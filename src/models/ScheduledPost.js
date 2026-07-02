const mongoose = require("mongoose");

const scheduledPostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    instagramAccountId: { type: String, required: true }, // Instagram Business Account ID
    accessToken: { type: String, required: true },         // Encrypted token — copied at schedule time

    // Media info
    mediaType: { type: String, enum: ["IMAGE", "REEL"], required: true },
    cdnUrl: { type: String, required: true },              // Publicly accessible CDN URL
    caption: { type: String, default: "" },

    // Scheduling
    scheduledAt: { type: Date, required: true },           // When the post should go live
    publishedAt: { type: Date },                           // Filled in once published

    // Status lifecycle: pending → processing → published | failed
    status: {
      type: String,
      enum: ["pending", "processing", "published", "failed"],
      default: "pending"
    },
    errorMessage: { type: String },

    // Instagram media container ID (created ahead of schedule for faster publish)
    containerId: { type: String },
  },
  { timestamps: true }
);

// Index for efficient polling: find pending posts whose scheduledAt has passed
scheduledPostSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model("ScheduledPost", scheduledPostSchema);
