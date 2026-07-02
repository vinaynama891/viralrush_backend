require("dotenv").config();
const { searchInstagramByKeyword } = require("./src/services/rapidApiInstagramService");

async function runTest() {
  try {
    console.log("=== VERIFYING INSTAGRAM SEARCH ===");
    const results = await searchInstagramByKeyword("fitness", 5);
    console.log(`SUCCESS! Found ${results.length} real Instagram videos.`);
    if (results.length > 0) {
      console.log("First Result Title:", results[0].title);
    }
  } catch (err) {
    console.error("FAILED:", err.message);
  }
}

runTest();
