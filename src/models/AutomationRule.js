const mongoose = require("mongoose");

const automationRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    instagramAccountId: { type: String, required: true },
    name: { type: String, default: "Untitled Automation" },
    
    // Target specific post/reel ID or "all" for all posts
    postId: { type: String, default: "all" },
    postTitle: { type: String },
    postThumbnail: { type: String },
    
    // Trigger configuration
    triggerType: { type: String, enum: ["any_comment", "keyword"], default: "keyword" },
    keyword: { type: String },
    matchType: { type: String, enum: ["contains", "exact", "startsWith"], default: "contains" },
    
    // Replies configuration
    publicReplyText: { type: String }, // Public reply on the comment
    dmReplyMode: { type: String, enum: ["template", "ai"], default: "template" },
    replyMessage: { type: String }, // Template DM reply
    aiInstruction: { type: String }, // AI persona instruction prompt
    
    delaySeconds: { type: Number, default: 0 },
    createLead: { type: Boolean, default: false },
    dmSentCount: { type: Number, default: 0 },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AutomationRule", automationRuleSchema);
