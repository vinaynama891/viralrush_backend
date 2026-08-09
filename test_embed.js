const axios = require('axios');

async function testEmbed() {
  try {
    const url = 'https://www.instagram.com/p/DZscDIDy-FB/embed/';
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    console.log("HTML length:", res.data.length);
    // Find like count pattern in embed HTML
    // Let's print out text matches
    const likeMatch = res.data.match(/SocialGLikes[^>]*>([\d,.]+[KMB]?)/i) || 
                      res.data.match(/class="[^"]*Likes[^"]*"[^>]*>([\d,.]+[KMB]?)/i) ||
                      res.data.match(/([\d,.]+[KMB]?)\s*likes/i);
    console.log("Like match:", likeMatch ? likeMatch[0] : "Not found");
    
    // Look for any embedded JSON data or window.__sharedData
    const cleanBody = res.data.replace(/\s+/g, ' ');
    const sharedDataMatch = cleanBody.match(/window\._sharedData\s*=\s*({.*?});/i) || 
                            cleanBody.match(/window\.__additionalDataLoaded\s*=\s*([^;]+)/i);
    if (sharedDataMatch) {
      console.log("Found sharedData JSON");
    } else {
      console.log("No sharedData JSON found");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testEmbed();
