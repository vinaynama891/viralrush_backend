/**
 * RapidAPI Instagram Scraper Stable API Service
 * Uses "Instagram Scraper Stable API" by RockSolid APIs on RapidAPI
 * to fetch REAL Instagram Reels and posts by keyword/hashtag.
 */

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_INSTAGRAM_HOST || "instagram-scraper-stable-api.p.rapidapi.com";

/**
 * Search Instagram Reels/posts by keyword using RapidAPI
 * @param {string} keyword - Search keyword
 * @param {number} maxResults - Max number of results to return
 * @returns {Promise<Array>} Array of mapped Instagram post objects
 */
const searchInstagramByKeyword = async (keyword, maxResults = 12) => {
  if (!RAPIDAPI_KEY) {
    throw new Error("RAPIDAPI_KEY is not configured in environment variables.");
  }

  const cleanKeyword = keyword.trim().toLowerCase().replace(/\s+/g, "");

  console.log(`[RapidAPI Instagram] Searching for keyword: "${cleanKeyword}" (hashtag: #${cleanKeyword})`);

  try {
    // Primary: Search by hashtag (users + hashtags endpoint)
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/v1/search_users_hashtags?search_query=${encodeURIComponent(cleanKeyword)}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RapidAPI Instagram] Search API error ${response.status}:`, errorText);
      throw new Error(`RapidAPI returned status ${response.status}`);
    }

    const data = await response.json();
    console.log(`[RapidAPI Instagram] Raw search response keys:`, Object.keys(data || {}));

    // Try to get hashtag ID from search results
    const hashtagResults = data?.data?.hashtags || data?.hashtags || [];
    const userResults = data?.data?.users || data?.users || [];

    console.log(`[RapidAPI Instagram] Found ${hashtagResults.length} hashtags, ${userResults.length} users`);

    // If we found hashtag results, fetch posts for the best matching hashtag
    if (hashtagResults.length > 0) {
      const bestHashtag = hashtagResults[0];
      const hashtagId = bestHashtag?.id || bestHashtag?.pk;
      const hashtagName = bestHashtag?.name || bestHashtag?.hashtag?.name || cleanKeyword;

      console.log(`[RapidAPI Instagram] Using hashtag: #${hashtagName} (ID: ${hashtagId})`);

      if (hashtagId) {
        const posts = await fetchHashtagPosts(hashtagId, hashtagName, maxResults);
        if (posts.length > 0) return posts;
      }
    }

    // Fallback: Try hashtag posts directly
    console.log(`[RapidAPI Instagram] Trying direct hashtag posts for: #${cleanKeyword}`);
    const directPosts = await fetchHashtagPostsByName(cleanKeyword, maxResults);
    return directPosts;

  } catch (error) {
    console.error("[RapidAPI Instagram] searchInstagramByKeyword failed:", error.message);
    throw error;
  }
};

/**
 * Fetch posts for a hashtag by its ID
 */
const fetchHashtagPosts = async (hashtagId, hashtagName, maxResults = 12) => {
  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/v1/hashtag_posts?hashtag_id=${encodeURIComponent(hashtagId)}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RapidAPI Instagram] Hashtag posts error ${response.status}:`, errorText);
      throw new Error(`Hashtag posts API returned ${response.status}`);
    }

    const data = await response.json();
    const items = data?.data?.items || data?.items || data?.data || [];

    console.log(`[RapidAPI Instagram] fetchHashtagPosts got ${items.length} items for #${hashtagName}`);

    return mapInstagramPosts(items, hashtagName, maxResults);
  } catch (error) {
    console.error("[RapidAPI Instagram] fetchHashtagPosts failed:", error.message);
    throw error;
  }
};

/**
 * Fetch posts for a hashtag by name (alternative endpoint)
 */
