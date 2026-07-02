const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true }, // Normalized to midnight local/UTC time
    durationSeconds: { type: Number, default: 0 },
    // A map of hour key (e.g. "9", "12", "15", "18", "21") to active seconds
    hourlySeconds: { type: Map, of: Number, default: {} }
  },
  { timestamps: true }
);

userActivitySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("UserActivity", userActivitySchema);
