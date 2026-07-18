const { GoogleGenAI } = require("@google/genai");
const ApiError = require("../utils/apiError");

/**
 * Format a duration in seconds into SRT timestamp format: HH:MM:SS,mmm
 */
function formatSrtTimestamp(seconds) {
  const ms = Math.floor((seconds % 1) * 1000);
  const totalSecs = Math.floor(seconds);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hours = Math.floor(totalSecs / 3600);

  const pad = (num, len = 2) => String(num).padStart(len, "0");
  return `${pad(hours)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Translates subtitle segments using Gemini API while preserving timestamps.
 */
async function translateSegments(segments, targetLanguage) {
  if (!segments || segments.length === 0) return [];
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    console.warn("[SubtitleService] GEMINI_API_KEY is not configured. Skipping subtitle translation.");
    return segments;
  }

  const genAI = new GoogleGenAI({ apiKey });

  let langInstruction = "";
  if (targetLanguage === "english") {
    langInstruction = `Translate the "text" field of all segments into English. Do not write any Hindi or Hinglish.`;
  } else if (targetLanguage === "hindi") {
    langInstruction = `Translate the "text" field of all segments into Hindi using Devanagari script (हिंदी देवनागरी लिपि). Do not write in English.`;
  } else if (targetLanguage === "hinglish") {
    langInstruction = `Translate the "text" field of all segments into Hinglish (conversational Hindi written using Latin/English alphabet). E.g. "kya haal hai" or "video end tak dekhna".`;
  } else {
    return segments; // Auto or no conversion
  }

  const prompt = `You are a professional subtitle translator.
I have a list of subtitle segments in JSON format.
Your task is to translate ONLY the "text" field of each segment.
Keep the "id", "start", and "end" fields exactly the same.
DO NOT change any timestamps, ids, or segments structure.

Translation Language Rule:
${langInstruction}

Segments list:
${JSON.stringify(segments, null, 2)}

Return ONLY a valid JSON array of segments matching the original structure (no markdown, no extra explanation, no code fences):
[
  {
    "id": 1,
    "start": 0.0,
    "end": 3.0,
    "text": "Translated subtitle text"
  }
]`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const modelName of models) {
    try {
      console.log(`[SubtitleService] Translating subtitles to ${targetLanguage} using model: ${modelName}`);
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const raw = (result.text || "").trim();
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length === segments.length) {
        return parsed.map((seg, idx) => ({
          id: seg.id || segments[idx].id,
          start: seg.start !== undefined ? seg.start : segments[idx].start,
          end: seg.end !== undefined ? seg.end : segments[idx].end,
          text: (seg.text || "").trim()
        }));
      }
    } catch (err) {
      console.error(`[SubtitleService] Translation with model ${modelName} failed:`, err.message);
    }
  }

  console.warn("[SubtitleService] Subtitle translation failed or timed out. Returning original segments.");
  return segments;
}

/**
 * Builds subtitle files and text layouts from segments.
 */
async function generateSubtitles(rawSegments, detectedLanguage, selectedLanguage) {
  let segments = rawSegments.map((seg, idx) => ({
    id: idx + 1,
    start: seg.start,
    end: seg.end,
    text: seg.text
  }));

  // Determine if translation is needed
  const isDetectedHindi = (detectedLanguage || "").toLowerCase().includes("hi");
  const isDetectedEnglish = (detectedLanguage || "").toLowerCase().includes("en");
  
  let needsTranslation = false;
  if (selectedLanguage === "english" && !isDetectedEnglish) needsTranslation = true;
  if (selectedLanguage === "hindi" && !isDetectedHindi) needsTranslation = true;
  if (selectedLanguage === "hinglish") needsTranslation = true; // Hinglish is always translated

  if (needsTranslation && selectedLanguage !== "auto") {
    segments = await translateSegments(segments, selectedLanguage);
  }

  // Generate SRT and timestamped plain text
  let srtContent = "";
  let subtitleText = "";
  const subtitles = [];

  segments.forEach((seg) => {
    const startStr = formatSrtTimestamp(seg.start);
    const endStr = formatSrtTimestamp(seg.end);

    // SRT format
    srtContent += `${seg.id}\n${startStr} --> ${endStr}\n${seg.text}\n\n`;

    // Plain text layout
    subtitleText += `[${startStr} - ${endStr}] ${seg.text}\n`;

    // JSON subtitle objects
    subtitles.push({
      id: seg.id,
      start: startStr,
      end: endStr,
      text: seg.text
    });
  });

  return {
    subtitles,
    srtContent: srtContent.trim(),
    subtitleText: subtitleText.trim()
  };
}

module.exports = { generateSubtitles, formatSrtTimestamp };
