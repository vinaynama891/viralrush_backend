const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/authMiddleware");
const {
  getAuthUrl,
  handleCallback,
  getProfile,
  getAnalytics,
  getMedia,
  publishPost,
  schedulePost,
  getScheduledPosts,
  deleteScheduledPost,
  disconnectInstagram,
  getConversations,
  getConversationMessages,
  sendConversationReply,
  getDMInbox,
  sendDMMessage,
  getPostComments,
  proxyInstagramImage,
  connectInstagram,
  getSafeSignals,
  lookupCompetitor
} = require("../controllers/instagramController");

// Multer for Instagram post uploads — keep files with original extension
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const igUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || (file.mimetype.startsWith("video") ? ".mp4" : ".jpg");
      cb(null, `ig_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = file.mimetype.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    const isVideo = file.mimetype.startsWith("video/") || [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext);
    if (isImage || isVideo) cb(null, true);
    else cb(new Error("Only image and video files are allowed."));
  }
});

const router = express.Router();

// Route to initiate Instagram OAuth
router.get("/auth", protect, getAuthUrl);

// Callback route where Meta redirects back. It doesn't contain user auth header,
// because Meta triggers a full page GET redirect.
router.get("/callback", handleCallback);

// Route to proxy Instagram/Facebook images to avoid CORS and hotlink blocks
router.get("/proxy-image", proxyInstagramImage);

// Public competitor profile lookup (no auth required)
router.get("/lookup-competitor", lookupCompetitor);

// Profile and analytics routes
router.get("/profile", protect, getProfile);
router.get("/analytics", protect, getAnalytics);
router.get("/media", protect, getMedia);
router.get("/media/:mediaId/comments", protect, getPostComments);

// Publish a new post directly to Instagram
router.post("/publish", protect, igUpload.single("file"), publishPost);

// ── Scheduled Posts ────────────────────────────────────────────────────────
// Schedule a post/reel for future publishing
router.post("/schedule", protect, igUpload.single("file"), schedulePost);
// Get all scheduled posts for the current user
router.get("/scheduled", protect, getScheduledPosts);
// Cancel / delete a pending scheduled post
router.delete("/scheduled/:id", protect, deleteScheduledPost);

// Disconnect route
router.post("/disconnect", protect, disconnectInstagram);

// Safe trend signals and official OAuth connect
router.post("/connect", protect, connectInstagram);
router.get("/safe-signals", protect, getSafeSignals);

// ── Instagram DM Inbox (DB-backed, works without App Review) ─────────────
// Fetch all stored conversations from MongoDB
router.get("/dm/inbox", protect, getDMInbox);
// Send a DM reply and persist it
router.post("/dm/:participantIgId/send", protect, sendDMMessage);

// ── Instagram Graph API conversations (requires App Review) ───────────
// Get all DM conversation threads
router.get("/conversations", protect, getConversations);
// Get messages for a specific conversation
router.get("/conversations/:conversationId/messages", protect, getConversationMessages);
// Send a reply to a specific user
router.post("/conversations/:userId/reply", protect, sendConversationReply);

module.exports = router;
