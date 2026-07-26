const axios = require("axios");

const cleanInt = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return Math.round(val);
  const cleanStr = String(val).replace(/,/g, "").trim();
  
  if (cleanStr.toUpperCase().endsWith("M")) {
    return Math.round(parseFloat(cleanStr) * 1e6);
  }
  if (cleanStr.toUpperCase().endsWith("K")) {
    return Math.round(parseFloat(cleanStr) * 1e3);
  }
  return parseInt(cleanStr, 10) || 0;
};

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
    const followersCount = cleanInt(profile.followersCount);
    const postsCount = cleanInt(profile.postsCount);
    const bio = profile.biography || "";
    const avatar = profile.profilePicUrlHD || profile.profilePicUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";

    // Map top posts/reels from latestPosts
    const latestPosts = profile.latestPosts || [];
    const topVideos = latestPosts.map(item => {
      const viewCount = cleanInt(item.videoViewCount || item.videoPlayCount || item.playCount || item.viewCount);
      const likesCount = cleanInt(item.likesCount || item.likeCount);
      const commentsCount = cleanInt(item.commentsCount || item.commentCount);
      const isVideo = item.type === "Video" || item.type === "Reel" || !!item.videoUrl;

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
        link: link,
        videoUrl: item.videoUrl || ""
      };
    });

    // Sort by views descending to show the highest performance content first
    topVideos.sort((a, b) => b.views - a.views);

    // Estimate total views
    const totalViews = topVideos.reduce((sum, v) => sum + cleanInt(v.views), 0);

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

  /**
   * Look up details of a single public Instagram post/reel using Apify.
   * @param {string} url - Direct Instagram Reel/post URL
   * @returns {Promise<Object>} Map of reel details
   */
  static async lookupPost(url) {
    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) {
      throw new Error("APIFY_TOKEN is not configured in environment variables.");
    }
    
    console.log(`[Apify Instagram] Starting lookup for post: ${url}`);
    const apifyUrl = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
    
    const requestBody = {
      directUrls: [url],
      resultsType: "details",
      searchLimit: 1
    };

    const response = await axios.post(apifyUrl, requestBody, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 90000
    });

    const items = response.data;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No data found for this Instagram URL.");
    }

    const post = items[0];
    const likesCount = cleanInt(post.likesCount || post.likeCount);
    const commentsCount = cleanInt(post.commentsCount || post.commentCount);
    const viewCount = cleanInt(post.videoViewCount || post.videoPlayCount || post.playCount || post.viewCount);
    const caption = post.caption || "";
    const videoUrl = post.videoUrl || "";
    const displayUrl = post.displayUrl || "";
    const duration = post.videoDuration || 30;
    const ownerName = post.ownerFullName || post.ownerUsername || "";

    return {
      title: caption.split("\n")[0].substring(0, 100) || "Instagram Reel",
      views: viewCount || likesCount * 8, // estimate if 0
      likes: likesCount,
      comments: commentsCount,
      duration: Math.round(duration) || 30,
      videoUrl,
      thumbnail: displayUrl,
      creator: ownerName
    };
  }
}

module.exports = ApifyInstagramService;
