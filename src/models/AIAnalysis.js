const mongoose = require("mongoose");

const AIAnalysisSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contentTitle: { type: String, required: true },
    platform: { type: String, required: true },
    whyItWentViral: { type: String, required: true },
    emotionalTrigger: { type: String, required: true },
    retentionScore: { type: Number, required: true },
    hookQuality: { type: Number, required: true },
    ctaScore: { type: Number, required: true },
    audiencePsychology: { type: String, required: true },
    viralProbability: { type: Number, required: true },
    topicRatingOutOf10: { type: Number, default: 8 },
    suggestedImprovements: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AIAnalysis", AIAnalysisSchema);
