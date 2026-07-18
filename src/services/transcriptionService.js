const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const ApiError = require("../utils/apiError");

const PROVIDER = process.env.TRANSCRIPTION_PROVIDER || "openai";
const API_KEY = process.env.TRANSCRIPTION_API_KEY;

const { GoogleGenAI } = require("@google/genai");

/**
 * Transcribes audio file using OpenAI Whisper API.
 */
async function transcribeWithOpenAI(audioPath, language) {
  if (!API_KEY) {
    throw new Error("TRANSCRIPTION_API_KEY is not configured for OpenAI.");
  }

  const url = "https://api.openai.com/v1/audio/transcriptions";
  const formData = new FormData();
  
  formData.append("file", fs.createReadStream(audioPath));
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  
  if (language && language !== "auto" && language !== "hinglish") {
    // OpenAI accepts ISO 639-1 language codes (e.g. "en", "hi")
    const code = language === "hindi" ? "hi" : "en";
    formData.append("language", code);
  }

  console.log(`[Transcription] Sending audio to OpenAI Whisper API (language option: ${language})`);

  try {
    const res = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        "Authorization": `Bearer ${API_KEY}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000 // 60s timeout
    });

    const data = res.data;
    
    // Auto-detected or specified language from Whisper
    const detectedLanguage = data.language || "English"; 

    // Map segments
    const segments = (data.segments || []).map((seg, idx) => ({
      id: idx + 1,
      start: seg.start || 0, // In seconds (float)
      end: seg.end || 0,
      text: (seg.text || "").trim()
    }));

    // If no segments returned, create a single segment from full text
    if (segments.length === 0 && data.text) {
      segments.push({
        id: 1,
        start: 0,
        end: 10,
        text: data.text.trim()
      });
    }

    return {
      transcript: data.text || "",
      detectedLanguage: detectedLanguage.charAt(0).toUpperCase() + detectedLanguage.slice(1),
      segments
    };
  } catch (err) {
    console.error("[Transcription] OpenAI Whisper API request failed:", err.response?.data || err.message);
    throw new ApiError("Failed to transcribe audio with OpenAI Whisper.", 500, "TRANSCRIPTION_FAILED");
  }
}

/**
 * Transcribes audio file using Google Gemini API.
 */
async function transcribeWithGemini(audioPath, language) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new Error("Neither OpenAI key nor Gemini API key is configured.");
  }

  const genAI = new GoogleGenAI({ apiKey });
  
  // Read file and convert to base64
  const audioData = fs.readFileSync(audioPath);
  const base64Audio = audioData.toString("base64");

  const prompt = `You are a professional audio transcriber.
Your task is to transcribe the spoken words in the attached audio file.
Produce accurate, word-for-word transcription.
Format the transcription into timestamped segments.

Important Rules:
- Return ONLY a valid JSON object matching the exact schema below.
- Do not add markdown backticks, explanations, or wrappers.
- Timestamps must be in seconds (as floating point numbers).
- Auto-detect the spoken language and set "detectedLanguage" field (e.g. "Hindi", "English", "Hinglish").

Expected JSON Schema:
{
  "detectedLanguage": "Hinglish",
  "transcript": "Complete plain text transcript",
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 3.4,
      "text": "First spoken segment"
    }
  ]
}`;

  console.log(`[Transcription] Sending audio to Gemini API for transcription (language option: ${language})`);

  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const modelName of models) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: "audio/mp3"
            }
          },
          prompt
        ]
      });

      const raw = (response.text || "").trim();
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      if (parsed.transcript && Array.isArray(parsed.segments)) {
        return {
          transcript: parsed.transcript,
          detectedLanguage: parsed.detectedLanguage || "English",
          segments: parsed.segments.map((seg, idx) => ({
            id: seg.id || (idx + 1),
            start: parseFloat(seg.start) || 0,
            end: parseFloat(seg.end) || 0,
            text: (seg.text || "").trim()
          }))
        };
      }
    } catch (err) {
      console.error(`[Transcription] Gemini transcription with model ${modelName} failed:`, err.message);
    }
  }

  throw new Error("Gemini audio transcription failed on all models.");
}

/**
 * Main transcription service routing.
 */
async function transcribeAudio(audioPath, language = "auto") {
  if (PROVIDER === "openai" && API_KEY) {
    try {
      return await transcribeWithOpenAI(audioPath, language);
    } catch (err) {
      console.warn("[Transcription] OpenAI Whisper transcription failed, falling back to Gemini...");
    }
  }
  
  // Fallback to Gemini
  try {
    return await transcribeWithGemini(audioPath, language);
  } catch (err) {
    console.error("[Transcription] Gemini fallback transcription failed:", err.message);
    throw new ApiError("Failed to transcribe audio. Verify your API keys.", 500, "TRANSCRIPTION_FAILED");
  }
}

module.exports = { transcribeAudio };
