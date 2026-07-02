const mongoose = require("mongoose");

const calendarItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    platform: { type: String, required: true },
    contentType: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, default: "Planned" },
    remindersSent: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CalendarItem", calendarItemSchema);
