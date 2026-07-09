const axios = require("axios");

function parseRelativeDate(dateStr) {
  if (!dateStr) return new Date();
  const now = new Date();
  const lowerStr = dateStr.toLowerCase();
  
  if (lowerStr.includes("min")) {
    const mins = parseInt(lowerStr) || 1;
    return new Date(now.getTime() - mins * 60 * 1000);
  } else if (lowerStr.includes("hour")) {
    const hours = parseInt(lowerStr) || 1;
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  } else if (lowerStr.includes("day")) {
    const days = parseInt(lowerStr) || 1;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  } else if (lowerStr.includes("week")) {
    const weeks = parseInt(lowerStr) || 1;
    return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  } else if (lowerStr.includes("yesterday")) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? now : parsed;
}

class GoogleTrendService {
  /**
   * Parse XML/RSS feed content using regex (dependency-free parsing)
   */
  static parseRss(xml, fallbackSource, niche) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
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
      
      // Extract real pubDate
      let publishedAt = new Date();
      const pubDateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (pubDateMatch) {
        const parsedDate = new Date(pubDateMatch[1].trim());
        if (!isNaN(parsedDate.getTime())) {
          publishedAt = parsedDate;
        }
      }
      
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
        sourceUrl: link || `https://news.google.com/search?q=${encodeURIComponent(title)}`,
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
    const serpapiKey = process.env.SERPAPI_KEY;
    
    let combinedItems = [];
    let usedSerpApi = false;

    if (serpapiKey) {
      console.log(`[Google Trend Service] Using SerpApi for niche: "${cleanNiche}" in country: ${cleanCountry}`);
      try {
        if (!niche || cleanNiche === "general" || cleanNiche === "trends") {
          // Fetch Daily Trending Searches from Google Trends
          const url = `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=${cleanCountry}&frequency=daily&api_key=${serpapiKey}`;
          const response = await axios.get(url, { timeout: 8000 });
          
          const dailySearches = response.data?.daily_searches || [];
          for (const day of dailySearches) {
            const searches = day.searches || [];
            for (const search of searches) {
              const query = search.query;
              // Parse traffic (e.g., "100K+", "2M+")
              const trafficStr = search.traffic || "50K+";
              const trafficVal = parseInt(trafficStr.replace(/[^0-9]/g, "")) * (trafficStr.includes("M") ? 1000000 : 1000) || 50000;
              
              const article = search.articles?.[0] || {};
              const mockLikes = Math.round(trafficVal * 0.08);
              const mockComments = Math.round(mockLikes * 0.1);
              
              const fallbackLink = `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}&geo=${cleanCountry}`;
              const sourceUrl = article.link || article.url || search.google_trends_link || search.link || fallbackLink;

              combinedItems.push({
                platform: "google",
                niche: cleanNiche,
                title: query,
                description: article.snippet || article.title || `Trending search query: "${query}" in ${cleanCountry}`,
                thumbnail: article.thumbnail || `https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=500&auto=format&fit=crop&q=60`,
                sourceUrl,
                sourceName: article.source || "Google Trends",
                metrics: {
                  upvotes: 0,
                  comments: mockComments,
                  likes: mockLikes,
                  shares: Math.round(mockLikes * 0.12),
                  reach: trafficVal,
                  impressions: trafficVal * 2
                },
                publishedAt: parseRelativeDate(article.date) || new Date(),
                fetchedAt: new Date()
              });
            }
          }
        } else {
          // Fetch Google News for the custom niche
          const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(cleanNiche)}&gl=${cleanCountry.toLowerCase()}&api_key=${serpapiKey}`;
          const response = await axios.get(url, { timeout: 8000 });
          const newsResults = response.data?.news_results || [];
          
          combinedItems = newsResults.map(item => {
            const trafficValue = Math.floor(Math.random() * 35000) + 5000;
            const mockLikes = Math.round(trafficValue * (Math.random() * 0.12 + 0.05));
            const mockComments = Math.round(mockLikes * (Math.random() * 0.12 + 0.04));
            
            const fallbackLink = `https://news.google.com/search?q=${encodeURIComponent(item.title)}`;
            const sourceUrl = item.link || item.url || item.stories?.[0]?.link || item.stories?.[0]?.url || item.serpapi_link || fallbackLink;

            return {
              platform: "google",
              niche: cleanNiche,
              title: item.title,
              description: item.snippet || item.title,
              thumbnail: item.thumbnail || `https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=500&auto=format&fit=crop&q=60`,
              sourceUrl,
              sourceName: (typeof item.source === "object" ? item.source?.name : item.source) || "Google News",
              metrics: {
                upvotes: 0,
                comments: mockComments,
                likes: mockLikes,
                shares: Math.round(mockLikes * 0.15),
                reach: trafficValue,
                impressions: Math.round(trafficValue * 1.5)
              },
              publishedAt: parseRelativeDate(item.date),
              fetchedAt: new Date()
            };
          });
        }
        usedSerpApi = true;
      } catch (err) {
        console.error("[Google Trend Service] SerpApi call failed, falling back to RSS:", err.message);
      }
    }

    if (!usedSerpApi) {
      // FALLBACK TO FREE RSS
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
      
      combinedItems = [...googleTrendsItems, ...googleNewsItems];
    }
    
    if (combinedItems.length === 0) return [];
    
    // Calculate trendScores / viralScore globally for all items (SerpApi & RSS fallback)
    const now = Date.now();
    const nicheLower = cleanNiche.toLowerCase();
    
    combinedItems = combinedItems.map(item => {
      const isGoogleTrends = item.sourceName === "Google Trends";
      const sourceRelevance = isGoogleTrends ? 1.0 : 0.8;
      
      const ageInHours = (now - item.publishedAt.getTime()) / 3600000;
      const recencyScore = Math.max(0, 1 - (ageInHours / 168)); // 7-day decay
      
      const titleLower = item.title.toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      let keywordRelevance = 0.2;
      
      if (titleLower.includes(nicheLower)) {
        keywordRelevance = 1.0;
      } else if (descLower.includes(nicheLower)) {
        keywordRelevance = 0.7;
      } else if (cleanNiche === "general") {
        keywordRelevance = 0.5;
      }
      
      const score = (sourceRelevance * 0.5) + (recencyScore * 0.3) + (keywordRelevance * 0.2);
      item.viralScore = Math.round(score * 100);
      return item;
    });
    
    // Remove duplicates by title and link
    const seen = new Set();
    const uniqueItems = combinedItems.filter(item => {
      if (!item.sourceUrl) return true;
      const key = `${item.title.toLowerCase()}:${item.sourceUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return uniqueItems.sort((a, b) => b.viralScore - a.viralScore).slice(0, 15);
  }
}

module.exports = GoogleTrendService;
