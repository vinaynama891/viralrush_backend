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

INSTRUCTIONS:
1. Craft a high-impact viral content concept based on this trend.
2. Write a scroll-stopping hook (under 15 words) targeting the psychology of the viewer.
3. Write a complete 30-second video script. Include visual and audio cues in brackets (e.g. [Visual: ...], [Sound: ...]). The script should be ready to read, highly engaging, fast-paced, and fit within 30 seconds (around 70-90 spoken words).
4. Create an optimized caption with a Call to Action (CTA).
5. Suggest 5-7 highly relevant, trending hashtags.
6. Detail the content angle (e.g. Listicle, Curiosity Loop, Contrarian/Debunking, Storytelling).
7. Identify the precise target audience.
8. Explain why this topic can go viral (algorithmic and psychological triggers).
9. Suggest the video format (e.g. talking head, aesthetic B-roll with text overlay, side-by-side comparison, step-by-step tutorial).

You MUST output ONLY a valid JSON object matching the following structure. Do not wrap in markdown blocks, do not write any pre-text or post-text:
{
  "viralReelIdea": "Catchy concept title and summary of the video",
  "hook": "Scroll-stopping hook sentence",
  "script": "Complete 30-second script with brackets for cues",
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
    
    return response;
  }
}

module.exports = AITrendGeneratorService;
