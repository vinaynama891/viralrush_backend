const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./src/models/User");

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const hashedPassword = await bcrypt.hash("password123", 10);
    const res = await User.updateOne({ username: "nike" }, { password: hashedPassword });
    console.log("Password reset result:", res);
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

run();
