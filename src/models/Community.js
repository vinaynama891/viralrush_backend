const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    name: { type: String, default: "" },
    isClosed: { type: Boolean, default: false },
    finalPrice: { type: Number, default: null },
    paymentStatus: { type: String, enum: ["unpaid", "half", "paid"], default: "unpaid" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Community", communitySchema);
