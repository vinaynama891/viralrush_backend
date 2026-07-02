const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/crypto");

const instagramAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    instagramUserId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    profilePicture: { type: String },
    followersCount: { type: Number, default: 0 },
    followsCount: { type: Number, default: 0 },
    mediaCount: { type: Number, default: 0 },
    // Cached aggregated stats from media posts
    totalLikes: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    avgEngagement: { type: String, default: "0%" },
    lastStatsSync: { type: Date },
    accessToken: { 
      type: String, 
      required: true,
      get: decrypt,
      set: encrypt 
    },
    refreshToken: { 
      type: String,
      get: decrypt,
      set: encrypt
    },
    tokenExpiresAt: { type: Date },
    isConnected: { type: Boolean, default: true },
    connectedAt: { type: Date, default: Date.now }
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

module.exports = mongoose.model("InstagramAccount", instagramAccountSchema);
