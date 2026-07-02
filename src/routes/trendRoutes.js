const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  safeSearch,
  generateIdea,
  getHistory
} = require("../controllers/trendController");

const router = express.Router();

// Route to perform safe trends search
router.post("/safe-search", protect, safeSearch);

// Route to generate AI idea from a trend item
router.post("/generate-idea", protect, generateIdea);

// Route to get previously searched trend items
router.get("/history", protect, getHistory);

module.exports = router;
