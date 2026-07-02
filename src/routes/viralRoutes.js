const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
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
} = require("../controllers/viralController");

const router = express.Router();

router.get("/search", protect, searchViralContent);
router.post("/analyze", protect, analyzeViralContent);
router.post("/generate", protect, generateSimilarContent);
router.post("/save", protect, saveViralIdea);
router.get("/save", protect, getSavedIdeas);
router.delete("/save/:id", protect, deleteSavedIdea);
router.get("/analytics", protect, getAnalytics);

// New Dashboard Insight Endpoints
router.get("/trending", protect, getTrendingNiches);
router.get("/hashtags", protect, getTrendingHashtags);
router.get("/audio", protect, getTrendingAudio);

module.exports = router;
