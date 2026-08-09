const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function testApify() {
  const apifyToken = process.env.APIFY_TOKEN;
  const cleanUsername = "munjal.ai";
  const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`;
  
  const requestBody = {
    directUrls: [`https://www.instagram.com/${cleanUsername}/`],
    resultsType: "details"
  };

  try {
    console.log("Calling Apify with directUrls...");
    const response = await axios.post(url, requestBody);
    console.log("Full Response:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testApify();
