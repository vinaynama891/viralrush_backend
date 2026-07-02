const TrendItem = require("../models/TrendItem");
const GeneratedIdea = require("../models/GeneratedIdea");
const RedditTrendService = require("../services/redditTrendService");
const GoogleTrendService = require("../services/googleTrendService");
const InstagramSafeSignalService = require("../services/instagramSafeSignalService");
const AITrendGeneratorService = require("../services/aiTrendGeneratorService");

/**
 * POST /api/trends/safe-search
 * Searches trends across safe platforms (Reddit, Google Daily/News RSS, allowed Instagram data)
 */
const safeSearch = async (req, res) => {
  try {
    const { niche, platforms, country } = req.body;
    
    if (!niche) {
      return res.status(400).json({ message: "Niche/keyword is required" });
    }
    
    const selectedPlatforms = platforms || ["reddit", "google"];
    const searchCountry = country || "IN";
    
    let fetchedItems = [];
    let instagramWarning = null;
    
    // Process each selected platform
    for (const platform of selectedPlatforms) {
      const cleanPlatform = platform.toLowerCase();
      
      if (cleanPlatform === "reddit") {
        const redditItems = await RedditTrendService.fetchTrending(niche);
        fetchedItems.push(...redditItems);
      } else if (cleanPlatform === "google") {
        const googleItems = await GoogleTrendService.fetchTrending(niche, searchCountry);
        fetchedItems.push(...googleItems);
      } else if (cleanPlatform === "instagram") {
        const igSignals = await InstagramSafeSignalService.fetchSignals(req.user.id, niche);
        if (igSignals.items && igSignals.items.length > 0) {
          fetchedItems.push(...igSignals.items);
        }
        if (igSignals.message) {
          instagramWarning = igSignals.message;
        }
      }
    }
    
    // Save/Upsert trend items to MongoDB to persist them in search history
    const savedItems = [];
    for (const item of fetchedItems) {
      try {
        const query = {
          platform: item.platform,
          niche: item.niche,
          title: item.title
        };
        // If sourceUrl exists, use it to ensure uniqueness
        if (item.sourceUrl) {
          query.sourceUrl = item.sourceUrl;
        }
        
        const saved = await TrendItem.findOneAndUpdate(
          query,
          {
            ...item,
            fetchedAt: new Date()
          },
          { upsert: true, new: true }
        );
        savedItems.push(saved);
      } catch (dbErr) {
        console.error("[Trend Controller] Error upserting trend item:", dbErr.message);
        // Fallback to push raw item if DB write fails, to not break client search
        savedItems.push(item);
      }
    }
    
    // Sort items by viralScore or by Instagram engagement descending, and limit to top 15
    const isOnlyInstagram = selectedPlatforms.length === 1 && selectedPlatforms.includes("instagram");
    let sortedTrends;
    if (isOnlyInstagram) {
      sortedTrends = savedItems.sort((a, b) => {
        const aEng = (a.metrics?.likes || 0) + (a.metrics?.comments || 0);
        const bEng = (b.metrics?.likes || 0) + (b.metrics?.comments || 0);
        return bEng - aEng;
      });
    } else {
      sortedTrends = savedItems.sort((a, b) => b.viralScore - a.viralScore);
    }
    const top15Trends = sortedTrends.slice(0, 15);
    
    res.json({
      success: true,
      trends: top15Trends,
      instagramWarning: instagramWarning
    });
  } catch (error) {
    console.error("[Trend Controller] safeSearch error:", error);
    res.status(500).json({ message: "Failed to search trending content safely." });
  }
};

/**
 * POST /api/trends/generate-idea
 * Converts a specific trend item into a short-form content idea using Gemini
 */
const generateIdea = async (req, res) => {
  try {
    const { trendItemId, targetPlatform } = req.body;
    
    if (!trendItemId) {
      return res.status(400).json({ message: "trendItemId is required" });
    }
    
    const trendItem = await TrendItem.findById(trendItemId);
    if (!trendItem) {
      return res.status(404).json({ message: "Trend item not found" });
    }
    
    const platformSuggestion = targetPlatform || "instagram";
    
    // Generate content idea using AI service
    const aiResponse = await AITrendGeneratorService.generateIdea(trendItem, platformSuggestion);
    
    // Save generated idea in database
    const newIdea = await GeneratedIdea.create({
      userId: req.user.id,
      trendItemId: trendItem._id,
      niche: trendItem.niche,
      platformSuggestion: platformSuggestion,
      hook: aiResponse.hook,
      script: aiResponse.script,
      caption: aiResponse.caption,
      hashtags: aiResponse.hashtags || [],
      contentAngle: aiResponse.contentAngle || "",
      targetAudience: aiResponse.targetAudience || "",
      viralReason: aiResponse.viralReason || "",
      videoFormat: aiResponse.videoFormat || ""
    });
    
    res.status(201).json({
      success: true,
      idea: newIdea
    });
  } catch (error) {
    console.error("[Trend Controller] generateIdea error:", error);
    res.status(500).json({ message: "Failed to generate AI content idea." });
  }
};

/**
 * GET /api/trends/history
 * Returns recently searched trend items
 */
const getHistory = async (req, res) => {
  try {
    // Fetch last 30 searched trend items sorted by fetchedAt desc
    const history = await TrendItem.find()
      .sort({ fetchedAt: -1 })
      .limit(30);
      
    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error("[Trend Controller] getHistory error:", error);
    res.status(500).json({ message: "Failed to fetch search history." });
  }
};

module.exports = {
  safeSearch,
  generateIdea,
  getHistory
};
