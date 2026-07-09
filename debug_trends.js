require("dotenv").config();
const axios = require("axios");

async function debug() {
  const serpapiKey = process.env.SERPAPI_KEY;
  if (!serpapiKey) {
    console.log("No SerpApi key found.");
    return;
  }
  try {
    const url = `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=IN&frequency=daily&api_key=${serpapiKey}`;
    const response = await axios.get(url);
    const dailySearches = response.data?.daily_searches || [];
    console.log("Total days of trends:", dailySearches.length);
  } catch (err) {
    if (err.response) {
      console.error("Error response:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error message:", err.message);
    }
  }
}

debug();
