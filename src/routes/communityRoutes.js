const express = require("express");
const {
  searchUsers,
  sendRequest,
  getNotifications,
  acceptRequest,
  rejectRequest,
  getMyCommunities,
  getChatHistory,
  markRead,
  deleteCommunity,
  deleteMessage,
  editMessage,
  uploadImage,
  closeDeal,
  updatePaymentStatus,
  generateBill,
  updateCreatorStats,
  forceRefreshCreatorStats,
} = require("../controllers/communityController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// User search
router.get("/users/search", protect, searchUsers);

// Community request flow
router.post("/community/request", protect, sendRequest);
router.get("/community/notifications", protect, getNotifications);
router.post("/community/notifications/:id/accept", protect, acceptRequest);
router.post("/community/notifications/:id/reject", protect, rejectRequest);

// My communities
router.get("/community/my", protect, getMyCommunities);

// Chat history + read receipts
router.get("/community/:communityId/messages", protect, getChatHistory);
router.post("/community/:communityId/messages/read", protect, markRead);

// Delete community
router.delete("/community/:communityId", protect, deleteCommunity);

// Close deal
router.post("/community/:communityId/close", protect, closeDeal);

// Update payment status
router.put("/community/:communityId/payment", protect, updatePaymentStatus);

// Generate Bill
router.post("/community/:communityId/bill", protect, generateBill);

// Update Creator Stats (creator apni stats update kare)
router.put("/community/creator-stats", protect, updateCreatorStats);

// Force-refresh creator IG stats (brand use kare)
router.post("/community/:communityId/refresh-stats", protect, forceRefreshCreatorStats);

// Message CRUD
router.delete("/community/messages/:messageId", protect, deleteMessage);
router.put("/community/messages/:messageId", protect, editMessage);

// Image upload
router.post("/community/:communityId/upload", protect, upload.single("image"), uploadImage);

module.exports = router;
