const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    niche: { type: String, default: "General" },
    platform: { type: String, default: "Instagram" },
    platformProfileUrl: { type: String, default: "" },
    profilePicture: { type: String, default: "" },
    bio: { type: String, default: "" },
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    posts: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    avgEngagement: { type: String, default: "0%" },
    role: { type: String, enum: ["user", "admin", "brand", "creator"], default: "creator" },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: "" },
    otpExpiry: { type: Date },
    youtube: {
      channelId: { type: String, default: "" },
      accessToken: { type: String, default: "" },
      refreshToken: { type: String, default: "" },
      tokensExpiry: { type: Date },
      channelData: { type: Object, default: null },
      analyticsCache: { type: Object, default: null },
      lastSync: { type: Date }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
