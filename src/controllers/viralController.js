const ViralContent = require("../models/ViralContent");
const SavedIdea = require("../models/SavedIdea");
const AIAnalysis = require("../models/AIAnalysis");
const AIService = require("../services/aiService");

const youtubeTrend = require("../services/youtubeTrendService");
const instagramTrend = require("../services/instagramTrendService");
const tiktokTrend = require("../services/tiktokTrendService");
const linkedInTrend = require("../services/linkedInTrendService");
const twitterTrend = require("../services/twitterTrendService");

const parseViews = (viewsStr) => {
  if (!viewsStr) return 0;
  let cleanStr = viewsStr.toString().toUpperCase().replace(/,/g, "").trim();
  if (cleanStr.includes("M")) {
    return parseFloat(cleanStr) * 1000000;
  }
  if (cleanStr.includes("K")) {
    return parseFloat(cleanStr) * 1000;
  }
  return parseFloat(cleanStr) || 0;
};

const getPlatformSearchUrl = (platform, q) => {
  const cleanQ = q || "viral";
  const lowerPlat = (platform || "Instagram").toLowerCase();
  if (lowerPlat.includes("youtube") || lowerPlat.includes("shorts")) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}`;
  }
  if (lowerPlat.includes("instagram") || lowerPlat.includes("reel")) {
    return `https://www.instagram.com/explore/tags/${encodeURIComponent(cleanQ.replace(/\s+/g, ""))}/`;
  }
  if (lowerPlat.includes("tiktok")) {
    return `https://www.tiktok.com/search?q=${encodeURIComponent(cleanQ)}`;
  }
  if (lowerPlat.includes("twitter") || lowerPlat.includes("x")) {
    return `https://twitter.com/search?q=${encodeURIComponent(cleanQ)}`;
  }
  if (lowerPlat.includes("linkedin")) {
    return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(cleanQ)}`;
  }
  return `https://google.com/search?q=${encodeURIComponent(cleanQ + " " + platform)}`;
};

/**
 * Searches trending content using AI or Platform specific mock systems, caching results in MongoDB
 */
