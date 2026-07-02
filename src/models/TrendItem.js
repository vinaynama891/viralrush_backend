const mongoose = require("mongoose");

const trendItemSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, enum: ["reddit", "google", "instagram"] },
    niche: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    thumbnail: { type: String },
    sourceUrl: { type: String },
    sourceName: { type: String },
    metrics: {
      upvotes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 }
    },
    viralScore: { type: Number, default: 0 },
    publishedAt: { type: Date },
    fetchedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("TrendItem", trendItemSchema);
