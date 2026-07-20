const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const ApiError = require("../utils/apiError");

const localWinBin = path.join(__dirname, "../../bin/yt-dlp.exe");
const localUnixBin = path.join(__dirname, "../../bin/yt-dlp");
const localBin = fs.existsSync(localWinBin) ? localWinBin : (fs.existsSync(localUnixBin) ? localUnixBin : null);

const YT_DLP_PATH = localBin || process.env.YT_DLP_PATH || "yt-dlp";
const MAX_DURATION = parseInt(process.env.MAX_REEL_DURATION_SECONDS || "180", 10);
const MAX_SIZE_MB = parseInt(process.env.MAX_REEL_SIZE_MB || "100", 10);

/**
 * Downloads direct video stream via RapidAPI.
 */
async function downloadViaRapidApi(url, tempDir, filename) {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_INSTAGRAM_HOST || "instagram-scraper-stable-api.p.rapidapi.com";

  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY is not configured.");
  }

  // Extract shortcode
  let shortcode = null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex(p => p === "reel" || p === "p");
    if (idx !== -1 && parts[idx + 1]) {
      shortcode = parts[idx + 1];
    } else if (parts.length > 0) {
      shortcode = parts[parts.length - 1];
    }
  } catch (e) {}

  if (!shortcode) {
    throw new Error("Could not extract Instagram shortcode from URL.");
  }

  console.log(`[InstagramDownloader] Fetching Reel details from RapidAPI for shortcode: ${shortcode}`);
  
  const postInfoUrl = `https://${host}/v1/post_info?shortcode=${shortcode}`;
  const response = await axios.get(postInfoUrl, {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": host,
    },
    timeout: 10000
  });

  const data = response.data?.data || response.data;
  if (!data) {
    throw new Error("No data returned from RapidAPI post_info.");
  }

  const videoUrl = data.video_url || 
                   (data.video_versions && data.video_versions[0]?.url) ||
                   (data.carousel_media && data.carousel_media[0]?.video_versions?.[0]?.url);
  
  if (!videoUrl) {
    throw new Error("This Instagram post does not contain a video stream.");
  }

  const duration = data.video_duration || 0;
  const title = data.caption?.text || "Instagram Reel";

  const outputPath = path.join(tempDir, filename);
  console.log(`[InstagramDownloader] Downloading stream -> ${outputPath}`);

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(videoUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          res2.pipe(file);
        });
      } else {
        res.pipe(file);
      }
      file.on("finish", () => {
        file.close(() => resolve());
      });
    }).on("error", (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });

  return {
    videoPath: outputPath,
    duration: Math.round(duration) || 30,
    title
  };
}

/**
 * Gets video metadata from yt-dlp.
 */
async function getReelMetadata(url) {
  return new Promise((resolve, reject) => {
    console.log(`[InstagramDownloader] Fetching video metadata with yt-dlp for: ${url}`);
    
    const args = [
      "-J",
      "--no-playlist",
      "--no-warnings"
    ];

    const cookiesPath = path.join(__dirname, "../../cookies.txt");
    if (fs.existsSync(cookiesPath)) {
      console.log(`[InstagramDownloader] Using cookies file: ${cookiesPath}`);
      args.push("--cookies", cookiesPath);
    }

    args.push(url);

    const ytDlp = spawn(YT_DLP_PATH, args);

    let stdout = "";
    let stderr = "";

    ytDlp.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ytDlp.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytDlp.on("close", (code) => {
      if (code !== 0) {
        console.error(`[InstagramDownloader] Metadata fetch failed (exit code ${code}). Stderr:`, stderr);
        
        // Determine the failure reason based on stderr message
        if (stderr.includes("Private video") || stderr.includes("private")) {
          return reject(new ApiError("This Instagram Reel is private.", 400, "PRIVATE_REEL"));
        }
        if (stderr.includes("login") || stderr.includes("Sign in")) {
          return reject(new ApiError("Login is required to view this Reel.", 400, "LOGIN_REQUIRED"));
        }
        if (stderr.includes("does not exist") || stderr.includes("404")) {
          return reject(new ApiError("This Instagram Reel was deleted or does not exist.", 404, "DELETED_REEL"));
        }
        return reject(new ApiError("Failed to fetch Reel details. Please check the URL.", 400, "METADATA_FETCH_FAILED"));
      }

      try {
        const metadata = JSON.parse(stdout);
        resolve(metadata);
      } catch (err) {
        reject(new ApiError("Failed to parse Reel details from yt-dlp.", 500, "PARSING_ERROR"));
      }
    });
  });
}

/**
 * Downloads public Reel video.
 */
