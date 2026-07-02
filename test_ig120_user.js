require("dotenv").config();
const axios = require("axios");

async function runTest() {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = "instagram120.p.rapidapi.com";
  
  console.log("=== TESTING INSTAGRAM120 USER POSTS ===");
  console.log("Key:", apiKey?.substring(0, 20));

  try {
    const response = await axios.post(`https://${host}/api/instagram/posts`, 
      {
        username: "gymshark",
        maxId: ""
      },
      {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": host,
          "content-type": "application/json"
        }
      }
    );

    console.log("Response Keys:", Object.keys(response.data || {}));
    console.log("Response Data sample:", JSON.stringify(response.data?.data?.edges?.slice(0, 1) || response.data, null, 2));
  } catch (err) {
    console.error("POST posts failed:", err.response?.data || err.message);
  }
}

runTest();
