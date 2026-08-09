const axios = require('axios');
const fs = require('fs');

async function testPostPage() {
  try {
    const url = 'https://www.instagram.com/p/DZscDIDy-FB/';
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    console.log("HTML length:", res.data.length);
    fs.writeFileSync('post_dump.html', res.data);
    
    // Check for og:description or description
    const descMatch = res.data.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i) ||
                      res.data.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
    
    if (descMatch) {
      console.log("Meta description content:", descMatch[1]);
    } else {
      console.log("Meta description NOT found");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testPostPage();