async function downloadReel(url, tempDir, filename) {
  // Try RapidAPI first if key is configured
  if (process.env.RAPIDAPI_KEY) {
    try {
      console.log("[InstagramDownloader] Attempting download via RapidAPI...");
      const result = await downloadViaRapidApi(url, tempDir, filename);
      return result;
    } catch (err) {
      console.warn(`[InstagramDownloader] RapidAPI download failed: ${err.message}. Falling back to yt-dlp...`);
    }
  }

  // 1. Fetch metadata first to validate duration and size
  const meta = await getReelMetadata(url);

  const duration = meta.duration || 0;
  // Estimate size: filesize field (bytes) or filesize_approx
  const bytes = meta.filesize || meta.filesize_approx || 0;
  const sizeMb = bytes / (1024 * 1024);

  console.log(`[InstagramDownloader] Video Duration: ${duration}s, Estimated Size: ${sizeMb.toFixed(2)}MB`);

  if (duration > MAX_DURATION) {
    throw new ApiError(`Reel duration (${duration}s) exceeds maximum allowed limit of ${MAX_DURATION}s.`, 400, "VIDEO_TOO_LONG");
  }

  if (sizeMb > MAX_SIZE_MB) {
    throw new ApiError(`Reel file size (${sizeMb.toFixed(2)}MB) exceeds maximum allowed limit of ${MAX_SIZE_MB}MB.`, 400, "FILE_TOO_LARGE");
  }

  const outputPath = path.join(tempDir, filename);

  // 2. Spawn yt-dlp to download video
  return new Promise((resolve, reject) => {
    console.log(`[InstagramDownloader] Downloading Reel to: ${outputPath}`);

    const args = [
      "--no-playlist",
      "--max-filesize",
      `${MAX_SIZE_MB}M`,
      "-f",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "-o",
      outputPath
    ];

    const cookiesPath = path.join(__dirname, "../../cookies.txt");
    if (fs.existsSync(cookiesPath)) {
      console.log(`[InstagramDownloader] Using cookies file: ${cookiesPath}`);
      args.push("--cookies", cookiesPath);
    }

    args.push(url);

    const ytDlp = spawn(YT_DLP_PATH, args);

    let stderr = "";

    ytDlp.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytDlp.on("close", (code) => {
      if (code !== 0) {
        console.error(`[InstagramDownloader] Download failed (exit code ${code}). Stderr:`, stderr);
        return reject(new ApiError("Failed to download the Instagram Reel.", 500, "REEL_DOWNLOAD_FAILED"));
      }

      // Check if file exists
      if (!fs.existsSync(outputPath)) {
        return reject(new ApiError("Downloaded Reel file not found on disk.", 500, "REEL_DOWNLOAD_FAILED"));
      }

      resolve({
        videoPath: outputPath,
        duration: Math.round(duration) || 0,
        title: meta.title || meta.description || "Instagram Reel"
      });
    });
  });
}

/**
 * Downloads audio stream only (extremely fast, suitable for transcription).
 */
async function downloadAudioOnly(url, tempDir, filename) {
  const meta = await getReelMetadata(url);
  const duration = meta.duration || 0;
  
  // Support up to 20 minutes (1200s) for YouTube transcription
  const maxAudioDuration = 1200; 
  if (duration > maxAudioDuration) {
    throw new ApiError(`Video duration (${duration}s) exceeds transcription limit of ${maxAudioDuration}s.`, 400, "VIDEO_TOO_LONG");
  }

  const outputPath = path.join(tempDir, filename);

  return new Promise((resolve, reject) => {
    console.log(`[InstagramDownloader] Downloading audio only to: ${outputPath}`);

    const args = [
      "--no-playlist",
      "-f",
      "bestaudio",
      "-o",
      outputPath
    ];

    const cookiesPath = path.join(__dirname, "../../cookies.txt");
    if (fs.existsSync(cookiesPath)) {
      args.push("--cookies", cookiesPath);
    }

    args.push(url);

    const ytDlp = spawn(YT_DLP_PATH, args);
    let stderr = "";

    ytDlp.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytDlp.on("close", (code) => {
      if (code !== 0) {
        console.error(`[InstagramDownloader] Audio download failed (exit code ${code}). Stderr:`, stderr);
        return reject(new ApiError("Failed to download audio.", 500, "AUDIO_DOWNLOAD_FAILED"));
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new ApiError("Downloaded audio file not found on disk.", 500, "AUDIO_DOWNLOAD_FAILED"));
      }

      resolve({
        audioPath: outputPath,
        duration: Math.round(duration) || 0,
        title: meta.title || "Audio stream"
      });
    });
  });
}

module.exports = { downloadReel, getReelMetadata, downloadAudioOnly };
