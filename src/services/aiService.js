const { GoogleGenAI } = require("@google/genai");

/**
 * Reusable AI service wrapping Gemini & OpenAI APIs
 */
class AIService {
  static getGenAIInstance() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
    if (apiKey) {
      return new GoogleGenAI({ apiKey });
    }
    return null;
  }

  static getModelNames() {
    const models = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (!models.includes("gemini-2.5-flash")) {
      models.push("gemini-2.5-flash");
    }
    return models;
  }

  /**
   * Helper to perform content generation using Gemini API
   */
  static async generateWithGemini(prompt, config = {}) {
    const genAI = this.getGenAIInstance();
    if (!genAI) return null;

    const models = this.getModelNames();
    for (const modelName of models) {
      try {
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
          config: config
        });
        const raw = (result.text || "").trim();
        let cleaned = raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        
        try {
          return JSON.parse(cleaned);
        } catch (parseErr) {
          const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (match) {
            return JSON.parse(match[0]);
          }
          throw parseErr;
        }
      } catch (err) {
        console.error(`[AI Service] Gemini model ${modelName} call failed:`, err.message);
        // If quota is exhausted (429), skip and try other models
        if (err.message && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429") || err.message.includes("quota"))) {
          console.warn("[AI Service] Quota exhausted — trying next model in fallback list.");
          continue;
        }
      }
    }
    return null;
  }

  /**
   * AI-powered Search / Discovery for Trending Content
   */
  static async searchTrendingContent({ q, niche, platform, region = "India", timeRange = "7 Days" }) {
    const queryTerm = q || niche || "General Creator Tips";
    const targetPlatform = platform || "Instagram";

    const prompt = `You are a world-class viral social media analyst and creator strategist.
A user wants to find trending viral content for the search term: "${queryTerm}" on the platform: "${targetPlatform}".
Region focus: "${region}". Time range: "${timeRange}".

IMPORTANT: Use the Google Search tool to search for real, actual trending and viral posts, reels, shorts, or videos on the platform: "${targetPlatform}" matching the search term: "${queryTerm}".
ONLY return actual, real-world trending viral content that is currently available on the platform. DO NOT hallucinate fake concepts. The results MUST be real videos/posts that actually exist and have good views on "${targetPlatform}" within the niche of "${niche || "general"}" in the region "${region}".
If you find the actual URL of the post/video/reel/short in your Google Search, put it in the "videoUrl" field. Otherwise, leave it blank.

Return ONLY a valid JSON array of objects (no markdown code blocks, no other text, just the raw JSON array) matching this exact schema:
[
  {
    "title": "A highly clickable, realistic viral video title/concept from a real post",
    "niche": "The category, e.g. Tech, Fitness, Finance, Marketing, Education, etc.",
    "creator": "@username_handle",
    "platform": "${targetPlatform}",
    "viralScore": 95, // Integer score between 85 to 99
    "engagementLevel": "One of: Explosive 🔥, High, Medium",
    "views": "A realistic view count string, e.g., '1.4M', '850K', etc.",
    "likes": "A realistic like count, e.g., '120K', '42K', etc.",
    "comments": "A realistic comment count, e.g., '4.2K', '890', etc.",
    "engagementRate": "A realistic rate, e.g. '9.4%', '10.5%', etc.",
    "shares": "A realistic share count string, e.g. '23K', '8.4K', etc.",
    "postedTime": "Time indicator, e.g. '12 hours ago', '1 day ago'",
    "trendingStatus": "One of: 🔥 Trending Now, 📈 Rising Fast, ⚡ Viral, 💎 Top Performer",
    "thumbnail": "An elegant, premium Unsplash image URL matching the theme, e.g. 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60'",
    "videoUrl": "Real video link if found in search, e.g. 'https://www.youtube.com/watch?v=...' or 'https://www.instagram.com/reel/...'. Otherwise leave blank.",
    "hook": "A highly compelling, attention-grabbing opening hook sentence (under 20 words)",
    "whyViral": "Detailed, professional explanation of why this went viral, e.g., psychological trigger, curiosity gap, high utility.",
    "emotionalTrigger": "Trigger type, e.g. 'Ambition & High Curiosity', 'Intense Intrigue', etc.",
    "hookQuality": 95,
    "retentionScore": 92,
    "ctaScore": 88,
    "psychology": "Deep psychographic explanation of the viewer's psychological state when watching this.",
    "retentionData": [
      { "name": "0s", "value": 100 },
      { "name": "3s", "value": 96 },
      { "name": "8s", "value": 91 },
      { "name": "15s", "value": 85 },
      { "name": "30s", "value": 81 },
      { "name": "45s", "value": 76 },
      { "name": "60s", "value": 73 }
    ],
    "improvements": "Specific actionable suggestion on how to make this video even more viral."
  }
]`;

    try {
      const config = {
        tools: [{ googleSearch: {} }]
      };
      const data = await this.generateWithGemini(prompt, config);
      if (data && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.error("[AI Service] Gemini search error:", err.message);
    }

    // Curated dynamic fallbacks
    return this.getMockFallbackSearch(queryTerm, targetPlatform, niche);
  }

  /**
   * AI-powered Content Diagnostics
   */
  static async analyzeContent({ title, platform, hook }) {
    const prompt = `You are a legendary social media neuro-analyst and growth consultant.
Analyze this social media content concept:
Title/Concept: "${title}"
Platform: "${platform}"
Hook: "${hook}"

Perform a deep psychiatric and metric diagnostic of this post.
Return ONLY a valid JSON object matching this exact schema:
{
  "whyItWentViral": "Multi-paragraph comprehensive explanation of the virality vector, video loops, pacing, and retention mechanics.",
  "emotionalTrigger": "Primary human emotion tapped (e.g. Ambition, Relational validation, Fear of Missing Out, Curated competency)",
  "retentionScore": 94, // Score 1 to 100
  "hookQuality": 96, // Score 1 to 100
  "ctaScore": 91, // Score 1 to 100
  "audiencePsychology": "Deep psychographic breakdown explaining viewer impulses, saving behavior, and why they clicked share.",
  "viralProbability": 98, // Predicted virality %
  "topicRatingOutOf10": 9, // Rate the content out of 10 based specifically on its title/topic in this niche
  "suggestedImprovements": "Highly detailed, actionable step-by-step guidance to optimize this content concept further."
}`;

    try {
      const data = await this.generateWithGemini(prompt);
      if (data && data.whyItWentViral) {
        return data;
      }
    } catch (err) {
      console.error("[AI Service] Gemini analysis error:", err.message);
    }

    //curated diagnostic fallback
    return this.getDynamicFallbackAnalysis({ title, platform, hook });
  }

  static getDynamicFallbackAnalysis({ title = "", platform = "Instagram", hook = "" }) {
    const cleanTitle = title.replace(/[^\w\s]/gi, '');
    const words = cleanTitle.split(" ").filter(w => w.length > 3);
    const keywords = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const topic = keywords.join(" ") || "this niche";

    let whyItWentViral = "";
    let emotionalTrigger = "";
    let audiencePsychology = "";
    let suggestedImprovements = "";
    let topicRatingOutOf10 = 8;

    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes("automate") || lowerTitle.includes("workflow") || lowerTitle.includes("tech") || lowerTitle.includes("code")) {
      whyItWentViral = `This concept exploded on ${platform} by solving a major friction point in tech automation. Creators and professionals are constantly seeking leverage. Showing a working "${topic}" setup in a visual format creates instant credibility and makes viewers want to copy it.`;
      emotionalTrigger = "Ambition & Efficiency Drive";
      audiencePsychology = `Viewers watching a "${topic}" tutorial feel a strong urge to optimize their setups. The high saving rate is driven by utility: they save the video to replicate the exact steps later.`;
      suggestedImprovements = `To improve this "${topic}" post, display clear step-by-step checklist graphics on the screen, and pin the link to the tools in the comments.`;
      topicRatingOutOf10 = 9;
    } else if (lowerTitle.includes("stop") || lowerTitle.includes("mistake") || lowerTitle.includes("tweak")) {
      whyItWentViral = `Challenging conventional wisdom is one of the most effective virality vectors. By starting with a contrarian hook related to "${topic}", it immediately triggers the viewer's ego and curiosity, urging them to check if they are making the same error.`;
      emotionalTrigger = "Competence FOMO & Ego Protection";
      audiencePsychology = `Viewers feel immediate discomfort when told their approach to "${topic}" is wrong. They watch until the explanation to validate their habits or correct their mistake.`;
      suggestedImprovements = `To make the "${topic}" critique more engaging, add side-by-side split screen showing the 'Wrong Way' vs the 'Right Way'.`;
      topicRatingOutOf10 = 8;
    } else if (lowerTitle.includes("tried") || lowerTitle.includes("challenge") || lowerTitle.includes("days")) {
      whyItWentViral = `Transformation case studies are extremely addictive. Documenting a personal "${topic}" challenge creates a narrative arc (suspense, failure, and ultimate success) that keeps audience retention extremely high.`;
      emotionalTrigger = "Curiosity, Suspense & Motivation";
      audiencePsychology = `Humans are naturally empathetic and curious about outcomes. They stick around to see the 'before vs after' results of the "${topic}" experiment.`;
      suggestedImprovements = `Show the dramatic final results of the "${topic}" challenge in the first 2 seconds as a teaser, then explain the process.`;
      topicRatingOutOf10 = 9;
    } else {
      whyItWentViral = `This concept went viral on ${platform} because it targets trending themes in "${topic}". Presenting actionable tips with a clean aesthetic and high-contrast visuals hooks the viewer and keeps them engaged.`;
      emotionalTrigger = "Curiosity & High-value Acquisition";
      audiencePsychology = `Viewers are looking for digestible, high-impact content about "${topic}". The visual pacing keeps them hooked, and the clear benefit makes them share it with peers.`;
      suggestedImprovements = `Boost this "${topic}" video by adding voiceover narration and using dynamic caption styling with bold colors on key words.`;
      topicRatingOutOf10 = 8;
    }

    if (hook) {
      suggestedImprovements += ` For your hook: "${hook}", try adding a visual text overlay during the first 1.5 seconds.`;
    }

    const hash = (cleanTitle.length + hook.length) % 10;
    const hookQuality = 90 + (hash % 10);
    const retentionScore = 88 + (hash % 11);
    const ctaScore = 85 + (hash % 7);
    const viralProbability = Math.max(90, Math.min(99, 90 + hash));

    return {
      whyItWentViral,
      emotionalTrigger,
      retentionScore,
      hookQuality,
      ctaScore,
      audiencePsychology,
      viralProbability,
      topicRatingOutOf10,
      suggestedImprovements
    };
  }

  /**
   * AI-powered content generator of similar posts
   */
  static async generateSimilar({ title, platform, niche, hook }) {
    const prompt = `You are a social media copywriter.
Generate highly refined similar hooks, caption copies, script scripts, and tags inspired by this concept:
Title/Concept: "${title}"
Platform: "${platform}"
Niche: "${niche || "general"}"
Hook: "${hook}"

Return ONLY a valid JSON object matching this exact schema:
{
  "hooks": [
    "Alternative powerful hook option 1 (under 20 words)",
    "Alternative powerful hook option 2 (under 20 words)",
    "Alternative powerful hook option 3 (under 20 words)"
  ],
  "captions": [
    "A premium, engaging short caption option with emojis and clear CTA",
    "A detailed, educational value-add caption option with formatting and bullet points"
  ],
  "scripts": [
    "Short Form Script (30s): Hook -> Body -> Call-to-action (seamless loop body)",
    "Medium Form Script (60s): Detailed structured guide script"
  ],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"]
}`;

    try {
      const data = await this.generateWithGemini(prompt);
      if (data && data.hooks) {
        return data;
      }
    } catch (err) {
      console.error("[AI Service] Gemini generation error:", err.message);
    }

    // fallback
    const q = title.split(" ").slice(0, 3).join(" ");
    return {
      hooks: [
        `Stop doing standard ${q}. Try this 1 simple step instead...`,
        `I spent 100 hours automating ${q} so you don't have to...`,
        `The secret database for ${q} that feels completely illegal to know...`
      ],
      captions: [
        `Nailing ${q} doesn't require 10 hours a day. It just requires the right framework. Tap save to keep this split for later! 💾`,
        `Here is the raw blueprint for ${q} that most agencies charge $1,000s for. No gates, no secrets. 👇`
      ],
      scripts: [
        `[0-3s Hook]: Nobody talks about this ${q} cheat code...\n[3-12s Body]: Most creators build everything from scratch. Instead, download this open-source stack, connect it to your database, and run automated hooks.\n[12-15s CTA]: DM me "${q.toUpperCase()}" and I'll send you the direct download node!`,
        `[0-5s Hook]: This single ${q} hack completely changed my weekly productivity flow...\n[5-45s Body]: I used to waste hours manually sorting tags. Now, I use this clean JS exclusion loop. It aggregates tags by niche, sorts by compounding metric growth, and filters duplicates.\n[45-60s CTA]: Share this with a creator friend who is still doing this the old way!`
      ],
      hashtags: ["#viralrush", "#creatorscale", `#${q.replace(/\s+/g, "").toLowerCase()}`, "#automation", "#growoninstagram", "#techhacks"]
    };
  }

  static getMockFallbackSearch(q, platform, niche) {
    const cleanQ = q || "Growth";
    const capitalQ = cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1);
    const isYt = (platform || "").toLowerCase().includes("youtube") || (platform || "").toLowerCase().includes("shorts");
    
    return [
      {
        title: `I built a fully automated ${capitalQ} workflow in 2 hours. Here is the exact tech stack.`,
        niche: niche || "Tech",
        creator: "@alex_growth",
        platform,
        viralScore: 98,
        engagementLevel: "Explosive 🔥",
        views: "1.4M",
        likes: "128K",
        comments: "4.2K",
        engagementRate: "9.4%",
        postedTime: "12 hours ago",
        thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
        hook: `Nobody talks about this secret ${cleanQ} automation framework...`,
        whyViral: `Leverages the massive wave of AI autonomy, provides concrete financial proof, and promises a friction-free blueprint for ${cleanQ}.`,
        emotionalTrigger: "Ambition & Financial Independence",
        hookQuality: 97,
        retentionScore: 94,
        ctaScore: 91,
        psychology: `Side-hustlers and developers seek low-friction technical setups. Providing the exact code stack validates the claims instantly.`,
        retentionData: [
          { name: "0s", value: 100 },
          { name: "3s", value: 96 },
          { name: "8s", value: 91 },
          { name: "15s", value: 85 },
          { name: "30s", value: 81 },
          { name: "45s", value: 76 },
          { name: "60s", value: 73 }
        ],
        improvements: `Inject a high-contrast subtitle overlay during the hook phase (first 3 seconds) to ensure mute users grasp the premise.`,
        videoUrl: isYt ? "https://www.youtube.com/watch?v=sZd1R4wSGFQ" : "https://www.instagram.com/p/CmU3M69OBYk/"
      },
      {
        title: `Stop doing standard ${capitalQ}. This 1 simple tweak changes everything.`,
        niche: niche || "Marketing",
        creator: "@dev_insights",
        platform,
        viralScore: 94,
        engagementLevel: "High",
        views: "890K",
        likes: "74K",
        comments: "1.8K",
        engagementRate: "8.5%",
        postedTime: "2 days ago",
        thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60",
        hook: `This single tweak in ${cleanQ} will make you delete all your old splits...`,
        whyViral: `Contrarian hook challenging standard user behavior. Creators love optimizations and feel highly compelled to validate their habits.`,
        emotionalTrigger: "Intense Curiosity & Competence FOMO",
        hookQuality: 92,
        retentionScore: 89,
        ctaScore: 85,
        psychology: `Professionals hate writing verbose scripts. Reframing a standard practice as a 'mistake' triggers FOMO.`,
        retentionData: [
          { name: "0s", value: 100 },
          { name: "3s", value: 93 },
          { name: "8s", value: 86 },
          { name: "15s", value: 81 },
          { name: "30s", value: 74 },
          { name: "45s", value: 70 },
          { name: "60s", value: 68 }
        ],
        improvements: "Pin the optimized instructions in the video description to boost organic credibility.",
        videoUrl: isYt ? "https://www.youtube.com/watch?v=Ke90Tje7VS0" : "https://www.instagram.com/p/BsOGulcndj-/"
      },
      {
        title: `I tried this extreme 30-day ${capitalQ} challenge. Here's what happened.`,
        niche: niche || "Lifestyle",
        creator: "@fit_lifestyle",
        platform,
        viralScore: 96,
        engagementLevel: "Explosive 🔥",
        views: "2.8M",
        likes: "340K",
        comments: "8.9K",
        engagementRate: "12.4%",
        postedTime: "1 day ago",
        thumbnail: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60",
        hook: `I tried this extreme ${cleanQ} challenge so you don't have to...`,
        whyViral: "Visual before-and-after proof always dominates. Humans are obsessed with transformations and realistic challenge case studies.",
        emotionalTrigger: "Inspiration, Suspense & Self-Discipline",
        hookQuality: 95,
        retentionScore: 91,
        ctaScore: 88,
        psychology: `Challenges evoke deep empathy. Watchers want to witness if the sacrifice pays off, keeping them hooked till the final frames.`,
        retentionData: [
          { name: "0s", value: 100 },
          { name: "3s", value: 97 },
          { name: "8s", value: 92 },
          { name: "15s", value: 87 },
          { name: "30s", value: 82 },
          { name: "45s", value: 77 },
          { name: "60s", value: 74 }
        ],
        improvements: "Accelerate the transition slides in the middle segment. A minor drop in retention occurred during the week-2 recap.",
        videoUrl: isYt ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : "https://www.instagram.com/p/Cm1L2-0jS8X/"
      }
    ];
  }

  static async lookupInstagramProfile(username) {
    const cleanUsername = username.trim().replace(/\s+/g, "").replace(/^@/, "");
    const prompt = `You are an expert social media scraper and researcher.
A user wants to find real-world statistics for the Instagram profile of: "@${cleanUsername}".

IMPORTANT: Use the Google Search tool to search for the Instagram page of "${cleanUsername}" (e.g. search "instagram.com/${cleanUsername} followers posts bio").
Find their actual:
1. Full Name/Name
2. Followers count (in numbers, e.g. 1250000 for 1.25M)
3. Posts count (number of posts uploaded)
4. Biography/Bio description
5. Estimate their total views (sum of views on their recent reels/videos found in search, or estimate based on followers count * posts * 0.1)
6. Extract or generate a list of their top 15 most popular/viral Reels or posts. For each reel, provide:
   - title: a short catchy description/title of what the reel is about.
   - views: actual or estimated view count as a number.
   - likes: actual or estimated like count as a number.
   - comments: actual or estimated comment count as a number.
   - link: a realistic Instagram reel URL link (e.g., https://www.instagram.com/reel/B8_47dfg/).

If you find a valid profile picture url, include it in "avatar". Otherwise, use a premium unsplash avatar placeholder (e.g. 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150').

Return ONLY a valid JSON object matching this exact schema (no markdown, no other text):
{
  "name": "Full Name",
  "handle": "@${cleanUsername}",
  "followersCount": 1250000,
  "postsCount": 420,
  "bio": "Creator of fine things | Daily tips...",
  "avatar": "https://...",
  "totalViews": 8500000,
  "topVideos": [
    {
      "title": "Title/Description of reel 1",
      "views": 1500000,
      "likes": 85000,
      "comments": 420,
      "link": "https://www.instagram.com/reel/Cm1L2-0jS8X/"
    }
  ]
}`;

    try {
      const config = {
        tools: [{ googleSearch: {} }]
      };
      const data = await this.generateWithGemini(prompt, config);
      if (data) {
        return data;
      }
    } catch (err) {
      console.error("[AI Service] lookupInstagramProfile failed:", err.message);
    }
    return null;
  }
}

module.exports = AIService;
