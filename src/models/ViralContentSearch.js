const mongoose = require("mongoose");

/**
 * Stores every viral content search made by a logged-in user.
 * Videos are raw YouTube API data with computed viral scores.
 * aiAnalysis is the structured Gemini response.
 */
const VideoSchema = new mongoose.Schema(
  {
    videoId:       { type: String, required: true },
    title:         { type: String, required: true },
    channelTitle:  { type: String, required: true },
    description:   { type: String, default: "" },
    thumbnail:     { type: String, default: "" },
    publishedAt:   { type: String, default: "" },
    videoUrl:      { type: String, required: true },
    duration:      { type: String, default: "N/A" },
    viewCount:     { type: Number, default: 0 },
    likeCount:     { type: Number, default: 0 },
    commentCount:  { type: Number, default: 0 },
    viralScore:    { type: Number, default: 0 },
    engagementRate:{ type: Number, default: 0 },  // percentage, 2 decimal places
  },
  { _id: false }
);

const ContentIdeaSchema = new mongoose.Schema(
  {
    title:                  { type: String },
    hook:                   { type: String },
    format:                 { type: String },
    scriptOutline:          { type: String },
    estimatedViralPotential:{ type: String },
  },
  { _id: false }
);

const AIAnalysisSchema = new mongoose.Schema(
  {
    keyword:                 { type: String },
    trendSummary:            { type: String },
    commonHooks:             [{ type: String }],
    commonFormats:           [{ type: String }],
    whyTheseVideosAreViral:  [{ type: String }],
    contentIdeas:            [ContentIdeaSchema],
    recommendedPostingStyle: { type: String },
    hashtags:                [{ type: String }],
  },
  { _id: false }
);

const ViralContentSearchSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    keyword:     { type: String, required: true, trim: true },
    regionCode:  { type: String, default: "IN" },
    platform:    { type: String, default: "youtube", enum: ["youtube", "instagram", "facebook"] },
    videos:      [VideoSchema],
    aiAnalysis:  { type: AIAnalysisSchema, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ViralContentSearch", ViralContentSearchSchema);
