const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const ApiError = require("../utils/apiError");

const localWinBin = path.join(__dirname, "../../bin/ffmpeg.exe");
const localUnixBin = path.join(__dirname, "../../bin/ffmpeg");
const localBin = fs.existsSync(localWinBin) ? localWinBin : (fs.existsSync(localUnixBin) ? localUnixBin : null);

const FFMPEG_PATH = localBin || process.env.FFMPEG_PATH || "ffmpeg";

/**
 * Extracts audio from video file.
 * Returns the path to the extracted mono MP3 at 16 kHz.
 */
async function extractAudio(videoPath, tempDir, outputFilename) {
  const outputPath = path.join(tempDir, outputFilename);

  return new Promise((resolve, reject) => {
    console.log(`[AudioExtraction] Extracting audio from ${videoPath} to ${outputPath}`);

    // ffmpeg args: -i input -vn -acodec libmp3lame -ac 1 -ar 16000 -y output
    const ffmpeg = spawn(FFMPEG_PATH, [
      "-i", videoPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-ac", "1",
      "-ar", "16000",
      "-y",
      outputPath
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        console.error(`[AudioExtraction] FFmpeg failed with code ${code}. Stderr:`, stderr);

        // Check if error is due to missing audio stream
        if (
          stderr.includes("does not contain any audio stream") ||
          stderr.includes("Output file does not contain any stream") ||
          stderr.includes("no audio")
        ) {
          return reject(new ApiError("No audio found in this video.", 400, "NO_AUDIO_FOUND"));
        }

        return reject(new ApiError("Audio extraction failed.", 500, "AUDIO_EXTRACTION_FAILED"));
      }

      if (!fs.existsSync(outputPath)) {
        return reject(new ApiError("Extracted audio file not found.", 500, "AUDIO_EXTRACTION_FAILED"));
      }

      // Check if size is 0
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        return reject(new ApiError("Extracted audio file is empty (no sound found).", 400, "NO_AUDIO_FOUND"));
      }

      resolve(outputPath);
    });
  });
}

module.exports = { extractAudio };
