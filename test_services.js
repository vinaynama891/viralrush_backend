require("dotenv").config();
const RedditTrendService = require("./src/services/redditTrendService");
const GoogleTrendService = require("./src/services/googleTrendService");

async function checkViralData() {
  console.log("--------------------------------------------------");
  console.log("Checking Reddit Trend Service...");
  console.log("--------------------------------------------------");
  const redditItems = await RedditTrendService.fetchTrending("fitness");
  if (redditItems.length === 0) {
    console.log("No Reddit data fetched.");
  } else {
    console.log(`Fetched ${redditItems.length} items from Reddit.`);
    console.log("Top Viral Item:");
    console.log(` - Title: ${redditItems[0].title}`);
    console.log(` - Source: ${redditItems[0].sourceName}`);
    console.log(` - URL: ${redditItems[0].sourceUrl}`);
    console.log(` - Published At: ${redditItems[0].publishedAt}`);
    console.log(` - Metrics: Upvotes: ${redditItems[0].metrics.upvotes}, Comments: ${redditItems[0].metrics.comments}`);
    console.log(` - Viral Score: ${redditItems[0].viralScore}/100`);
  }

  console.log("\n--------------------------------------------------");
  console.log("Checking Google Trend Service...");
  console.log("--------------------------------------------------");
  const googleItems = await GoogleTrendService.fetchTrending("fitness");
  if (googleItems.length === 0) {
    console.log("No Google data fetched.");
  } else {
    console.log(`Fetched ${googleItems.length} items from Google.`);
    console.log("Top Viral Item:");
    console.log(` - Title: ${googleItems[0].title}`);
    console.log(` - Source: ${googleItems[0].sourceName}`);
    console.log(` - URL: ${googleItems[0].sourceUrl}`);
    console.log(` - Published At: ${googleItems[0].publishedAt}`);
    console.log(` - Metrics: Likes: ${googleItems[0].metrics.likes}, Comments: ${googleItems[0].metrics.comments}, Reach: ${googleItems[0].metrics.reach}`);
    console.log(` - Viral Score: ${googleItems[0].viralScore}/100`);
  }
}

checkViralData();
