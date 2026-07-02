const mongoose = require("mongoose");

// Stores one message within a DM conversation
const DMMessageSchema = new mongoose.Schema({
  igMessageId:  { type: String },           // Meta message ID (if available)
  text:         { type: String, default: "" },
  senderId:     { type: String, required: true },   // IG user ID of sender
  senderName:   { type: String, default: "" },
  isFromMe:     { type: Boolean, default: false },  // true = sent by the account owner
  attachments:  { type: [String], default: [] },    // attachment URLs if any
  sentAt:       { type: Date, default: Date.now },
});

// Stores one conversation thread (identified by the other participant's IG ID)
const DMConversationSchema = new mongoose.Schema({
  // Owner of this inbox (our connected IG account)
  igAccountId:        { type: String, required: true, index: true },
  ownerUserId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  // The other participant
  participantIgId:    { type: String, required: true },
  participantName:    { type: String, default: "" },
  participantAvatar:  { type: String, default: "" },

  messages:           { type: [DMMessageSchema], default: [] },

  lastMessageAt:      { type: Date, default: Date.now, index: true },
  lastMessageText:    { type: String, default: "" },
  unreadCount:        { type: Number, default: 0 },
}, { timestamps: true });

// Compound unique index: one conversation per pair
DMConversationSchema.index({ igAccountId: 1, participantIgId: 1 }, { unique: true });

module.exports = mongoose.model("DMConversation", DMConversationSchema);
