const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  dashboardStats,
  generateScript,
  analyzeVideoScript,
  generateScriptQuestions,
  enhancePrompt,
  enhanceScript,
  generateCaption,
  analyzeMediaCaption,
  createAutomationRule,
  getAutomationRules,
  updateAutomationRule,
  deleteAutomationRule,
  getBrandDeals,
  suggestBrandDeals,
  createBrandDeal,
  applyBrandDeal,
  getBrandDealApplications,
  updateBrandDealApplicationStatus,
  listCommunityPosts,
  createCommunityPost,
  likePost,
  addComment,
  listCalendarItems,
  addCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
  analytics,
  academy,
  toolsMarketplace,
  facelessIdeas,
  collabAgreement,
  reports,
  reportsHeartbeat,
  listNotifications,
  createNotification,
  linkInBioPreview,
  platformMetrics,
} = require("../controllers/featureController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Multer setup for video uploads (stored as temp files, deleted after analysis)
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const videoUpload = multer({
  dest: uploadDir,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files are allowed."));
  },
});

const mediaUpload = multer({
  dest: uploadDir,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only video and image files are allowed."));
  },
});

router.get("/dashboard/stats", protect, dashboardStats);
router.post("/ai/script", protect, generateScript);
router.post("/ai/script/questions", protect, generateScriptQuestions);
router.post("/ai/script/analyze-video", protect, videoUpload.single("video"), analyzeVideoScript);
router.post("/ai/script/enhance", protect, enhanceScript);
router.post("/ai/prompt/enhance", protect, enhancePrompt);
router.post("/ai/caption", protect, generateCaption);
router.post("/ai/caption/analyze-media", protect, mediaUpload.single("media"), analyzeMediaCaption);
router.get("/automation", protect, getAutomationRules);
router.post("/automation", protect, createAutomationRule);
router.put("/automation/:id", protect, updateAutomationRule);
router.delete("/automation/:id", protect, deleteAutomationRule);
router.get("/brand-deals", protect, getBrandDeals);
router.post("/brand-deals", protect, createBrandDeal);
router.get("/brand-deals/suggest", protect, suggestBrandDeals);
router.post("/brand-deals/apply", protect, applyBrandDeal);
router.get("/brand-deals/applications", protect, getBrandDealApplications);
router.put("/brand-deals/applications/:id/status", protect, updateBrandDealApplicationStatus);
router.get("/community/posts", protect, listCommunityPosts);
router.post("/community/posts", protect, createCommunityPost);
router.post("/community/posts/:id/like", protect, likePost);
router.post("/community/posts/:id/comment", protect, addComment);
router.get("/calendar", protect, listCalendarItems);
router.post("/calendar", protect, addCalendarItem);
router.put("/calendar/:id", protect, updateCalendarItem);
router.delete("/calendar/:id", protect, deleteCalendarItem);
router.get("/analytics", protect, analytics);
router.get("/academy", protect, academy);
router.get("/tools-marketplace", protect, toolsMarketplace);
router.get("/faceless-ideas", protect, facelessIdeas);
router.post("/collab-agreement", protect, collabAgreement);
router.get("/reports", protect, reports);
router.post("/reports/heartbeat", protect, reportsHeartbeat);
router.get("/notifications", protect, listNotifications);
router.post("/notifications", protect, createNotification);
router.post("/link-in-bio/preview", protect, linkInBioPreview);
router.get("/platform-metrics", protect, platformMetrics);

module.exports = router;
