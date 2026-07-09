require("dotenv").config();
const GoogleTrendService = require("e:/ViralRush2/ViralRush/backend/src/services/googleTrendService");

async function debug() {
  const items = await GoogleTrendService.fetchTrending("fitness");
  console.log("Returned items count:", items.length);
  if (items.length > 0) {
    console.log("First returned item full structure:", JSON.stringify(items[0], null, 2));
  }
}

debug();
