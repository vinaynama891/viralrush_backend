const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    instagramAccountId: { type: String },
    username: { type: String, required: true },
    instagramUserId: { type: String, required: true },
    source: { type: String, enum: ["dm", "comment"], default: "dm" },
    firstMessage: { type: String },
    status: { type: String, enum: ["new", "interested", "follow-up", "closed"], default: "new" },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);