const searchViralContent = async (req, res, next) => {
  try {
    const { keyword = "", q = "", niche = "", platform = "All", contentType = "All", timeRange = "7 Days", region = "India", minViews = "10k" } = req.query;
    const searchQuery = (q || keyword).trim() || "Growth";

    let candidates = [];
    const targetPlatform = platform === "All" ? "Instagram" : platform;
    
    // 1. Run the AI trend detector based on the user's exact search query!
    if (process.env.GEMINI_API_KEY) {
      try {
        const aiCandidates = await AIService.searchTrendingContent({
          q: searchQuery,
          niche: searchQuery,
          platform: targetPlatform,
          region,
          timeRange
        });
        if (aiCandidates && aiCandidates.length > 0) {
          candidates = aiCandidates;
        }
      } catch (aiErr) {
        console.error("[Search Controller] AI Trend Search failed:", aiErr.message);
      }
    }
    
    // 2. If AI fails, use platform-specific fallback mock
    if (candidates.length === 0) {
      const lowerPlatform = targetPlatform.toLowerCase();
      if (lowerPlatform.includes("youtube") || lowerPlatform.includes("short")) {
        candidates = await youtubeTrend.getTrending(searchQuery, searchQuery);
      } else if (lowerPlatform.includes("tiktok")) {
        candidates = await tiktokTrend.getTrending(searchQuery, searchQuery);
      } else if (lowerPlatform.includes("linkedin")) {
        candidates = await linkedInTrend.getTrending(searchQuery, searchQuery);
      } else if (lowerPlatform.includes("twitter") || lowerPlatform.includes("x")) {
        candidates = await twitterTrend.getTrending(searchQuery, searchQuery);
      } else {
        candidates = await instagramTrend.getTrending(searchQuery, searchQuery);
      }
    }

    // 3. Cache found candidates into Mongoose collection to allow deep diagnostics lookup
    const savedRecords = [];
    for (const item of candidates) {
      // Formulate active, accurate videoUrl if it's mock or empty
      let finalVideoUrl = item.videoUrl;
      let isMockYt = false;
      const lowerPlat = (item.platform || targetPlatform || "").toLowerCase();
      if (lowerPlat.includes("youtube") || lowerPlat.includes("shorts")) {
        if (finalVideoUrl) {
          let videoId = "";
          try {
            const urlObj = new URL(finalVideoUrl);
            if (urlObj.hostname.includes("youtube.com")) {
              if (urlObj.pathname.includes("/watch")) {
                videoId = urlObj.searchParams.get("v") || "";
              } else if (urlObj.pathname.includes("/shorts/")) {
                videoId = urlObj.pathname.split("/shorts/")[1]?.split("/")[0] || "";
              }
            } else if (urlObj.hostname.includes("youtu.be")) {
              videoId = urlObj.pathname.split("/")[1]?.split("?")[0] || "";
            }
          } catch (e) {}
          if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            isMockYt = true;
          }
        }
      }

      if (!finalVideoUrl || finalVideoUrl.includes("mock") || finalVideoUrl.includes("example") || finalVideoUrl.includes("yt_") || isMockYt) {
        finalVideoUrl = getPlatformSearchUrl(item.platform || targetPlatform, item.title || searchQuery);
      }

      // Avoid duplicate titles
      let existing = await ViralContent.findOne({ title: item.title });
      if (!existing) {
        existing = await ViralContent.create({
          title: item.title,
          niche: item.niche || niche || "Growth",
          creator: item.creator || "@creator",
          platform: item.platform || targetPlatform,
          viralScore: item.viralScore || 92,
          engagementLevel: item.engagementLevel || "High",
          views: item.views || "1.2M",
          likes: item.likes || "85K",
          comments: item.comments || "1.2K",
          engagementRate: item.engagementRate || "8.2%",
          postedTime: item.postedTime || "12 hours ago",
          thumbnail: item.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
          hook: item.hook || "Nobody talking about this...",
          whyViral: item.whyViral || "High curiosity hook split.",
          emotionalTrigger: item.emotionalTrigger || "Intense Intrigue",
          hookQuality: item.hookQuality || 92,
          retentionScore: item.retentionScore || 89,
          ctaScore: item.ctaScore || 85,
          psychology: item.psychology || "FOMO and immediate leverage.",
          retentionData: item.retentionData || [
            { name: "0s", value: 100 },
            { name: "3s", value: 92 },
            { name: "8s", value: 87 },
            { name: "15s", value: 80 },
            { name: "30s", value: 74 },
            { name: "60s", value: 65 }
          ],
          improvements: item.improvements || "Add higher contrast visual splits.",
          videoUrl: finalVideoUrl,
          shares: item.shares || "12K",
          saves: item.saves || "45K",
          followersCount: item.followersCount || "150K",
          caption: item.caption || `This is a highly viral breakdown of exactly how I achieved incredible results in ${niche || "Growth"}. Save this for later! 👇\n\n#${(niche || "growth").replace(/\s+/g,"")} #viral #explore`,
          hashtags: item.hashtags || ["#viral", "#explore", "#trending"],
          audioUsed: item.audioUsed || "Trending Audio - Original",
          language: item.language || "English",
          reelLength: item.reelLength || "15s",
          isVerified: item.isVerified !== undefined ? item.isVerified : true,
          audienceType: item.audienceType || "General Audience",
          bestTimeToPost: item.bestTimeToPost || "6:00 PM EST"
        });
      } else {
        // Update videoUrl if mock or missing
        if (!existing.videoUrl || existing.videoUrl.includes("mock") || existing.videoUrl.includes("example")) {
          existing.videoUrl = finalVideoUrl;
          await existing.save();
        }
      }
      savedRecords.push(existing);
    }

    // Determine min view requirement based on filters
    let minViewCount = 10000;
    const cleanMinViews = (minViews || "10k").toLowerCase();
    if (cleanMinViews === "50k") minViewCount = 50000;
    else if (cleanMinViews === "100k") minViewCount = 100000;
    else if (cleanMinViews.startsWith("1m")) minViewCount = 1000000;

    // Apply view threshold filtering
    let filtered = savedRecords.filter(item => {
      let viewCount = parseViews(item.views);
      return viewCount >= minViewCount;
    });

    if (contentType && contentType.toLowerCase() !== "all") {
      // Simulate content type match
    }

    res.json(filtered);
  } catch (err) {
    next(err);
  }
};

/**
 * Deep diagnostic analysis of post virality using AI service
 */
