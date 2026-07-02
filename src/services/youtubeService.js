const axios = require("axios");

const YT_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Dedicated YouTube Data API v3 service for the Viral Content Finder.
 * Fetches real trending videos and enriches them with statistics.
 */
class YouTubeService {
  /**
   * Runs a two-step fetch:
   *  1. search.list  – finds video IDs matching keyword
   *  2. videos.list  – fetches full statistics + contentDetails for each ID
   *
   * @param {string} keyword     - User search term  e.g. "fitness"
   * @param {string} regionCode  - ISO 3166-1 alpha-2  e.g. "IN"
   * @param {number} maxResults  - Max videos to return (1–50)
   * @returns {Array}  Enriched video objects sorted by viralScore desc
   */
  static async searchViralVideos({ keyword, regionCode = "IN", maxResults = 10, videoDuration }) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY is not configured in environment variables.");
    }

    // --- Step 1: Search for video IDs ---
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - 30);

    let videoIds = [];
    try {
      const searchRes = await axios.get(`${YT_BASE}/search`, {
        params: {
          part: "snippet",
          q: keyword,
          type: "video",
          order: "viewCount",
          regionCode,
          maxResults,
          publishedAfter: publishedAfter.toISOString(),
          key: apiKey,
          ...(videoDuration && { videoDuration }),
        },
        timeout: 15000,
      });

      const items = searchRes.data?.items || [];
      if (items.length === 0) {
        throw new Error(`No videos found on YouTube for keyword: "${keyword}"`);
      }
      videoIds = items.map((item) => item.id?.videoId).filter(Boolean);
    } catch (err) {
      // Re-throw YouTube quota or network errors with clear messages
      if (err.response?.data?.error) {
        const ytErr = err.response.data.error;
        throw new Error(`YouTube API error (${ytErr.code}): ${ytErr.message}`);
      }
      throw err;
    }

    if (videoIds.length === 0) {
      throw new Error(`No valid video IDs returned from YouTube search for: "${keyword}"`);
    }

    // --- Step 2: Fetch full statistics + content details ---
    let enrichedVideos = [];
    try {
      const statsRes = await axios.get(`${YT_BASE}/videos`, {
        params: {
          part: "snippet,statistics,contentDetails",
          id: videoIds.join(","),
          key: apiKey,
        },
        timeout: 15000,
      });

      const rawVideos = statsRes.data?.items || [];

      enrichedVideos = rawVideos.map((v) => {
        const snippet   = v.snippet            || {};
        const stats     = v.statistics         || {};
        const content   = v.contentDetails     || {};

        const viewCount    = parseInt(stats.viewCount    || "0", 10);
        const likeCount    = parseInt(stats.likeCount    || "0", 10);
        const commentCount = parseInt(stats.commentCount || "0", 10);

        // Viral score formula
        const viralScore = Math.round(
          viewCount * 0.5 + likeCount * 0.3 + commentCount * 0.2
        );

        // Engagement rate (avoid division by zero)
        const engagementRate =
          viewCount > 0
            ? parseFloat((((likeCount + commentCount) / viewCount) * 100).toFixed(2))
            : 0;

        return {
          videoId:        v.id,
          title:          snippet.title          || "Untitled",
          channelTitle:   snippet.channelTitle   || "Unknown Channel",
          description:    (snippet.description  || "").substring(0, 400),
          thumbnail:
            snippet.thumbnails?.maxres?.url ||
            snippet.thumbnails?.high?.url   ||
            snippet.thumbnails?.default?.url || "",
          publishedAt:    snippet.publishedAt    || "",
          videoUrl:       `https://www.youtube.com/watch?v=${v.id}`,
          duration:       this._parseDuration(content.duration || ""),
          durationSeconds: this._parseDurationToSeconds(content.duration || ""),
          viewCount,
          likeCount,
          commentCount,
          viralScore,
          engagementRate,
        };
      });

      // Sort by viralScore descending
      enrichedVideos.sort((a, b) => b.viralScore - a.viralScore);
    } catch (err) {
      if (err.response?.data?.error) {
        const ytErr = err.response.data.error;
        throw new Error(`YouTube statistics API error (${ytErr.code}): ${ytErr.message}`);
      }
      throw err;
    }

    return enrichedVideos;
  }

  /**
   * Converts ISO 8601 duration (PT4M13S) to a human-readable string (4m 13s).
   */
  static _parseDuration(iso) {
    if (!iso) return "N/A";
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return iso;
    const h = match[1] ? `${match[1]}h ` : "";
    const m = match[2] ? `${match[2]}m ` : "";
    const s = match[3] ? `${match[3]}s`  : "";
    return (h + m + s).trim() || "N/A";
  }

  /**
   * Converts ISO 8601 duration (PT4M13S) to total seconds.
   */
  static _parseDurationToSeconds(iso) {
    if (!iso) return 0;
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const h = parseInt(match[1] || "0", 10);
    const m = parseInt(match[2] || "0", 10);
    const s = parseInt(match[3] || "0", 10);
    return h * 3600 + m * 60 + s;
  }
}

module.exports = YouTubeService;
