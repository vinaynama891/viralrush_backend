const mongoose = require("mongoose");

const brandDealApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: "BrandDeal", required: true },
    brandName: { type: String },
    offerTitle: { type: String },
    status: {
      type: String,
      enum: ["Applied", "Reviewed", "Accepted", "Rejected"],
      default: "Applied",
    },
    pitch: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BrandDealApplication", brandDealApplicationSchema);
