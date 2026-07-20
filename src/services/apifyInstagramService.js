const axios = require("axios");

class ApifyInstagramService {
  /**
   * Look up a public Instagram profile and its top recent posts/reels using Apify Instagram Scraper.
   * @param {string} username - Instagram username or handle
   * @returns {Promise<Object>} Map of standard competitor details
   */
  static async lookupProfile(username) {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) {
      throw new Error("APIFY_TOKEN is not configured in environment variables.");
    }

    const cleanUsername = username.trim().replace(/\s+/g, "").replace(/^@/, "");
    console.log(`[Apify Instagram] Starting lookup for: @${cleanUsername}`);

    // Call apify/instagram-scraper actor
    // We use run-sync-get-dataset-items endpoint for a synchronous run
    const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
    
    const requestBody = {
      directUrls: [`https://www.instagram.com/${cleanUsername}/`],
      resultsType: "details",
      searchType: "hashtag",
      searchLimit: 1
    };

    const response = await axios.post(url, requestBody, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 90000 // Scrapes can take up to 90 seconds
    });

    const items = response.data;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`No data found on Instagram for "${cleanUsername}". Check if username is correct and public.`);
    }

    // The first item will contain the full profile details
    const profile = items[0];
    
    // Extract profile info
    const name = profile.fullName || profile.username || cleanUsername;
    const followersCount = profile.followersCount || 0;
    const postsCount = profile.postsCount || 0;
    const bio = profile.biography || "";
    const avatar = profile.profilePicUrlHD || profile.profilePicUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

    // Map top posts/reels from latestPosts
    const latestPosts = profile.latestPosts || [];
    const topVideos = latestPosts.map(item => {
      const viewCount = parseInt(item.videoViewCount || item.videoPlayCount || 0, 10);
      const likesCount = parseInt(item.likesCount || 0, 10);
      const commentsCount = parseInt(item.commentsCount || 0, 10);
      const isVideo = item.type === "Video" || item.type === "Sidecar" || !!item.videoUrl;

      // Extract shortcode
      const shortcode = item.shortCode || item.code || "";
      const link = shortcode ? `https://www.instagram.com/reel/${shortcode}/` : item.url || `https://www.instagram.com/p/${item.id}/`;

      return {
        id: item.id || String(Math.random()),
        title: item.caption ? item.caption.split("\n")[0].substring(0, 100) : "Instagram Post",
        thumbnail: item.displayUrl || item.thumbnailUrl || "",
        publishedAt: item.timestamp || new Date().toISOString(),
        views: isVideo ? (viewCount || likesCount * 8) : likesCount,
        likes: likesCount,
        comments: commentsCount,
        duration: isVideo ? "Reel" : "Post",
        link: link
      };
    });

    // Sort by views descending to show the highest performance content first
    topVideos.sort((a, b) => b.views - a.views);

    // Estimate total views
    const totalViews = topVideos.reduce((sum, v) => sum + parseInt(v.views || 0, 10), 0);

    return {
      name,
      handle: `@${cleanUsername}`,
      followersCount,
      postsCount,
      bio,
      avatar,
      totalViews,
      topVideos
    };
  }
}

module.exports = ApifyInstagramService;