const analyzeViralContent = async (req, res, next) => {
  try {
    const { title, platform, hook, contentId } = req.body;
    if (!title || !platform) {
      return res.status(400).json({ message: "Content title and platform are required." });
    }

    // Call AI service for diagnostics
    const analysis = await AIService.analyzeContent({ title, platform, hook });

    // Save logs to MongoDB linked with current user
    const log = await AIAnalysis.create({
      userId: req.user.id,
      contentTitle: title,
      platform,
      whyItWentViral: analysis.whyItWentViral,
      emotionalTrigger: analysis.emotionalTrigger,
      retentionScore: analysis.retentionScore,
      hookQuality: analysis.hookQuality,
      ctaScore: analysis.ctaScore,
      audiencePsychology: analysis.audiencePsychology,
      viralProbability: analysis.viralProbability,
      topicRatingOutOf10: analysis.topicRatingOutOf10,
      suggestedImprovements: analysis.suggestedImprovements
    });

    res.json({
      ...analysis,
      logId: log._id
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate alternative hooks and scripts inspired by successful concept
 */
const generateSimilarContent = async (req, res, next) => {
  try {
    const { title, platform, niche, hook } = req.body;
    if (!title || !platform) {
      return res.status(400).json({ message: "Concept title and platform are required." });
    }

    const generation = await AIService.generateSimilar({ title, platform, niche, hook });
    res.json(generation);
  } catch (err) {
    next(err);
  }
};

/**
 * Saves content to user's custom collections
 */
const saveViralIdea = async (req, res, next) => {
  try {
    const { contentId, title, platform, niche, hook, caption, script, tags = [], collectionName = "General", notes = "" } = req.body;

    const savedRecord = await SavedIdea.create({
      userId: req.user.id,
      contentId: contentId || null,
      title,
      platform,
      niche,
      hook: hook || "",
      caption: caption || "",
      script: script || "",
      tags,
      collectionName,
      notes
    });

    res.status(201).json(savedRecord);
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves saved ideas for the logged-in user
 */
const getSavedIdeas = async (req, res, next) => {
  try {
    const ideas = await SavedIdea.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(ideas);
  } catch (err) {
    next(err);
  }
};

/**
 * Removes a saved idea
 */
const deleteSavedIdea = async (req, res, next) => {
  try {
    const item = await SavedIdea.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!item) {
      return res.status(404).json({ message: "Saved idea not found" });
    }
    res.json({ message: "Removed successfully from Content Planner" });
  } catch (err) {
    next(err);
  }
};

/**
 * Compiles compound niche growth stats, platform margins, and best schedules
 */
const getAnalytics = async (req, res, next) => {
  try {
    // Curated high-performing Recharts compatible dashboard arrays
    const trendingNiches = [
      { name: "Tech & AI", score: 98, growth: "+34.2%", color: "#8b5cf6" },
      { name: "FinanceSplit", score: 94, growth: "+21.4%", color: "#3b82f6" },
      { name: "Hybrid Fitness", score: 91, growth: "+18.9%", color: "#ec4899" },
      { name: "UGC Marketing", score: 88, growth: "+14.6%", color: "#10b981" },
      { name: "Creator Economy", score: 85, growth: "+12.1%", color: "#f59e0b" }
    ];

    const platformComparison = [
      { name: "Instagram Reels", reach: 410, engagement: 8.8, color: "#ec4899" },
      { name: "YouTube Shorts", reach: 520, engagement: 6.4, color: "#ef4444" },
      { name: "TikTok", reach: 680, engagement: 11.2, color: "#00f2fe" },
      { name: "LinkedIn Articles", reach: 180, engagement: 7.2, color: "#0077b5" },
      { name: "Twitter Threads", reach: 290, engagement: 9.5, color: "#ffffff" }
    ];

    const growthTimeline = [
      { name: "Mon", score: 84, growth: 12000 },
      { name: "Tue", score: 89, growth: 18000 },
      { name: "Wed", score: 95, growth: 31000 },
      { name: "Thu", score: 91, growth: 24000 },
      { name: "Fri", score: 96, growth: 42000 },
      { name: "Sat", score: 98, growth: 58000 },
      { name: "Sun", score: 99, growth: 72000 }
    ];

    const postingSchedules = [
      { platform: "Instagram", bestTime: "6:30 PM EST", er: "9.2%", difficulty: "Medium" },
      { platform: "YouTube", bestTime: "11:00 AM EST", er: "7.1%", difficulty: "High" },
      { platform: "TikTok", bestTime: "8:00 PM EST", er: "12.4%", difficulty: "Low" },
      { platform: "LinkedIn", bestTime: "8:30 AM EST", er: "6.8%", difficulty: "Medium" },
      { platform: "Twitter/X", bestTime: "12:00 PM EST", er: "9.8%", difficulty: "Low" }
    ];

    res.json({
      trendingNiches,
      platformComparison,
      growthTimeline,
      postingSchedules
    });
  } catch (err) {
    next(err);
  }
};

const getTrendingNiches = async (req, res, next) => {
  try {
    res.json([
      { name: "AI Automation", growth: "+45%", trend: "up" },
      { name: "Faceless Channels", growth: "+32%", trend: "up" },
      { name: "Finance Hacks", growth: "+21%", trend: "up" },
      { name: "Short Form Editing", growth: "+18%", trend: "up" }
    ]);
  } catch (err) {
    next(err);
  }
};

const getTrendingHashtags = async (req, res, next) => {
  try {
    res.json([
      { name: "#aitools", growth: "+120%", count: "4.2M" },
      { name: "#passiveincome", growth: "+80%", count: "12M" },
      { name: "#chatgpthacks", growth: "+65%", count: "1.8M" },
      { name: "#creatoreconomy", growth: "+40%", count: "3.1M" }
    ]);
  } catch (err) {
    next(err);
  }
};

const getTrendingAudio = async (req, res, next) => {
  try {
    res.json([
      { name: "Sigma Grindset Original", creator: "Phonk Music", growth: "+200%" },
      { name: "Suspense Build Up", creator: "AudioLibrary", growth: "+150%" },
      { name: "Cinematic Whoosh", creator: "EffectsMaster", growth: "+85%" },
      { name: "Lofi Chill Beat", creator: "StudyBeats", growth: "+60%" }
    ]);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchViralContent,
  analyzeViralContent,
  generateSimilarContent,
  saveViralIdea,
  getSavedIdeas,
  deleteSavedIdea,
  getAnalytics,
  getTrendingNiches,
  getTrendingHashtags,
  getTrendingAudio
};
