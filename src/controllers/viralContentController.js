const YouTubeService           = require("../services/youtubeService");
const GeminiViralService       = require("../services/geminiViralService");
const ViralContentSearch       = require("../models/ViralContentSearch");

/**
 * POST /api/viral-content/find
 * Protected — requires JWT via authMiddleware.
 *
 * Body: { keyword, regionCode?, maxResults?, platform? }
 * platform: "youtube" (default) | "instagram" | "facebook"
 *
 * Flow:
 *  1. Validate input
 *  2. Route to platform-specific fetch logic
 *  3. Send top results to Gemini for AI analysis (YouTube) or use Gemini-generated content (IG/FB)
 *  4. Persist search to MongoDB
 *  5. Return combined result
 */
const findViralContent = async (req, res) => {
  try {
    const { keyword, regionCode = "IN", maxResults = 10, platform = "youtube" } = req.body;

    // --- 1. Input validation ---
    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "keyword is required and must be a non-empty string.",
      });
    }

    const cleanKeyword = keyword.trim();
    const safeMax      = Math.min(Math.max(parseInt(maxResults, 10) || 10, 1), 25);
    const userId       = req.user?.id || req.user?._id;
    const cleanPlatform = (platform || "youtube").toLowerCase().trim();

    if (cleanPlatform === "instagram") {
      return res.status(400).json({
        success: false,
        message: "Instagram is no longer supported in Viral Content Finder.",
      });
    }

    console.log(`[ViralContent] User ${userId} searching: "${cleanKeyword}" | platform: ${cleanPlatform} | region: ${regionCode} | max: ${safeMax}`);

    // --- 2. Platform-based routing ---
    if (cleanPlatform === "facebook") {
      let videos = [];
      let aiAnalysis = null;

      // ── FALLBACK 3: Gemini AI-generated content (if all APIs fail) ──
      if (videos.length === 0) {
        console.log(`[ViralContent] [Gemini] All real APIs failed. Generating AI-powered ${cleanPlatform} content for "${cleanKeyword}"...`);
        try {
          const platformData = await GeminiViralService.generatePlatformViralContent(
            cleanKeyword,
            cleanPlatform,
            regionCode,
            safeMax
          );
          videos = platformData.videos || [];
          aiAnalysis = platformData.aiAnalysis || null;
          if (videos.length > 0) {
            videos.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0));
          }
          console.log(`[ViralContent] [Gemini] Generated ${videos.length} ${cleanPlatform} results.`);
        } catch (err) {
          console.error(`[ViralContent] [Gemini] Content generation failed:`, err.message);
          return res.status(502).json({
            success: false,
            message: `Could not find Facebook content for "${cleanKeyword}". Please try a different keyword.`,
            error: err.message,
          });
        }
      } else {
        // Sort by viewCount descending
        videos.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0));
        if (videos.length > safeMax) {
          videos = videos.slice(0, safeMax);
        }
      }

      if (videos.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No content found for "${cleanKeyword}" on ${cleanPlatform}. Try a different keyword.`,
        });
      }

      // Save to MongoDB
      let savedSearch = null;
      try {
        savedSearch = await ViralContentSearch.create({
          userId,
          keyword: cleanKeyword,
          regionCode,
          platform: cleanPlatform,
          videos,
          aiAnalysis,
        });
      } catch (dbErr) {
        console.error("[ViralContent] MongoDB save failed:", dbErr.message);
      }

      return res.status(200).json({
        success: true,
        searchId: savedSearch?._id || null,
        keyword: cleanKeyword,
        platform: cleanPlatform,
        regionCode,
        totalFound: videos.length,
        videos,
        aiAnalysis,
      });
    }

    // --- YouTube flow (default) ---
    let videos;
    try {
      videos = await YouTubeService.searchViralVideos({
        keyword: cleanKeyword,
        regionCode,
        maxResults: safeMax,
      });
      // Sort by viewCount descending (highest views first)
      if (videos && videos.length > 0) {
        videos.sort((a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0));
      }
    } catch (ytErr) {
      console.error("[ViralContent] YouTube fetch failed:", ytErr.message);
      return res.status(502).json({
        success: false,
        message: `YouTube API error: ${ytErr.message}`,
        source: "youtube",
      });
    }

    if (!videos || videos.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No videos found on YouTube for keyword: "${cleanKeyword}". Try a different keyword.`,
      });
    }

    // --- 3. Gemini AI analysis ---
    let aiAnalysis = null;
    try {
      aiAnalysis = await GeminiViralService.analyzeViralVideos(cleanKeyword, videos);
    } catch (aiErr) {
      // Non-fatal: still return videos even if Gemini fails
      console.error("[ViralContent] Gemini analysis failed:", aiErr.message);
      aiAnalysis = null;
    }

    // --- 4. Save to MongoDB ---
    let savedSearch = null;
    try {
      savedSearch = await ViralContentSearch.create({
        userId,
        keyword:    cleanKeyword,
        regionCode,
        platform:   "youtube",
        videos,
        aiAnalysis,
      });
    } catch (dbErr) {
      // Non-fatal: return data even if DB save fails
      console.error("[ViralContent] MongoDB save failed:", dbErr.message);
    }

    // --- 5. Respond ---
    return res.status(200).json({
      success:    true,
      searchId:   savedSearch?._id || null,
      keyword:    cleanKeyword,
      platform:   "youtube",
      regionCode,
      totalFound: videos.length,
      videos,
      aiAnalysis,
    });
  } catch (err) {
    console.error("[ViralContent] Unexpected error in findViralContent:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again.",
      error:   process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * GET /api/viral-content/history
 * Protected — returns the logged-in user's previous searches (newest first).
 * Query params: ?limit=10&page=1
 */
const getSearchHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const limit  = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const page   = Math.max(parseInt(req.query.page,  10) || 1,  1);
    const skip   = (page - 1) * limit;

    const [searches, total] = await Promise.all([
      ViralContentSearch.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-videos.description") // omit heavy description field from list
        .lean(),
      ViralContentSearch.countDocuments({ userId }),
    ]);

    return res.status(200).json({
      success:    true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searches,
    });
  } catch (err) {
    console.error("[ViralContent] getSearchHistory error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch search history.",
      error:   process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * GET /api/viral-content/history/:id
 * Protected — returns a single past search in full detail.
 */
const getSearchById = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    const search = await ViralContentSearch.findOne({ _id: id, userId }).lean();

    if (!search) {
      return res.status(404).json({
        success: false,
        message: "Search record not found or access denied.",
      });
    }

    return res.status(200).json({ success: true, search });
  } catch (err) {
    console.error("[ViralContent] getSearchById error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch search record.",
      error:   process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * POST /api/viral-content/refine
 * Protected — requires JWT via authMiddleware.
 *
 * Body: { videoId, title, description, platform, channelTitle }
 *
 * Calls GeminiViralService to suggest refined script, caption, and hashtags.
 */
const refineVideoContent = async (req, res) => {
  try {
    const { videoId, title, description, platform, channelTitle, targetLanguage } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required for content refinement.",
      });
    }

    const cleanPlatform = (platform || "youtube").toLowerCase().trim();

    console.log(`[ViralContent] User ${req.user?.id || req.user?._id} refining: "${title}" | platform: ${cleanPlatform} | targetLanguage: ${targetLanguage}`);

    const refined = await GeminiViralService.refineVideoContent({
      title,
      description,
      platform: cleanPlatform,
      channelTitle,
      targetLanguage,
    });

    return res.status(200).json({
      success: true,
      refined,
    });
  } catch (err) {
    console.error("[ViralContent] Error in refineVideoContent:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to refine content. Please try again.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

module.exports = { findViralContent, getSearchHistory, getSearchById, refineVideoContent };

