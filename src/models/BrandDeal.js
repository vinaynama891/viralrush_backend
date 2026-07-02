const mongoose = require("mongoose");

const brandDealSchema = new mongoose.Schema(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    budget: { type: String, default: "Negotiable" },
    platform: { type: String, default: "Instagram" },
    deadline: { type: Date, required: true },
    creatorsNeeded: { type: String, default: "1 Creator" },
    image: { type: String, default: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400" },
    status: {
      type: String,
      enum: ["Active", "Draft", "Completed", "Expired"],
      default: "Active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BrandDeal", brandDealSchema);
