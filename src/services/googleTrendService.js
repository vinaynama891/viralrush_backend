const axios = require("axios");

class GoogleTrendService {
  /**
   * Parse XML/RSS feed content using regex (dependency-free parsing)
   */
  static parseRss(xml, fallbackSource, niche) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    const now = Date.now();
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      
      // Extract title
      let title = "";
      const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
      if (titleMatch) {
        title = titleMatch[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();
      }
      
      if (!title) continue;
      
      // Extract link
      let link = "";
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      if (linkMatch) {
        link = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      }
      
      // Extract description
      let description = "";
      const descMatch = content.match(/<description>([\s\S]*?)<\/description>/);
      if (descMatch) {
        description = descMatch[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
          .replace(/<[^>]*>/g, "") // remove HTML tags
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .trim();
      }
      
      // Extract pubDate - forced to 3 to 4 days ago
      const daysAgo = 3 + Math.random();
      const publishedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      // Extract source
      let sourceName = fallbackSource;
      const sourceMatch = content.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      if (sourceMatch) {
        sourceName = sourceMatch[1].trim();
      }
      
      // Approximate Traffic (only present in Google Trends feed)
      let approxTraffic = 0;
      const trafficMatch = content.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/);
      if (trafficMatch) {
        approxTraffic = parseInt(trafficMatch[1].replace(/[^0-9]/g, ""), 10) || 0;
      }
      
      // Metrics (likes, upvotes mapped based on approx traffic or news relevance - highly viral)
      const approxTrafficValue = approxTraffic || (Math.floor(Math.random() * 45000) + 5000);
      const mockLikes = Math.round(approxTrafficValue * (Math.random() * 0.12 + 0.05));
      const mockComments = Math.round(mockLikes * (Math.random() * 0.12 + 0.04));
      
      // Unsplash fallback
      const thumbnail = `https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=500&auto=format&fit=crop&q=60`;
      
      items.push({
        platform: "google",
        niche: niche || "general",
        title,
        description: description || title,
        thumbnail,
        sourceUrl: link,
        sourceName,
        metrics: {
          upvotes: 0,
          comments: mockComments,
          likes: mockLikes,
          shares: Math.round(mockLikes * 0.15),
          reach: approxTrafficValue,
          impressions: Math.round(approxTrafficValue * 1.5)
        },
        publishedAt,
        fetchedAt: new Date()
      });
    }
    
    return items;
  }

  /**
   * Fetch daily trending searches and news
   * @param {string} niche - The search keyword/niche
   * @param {string} country - ISO country code (e.g. IN, US, GB)
   */
  static async fetchTrending(niche, country = "IN") {
    const cleanCountry = (country || "IN").toUpperCase();
    const cleanNiche = niche ? niche.trim() : "general";
    
    let googleTrendsItems = [];
    let googleNewsItems = [];
    
    // 1. Fetch Google Daily Trends (broad search terms)
    try {
      console.log(`[Google Trends] Fetching daily searches for ${cleanCountry}`);
      const url = `https://trends.google.com/trending/rss?geo=${cleanCountry}`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        timeout: 5000
      });
      if (response.data) {
        googleTrendsItems = this.parseRss(response.data, "Google Trends", cleanNiche);
      }
    } catch (error) {
      console.error(`[Google Trends] Daily trends fetch failed:`, error.message);
    }
    
    // 2. Fetch Google News RSS for the keyword/niche
    try {
      console.log(`[Google News] Fetching search results for "${cleanNiche}" in country ${cleanCountry}`);
      // Mapping country code to news ceid
      const ceidMap = {
        IN: "IN:en",
        US: "US:en",
        GB: "GB:en",
        CA: "CA:en",
        AU: "AU:en"
      };
      const ceid = ceidMap[cleanCountry] || "US:en";
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanNiche)}&hl=en-${cleanCountry}&gl=${cleanCountry}&ceid=${ceid}`;
      
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 ViralRush/1.0.0" },
        timeout: 5000
      });
      if (response.data) {
        googleNewsItems = this.parseRss(response.data, "Google News", cleanNiche);
      }
    } catch (error) {
      console.error(`[Google News] Search news fetch failed:`, error.message);
    }
    
    // Combine items
    let combinedItems = [...googleTrendsItems, ...googleNewsItems];
    
    if (combinedItems.length === 0) return [];
    
    // Calculate trendScores
    // trendScore = sourceRelevance * 0.5 + recencyScore * 0.3 + keywordRelevance * 0.2
    const now = Date.now();
    const nicheLower = cleanNiche.toLowerCase();
    
    combinedItems = combinedItems.map(item => {
      const isGoogleTrends = item.sourceName === "Google Trends";
      const sourceRelevance = isGoogleTrends ? 1.0 : 0.8;
      
      const ageInHours = (now - item.publishedAt.getTime()) / 3600000;
      const recencyScore = Math.max(0, 1 - (ageInHours / 168)); // 7-day decay
      
      const titleLower = item.title.toLowerCase();
      const descLower = item.description.toLowerCase();
      let keywordRelevance = 0.2;
      
      if (titleLower.includes(nicheLower)) {
        keywordRelevance = 1.0;
      } else if (descLower.includes(nicheLower)) {
        keywordRelevance = 0.7;
      } else if (cleanNiche === "general") {
        keywordRelevance = 0.5; // Neutral for general searches
      }
      
      const score = (sourceRelevance * 0.5) + (recencyScore * 0.3) + (keywordRelevance * 0.2);
      item.viralScore = Math.round(score * 100);
      return item;
    });
    
    // Remove duplicates by title and link
    const seen = new Set();
    const uniqueItems = combinedItems.filter(item => {
      const key = `${item.title.toLowerCase()}:${item.sourceUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return uniqueItems.sort((a, b) => b.viralScore - a.viralScore);
  }
}

module.exports = GoogleTrendService;
