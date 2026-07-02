require("dotenv").config();
const axios = require("axios");

async function testEndpoints() {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_INSTAGRAM_HOST || "instagram-scraper-stable-api.p.rapidapi.com";
  
  // A real public Instagram post shortcode (this is a public post on Instagram)
  const shortcode = "C8a1b2c3d4"; // or a generic one
  const testUrls = [
    `https://${host}/v1/post_info?shortcode=${shortcode}`,
    `https://${host}/v1/post?shortcode=${shortcode}`,
    `https://${host}/v1/media_info?shortcode=${shortcode}`,
    `https://${host}/v1/media?shortcode=${shortcode}`,
    `https://${host}/v1/post_info?url=${encodeURIComponent("https://www.instagram.com/reel/C8a1b2c3d4/")}`,
  ];

  console.log("RAPIDAPI_KEY length:", apiKey ? apiKey.length : 0);
  console.log("RAPIDAPI_HOST:", host);

  for (const url of testUrls) {
    try {
      console.log(`\nTesting endpoint: ${url}`);
      const response = await axios.get(url, {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": host,
        },
        timeout: 8000
      });
      console.log(`SUCCESS! Status: ${response.status}`);
      console.log("Data Keys:", Object.keys(response.data || {}));
      console.log("Data snippet:", JSON.stringify(response.data).substring(0, 1000));
      break; // Stop at first successful response
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      if (err.response) {
        console.log(`Response status: ${err.response.status}`);
        console.log(`Response data:`, JSON.stringify(err.response.data).substring(0, 500));
      }
    }
  }
}

testEndpoints();
