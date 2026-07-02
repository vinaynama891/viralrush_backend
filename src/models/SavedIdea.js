const mongoose = require("mongoose");

const SavedIdeaSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: "ViralContent", default: null },
    title: { type: String, required: true },
    platform: { type: String, required: true },
    niche: { type: String, required: true },
    hook: { type: String, default: "" },
    caption: { type: String, default: "" },
    script: { type: String, default: "" },
    tags: [{ type: String }],
    collectionName: { type: String, default: "General" },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SavedIdea", SavedIdeaSchema);
