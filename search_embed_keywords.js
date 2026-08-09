const fs = require('fs');

function searchKeywords() {
  const html = fs.readFileSync('embed_dump.html', 'utf8');
  console.log("File size:", html.length);
  
  // Find all instances of "likes" (case insensitive)
  const regex = /[^<]{0,50}likes[^<]{0,50}/gi;
  let match;
  let count = 0;
  while ((match = regex.exec(html)) && count < 20) {
    console.log(`Match ${count + 1}: ${match[0].trim()}`);
    count++;
  }
  
  // Let's search for "comment" (case insensitive)
  const regex2 = /[^<]{0,50}comment[^<]{0,50}/gi;
  let count2 = 0;
  while ((match = regex2.exec(html)) && count2 < 20) {
    console.log(`Comment Match ${count2 + 1}: ${match[0].trim()}`);
    count2++;
  }
}

searchKeywords();
