const axios = require("axios");

const NICHE_MAP = {
  fitness: ["Fitness", "GymMotivation", "loseit"],
  business: ["Entrepreneur", "startups", "smallbusiness"],
  ai: ["artificial", "ChatGPT", "ArtificialInteligence"],
  tech: ["technology", "programming", "webdev"],
  finance: ["personalfinance", "investing", "stocks"],
  marketing: ["marketing", "socialmedia", "digitalmarketing"],
  gaming: ["gaming", "Games", "pcgaming"]
};

class RedditTrendService {
  /**
   * Fetches trending posts from Reddit for a given niche/keyword using RSS feeds (highly reliable)
   * @param {string} niche - The niche or keyword
   * @returns {Promise<Array>} List of parsed trend items
   */
  static async fetchTrending(niche) {
    if (!niche) return [];
    
    const cleanNiche = niche.trim().toLowerCase();
    const subreddits = NICHE_MAP[cleanNiche] || [cleanNiche.replace(/[^a-zA-Z0-9]/g, "")];
    
    let allPosts = [];
    const now = Date.now();
    
    for (const subreddit of subreddits) {
      try {
        console.log(`[Reddit Service] Fetching hot RSS feed for r/${subreddit}`);
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.rss`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
          },
          timeout: 6000
        });
        
        if (response.data) {
          const xml = response.data;
          
          // Match <entry>...</entry> (Atom format) or <item>...</item> (RSS format)
          const entryRegex = /<(entry|item)>([\s\S]*?)<\/ \1>|<(entry|item)>([\s\S]*?)<\/\3>/g;
          let match;
          
          // Alternative regex to capture entry blocks cleanly
          const cleanEntryRegex = /<(entry|item)>([\s\S]*?)<\/(entry|item)>/g;
          
          while ((match = cleanEntryRegex.exec(xml)) !== null) {
            const content = match[2];
            
            // Extract title
            let title = "";
            const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
            if (titleMatch) {
              title = titleMatch[1]
                .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .trim();
            }
            
            if (!title) continue;
            
            // Extract permalink
            let link = "";
            const hrefMatch = content.match(/<link[^>]+href=["']([^"']+)["']/);
            if (hrefMatch) {
              link = hrefMatch[1];
            } else {
              const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
              if (linkMatch) {
                link = linkMatch[1].trim();
              }
            }
            
            // Extract description / summary
            let description = "";
            const descMatch = content.match(/<(content|summary|description)[^>]*>([\s\S]*?)<\/\1>/);
            if (descMatch) {
              description = descMatch[2]
                .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
                .replace(/<[^>]*>/g, "") // strip HTML tags
                .replace(/&lt;[^&]+&gt;/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .trim();
            }
            
            // Extract date - forced to 3 to 4 days ago
            const daysAgo = 3 + Math.random();
            const publishedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
            
            // Extract author
            let author = "";
            const authorMatch = content.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/);
            if (authorMatch) {
              author = authorMatch[1].replace("/u/", "").trim();
            }
            
            // Try to extract thumbnail image from HTML content
            let thumbnail = "";
            const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i) || 
                             content.match(/src=&quot;([^&]+)&quot;/i) ||
                             content.match(/href=&quot;([^&]+\.(?:jpg|png|webp|gif))&quot;/i);
            
            if (imgMatch) {
              thumbnail = imgMatch[1].replace(/&amp;/g, "&");
            } else {
              // Fallback Unsplash image
              thumbnail = `https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=60`;
            }
            
            // Generate mock metrics for display based on random ranges (highly viral)
            const upvotes = Math.floor(Math.random() * 23500) + 1500;
            const comments = Math.floor(upvotes * (Math.random() * 0.12 + 0.04));
            
            allPosts.push({
              platform: "reddit",
              niche: cleanNiche,
              title,
              description: description.substring(0, 300),
              thumbnail,
              sourceUrl: link,
              sourceName: `r/${subreddit}${author ? ` (@${author})` : ""}`,
              metrics: {
                upvotes,
                comments,
                likes: upvotes,
                shares: Math.round(upvotes * 0.05),
                reach: upvotes * 8,
                impressions: upvotes * 12
              },
              publishedAt,
              fetchedAt: new Date()
            });
          }
        }
      } catch (error) {
        console.error(`[Reddit Service] Error fetching r/${subreddit} RSS:`, error.message);
      }
    }
    
    if (allPosts.length === 0) return [];
    
    // Normalize upvotes/comments and calculate viralScore
    const maxUpvotes = Math.max(...allPosts.map(p => p.metrics.upvotes), 1);
    const maxComments = Math.max(...allPosts.map(p => p.metrics.comments), 1);
    
    allPosts = allPosts.map(post => {
      const upvotesScore = post.metrics.upvotes / maxUpvotes;
      const commentsScore = post.metrics.comments / maxComments;
      
      const ageInHours = (now - post.publishedAt.getTime()) / 3600000;
      const recencyScore = Math.max(0, 1 - (ageInHours / 168)); // 7-day decay
      
      const score = (upvotesScore * 0.5) + (commentsScore * 0.3) + (recencyScore * 0.2);
      post.viralScore = Math.round(score * 100);
      return post;
    });
    
    return allPosts.sort((a, b) => b.viralScore - a.viralScore);
  }
}

module.exports = RedditTrendService;
