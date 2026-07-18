const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { analyzeReel } = require("../controllers/instagramAnalyzerController");

const router = express.Router();

router.post("/analyze", protect, analyzeReel);

module.exports = router;
