const fs = require('fs');

function printHead() {
  const html = fs.readFileSync('embed_dump.html', 'utf8');
  console.log(html.substring(0, 4000));
}

printHead();
