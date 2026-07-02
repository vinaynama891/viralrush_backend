const mongoose = require("mongoose");

const ViralContentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    niche: { type: String, required: true },
    creator: { type: String, required: true },
    platform: { type: String, enum: ["Instagram", "YouTube", "TikTok", "LinkedIn", "Twitter"], required: true },
    viralScore: { type: Number, required: true },
    engagementLevel: { type: String, required: true },
    views: { type: String, required: true },
    likes: { type: String, required: true },
    comments: { type: String, required: true },
    shares: { type: String, default: "0" },
    saves: { type: String, default: "0" },
    engagementRate: { type: String, required: true },
    postedTime: { type: String, required: true },
    thumbnail: { type: String, required: true },
    hook: { type: String, required: true },
    whyViral: { type: String, required: true },
    emotionalTrigger: { type: String, required: true },
    hookQuality: { type: Number, required: true },
    retentionScore: { type: Number, required: true },
    ctaScore: { type: Number, required: true },
    psychology: { type: String, required: true },
    followersCount: { type: String, default: "10K" },
    caption: { type: String, default: "" },
    hashtags: [{ type: String }],
    audioUsed: { type: String, default: "Original Audio" },
    language: { type: String, default: "English" },
    reelLength: { type: String, default: "15s" },
    isVerified: { type: Boolean, default: false },
    audienceType: { type: String, default: "General" },
    bestTimeToPost: { type: String, default: "6 PM EST" },
    retentionData: [
      {
        name: { type: String, required: true },
        value: { type: Number, required: true },
      }
    ],
    improvements: { type: String, required: true },
    videoUrl: { type: String, required: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ViralContent", ViralContentSchema);
