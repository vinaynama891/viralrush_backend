const AIService = require("./aiService");

class AITrendGeneratorService {
  /**
   * Generates a viral short-form content idea from a trend item using Gemini API
   * @param {object} trendItem - The TrendItem document/object
   * @param {string} targetPlatform - The platform suggestion ("instagram" or "youtube")
   * @returns {Promise<object>} The AI generated content idea
   */
  static async generateIdea(trendItem, targetPlatform = "instagram") {
    if (!trendItem) {
      throw new Error("Missing trend item for AI generation");
    }

    const platformLabel = targetPlatform.toLowerCase() === "instagram" ? "Instagram Reel" : "YouTube Short";
    
    const prompt = `You are a world-class viral short-form content developer and expert script writer for ${platformLabel} and YouTube Shorts.
You need to convert the following trending social media signal into an extremely engaging, high-retention, and viral content idea:

TREND SIGNAL DETAILS:
- Platform: ${trendItem.platform}
- Niche: ${trendItem.niche}
- Original Title: ${trendItem.title}
- Original Description: ${trendItem.description || "N/A"}
- Original Source: ${trendItem.sourceName}
- Original Metrics: Upvotes: ${trendItem.metrics?.upvotes || 0}, Comments: ${trendItem.metrics?.comments || 0}, Likes: ${trendItem.metrics?.likes || 0}
- Calculated Viral Score: ${trendItem.viralScore}/100

LANGUAGE REQUIREMENT:
The script body, hooks, CTA, and caption MUST be written in "Hinglish" (a natural blend of Hindi and English written in the English alphabet, e.g., "Doston, kya aap bhi weight loss me struggle kar rahe ho? Today, I will show you a secret trick!"). Visual and audio cues in brackets (e.g. [Visual: ...]) must remain in English.

INSTRUCTIONS:
1. Craft a high-impact viral content concept based on this trend.
2. Write 3 scroll-stopping, high-impact hook options in Hinglish (under 15 words each):
   - Hook 1: Curiosity Loop / Intrigue style
   - Hook 2: Pain Point / Relatable Problem style
   - Hook 3: Contrarian / Pattern Interrupt style
3. Write a complete video script body in Hinglish (60 seconds duration). Include visual and audio cues in brackets in English. The script should be ready to read, highly engaging, fast-paced, and fit within 60 seconds (around 120-150 spoken words).
4. Write 1 powerful, high-converting Call To Action (CTA) sentence in Hinglish.
5. Create an optimized caption in Hinglish with the CTA integrated.
6. Suggest 5-7 highly relevant, trending hashtags.
7. Detail the content angle.
8. Identify the precise target audience.
9. Explain why this topic can go viral (algorithmic and psychological triggers).
10. Suggest the video format (e.g. talking head, aesthetic B-roll with text overlay).

You MUST output ONLY a valid JSON object matching the following structure. Do not wrap in markdown blocks, do not write any pre-text or post-text:
{
  "viralReelIdea": "Catchy concept title and summary of the video",
  "hooks": [
    "Curiosity Loop hook option",
    "Pain Point hook option",
    "Contrarian hook option"
  ],
  "script": "Complete 60-second script body with brackets for visual/audio cues",
  "cta": "High-converting Call to Action sentence",
  "caption": "Conversion-focused caption text",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "contentAngle": "The specific style/angle",
  "targetAudience": "Precisely targeted demographics",
  "viralReason": "Algorithmic and psychological triggers explanation",
  "videoFormat": "Suggested visual style and editing notes"
}`;

    console.log(`[AI Trend Gen] Requesting Gemini content idea generation for platform: ${targetPlatform}`);
    
    // We enforce JSON output format
    const response = await AIService.generateWithGemini(prompt, {
      responseMimeType: "application/json"
    });
    
    if (!response) {
      throw new Error("Failed to generate content idea from Gemini API");
    }
    
    // Ensure hooks array exists and has a fallback hook property for backwards compatibility
    if (response && Array.isArray(response.hooks)) {
      response.hook = response.hooks[0] || "";
    } else if (response && response.hook) {
      response.hooks = [response.hook, "Pain point hook option...", "Contrarian hook option..."];
    } else if (response) {
      response.hook = "Try this viral trick today!";
      response.hooks = [response.hook, "Pain point hook option...", "Contrarian hook option..."];
    }
    
    return response;
  }
}

module.exports = AITrendGeneratorService;
