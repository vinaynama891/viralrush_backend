const { GoogleGenAI } = require("@google/genai");

/**
 * Dedicated Gemini service for Viral Content Finder AI analysis.
 * Analyses the top YouTube videos and returns structured JSON insights.
 */
class GeminiViralService {
  static _getClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Sends top YouTube video data to Gemini and receives structured viral analysis.
   *
   * @param {string} keyword  - Original search keyword
   * @param {Array}  videos   - Enriched video objects from YouTubeService
   * @returns {Object}        - Structured JSON matching the ViralAnalysis schema
   */
  static async analyzeViralVideos(keyword, videos) {
    const genAI = this._getClient();

    // Build a compact video summary to stay within token limits
    const videoSummary = videos.slice(0, 8).map((v, i) => ({
      rank: i + 1,
      title: v.title,
      channel: v.channelTitle,
      views: v.viewCount,
      likes: v.likeCount,
      comments: v.commentCount,
      engagementRate: `${v.engagementRate}%`,
      duration: v.duration,
      description: v.description.substring(0, 200),
    }));

    const prompt = `You are an expert viral content strategist and YouTube growth analyst.

I have fetched the top trending YouTube videos for the keyword: "${keyword}".

Here is the data for the top ${videoSummary.length} videos sorted by viral score:
${JSON.stringify(videoSummary, null, 2)}

Analyze these videos deeply and return a structured JSON object ONLY — no markdown, no explanation, no code fences.

Required JSON schema:
{
  "keyword": "${keyword}",
  "trendSummary": "2-3 sentence summary of what is trending for this keyword and WHY these videos performed so well",
  "commonHooks": ["List of 4-6 actual hook patterns/phrases used in these videos or that work for this niche"],
  "commonFormats": ["List of 3-5 video format styles that dominate this niche e.g. Tutorial, Transformation, Challenge, POV, Listicle"],
  "whyTheseVideosAreViral": ["3-5 specific reasons explaining exactly why these particular videos went viral based on the data above"],
  "contentIdeas": [
    {
      "title": "Specific clickable video title idea for this niche",
      "hook": "Opening 1-2 sentence hook for the video script",
      "format": "Video format type",
      "scriptOutline": "3-5 bullet point outline of the video structure",
      "estimatedViralPotential": "High / Medium-High / Medium with brief reason"
    }
  ],
  "recommendedPostingStyle": "Detailed advice on posting frequency, time, thumbnail style, and CTA strategy for this niche",
  "hashtags": ["10-15 relevant hashtags for this keyword without the # symbol"]
}

Generate exactly 5 contentIdeas. Be specific, actionable, and base your analysis on the actual video data provided.`;

    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ];

    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[GeminiViralService] Trying model: ${modelName}`);
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
        });

        const raw = (result.text || "").trim();

        // Strip any accidental markdown code fences
        const cleaned = raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();

        const parsed = JSON.parse(cleaned);

        // Basic validation: ensure required keys exist
        if (!parsed.trendSummary || !Array.isArray(parsed.contentIdeas)) {
          throw new Error("Gemini returned incomplete JSON structure");
        }

        console.log(`[GeminiViralService] Success with model: ${modelName}`);
        return parsed;
      } catch (err) {
        lastError = err;
        console.error(`[GeminiViralService] Model ${modelName} failed:`, err.message);
        // If quota is exhausted (429), no point trying other models — go to fallback immediately
        if (err.message && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429") || err.message.includes("quota"))) {
          console.warn("[GeminiViralService] Quota exhausted — skipping remaining models.");
          break;
        }
        // Continue to next model
      }
    }

    // All models failed — return a structured fallback
    console.warn("[GeminiViralService] All Gemini models failed, returning smart fallback");
    return this._buildFallback(keyword, videos);
  }

  /**
   * Generates platform-specific viral content analysis for Instagram/Facebook
   * using Gemini AI. Used when no direct platform API is available.
   *
   * @param {string} keyword   - User search term
   * @param {string} platform  - "instagram" or "facebook"
   * @param {string} regionCode - Region code e.g. "IN"
   * @param {number} maxResults - Number of results to generate
   * @returns {Object} { videos: [...], aiAnalysis: {...} }
   */
  static async generatePlatformViralContent(keyword, platform, regionCode = "IN", maxResults = 10) {
    const genAI = this._getClient();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    const platformContext = platform === "instagram"
      ? "Instagram Reels exclusively. Do NOT include static image posts or carousel posts. Focus on visual hooks, trending audio, hashtag strategies, and engagement tactics specific to Instagram's Reels algorithm (Explore page, Reels tab). Include realistic Instagram usernames (e.g. @creator_name), Instagram-specific metrics, and Reel durations (15s, 30s, 60s, 90s)."
      : "Facebook Reels, video posts, and viral shareable content. Focus on Facebook's algorithm favoring watch time, shares, and meaningful interactions. Include realistic Facebook page names, Facebook-specific metrics, and video durations.";

    const prompt = `You are an expert viral content strategist specializing in ${platformName}.

${platformContext}

A user is searching for viral ${platformName} content related to the keyword: "${keyword}" in region: ${regionCode}.
${platform === "instagram" ? "IMPORTANT: Generate ONLY Reels (short-form videos). Do not include any static images or carousels in the results." : ""}

Generate a comprehensive, realistic viral content analysis as if you analyzed the top trending ${platformName} posts for this keyword.

Return ONLY valid JSON (no markdown, no code fences) with this exact schema:

{
  "videos": [
    {
      "videoId": "unique_id_string",
      "title": "Realistic viral post title",
      "channelTitle": "Creator/Page display name",
      "description": "Post caption/description (max 300 chars)",
      "thumbnail": "https://images.unsplash.com/photo-RELEVANT_ID?w=600&auto=format&fit=crop&q=80",
      "publishedAt": "ISO 8601 date within last 30 days",
      "videoUrl": "https://www.${platform === "instagram" ? "instagram.com/reel/" : "facebook.com/watch/?v="}example_id",
      "duration": "${platform === "instagram" ? "Reel" : "1m 30s or 3m"}",
      "viewCount": number (realistic, 100K-10M range),
      "likeCount": number,
      "commentCount": number,
      "viralScore": number (80-99),
      "engagementRate": number (2-15, two decimals)
    }
  ],
  "aiAnalysis": {
    "keyword": "${keyword}",
    "trendSummary": "2-3 sentences about what's trending for this keyword on ${platformName}",
    "commonHooks": ["4-6 hook patterns used in viral ${platformName} content"],
    "commonFormats": ["3-5 content format types dominating this niche on ${platformName}"],
    "whyTheseVideosAreViral": ["3-5 specific reasons"],
    "contentIdeas": [
      {
        "title": "Specific ${platformName} content idea title",
        "hook": "Opening hook for the content",
        "format": "${platform === "instagram" ? "Instagram Reel" : "Facebook Video"}",
        "scriptOutline": "3-5 bullet point outline",
        "estimatedViralPotential": "High / Medium-High / Medium with reason"
      }
    ],
    "recommendedPostingStyle": "Detailed ${platformName}-specific posting advice",
    "hashtags": ["10-15 relevant hashtags without # symbol"]
  }
}

Generate exactly ${maxResults} items in the "videos" array and exactly 5 items in "contentIdeas".
Use realistic Unsplash image URLs for thumbnails (use real Unsplash photo IDs related to the keyword niche).
Make viewCount, likeCount, commentCount realistic and internally consistent.
Base all analysis on real ${platformName} trends and best practices.`;

    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ];

    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[GeminiViralService] Platform search (${platformName}) - Trying model: ${modelName}`);
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

        if (!parsed.videos || !Array.isArray(parsed.videos) || parsed.videos.length === 0) {
          throw new Error("Gemini returned no videos array");
        }

        // Post-process simulated Reel/post URLs to point to valid public reels
        const VALID_INSTAGRAM_REELS = [
          "CmU3M69OBYk",
          "BsOGulcndj-",
          "Cm1L2-0jS8X",
          "C-nbFjoCklU",
          "C_q8-n9x12A",
          "C_yA8B8xB2C",
          "C_2X9B8xL3D"
        ];
        if (platform === "instagram") {
          parsed.videos = parsed.videos.map((v, i) => {
            const shortcode = VALID_INSTAGRAM_REELS[i % VALID_INSTAGRAM_REELS.length];
            return {
              ...v,
              videoUrl: `https://www.instagram.com/reel/${shortcode}/`,
              videoId: shortcode
            };
          });
        }

        console.log(`[GeminiViralService] Platform search (${platformName}) success with model: ${modelName} — ${parsed.videos.length} results`);
        return parsed;
      } catch (err) {
        lastError = err;
        console.error(`[GeminiViralService] Platform ${platformName} model ${modelName} failed:`, err.message);
        // If quota is exhausted (429), no point trying other models — go to fallback immediately
        if (err.message && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429") || err.message.includes("quota"))) {
          console.warn(`[GeminiViralService] Quota exhausted for ${platformName} — skipping remaining models.`);
          break;
        }
      }
    }

    // All models failed — return platform-specific fallback
    console.warn(`[GeminiViralService] All Gemini models failed for ${platformName}, returning fallback`);
    return this._buildPlatformFallback(keyword, platform, maxResults);
  }

  /**
   * Builds a realistic fallback for Instagram/Facebook when Gemini is unavailable.
   */
  static _buildPlatformFallback(keyword, platform, maxResults = 10) {
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    const cap = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    const now = new Date();

    const VALID_INSTAGRAM_REELS = [
      "CmU3M69OBYk",
      "BsOGulcndj-",
      "Cm1L2-0jS8X",
      "C-nbFjoCklU",
      "C_q8-n9x12A",
      "C_yA8B8xB2C",
      "C_2X9B8xL3D"
    ];

    const videos = Array.from({ length: Math.min(maxResults, 8) }, (_, i) => {
      const views = Math.floor(Math.random() * 4000000) + 200000;
      const likes = Math.floor(views * (0.04 + Math.random() * 0.08));
      const comments = Math.floor(views * (0.001 + Math.random() * 0.003));
      const engRate = parseFloat(((likes + comments) / views * 100).toFixed(2));
      const daysAgo = Math.floor(Math.random() * 25) + 1;
      const pubDate = new Date(now);
      pubDate.setDate(pubDate.getDate() - daysAgo);

      const titles = [
        `This ${cap} hack changed everything for me 🔥`,
        `Nobody is talking about this ${cap} strategy...`,
        `I tried ${cap} for 30 days — here's what happened`,
        `Stop doing ${cap} wrong! Here's the fix 💡`,
        `The #1 ${cap} mistake that's killing your growth`,
        `How I went viral with ${cap} content in 2024`,
        `${cap} secrets the algorithm doesn't want you to know`,
        `This simple ${cap} trick got me 1M views`,
      ];

      const creators = [
        `@${keyword.replace(/\s+/g, "").toLowerCase()}_pro`,
        `@grow_with_${keyword.replace(/\s+/g, "").toLowerCase()}`,
        `@the${keyword.replace(/\s+/g, "")}guru`,
        `@${keyword.replace(/\s+/g, "")}master`,
        `@daily${keyword.replace(/\s+/g, "")}`,
        `@${keyword.replace(/\s+/g, "")}tips`,
        `@viral${keyword.replace(/\s+/g, "")}`,
        `@${keyword.replace(/\s+/g, "")}coach`,
      ];

      const durations = platform === "instagram"
        ? ["15s", "30s", "60s", "90s"]
        : ["1m", "2m 30s", "3m", "5m"];

      const shortcode = VALID_INSTAGRAM_REELS[i % VALID_INSTAGRAM_REELS.length];

      return {
        videoId: platform === "instagram" ? shortcode : `${platform}_${keyword.replace(/\s+/g, "_")}_${i + 1}`,
        title: titles[i % titles.length],
        channelTitle: creators[i % creators.length].replace("@", ""),
        description: `Discover the best ${keyword} strategies and tips. This ${platformName} content is trending right now! Save it for later. #${keyword.replace(/\s+/g, "")} #viral #trending`,
        thumbnail: `https://images.unsplash.com/photo-${1550000000000 + i * 11111111}?w=600&auto=format&fit=crop&q=80`,
        publishedAt: pubDate.toISOString(),
        videoUrl: platform === "instagram"
          ? `https://www.instagram.com/explore/tags/${encodeURIComponent(keyword.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())}/`
          : `https://www.facebook.com/watch/?v=${100000000 + i}`,
        duration: durations[i % durations.length],
        viewCount: views,
        likeCount: likes,
        commentCount: comments,
        viralScore: Math.floor(85 + Math.random() * 14),
        engagementRate: engRate,
      };
    });

    videos.sort((a, b) => b.viralScore - a.viralScore);

    return {
      videos,
      aiAnalysis: {
        keyword,
        trendSummary: `"${keyword}" is currently a hot topic on ${platformName} with creators leveraging short-form content to drive massive engagement. The top-performing content combines emotional hooks with actionable value, averaging ${(videos.reduce((s, v) => s + v.engagementRate, 0) / videos.length).toFixed(2)}% engagement rate.`,
        commonHooks: [
          `"Nobody is talking about this ${keyword} secret..."`,
          `"I tried ${keyword} for 30 days — here's what happened"`,
          `"Stop doing ${keyword} wrong! Here's the fix"`,
          `"The ${keyword} hack that got me 1M views"`,
          `"POV: You finally discover the right ${keyword} strategy"`,
        ],
        commonFormats: ["Short-form Reel / Video", "Carousel / Slide Post", "Talking Head + B-Roll", "Before & After Transformation", "List / Tip Series"],
        whyTheseVideosAreViral: [
          `Strong curiosity-gap hooks in the first 2 seconds drive extremely high view-through rates.`,
          `Creators using trending audio combined with text overlays see 3x more reach on ${platformName}.`,
          `The ${keyword} niche has high save/bookmark rates, signaling valuable content to the algorithm.`,
          `Posts that challenge conventional wisdom ("you're doing it wrong") generate polarizing comments that boost reach.`,
        ],
        contentIdeas: [
          {
            title: `${cap} Mistakes Everyone Makes (But Nobody Admits)`,
            hook: `"I've been doing ${keyword} for 3 years and I was making all 5 of these mistakes..."`,
            format: "Reel / Short Video",
            scriptOutline: "1. Hook: Admit to mistakes • 2. Mistake #1 reveal • 3. Quick montage of mistakes #2-4 • 4. Biggest mistake #5 with fix • 5. CTA: Save this!",
            estimatedViralPotential: "High — mistake-format content drives saves",
          },
          {
            title: `The 30-Day ${cap} Challenge That Changed My Life`,
            hook: `"What happens when you commit to ${keyword} every single day for a month? The results shocked me."`,
            format: "Transformation Reel",
            scriptOutline: "1. Day 1 starting point • 2. Week 1 struggles • 3. Week 2-3 progress • 4. Day 30 results • 5. CTA: Try it yourself",
            estimatedViralPotential: "High — transformation content gets 2x shares",
          },
          {
            title: `${cap} Beginner vs Pro — The Difference Is THIS`,
            hook: `"Here's the ONE thing separating beginners from pros in ${keyword}..."`,
            format: "Split-screen Comparison",
            scriptOutline: "1. Show beginner approach • 2. Show pro approach • 3. Explain the key difference • 4. Quick tutorial • 5. CTA: Follow for more",
            estimatedViralPotential: "Medium-High — comparison format drives engagement",
          },
          {
            title: `I Asked 100 ${cap} Experts Their #1 Tip`,
            hook: `"I messaged 100 ${keyword} experts and asked for their single best tip. Here are the top answers."`,
            format: "Compilation / Listicle",
            scriptOutline: "1. Hook: The quest • 2. Top 3 tips • 3. The surprising #1 answer • 4. My takeaway • 5. CTA: Which tip resonates?",
            estimatedViralPotential: "Medium-High — social proof format performs well",
          },
          {
            title: `The Algorithm Hack for ${cap} Content in 2024`,
            hook: `"${platformName}'s algorithm just changed and here's exactly how to use it for ${keyword} content..."`,
            format: "Educational Talking Head",
            scriptOutline: "1. Algorithm change reveal • 2. What it means for creators • 3. 3 actionable strategies • 4. Real example • 5. CTA: Comment 'HACK' for guide",
            estimatedViralPotential: "High — algorithm tips are highly shareable",
          },
        ],
        recommendedPostingStyle: `For "${keyword}" on ${platformName}: Post 4-5x per week. Best times are 11 AM - 1 PM and 7 PM - 9 PM in your target timezone. Use ${platform === "instagram" ? "3-5 highly relevant hashtags" : "2-3 hashtags max"}, trending audio, and text overlays for mute viewers. Always include a strong CTA in the last 3 seconds.`,
        hashtags: [
          keyword.replace(/\s+/g, ""), `${keyword.replace(/\s+/g, "")}tips`, `${keyword.replace(/\s+/g, "")}hacks`,
          `${keyword.replace(/\s+/g, "")}101`, "viral", "trending", "explore", "fyp",
          `${keyword.replace(/\s+/g, "")}content`, `${keyword.replace(/\s+/g, "")}growth`,
          "contentcreator", "socialmedia", platform === "instagram" ? "reels" : "facebookreels",
          `learn${keyword.replace(/\s+/g, "")}`, `${keyword.replace(/\s+/g, "")}strategy`,
        ],
      },
    };
  }

  /**
   * Builds a data-driven fallback analysis when Gemini API is unavailable.
   * Uses real video data to generate meaningful (non-generic) insights.
   */
  static _buildFallback(keyword, videos) {
    const topTitles   = videos.slice(0, 5).map((v) => v.title);
    const avgEngRate  = videos.length
      ? (videos.reduce((s, v) => s + v.engagementRate, 0) / videos.length).toFixed(2)
      : 0;
    const topChannel  = videos[0]?.channelTitle || "Unknown";
    const topViews    = videos[0]?.viewCount?.toLocaleString() || "N/A";

    return {
      keyword,
      trendSummary: `"${keyword}" is currently trending on YouTube with strong engagement averaging ${avgEngRate}% across top videos. The leading video from ${topChannel} has amassed ${topViews} views. Content in this niche performs best when it combines an emotional hook with high-value, actionable information delivered concisely.`,
      commonHooks: [
        `"I tried ${keyword} for 30 days and here's what happened..."`,
        `"The ${keyword} mistake everyone makes (and how to fix it)"`,
        `"This ${keyword} hack changed everything for me"`,
        `"You're doing ${keyword} wrong — here's proof"`,
        `"${keyword} secrets that pros don't want you to know"`,
      ],
      commonFormats: ["Tutorial / How-To", "Transformation / Before & After", "Top Tips Listicle", "Common Mistakes Breakdown", "Personal Story / Vlog"],
      whyTheseVideosAreViral: [
        `The top video titled "${topTitles[0] || keyword}" leveraged a strong curiosity-gap hook in the first 3 seconds.`,
        `Videos in the "${keyword}" niche that show tangible results (numbers, transformations) consistently outperform generic advice.`,
        `High comment counts indicate these videos asked the audience a question or created debate, which boosts the YouTube algorithm.`,
        `Thumbnail + title combinations that challenge conventional wisdom ("you're doing it wrong") drive above-average CTR in this niche.`,
        `Average engagement rate of ${avgEngRate}% suggests highly targeted audience — viewers are genuinely interested, not passive browsers.`,
      ],
      contentIdeas: [
        {
          title: `I Tried ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Every Day for 30 Days — Shocking Results`,
          hook: `"What if I told you that doing ${keyword} consistently for just 30 days could completely transform your results? I put it to the test so you don't have to."`,
          format: "Transformation / Challenge",
          scriptOutline: "1. Hook: Day 1 vs Day 30 reveal • 2. Why I did this challenge • 3. What I did each day • 4. Week-by-week results • 5. Final verdict + what you should do",
          estimatedViralPotential: "High — transformation content performs 3x better in this niche",
        },
        {
          title: `5 ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Mistakes You're Making RIGHT NOW`,
          hook: `"99% of people doing ${keyword} are making at least one of these mistakes — and it's costing them serious results."`,
          format: "Listicle / Educational",
          scriptOutline: "1. Hook — tease the biggest mistake • 2. Mistake #1 (with fix) • 3. Mistake #2 (with fix) • 4. Mistakes #3–5 rapid fire • 5. CTA — drop a keyword to get free guide",
          estimatedViralPotential: "High — mistake-format videos generate 4x more saves",
        },
        {
          title: `The ONLY ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Guide You'll Ever Need (Beginner to Pro)`,
          hook: `"If you're overwhelmed by all the conflicting ${keyword} advice online, this is the only video you need to watch."`,
          format: "Tutorial / Comprehensive Guide",
          scriptOutline: "1. Problem (too much conflicting info) • 2. The simple framework • 3. Beginner level • 4. Intermediate level • 5. Pro level • 6. Next steps CTA",
          estimatedViralPotential: "Medium-High — evergreen content with long-term search traffic",
        },
        {
          title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Expert Reacts to YOUR Content (Brutally Honest)`,
          hook: `"I reviewed 50 videos from beginner ${keyword} creators and I'm going to tell you exactly what's holding you back."`,
          format: "Reaction / Critique",
          scriptOutline: "1. Hook + credibility • 2. Common #1 problem across all videos • 3. Review 3 real examples • 4. Quick wins for each • 5. Comment your niche for next episode",
          estimatedViralPotential: "High — reaction format drives high comments and shares",
        },
        {
          title: `How I Grew My ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} from Zero to 100K (Step-by-Step)`,
          hook: `"12 months ago I knew nothing about ${keyword}. Today I have 100K followers and a 6-figure business. Here's exactly how."`,
          format: "Personal Story / Case Study",
          scriptOutline: "1. Where I started (humble, relatable) • 2. The turning point • 3. The exact strategy I used • 4. Month-by-month milestones • 5. Biggest lesson + free resource",
          estimatedViralPotential: "Medium-High — personal stories build trust and drive profile visits",
        },
      ],
      recommendedPostingStyle: `For "${keyword}" content: Post 3–4x per week consistently. Upload between 6–9 PM local time when your target audience is most active. Use bright, high-contrast thumbnails with a clear facial expression and minimal bold text (3–5 words max). Always end with a comment-bait CTA ("Comment '${keyword}' if you want Part 2"). Use 10–15 niche-specific hashtags rather than generic viral ones. Aim for videos between 6–12 minutes for maximum ad revenue + YouTube recommendation boost.`,
      hashtags: [
        keyword, `${keyword}tips`, `${keyword}advice`, `${keyword}hacks`, `${keyword}101`,
        `learn${keyword}`, `${keyword}content`, `${keyword}growth`, `${keyword}strategy`,
        "youtuber", "contentcreator", "viralvideo", "youtube", "trending", "viral",
      ],
    };
  }

  /**
   * Refines a single video search result using Gemini to generate a better
   * title, script, caption, and hashtags.
   *
   * @param {Object} params - { title, description, platform, channelTitle }
   * @returns {Object} Refinement results matching the RefinedContent schema
   */
  static async refineVideoContent({ title, description, platform = "youtube", channelTitle = "", targetLanguage = "auto" }) {
    const genAI = this._getClient();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    let langInstruction = "";
    if (targetLanguage === "english") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE SCRIPT AND CAPTION TO BE IN ENGLISH. YOU MUST WRITE ALL VALUES IN ENGLISH ONLY. NO HINDI OR OTHER LANGUAGES.`;
    } else if (targetLanguage === "hindi") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE SCRIPT AND CAPTION TO BE IN HINDI. YOU MUST WRITE THE VALUES OF "originalScript", "title", "script.hook", "script.hooks" (both type and text fields), "script.structure", "script.fullScript", AND "caption" ENTIRELY IN HINDI USING DEVANAGARI SCRIPT (हिंदी देवनागरी लिपि). DO NOT WRITE IN ENGLISH.`;
    } else if (targetLanguage === "hinglish") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE SCRIPT AND CAPTION TO BE IN HINGLISH. YOU MUST WRITE THE VALUES OF "originalScript", "title", "script.hook", "script.hooks" (both type and text fields), "script.structure", "script.fullScript", AND "caption" ENTIRELY IN HINGLISH (HINDI WORDS WRITTEN USING LATIN/ENGLISH ALPHABET, E.g., "dosto aaj hum baat karenge...", "video ko skip mat karna", "kaise ho aap log?"). DO NOT WRITE IN HINDI DEVANAGARI SCRIPT OR PURE ENGLISH.`;
    } else {
      langInstruction = `AUTO-DETECT LANGUAGE RULE: Detect the primary language of the original video's Title and Description. If it is Hindi or Hinglish, write the values of "originalScript", "title", "script.hook", "script.hooks", "script.structure", "script.fullScript", and "caption" in that exact language/mix. If it is English, write them in English. Match the tone and language of the original creator.`;
    }

    const prompt = `You are an expert social media growth strategist and copywriter.
I want to analyze and refine a video/post from ${platformName}.

Here is the details of the post:
- Title/Hook: "${title}"
- Description/Caption: "${description || "No description provided."}"
- Creator/Channel: "${channelTitle}"

CRITICAL LANGUAGE REQUIREMENT:
${langInstruction}
YOU MUST STRICTLY FOLLOW THIS LANGUAGE RULE. EVEN IF THE JSON SCHEMA PLACEHOLDERS BELOW ARE SHOWN IN ENGLISH, THE ACTUAL GENERATED CONTENT VALUES OF "originalScript", "title", "script.hook", "script.hooks", "script.structure", "script.fullScript", AND "caption" MUST BE WRITTEN IN THE LANGUAGE STIPULATED ABOVE. THIS IS MANDATORY.

Please analyze this content and provide improvements to make it go viral. Specifically:
1. Reconstruct or estimate a realistic word-for-word transcript/script that was used in the original video (30-60 seconds read time) based on the title, description/caption, and context.
2. Suggest an improved catchy Title.
3. Draft a complete, high-converting refined video Script. Generate 3 distinct scroll-stopping hook variations (e.g. Curiosity, Bold/Controversial, and Storytelling/Value-First) in the target language. Also provide a structure and a complete spoken script.
4. Create a viral-ready Caption/Description that is optimized for engagement and click-through rate.
5. Provide a list of the 10-15 best-suited Hashtags for this content.

Return ONLY a valid JSON object matching this exact schema (no markdown formatting, no explanation, no code fences):
{
  "originalScript": "Reconstructed/estimated word-for-word transcript or script used in the original video (30-60 seconds read time)",
  "title": "Improved Catchy Title Idea",
  "script": {
    "hook": "Opening 1-2 sentence hook designed to grab attention immediately (Primary/Best choice)",
    "hooks": [
      {
        "type": "Curiosity/Question Hook",
        "text": "A curiosity-inducing or question-based hook variation"
      },
      {
        "type": "Controversial/Bold Hook",
        "text": "A bold, contrarian, or high-impact claim hook variation"
      },
      {
        "type": "Storytelling/Value-First Hook",
        "text": "A story/problem-focused or immediate value hook variation"
      }
    ],
    "structure": [
      "1. Intro or Hook setup...",
      "2. Core value delivery...",
      "3. Call to Action..."
    ],
    "fullScript": "A complete, spoken refined script for the video (word-for-word, 30-60 seconds read time)"
  },
  "caption": "Catchy caption with emojis, engaging questions, and Call to Action, ready to copy and paste",
  "hashtags": ["list", "of", "10-15", "relevant", "hashtags", "without", "the", "hash", "symbol"]
}
`;

    const models = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ];

    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[GeminiViralService] Refining content - Trying model: ${modelName}`);
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

        if (!parsed.title || !parsed.script || !parsed.caption || !Array.isArray(parsed.hashtags)) {
          throw new Error("Gemini returned incomplete refinement JSON structure");
        }

        console.log(`[GeminiViralService] Content refinement success with model: ${modelName}`);
        return parsed;
      } catch (err) {
        lastError = err;
        console.error(`[GeminiViralService] Model ${modelName} failed for refinement:`, err.message);
        if (err.message && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429") || err.message.includes("quota"))) {
          break;
        }
      }
    }

    // Fallback if all models fail
    console.warn("[GeminiViralService] Refinement fallback triggered.");
    return this._buildRefinementFallback(title, description, platform, targetLanguage);
  }

  /**
   * Fallback content refinement in case Gemini API is unavailable or fails.
   */
  static _buildRefinementFallback(title, description, platform, targetLanguage = "auto") {
    const cleanTitle = title || "Viral Video";
    const cap = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    
    // Extract key phrases and clean emojis for a realistic personalized script
    const cleanTopic = cleanTitle.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, "").trim();
    const words = cleanTopic.split(/\s+/).filter(w => w.length > 3 && !["this", "that", "with", "from", "your", "have", "about", "what", "here", "want", "know"].includes(w.toLowerCase()));
    const keyword1 = words[0] || "this";

    let originalScript = `Hey guys, today we are looking at "${cleanTitle}". Here is exactly how we can break this down: ${description || "Let's dive into the core strategies used in this post."}`;
    let hook = `Stop scrolling! If you want to know how to actually master "${cleanTopic}", you need to watch this until the end.`;
    let hooks = [
      { type: "Curiosity Hook", text: `Stop scrolling! If you want to know how to actually master "${cleanTopic}", you need to watch this until the end.` },
      { type: "Fear of Missing Out Hook", text: `If you are not using this secret trick for "${cleanTopic}", you are losing views every single day.` },
      { type: "Bold Promise Hook", text: `I will show you the exact 3-step formula to dominate "${cleanTopic}" in under 60 seconds.` }
    ];
    let fullScript = `Stop scrolling! If you want to know how to actually master "${cleanTopic}", you need to watch this until the end. Most people struggle with this because they focus on the wrong approach. Here is the exact fix: First, optimize your overall strategy. Second, implement consistency immediately. Do this for 30 days and watch your metrics explode. If you found this helpful, make sure to follow for more tips and share this with a friend!`;
    let caption = `Unpopular opinion: Most people are doing "${cleanTopic}" wrong... 😳\n\nIf you've been struggling to see results, here's your sign to change your approach. Save this video so you don't forget it, and let me know your thoughts in the comments! 👇\n\n#viral #${keyword1.toLowerCase().replace(/[^a-z0-9]/g, "")} #success #tips`;

    if (targetLanguage === "hindi") {
      originalScript = `नमस्ते दोस्तों, आज हम देख रहे हैं "${cleanTitle}"। हम इसे इस तरह से समझ सकते हैं...`;
      hook = `रुकिए! अगर आप "${cleanTopic}" में बेहतरीन परिणाम चाहते हैं, तो इस वीडियो को अंत तक जरूर देखें।`;
      hooks = [
        { type: "जिज्ञासा हुक (Curiosity)", text: `रुकिए! अगर आप "${cleanTopic}" में बेहतरीन परिणाम चाहते हैं, तो इस वीडियो को अंत तक जरूर देखें।` },
        { type: "नुकसान का डर (FOMO)", text: `अगर आप "${cleanTopic}" के लिए यह सीक्रेट ट्रिक नहीं जानते, तो आप हर दिन अपने व्यूज खो रहे हैं।` },
        { type: "बड़ा वादा (Bold Promise)", text: `मैं आपको सिर्फ 60 सेकंड में "${cleanTopic}" में महारत हासिल करने का बिल्कुल सही फॉर्मूला दिखाऊंगा।` }
      ];
      fullScript = `रुकिए! अगर आप "${cleanTopic}" में बेहतरीन परिणाम चाहते हैं, तो इस वीडियो को अंत तक जरूर देखें। ज्यादातर लोग इसमें असफल होते हैं क्योंकि वे गलत तरीका अपनाते हैं। आज से आपको केवल एक चीज बदलनी है: अपनी स्ट्रेटेजी और निरंतरता पर ध्यान दें। इसे 30 दिनों तक करें और अपने परिणाम देखें। अगर आपको यह मददगार लगा, तो फॉलो करना न भूलें!`;
      caption = `अलोकप्रिय राय: अधिकांश लोग "${cleanTopic}" को गलत तरीके से कर रहे हैं... 😳\n\nयदि आप इसके साथ परिणाम देखने के लिए संघर्ष कर रहे हैं, तो अपना दृष्टिकोण बदलने का यह सही समय है। इस वीडियो को सेव करें और कमेंट्स में अपने विचार बताएं! 👇\n\n#viral #${keyword1.toLowerCase().replace(/[^a-z0-9]/g, "")} #success #tips`;
    } else if (targetLanguage === "hinglish") {
      originalScript = `Hey dosto, aaj hum dekh rahe hai "${cleanTitle}" ke baare me. Isko hum aise samajh sakte hai...`;
      hook = `Ruko! Agar aap "${cleanTopic}" me best results chahte ho, to is video ko end tak zaroor dekho.`;
      hooks = [
        { type: "Curiosity Hook", text: `Ruko! Agar aap "${cleanTopic}" me best results chahte ho, to is video ko end tak zaroor dekho.` },
        { type: "FOMO Hook", text: `Agar aap "${cleanTopic}" ke liye ye secret trick nahi use kar rahe, to aap daily views miss kar rahe ho.` },
        { type: "Bold Promise Hook", text: `Main aapko dikhaunga ek aisa 3-step formula jisse aap "${cleanTopic}" ko 60 seconds me seekh jaoge.` }
      ];
      fullScript = `Ruko! Agar aap "${cleanTopic}" me best results chahte ho, to is video ko end tak zaroor dekho. Zyada tar log isme fail hote hai kyunki wo galat approach use karte hai. Aaj se aapko bas ek chiz badalni hai: apni strategy aur consistency par focus karo. Ise 30 dino tak karo aur apna growth dekho. Agar video acchi lagi to follow zaroor karna!`;
      caption = `Unpopular opinion: Zyada tar log "${cleanTopic}" ko galat tarike se kar rahe hai... 😳\n\nKaise laga aapko ye video? Comment karke zaroor bataye aur aisi videos ke liye follow karein! 👇\n\n#viral #${keyword1.toLowerCase().replace(/[^a-z0-9]/g, "")} #success #tips`;
    }

    return {
      originalScript,
      title: `🔥 Unlocking the Secret to ${cap}`,
      script: {
        hook,
        hooks,
        structure: [
          `1. Hook: Catch attention on "${cleanTopic}"`,
          "2. Problem: Why people fail at this approach",
          "3. Solution: Focus on strategy and consistency",
          "4. Call to Action: Follow and save for later"
        ],
        fullScript
      },
      caption,
      hashtags: ["viral", "trending", "growth", "strategy", "marketing", "contentcreator", keyword1.toLowerCase().replace(/[^a-z0-9]/g, ""), "tips"]
    };
  }
}

module.exports = GeminiViralService;
