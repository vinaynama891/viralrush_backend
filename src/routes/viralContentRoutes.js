const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  findViralContent,
  getSearchHistory,
  getSearchById,
  refineVideoContent,
} = require("../controllers/viralContentController");

const router = express.Router();

/**
 * POST /api/viral-content/find
 * Fetch viral YouTube videos + Gemini AI analysis for a given keyword.
 * Body: { keyword, regionCode?, maxResults? }
 */
router.post("/find", protect, findViralContent);

/**
 * POST /api/viral-content/refine
 * Refine a specific video/post with Gemini AI analysis to suggest a script, caption, and hashtags.
 */
router.post("/refine", protect, refineVideoContent);

/**
 * GET /api/viral-content/history
 * Paginated search history for the logged-in user.
 * Query: ?limit=10&page=1
 */
router.get("/history", protect, getSearchHistory);

/**
 * GET /api/viral-content/history/:id
 * Full detail for a single past search.
 */
router.get("/history/:id", protect, getSearchById);

module.exports = router;