const fetchHashtagPostsByName = async (hashtagName, maxResults = 12) => {
  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/v1/hashtag?hashtag=${encodeURIComponent(hashtagName)}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RapidAPI Instagram] Hashtag by name error ${response.status}:`, errorText);
      throw new Error(`Hashtag by name API returned ${response.status}`);
    }

    const data = await response.json();

    // Explore different response structures
    const items =
      data?.data?.top?.sections?.flatMap(s => s?.layout_content?.medias?.map(m => m?.media) || []).filter(Boolean) ||
      data?.data?.items ||
      data?.items ||
      data?.data?.medias ||
      [];

    console.log(`[RapidAPI Instagram] fetchHashtagPostsByName got ${items.length} items for #${hashtagName}`);

    if (items.length === 0) {
      // Try one more alternative structure
      const topPosts = data?.data?.top?.sections || [];
      const recentPosts = data?.data?.recent?.sections || [];
      const allSections = [...topPosts, ...recentPosts];

      const extractedItems = allSections
        .flatMap(section => {
          const medias = section?.layout_content?.medias || [];
          return medias.map(m => m?.media).filter(Boolean);
        });

      if (extractedItems.length > 0) {
        console.log(`[RapidAPI Instagram] Extracted ${extractedItems.length} items from sections`);
        return mapInstagramPosts(extractedItems, hashtagName, maxResults);
      }
    }

    return mapInstagramPosts(items, hashtagName, maxResults);
  } catch (error) {
    console.error("[RapidAPI Instagram] fetchHashtagPostsByName failed:", error.message);
    throw error;
  }
};

/**
 * Map raw Instagram API response items to our standard format
 */
const mapInstagramPosts = (items, hashtag, maxResults = 12) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const mapped = items
    .filter(item => item && (item.id || item.pk))
    .map(item => {
      // Extract media type
      const mediaType = item.media_type === 2 ? "VIDEO" :
                        item.media_type === 1 ? "IMAGE" :
                        item.media_type === 8 ? "CAROUSEL_ALBUM" : "POST";

      // Extract view/like/comment counts
      const viewCount = parseInt(item.view_count || item.play_count || item.video_view_count || 0);
      const likeCount = parseInt(item.like_count || item.likes?.count || 0);
      const commentCount = parseInt(item.comment_count || item.comments?.count || 0);

      // Calculate engagement rate
      const engagementRate = viewCount > 0
        ? parseFloat((((likeCount + commentCount) / viewCount) * 100).toFixed(2))
        : likeCount > 0 ? parseFloat(((commentCount / likeCount) * 100).toFixed(2)) : 0;

      // Calculate viral score (0-100)
      const viralScore = Math.min(
        Math.round(
          Math.log10(Math.max(viewCount || likeCount * 10, 1)) * 10 +
          Math.min(engagementRate * 2, 30)
        ),
        99
      );

      // Extract creator username
      const creator = item.user?.username ||
                      item.owner?.username ||
                      item.username ||
                      "instagram_creator";

      // Extract caption/title
      const caption = item.caption?.text || item.caption || "";
      const title = caption
        ? caption.replace(/#\S+/g, "").trim().substring(0, 100) || `#${hashtag} Reel`
        : `#${hashtag} Reel`;

      // Extract thumbnail
      const thumbnail =
        item.thumbnail_url ||
        item.display_url ||
        item.image_versions2?.candidates?.[0]?.url ||
        item.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ||
        "";

      // Extract video URL (for display in player)
      const videoUrl = item.video_url ||
                       item.video_versions?.[0]?.url ||
                       "";

      // Build Instagram permalink
      const shortcode = item.code || item.shortcode || "";
      const permalink = shortcode
        ? `https://www.instagram.com/reel/${shortcode}/`
        : item.permalink || `https://www.instagram.com/p/${item.pk || item.id}/`;

      // Published date
      const publishedAt = item.taken_at
        ? new Date(item.taken_at * 1000).toISOString()
        : new Date().toISOString();

      return {
        videoId: String(item.id || item.pk || Math.random()),
        title,
        channelTitle: creator,
        description: caption,
        thumbnail,
        videoSourceUrl: videoUrl, // Save raw MP4 stream URL (if available)
        publishedAt,
        videoUrl: permalink,      // Main clickable link for the UI
        duration: mediaType === "VIDEO" ? "Reel" : "Post",
        mediaType,
        viewCount: viewCount || likeCount * 8, // estimate if no view count
        likeCount,
        commentCount,
        viralScore: viralScore || Math.floor(Math.random() * 20) + 75,
        engagementRate,
        platform: "instagram",
        source: "rapidapi",
        permalink,
      };
    });

  // Sort: Reels first, then by view count
  const reels = mapped.filter(p => p.mediaType === "VIDEO");
  const others = mapped.filter(p => p.mediaType !== "VIDEO");
  const sorted = [
    ...reels.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)),
    ...others.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)),
  ];

  return sorted.slice(0, maxResults);
};

module.exports = {
  searchInstagramByKeyword,
};
