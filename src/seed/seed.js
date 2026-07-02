require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const CommunityPost = require("../models/CommunityPost");

const seed = async () => {
  await connectDB();
  await CommunityPost.deleteMany({});
  await CommunityPost.insertMany([
    { author: "Aisha", niche: "Marketing", content: "What hook format is converting best for you this week?" },
    { author: "Ravi", niche: "Finance", content: "Testing faceless reels with data overlays. Reach improved by 32%." },
  ]);
  console.log("Seed data inserted");
  await mongoose.connection.close();
};

seed();
