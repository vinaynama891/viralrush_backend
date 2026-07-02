const mongoose = require("mongoose");

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;
  const fallbackUri = "mongodb://127.0.0.1:27017/viralrush";

  try {
    const conn = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 5000 // Timeout quickly (5s) to fallback faster
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection to primary URI failed: ${error.message}`);
    if (primaryUri !== fallbackUri) {
      console.warn(`⚠️ Attempting fallback connection to local MongoDB: ${fallbackUri}`);
      try {
        const conn = await mongoose.connect(fallbackUri);
        console.log(`MongoDB connected (local fallback): ${conn.connection.host}`);
      } catch (fallbackError) {
        console.error(`Database connection to fallback URI failed: ${fallbackError.message}`);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
