const fs = require("fs");
const path = require("path");
const https = require("https");
const ffbinaries = require("ffbinaries");

const binDir = path.join(__dirname, "bin");
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} -> ${destPath}...`);
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download: status ${response.statusCode}`));
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          console.log(`Download finished successfully.`);
          resolve();
        });
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  try {
    // 1. Download ffmpeg and ffprobe using ffbinaries
    console.log("--- Downloading FFmpeg & FFprobe binaries ---");
    await new Promise((resolve, reject) => {
      ffbinaries.downloadBinaries(["ffmpeg", "ffprobe"], { destination: binDir }, (err, results) => {
        if (err) {
          console.error("FFmpeg binaries download failed:", err);
          return reject(err);
        }
        console.log("FFmpeg binaries download results:", results);
        resolve();
      });
    });

    // 2. Download yt-dlp binary based on OS
    console.log("--- Downloading yt-dlp binary ---");
    const platform = process.platform;
    let ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
    let destFilename = "yt-dlp";

    if (platform === "win32") {
      ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
      destFilename = "yt-dlp.exe";
    } else if (platform === "darwin") {
      ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
    }

    const destPath = path.join(binDir, destFilename);
    await downloadFile(ytDlpUrl, destPath);

    // Set executable permissions for Unix/Mac systems
    if (platform !== "win32") {
      fs.chmodSync(destPath, "755");
      console.log("Set executable permissions for yt-dlp.");
    }

    console.log("\nALL BINARIES READY IN: " + binDir);
  } catch (err) {
    console.error("Binary download failed:", err);
  }
}

run();
