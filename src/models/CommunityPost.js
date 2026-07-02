const mongoose = require("mongoose");

const communityPostSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    niche: { type: String, required: true },
    content: { type: String, required: true },
    likes: { type: Number, default: 0 },
    comments: [
      {
        author: String,
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommunityPost", communityPostSchema);
