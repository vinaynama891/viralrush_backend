const { GoogleGenAI } = require("@google/genai");
const ApiError = require("../utils/apiError");

async function generateScriptAndAnalysis({ transcript, selectedLanguage = "hinglish", duration = 30 }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const genAI = new GoogleGenAI({ apiKey });

  let langInstruction = "";
  if (selectedLanguage === "english") {
    langInstruction = `THE ENTIRE OUTPUT MUST BE IN ENGLISH ONLY. NO HINDI OR HINGLISH.`;
  } else if (selectedLanguage === "hindi") {
    langInstruction = `THE ENTIRE OUTPUT (except JSON keys and brackets) MUST BE IN HINDI (using Devanagari script, हिंदी देवनागरी लिपि). E.g. "नमस्ते दोस्तों, आज हम बात करेंगे..."`;
  } else if (selectedLanguage === "hinglish" || selectedLanguage === "auto") {
    langInstruction = `THE ENTIRE OUTPUT (except JSON keys and brackets) MUST BE IN HINGLISH (conversational Hindi words written using Latin/English alphabet). E.g., "Doston, kya aap bhi weight loss karna chahte ho? Toh follow karo ye 3 steps."`;
  }

  const prompt = `You are an expert short-form video strategist and scriptwriter.
Analyse the provided Instagram Reel transcript.
Transcript text:
"${transcript}"

Original Reel duration: ${duration} seconds.

Tasks:
1. Identify:
   - "contentType": Determine whether the content is primarily speech ("speech"), song lyrics ("song"), or a mix of both ("mixed").
   - "detectedLanguage": Auto-detect the source language of the transcript (e.g., "Hindi", "English", "Hinglish").
   - "topic": Main topic.
   - "targetAudience": Array of target audience tags (e.g. ["Creators", "Students"]).
   - "tone": Single word tone description (e.g., "Educational", "Energetic").
   - "emotion": Array of emotions triggered (e.g. ["Curiosity", "Urgency"]).
   - "hook": Reconstructed original Reel opening hook.
   - "cta": Reconstructed original CTA.
   - "keywords": Array of 3-5 important keywords.
   - "viralScore": Numeric score from 0 to 100 based on virality audit.
   - "hookScore": Numeric score from 1 to 10 based on hook strength.

2. Generate exactly three completely original, ready-to-record short-form video scripts based on the same core topic.
   Script styles:
   - Script 1: "Strong Hook" (Starts with a high-impact pattern-interrupt hook).
   - Script 2: "Curiosity" (Starts with a curiosity-inducing question or FOMO hook).
   - Script 3: "Storytelling" (Narrates a short relatable case study or personal story).

Rules:
* Never copy the transcript word-for-word.
* Change the wording, structure, examples, opening, and CTA.
* Preserve only the core topic and useful idea.
* Keep each script approximately suitable for the original video duration of ${duration} seconds (around ${Math.max(Math.floor(duration * 2.5), 50)} words maximum).
* Write all generated content values in the target language.
* LANGUAGE RULE:
  ${langInstruction}
* Avoid fake facts and unsupported claims.
* Return ONLY a valid JSON object matching this exact schema (no markdown, no code fences, no extra text):
{
  "detectedLanguage": "Hindi",
  "contentType": "speech",
  "analysis": {
    "topic": "Main topic",
    "targetAudience": ["tag1", "tag2"],
    "tone": "Educational",
    "emotion": ["Curiosity", "Urgency"],
    "hook": "Original Reel hook",
    "cta": "Original CTA",
    "keywords": ["keyword 1", "keyword 2"],
    "viralScore": 82,
    "hookScore": 7
  },
  "scripts": [
    {
      "id": 1,
      "style": "Strong Hook",
      "title": "Script Title",
      "hook": "Powerful opening hook",
      "body": "Complete spoken ready-to-record script with visual cues in brackets, e.g. [Visual: ...]",
      "cta": "Call to action text"
    },
    {
      "id": 2,
      "style": "Curiosity",
      "title": "Script Title",
      "hook": "Curiosity-based hook",
      "body": "Complete spoken ready-to-record script with visual cues in brackets, e.g. [Visual: ...]",
      "cta": "Call to action text"
    },
    {
      "id": 3,
      "style": "Storytelling",
      "title": "Script Title",
      "hook": "Story-based hook",
      "body": "Complete spoken ready-to-record script with visual cues in brackets, e.g. [Visual: ...]",
      "cta": "Call to action text"
    }
  ]
}`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  let lastError = null;

  for (const modelName of models) {
    try {
      console.log(`[ScriptGeneration] Querying Gemini using model: ${modelName}`);
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: prompt
      });

      const raw = (result.text || "").trim();
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (
        !parsed.detectedLanguage ||
        !parsed.contentType ||
        !parsed.analysis ||
        !Array.isArray(parsed.scripts) ||
        parsed.scripts.length < 3
      ) {
        throw new Error("Missing required fields in Gemini response JSON.");
      }

      return parsed;
    } catch (err) {
      console.error(`[ScriptGeneration] Model ${modelName} failed:`, err.message);
      lastError = err;
    }
  }

  throw new ApiError("Failed to generate scripts using Gemini AI.", 500, "GEMINI_API_FAILURE");
}

module.exports = { generateScriptAndAnalysis };
