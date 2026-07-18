const mongoose = require("mongoose");

const generatedIdeaSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    trendItemId: { type: mongoose.Schema.Types.ObjectId, ref: "TrendItem" },
    niche: { type: String, required: true },
    platformSuggestion: { type: String, required: true }, // e.g. "instagram", "youtube"
    hook: { type: String, required: true },
    hooks: [{ type: String }],
    cta: { type: String },
    script: { type: String, required: true },
    caption: { type: String, required: true },
    hashtags: [{ type: String }],
    contentAngle: { type: String },
    targetAudience: { type: String },
    viralReason: { type: String },
    videoFormat: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("GeneratedIdea", generatedIdeaSchema);
