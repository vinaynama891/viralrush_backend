const mongoose = require("mongoose");

const automationLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    automationRuleId: { type: mongoose.Schema.Types.ObjectId, ref: "AutomationRule", required: true },
    instagramAccountId: { type: String, required: true },
    commentId: { type: String, required: true },
    commentText: { type: String, required: true },
    commenterUsername: { type: String, required: true },
    mediaId: { type: String },
    
    publicReplySent: { type: Boolean, default: false },
    publicReplyText: { type: String },
    
    privateReplySent: { type: Boolean, default: false },
    privateReplyText: { type: String },
    
    status: { type: String, enum: ["success", "failed"], default: "success" },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AutomationLog", automationLogSchema);
