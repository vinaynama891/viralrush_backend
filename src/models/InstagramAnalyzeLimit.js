const mongoose = require("mongoose");

const instagramAnalyzeLimitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
    unique: true
  },
  timestamps: [
    {
      type: Date,
      required: true
    }
  ]
});

// Static helper to check and record rate limit (default: 5 requests per hour)
instagramAnalyzeLimitSchema.statics.checkLimit = async function(userId, limitCount = 5, windowMs = 3600000) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);

  let doc = await this.findOne({ userId });
  if (!doc) {
    doc = new this({ userId, timestamps: [now] });
    await doc.save();
    return true;
  }

  // Keep only timestamps within the window
  doc.timestamps = doc.timestamps.filter(ts => ts >= cutoff);

  if (doc.timestamps.length >= limitCount) {
    return false; // Limit exceeded
  }

  doc.timestamps.push(now);
  await doc.save();
  return true;
};

module.exports = mongoose.model("InstagramAnalyzeLimit", instagramAnalyzeLimitSchema);
