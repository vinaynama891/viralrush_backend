const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const validateInstagramUrl = require("../utils/validateInstagramUrl");
const cleanupFiles = require("../utils/cleanupFiles");
const ApiError = require("../utils/apiError");
const InstagramAnalyzeLimit = require("../models/InstagramAnalyzeLimit");

const { downloadReel } = require("../services/instagramDownloaderService");
const { extractAudio } = require("../services/audioExtractionService");
const { transcribeAudio } = require("../services/transcriptionService");
const { generateSubtitles } = require("../services/subtitleService");
const { generateScriptAndAnalysis } = require("../services/scriptGenerationService");

const analyzeReel = async (req, res) => {
  let tempDir = null;
  const userId = req.user.id || req.user._id;

  try {
    const { reelUrl, language } = req.body;

    // --- 1. Validate URL ---
    let cleanUrl = validateInstagramUrl(reelUrl);
    const isYouTube = reelUrl && (reelUrl.includes("youtube.com") || reelUrl.includes("youtu.be"));
    
    if (isYouTube) {
      try {
        const parsed = new URL(reelUrl.trim());
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          cleanUrl = parsed.toString();
        }
      } catch (e) {}
    }

    if (!cleanUrl) {
      return res.status(400).json({
        success: false,
        message: "Invalid or unsupported URL. Please paste a YouTube video link or an Instagram Reel link.",
        code: "INVALID_URL"
      });
    }

    const targetLang = ["auto", "english", "hindi", "hinglish"].includes(language)
      ? language
      : "hinglish";

    // --- 2. Enforce Rate Limit ---
    const withinLimit = await InstagramAnalyzeLimit.checkLimit(userId, 5, 3600000);
    if (!withinLimit) {
      return res.status(429).json({
        success: false,
        message: "Hourly limit exceeded. You can analyze up to 5 Reels per hour.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }

    // --- 3. Create Unique Temp Working Directory ---
    const uuid = crypto.randomUUID();
    tempDir = path.join(__dirname, "../../temp", uuid);
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`[InstagramController] Starting analysis pipeline for user ${userId} | URL: ${cleanUrl}`);

    let videoPath = null;
    let duration = 30;
    let title = "Viral Social Media Video";
    let downloadRes = null;

    // --- 4. Download Reel ---
    try {
      downloadRes = await downloadReel(cleanUrl, tempDir, "reel.mp4");
      videoPath = downloadRes.videoPath;
      duration = downloadRes.duration || 30;
      title = downloadRes.title || title;
    } catch (err) {
      console.warn("[InstagramController] Direct Reel download failed, proceeding with URL metadata:", err.message);
    }

    // --- 5. Extract Audio ---
    let audioPath = null;
    if (videoPath && fs.existsSync(videoPath)) {
      try {
        audioPath = await extractAudio(videoPath, tempDir, "audio.mp3");
      } catch (err) {
        if (err.code === "NO_AUDIO_FOUND" || err.message.includes("No audio found") || err.message.includes("Output file does not contain any stream")) {
          console.warn("[InstagramController] Scraped direct video has no audio. Retrying download via yt-dlp...");
          try {
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            downloadRes = await downloadReel(cleanUrl, tempDir, "reel.mp4", true);
            videoPath = downloadRes.videoPath;
            duration = downloadRes.duration || 30;
            title = downloadRes.title || title;
            audioPath = await extractAudio(videoPath, tempDir, "audio.mp3");
          } catch (retryErr) {
            console.warn("[InstagramController] Retry audio extraction failed:", retryErr.message);
          }
        } else {
          console.warn("[InstagramController] Audio extraction failed:", err.message);
        }
      }
    }

    // --- 6. Transcribe Audio ---
    let transcriptionRes = null;
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        transcriptionRes = await transcribeAudio(audioPath, targetLang);
      } catch (err) {
        console.warn("[InstagramController] Transcription failed:", err.message);
      }
    }

    const transcript = transcriptionRes?.transcript || `This video is about ${title} (${cleanUrl}). Generate high performing viral scripts and strategic breakdown for this topic.`;
    const detectedLanguage = transcriptionRes?.detectedLanguage || (targetLang === "auto" ? "English" : targetLang);
    const segments = transcriptionRes?.segments || [];

    // --- 7. Generate Subtitles ---
    let subtitleRes = { subtitles: [], srtContent: "", subtitleText: transcript };
    if (segments && segments.length > 0) {
      try {
        subtitleRes = await generateSubtitles(segments, detectedLanguage, targetLang);
      } catch (err) {
        console.warn("[InstagramController] Subtitle generation skipped:", err.message);
      }
    }

    const { subtitles, srtContent, subtitleText } = subtitleRes;

    // --- 8. Gemini Script Analysis ---
    let aiRes;
    try {
      aiRes = await generateScriptAndAnalysis({
        transcript,
        selectedLanguage: targetLang,
        duration
      });
    } catch (err) {
      const code = err.code || "GEMINI_API_FAILURE";
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: err.message || "Failed to generate scripts using Gemini AI.",
        code
      });
    }

    // --- 9. Return Response ---
    return res.status(200).json({
      success: true,
      data: {
        reelUrl: cleanUrl,
        detectedLanguage: aiRes.detectedLanguage || detectedLanguage,
        selectedLanguage: targetLang,
        contentType: aiRes.contentType || "speech",
        duration,
        views: downloadRes.views || 0,
        likes: downloadRes.likes || 0,
        comments: downloadRes.comments || 0,
        transcript,
        subtitleText,
        subtitles,
        srtContent,
        analysis: aiRes.analysis,
        scripts: aiRes.scripts
      }
    });

  } catch (err) {
    console.error("[InstagramController] Unhandled pipeline error:", err);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while analyzing the Reel.",
      code: "INTERNAL_SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  } finally {
    // --- 10. Clean up Temp Directory ---
    if (tempDir) {
      cleanupFiles(tempDir);
    }
  }
};

module.exports = { analyzeReel };
