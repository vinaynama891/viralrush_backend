const axios = require('axios');
const fs = require('fs');

async function dumpEmbed() {
  try {
    const url = 'https://www.instagram.com/p/DZscDIDy-FB/embed/';
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = res.data;
    
    // Write a portion of the file to scan
    fs.writeFileSync('embed_dump.html', html);
    console.log("Dumped HTML to embed_dump.html");
    
    // Look for comments count, likes count, or views count patterns in the script tags
    const scriptTags = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
    console.log("Found", scriptTags.length, "script tags");
    
    for (let i = 0; i < scriptTags.length; i++) {
      const content = scriptTags[i];
      if (content.includes("Likes") || content.includes("likes") || content.includes("comment") || content.includes("comment_count")) {
        console.log(`Script tag ${i} has keywords. Length: ${content.length}`);
        if (content.length < 5000) {
          console.log(content.substring(0, 1000));
        }
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

dumpEmbed();
