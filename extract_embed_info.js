const fs = require('fs');

function extractData() {
  const html = fs.readFileSync('embed_dump.html', 'utf8');
  
  // Look for JSON-like strings
  const scriptTags = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  for (let i = 0; i < scriptTags.length; i++) {
    const tag = scriptTags[i];
    if (tag.includes("likes") || tag.includes("Likes") || tag.includes("comment_count") || tag.includes("like_count")) {
      // Find JSON block starting with { and ending with }
      // Check if it has something like "like_count" or similar
      const matches = tag.match(/\{"shortcode":[\s\S]*?\}/g) || 
                      tag.match(/\{"media_id":[\s\S]*?\}/g) ||
                      tag.match(/\{"likes":[\s\S]*?\}/g) ||
                      tag.match(/\{"comment_count":[\s\S]*?\}/g) ||
                      tag.match(/\{[^\{]*"like_count"[^\}]*\}/g);
      
      if (matches) {
        console.log(`Found match in tag ${i}:`, matches[0].substring(0, 500));
      }
      
      // Let's search for "like_count" in the string and print surrounding characters
      let idx = tag.indexOf("like_count");
      if (idx !== -1) {
        console.log("like_count context:", tag.substring(idx - 100, idx + 100));
      }
      
      let commentIdx = tag.indexOf("comment_count");
      if (commentIdx !== -1) {
        console.log("comment_count context:", tag.substring(commentIdx - 100, commentIdx + 100));
      }
      
      let displayIdx = tag.indexOf("display_url");
      if (displayIdx !== -1) {
        console.log("display_url context:", tag.substring(displayIdx - 100, displayIdx + 100));
      }
    }
  }
}

extractData();
