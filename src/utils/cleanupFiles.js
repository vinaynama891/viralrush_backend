const fs = require("fs");
const path = require("path");

function cleanupFiles(dirPath) {
  if (!dirPath) return;
  try {
    if (fs.existsSync(dirPath)) {
      // Recursive delete directory
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[Cleanup] Successfully cleaned up temporary files at: ${dirPath}`);
    }
  } catch (err) {
    console.error(`[Cleanup] Failed to delete temporary files at ${dirPath}:`, err.message);
  }
}

module.exports = cleanupFiles;
