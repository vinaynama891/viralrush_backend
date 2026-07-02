const express = require("express");
const { signup, verifySignupOTP, login, verifyLoginOTP, resendOTP, profile, updateProfile } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-signup-otp", verifySignupOTP);
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOTP);
router.post("/resend-otp", resendOTP);
router.get("/profile", protect, profile);
router.put("/profile/update", protect, updateProfile);

// ── Admin routes ──
router.get("/admin/users", protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/admin/stats", protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    const totalUsers = await User.countDocuments();
    const activeToday = await User.countDocuments({
      updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const newThisWeek = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    const platformBreakdown = await User.aggregate([
      { $group: { _id: "$platform", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const nicheBreakdown = await User.aggregate([
      { $group: { _id: "$niche", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return res.json({ totalUsers, activeToday, newThisWeek, platformBreakdown, nicheBreakdown });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
