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
  static async refineVideoContent({ title, description, platform = "youtube", channelTitle = "", targetLanguage = "auto", step = "all", selectedHook = "", selectedScript = "", videoDuration = "auto" }) {
    if (step === "hooks") {
      return this.generateHooksOnly({ title, description, platform, channelTitle, targetLanguage });
    } else if (step === "scripts") {
      return this.generateScriptsOnly({ title, description, platform, channelTitle, targetLanguage, selectedHook, videoDuration });
    } else if (step === "final") {
      return this.generateFinalRefinement({ title, description, platform, channelTitle, targetLanguage, selectedHook, selectedScript });
    }

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
   * Generates only 3 hooks for the given video details.
   */
  static async generateHooksOnly({ title, description, platform = "youtube", channelTitle = "", targetLanguage = "auto" }) {
    const genAI = this._getClient();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    let langInstruction = "";
    if (targetLanguage === "english") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE HOOKS TO BE IN ENGLISH. YOU MUST WRITE ALL VALUES IN ENGLISH ONLY. NO HINDI OR OTHER LANGUAGES.`;
    } else if (targetLanguage === "hindi") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE HOOKS TO BE IN HINDI. YOU MUST WRITE THE HOOK TEXTS ENTIRELY IN HINDI USING DEVANAGARI SCRIPT (हिंदी देवनागरी लिपि). DO NOT WRITE IN ENGLISH.`;
    } else if (targetLanguage === "hinglish") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE HOOKS TO BE IN HINGLISH. YOU MUST WRITE THE HOOK TEXTS ENTIRELY IN HINGLISH (HINDI WORDS WRITTEN USING LATIN/ENGLISH ALPHABET, E.g., "dosto aaj hum baat karenge..."). DO NOT WRITE IN HINDI DEVANAGARI SCRIPT OR PURE ENGLISH.`;
    } else {
      langInstruction = `AUTO-DETECT LANGUAGE RULE: Detect the primary language of the original video's Title and Description. If it is Hindi or Hinglish, write the hooks in that exact language/mix. Otherwise, write them in English.`;
    }

    const prompt = `You are an expert social media growth strategist and copywriter.
I want to generate 3 viral hooks for a video/post on ${platformName}.

Here is the details of the post:
- Title: "${title}"
- Description: "${description || "No description provided."}"

CRITICAL LANGUAGE REQUIREMENT:
${langInstruction}

Please generate exactly 3 distinct scroll-stopping hook variations:
1. Curiosity / Question Hook (inducing curiosity or asking a compelling question)
2. Controversial / Bold Hook (a bold, contrarian, or high-impact claim)
3. Storytelling / Value-First Hook (a story/problem-focused or immediate value-delivery hook)

Return ONLY a valid JSON object matching this exact schema (no markdown formatting, no explanation, no code fences):
{
  "hooks": [
    {
      "type": "Curiosity/Question Hook",
      "text": "The actual hook text"
    },
    {
      "type": "Controversial/Bold Hook",
      "text": "The actual hook text"
    },
    {
      "type": "Storytelling/Value-First Hook",
      "text": "The actual hook text"
    }
  ]
}`;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[GeminiViralService] Generating hooks - Trying model: ${modelName}`);
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
        });

        const raw = (result.text || "").trim();
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed.hooks) || parsed.hooks.length !== 3) {
          throw new Error("Gemini returned incomplete hooks structure");
        }

        return parsed;
      } catch (err) {
        lastError = err;
        console.error(`[GeminiViralService] Model ${modelName} failed for hooks:`, err.message);
        if (err.message && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429") || err.message.includes("quota"))) {
          break;
        }
      }
    }

    console.warn("[GeminiViralService] Hooks fallback triggered.");
    return this._buildHooksFallback(title, targetLanguage);
  }

  /**
   * Fallback for generating hooks when API is down.
   */
  static _buildHooksFallback(title, targetLanguage = "auto") {
    const cleanTitle = title || "Viral Video";
    const cleanTopic = cleanTitle.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, "").trim();
    if (targetLanguage === "hindi") {
      return {
        hooks: [
          { type: "जिज्ञासा हुक (Curiosity)", text: `रुकिए! अगर आप "${cleanTopic}" में बेहतरीन परिणाम चाहते हैं, तो इस वीडियो को अंत तक जरूर देखें।` },
          { type: "नुकसान का डर (FOMO)", text: `अगर आप "${cleanTopic}" के लिए यह सीक्रेट ट्रिक नहीं जानते, तो आप हर दिन अपने व्यूज खो रहे हैं।` },
          { type: "बड़ा वादा (Bold Promise)", text: `मैं आपको सिर्फ 60 सेकंड में "${cleanTopic}" में महारत हासिल करने का बिल्कुल सही फॉर्मूला दिखाऊंगा।` }
        ]
      };
    } else if (targetLanguage === "hinglish") {
      return {
        hooks: [
          { type: "Curiosity Hook", text: `Ruko! Agar aap "${cleanTopic}" me best results chahte ho, to is video ko end tak zaroor dekho.` },
          { type: "FOMO Hook", text: `Agar aap "${cleanTopic}" ke liye ye secret trick nahi use kar rahe, to aap daily views miss kar rahe ho.` },
          { type: "Bold Promise Hook", text: `Main aapko dikhaunga ek aisa 3-step formula jisse aap "${cleanTopic}" ko 60 seconds me seekh jaoge.` }
        ]
      };
    } else {
      return {
        hooks: [
          { type: "Curiosity/Question Hook", text: `Stop scrolling! If you want to know how to actually master "${cleanTopic}", you need to watch this until the end.` },
          { type: "Controversial/Bold Hook", text: `If you are not using this secret trick for "${cleanTopic}", you are losing views every single day.` },
          { type: "Storytelling/Value-First Hook", text: `I will show you the exact 3-step formula to dominate "${cleanTopic}" in under 60 seconds.` }
        ]
      };
    }
  }

  /**
   * Generates only 3 script variations based on a selected hook.
   */
  static async generateScriptsOnly({ title, description, platform = "youtube", channelTitle = "", targetLanguage = "auto", selectedHook, videoDuration = "auto" }) {
    const genAI = this._getClient();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    let langInstruction = "";
    if (targetLanguage === "english") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE SCRIPTS TO BE IN ENGLISH. YOU MUST WRITE ALL VALUES IN ENGLISH ONLY. NO HINDI OR OTHER LANGUAGES.`;
    } else if (targetLanguage === "hindi") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE SCRIPTS TO BE IN HINDI. YOU MUST WRITE THE SCRIPT TEXTS ENTIRELY IN HINDI USING DEVANAGARI SCRIPT (हिंदी देवनागरी लिपि). DO NOT WRITE IN ENGLISH.`;
    } else if (targetLanguage === "hinglish") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE SCRIPTS TO BE IN HINGLISH. YOU MUST WRITE THE SCRIPT TEXTS ENTIRELY IN HINGLISH (HINDI WORDS WRITTEN USING LATIN/ENGLISH ALPHABET). DO NOT WRITE IN HINDI DEVANAGARI SCRIPT OR PURE ENGLISH.`;
    } else {
      langInstruction = `AUTO-DETECT LANGUAGE RULE: Detect the language of the selected hook. If it is Hindi or Hinglish, write the script variations in that exact language/mix.`;
    }

    let durationInstruction = "";
    if (videoDuration && videoDuration !== "auto" && videoDuration !== "N/A") {
      // Parse duration to total seconds - support ALL formats:
      // "10m 30s", "1h 5m 30s", "10:30", "1:05:30", "630", "PT10M30S"
      let totalSeconds = 0;

      // Format: "XhYmZs" or "Xm Ys" (from YouTubeService._parseDuration)
      const hmsMatch = videoDuration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/i);
      const colonParts = videoDuration.split(":");

      if (colonParts.length === 3) {
        // "H:MM:SS" format
        totalSeconds = parseInt(colonParts[0], 10) * 3600 + parseInt(colonParts[1], 10) * 60 + parseInt(colonParts[2], 10);
      } else if (colonParts.length === 2 && !videoDuration.match(/[hms]/i)) {
        // "M:SS" format (only if no h/m/s letters present)
        totalSeconds = parseInt(colonParts[0], 10) * 60 + parseInt(colonParts[1], 10);
      } else if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
        // "10m 30s", "1h 5m", "45s" etc.
        const h = parseInt(hmsMatch[1] || "0", 10);
        const m = parseInt(hmsMatch[2] || "0", 10);
        const s = parseInt(hmsMatch[3] || "0", 10);
        totalSeconds = h * 3600 + m * 60 + s;
      } else {
        // Pure numeric seconds
        totalSeconds = parseInt(videoDuration, 10) || 0;
      }

      const totalMinutes = totalSeconds / 60;

      if (totalSeconds > 0 && totalMinutes >= 3) {
        // Long-form: calculate proportional word count
        // Speaking rate ~140 words/min, but we scale by video length
        const targetWords = Math.min(Math.round(totalMinutes * 140), 3000);
        const minWords = Math.max(Math.round(targetWords * 0.7), 300);
        durationInstruction = `The original video is a LONG-FORM video (duration: "${videoDuration}", approximately ${Math.round(totalMinutes)} minutes, ${totalSeconds} seconds).

CRITICAL SCRIPT LENGTH REQUIREMENT - THIS IS THE MOST IMPORTANT RULE:
- You MUST generate a DETAILED, COMPREHENSIVE script that matches the video's full duration.
- Target word count: approximately ${minWords} to ${targetWords} words per script variation.
- At a normal speaking pace of ~140 words per minute, a ${Math.round(totalMinutes)}-minute video needs approximately ${targetWords} words.
- DO NOT generate a short 3-4 line summary. That is UNACCEPTABLE for a ${Math.round(totalMinutes)}-minute video.
- Each script must include: Opening hook, multiple body sections with detailed talking points, examples, transitions between sections, and a strong closing CTA.
- Structure it like a real YouTube script with clear sections: INTRO → POINT 1 (with examples) → POINT 2 (with examples) → POINT 3+ → RECAP → CTA/OUTRO.
- For videos over 8 minutes, include at least 5-7 distinct content sections.
- The script should feel like a complete word-for-word speaking guide that fills the entire ${Math.round(totalMinutes)} minutes.`;
      } else if (totalSeconds > 0 && totalMinutes >= 1) {
        // Medium-form (1-3 min): full spoken script
        const targetWords = Math.round(totalMinutes * 140);
        durationInstruction = `The original video is a medium-length video (duration: "${videoDuration}", approximately ${Math.round(totalMinutes * 10) / 10} minutes). You MUST write a complete word-for-word spoken script of approximately ${targetWords} words that fills the entire video duration at a normal speaking pace (~140 words/minute).`;
      } else if (totalSeconds > 0) {
        // Short-form (under 1 min)
        const targetWords = Math.max(Math.round((totalSeconds / 60) * 150), 40);
        durationInstruction = `The original video is a short-form video (duration: "${videoDuration}", approximately ${totalSeconds} seconds). You MUST write the spoken script(s) of approximately ${targetWords} words, matching this length when read aloud at a normal conversational pace.`;
      } else {
        durationInstruction = `The target script length should be around 60-90 seconds read time (approximately 130-200 words) for a social media video.`;
      }
    } else {
      durationInstruction = `The target script length should be around 60-90 seconds read time (approximately 130-200 words) for a social media video.`;
    }

    const prompt = `You are an expert social media growth strategist and copywriter.
I want to write 3 distinct video script variations based on a specific hook for a video/post on ${platformName}.

Here is the details of the post:
- Title: "${title}"
- Description: "${description || "No description provided."}"
- Selected Hook (Opening hook already chosen by user): "${selectedHook}"

CRITICAL DURATION REQUIREMENT:
${durationInstruction}

CRITICAL LANGUAGE REQUIREMENT:
${langInstruction}

Please generate exactly 3 distinct video script variations that build upon this hook and match the duration instruction. Each script must START with the Selected Hook: "${selectedHook}". The variations should have different storytelling styles or angles:
1. Action-oriented & Direct Style (gets straight to the solution with quick points)
2. Educational & Explanation Style (deep dives into the 'why' and 'how')
3. High-Energy / Storyteller Style (uses suspenseful, high-energy delivery or a quick narrative flow)

Return ONLY a valid JSON object matching this exact schema (no markdown formatting, no explanation, no code fences):
{
  "scripts": [
    {
      "type": "Action-oriented Style",
      "text": "The full word-for-word spoken script text starting with the hook"
    },
    {
      "type": "Educational Style",
      "text": "The full word-for-word spoken script text starting with the hook"
    },
    {
      "type": "High-Energy Style",
      "text": "The full word-for-word spoken script text starting with the hook"
    }
  ]
}`;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[GeminiViralService] Generating scripts - Trying model: ${modelName}`);
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            maxOutputTokens: 8192,
          },
        });

        const raw = (result.text || "").trim();
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed.scripts) || parsed.scripts.length !== 3) {
          throw new Error("Gemini returned incomplete scripts structure");
        }

        return parsed;
      } catch (err) {
        lastError = err;
        console.error(`[GeminiViralService] Model ${modelName} failed for scripts:`, err.message);
        if (err.message && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429") || err.message.includes("quota"))) {
          break;
        }
      }
    }

    console.warn("[GeminiViralService] Scripts fallback triggered.");
    return this._buildScriptsFallback(title, selectedHook, targetLanguage);
  }

  static _buildScriptsFallback(title, selectedHook, targetLanguage = "auto") {
    const cleanTitle = title || "Viral Video";
    const cleanTopic = cleanTitle.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, "").trim();
    if (targetLanguage === "hindi") {
      return {
        scripts: [
          {
            type: "एक्शन-ओरिएंटेड (Action-oriented)",
            text: `${selectedHook}\n\nतो चलिए बात करते हैं "${cleanTopic}" के बारे में। सबसे पहले आपको समझना होगा कि ज़्यादातर लोग इसे गलत तरीके से approach करते हैं।\n\n🔹 पहला स्टेप: अपनी स्ट्रेटेजी को पूरी तरह बदलें। आपको यह समझना होगा कि पुराने तरीके अब काम नहीं करते। मार्केट बदल चुका है, algorithm बदल चुका है, और audience की expectations भी बदल चुकी हैं। इसलिए आपको नए mindset के साथ शुरुआत करनी होगी।\n\n🔹 दूसरा स्टेप: कंसिस्टेंसी सबसे जरूरी है। बहुत से creators 1-2 हफ्ते try करके छोड़ देते हैं। लेकिन algorithm को समय लगता है आपकी content को समझने में। कम से कम 30 दिनों तक रोज़ाना post करें, analytics देखें, और अपनी performance track करें।\n\n🔹 तीसरा स्टेप: थंबनेल और title पर ध्यान दें। यह सबसे पहली चीज़ है जो viewer देखता है। अगर यह attractive नहीं है तो कोई click ही नहीं करेगा। Bright colors, expressive faces, और 3-5 words maximum - यही formula है।\n\n🔹 चौथा स्टेप: पहले 10 सेकंड में viewer को hook करें। अगर viewer 10 सेकंड में engaged नहीं हुआ तो वो scroll कर देगा। इसलिए शुरुआत में सबसे interesting part रखें।\n\n🔹 पांचवा स्टेप: Community building करें। Comments का reply दें, polls और questions post करें, और अपने audience को feel करवाएं कि आप उनकी care करते हैं।\n\nइन 5 स्टेप्स को आज ही फॉलो करें और 30 दिनों बाद results देखें। मैं guarantee देता/देती हूँ कि आपको difference दिखेगा। अगर यह video helpful लगी तो like और share ज़रूर करें, और subscribe कर लें ताकि ऐसी और videos miss ना हों!`
          },
          {
            type: "शैक्षणिक (Educational)",
            text: `${selectedHook}\n\nआइए गहराई से समझते हैं कि "${cleanTopic}" actually कैसे काम करता है और ज़्यादातर लोग कहां गलती करते हैं।\n\nसबसे पहले, आपको algorithm को समझना होगा। YouTube, Instagram, या कोई भी platform - हर platform का goal एक ही है: users को ज़्यादा देर तक platform पर रखना। इसका मतलब यह है कि अगर आपकी content viewers को engage रखती है, तो algorithm आपकी content को और ज़्यादा लोगों तक पहुंचाएगा।\n\nइसके लिए सबसे important metric है Watch Time, यानी लोग आपकी video कितनी देर तक देखते हैं। अगर average view duration 50% से ज़्यादा है, तो यह बहुत अच्छा signal है।\n\nदूसरी बात, engagement rate matter करता है। Likes, comments, shares - ये सब signals हैं जो algorithm को बताते हैं कि यह content valuable है। लेकिन यहां trick यह है कि organic engagement ज़्यादा valuable है। Comment section में genuine conversations शुरू करें।\n\nतीसरी बात, posting time और frequency बहुत matter करती है। Research से पता चलता है कि शाम 6 से 9 बजे के बीच post करने पर सबसे ज़्यादा reach मिलती है, क्योंकि इस time पर लोग relax mode में होते हैं और content consume कर रहे होते हैं।\n\nचौथी और सबसे ज़रूरी बात - content quality बनाम quantity। बहुत से experts कहते हैं कि quantity ज़रूरी है, लेकिन अगर quality compromise हो रही है तो यह long-term में नुकसान करेगा। Balance बनाए रखें।\n\nतो summary यह है: Watch time बढ़ाएं, organic engagement लाएं, सही time पर post करें, और quality maintain करें। इन चारों चीज़ों पर focus करें और results देखें। Comment में बताएं कि आपके लिए सबसे helpful point कौन सा था!`
          },
          {
            type: "हाई-एनर्जी (High-Energy)",
            text: `${selectedHook}\n\nसुनिए, मैं आज आपको वो बात बताने जा रहा/रही हूँ जो कोई नहीं बताएगा। "${cleanTopic}" के बारे में internet पर जितनी भी information है, उसका 90% outdated है!\n\nमैंने personally last 6 months में experiment किया है और जो results आए हैं वो mind-blowing हैं। पहले मेरे views 100-200 आते थे, अब consistently 10K+ आ रहे हैं। और सबसे बड़ी बात - यह कोई hack नहीं है, यह एक proper system है।\n\nLet me break it down for you:\n\nPoint number 1 - HOOK! पहले 3 सेकंड में viewer को चौंका दो। कुछ ऐसा बोलो जो unexpected हो। "Kya aapko pata hai..." या "Ye mat karna warna..." जैसे openers use करो।\n\nPoint number 2 - RETENTION! Video के बीच में "Wait, abhi best part aane wala hai" या "Number 3 toh sabse shocking hai" जैसे retention hooks डालो। इससे viewer skip नहीं करता।\n\nPoint number 3 - CTA! End में sirf "Like subscribe" mat bolo. Kuch creative karo - "Agar ye video 1000 likes cross kar gayi toh part 2 laaunga" - इससे urgency create होती है।\n\nPoint number 4 - CONSISTENCY! Daily post karo. Haan, DAILY! Starting mein quality perfect nahi hogi, but algorithm ko signal chahiye ki tum serious ho.\n\nPoint number 5 - TRENDS! Trending audio, trending topics, trending formats - inko adapt karo apne niche ke according.\n\nYe 5 cheezein kar lo next 30 din, aur agar results na aayein toh mujhe DM kar dena. Main personally help karunga. Abhi video save karo aur share karo un logon ko jinhe ye information chahiye!`
          }
        ]
      };
    } else if (targetLanguage === "hinglish") {
      return {
        scripts: [
          {
            type: "Action-oriented Style",
            text: `${selectedHook}\n\nToh baat karte hain "${cleanTopic}" ke baare mein. Zyada tar log isse galat tarike se approach karte hain, aur isliye unhe results nahi milte.\n\n🔹 Step 1: Apni strategy ko completely overhaul karo. Purane methods ab kaam nahi karte. Market change ho chuka hai, algorithm update ho chuka hai, aur audience bhi ab different content expect karti hai. Toh naye mindset ke saath start karo.\n\n🔹 Step 2: Consistency king hai. Bahut se creators 1-2 weeks try karke chhod dete hain. Lekin algorithm ko time lagta hai aapki content understand karne mein. Minimum 30 din tak daily post karo, apne analytics check karo, aur performance track karo.\n\n🔹 Step 3: Thumbnail aur title pe dhyan do. Yahi sabse pehli cheez hai jo viewer dekhta hai. Agar attractive nahi hai toh koi click hi nahi karega. Bright colors, expressive faces, aur 3-5 words maximum - yahi winning formula hai.\n\n🔹 Step 4: Pehle 10 seconds mein viewer ko hook karo. Agar viewer 10 seconds mein engaged nahi hua toh scroll kar dega. Isliye shuruat mein sabse interesting part rakho.\n\n🔹 Step 5: Community build karo. Comments ka reply do, polls aur questions post karo, apne audience ko feel karao ki aap unki value karte ho.\n\nIn 5 steps ko aaj se follow karo aur 30 din baad difference dekho. Guaranteed results milenge! Video helpful lagi toh like share zaroor karo!`
          },
          {
            type: "Educational Style",
            text: `${selectedHook}\n\nAaiye deep dive karte hain ki "${cleanTopic}" actually kaise kaam karta hai aur zyada tar log kahan galti karte hain.\n\nSabse pehle, algorithm ko samajhna zaroori hai. YouTube ho ya Instagram, har platform ka ek hi goal hai - users ko zyada se zyada time tak platform pe rakhna. Iska matlab yeh hai ki agar aapki content viewers ko engage rakhti hai, toh algorithm aapko reward karega.\n\nIske liye sabse important metric hai Average View Duration. Yani log aapki video kitni der tak dekhte hain. Agar 50% se zyada hai, excellent signal hai. Agar 30% se kam hai toh content mein problem hai.\n\nDoosri baat - engagement rate. Likes, comments, shares - ye sab signals hain jo algorithm ko batate hain ki content valuable hai. Lekin organic engagement zyada matter karta hai. Fake engagement se algorithm aapko punish karega.\n\nTeesri baat - posting schedule. Research se pata chalta hai ki evening 6 se 9 PM ke beech post karne par sabse zyada reach milti hai. Kyunki is time log relaxed hote hain aur content consume karte hain.\n\nChauthi baat - content quality vs quantity ka balance. Bahut se experts kehte hain ki quantity important hai, par agar quality compromise ho rahi hai toh long-term mein nuksan hoga. Smart creators dono ka balance rakhte hain.\n\nSummary: Watch time badhao, organic engagement lao, sahi time pe post karo, quality maintain karo. In charon cheezon pe focus karo aur results definitely aayenge. Comment mein batao ki sabse helpful point kaunsa laga!`
          },
          {
            type: "High-Energy Style",
            text: `${selectedHook}\n\nSuno, main aaj tumhe wo baat batane jaa raha/rahi hoon jo koi nahi batayega. "${cleanTopic}" ke baare mein internet pe jo bhi information hai, uska 90% outdated hai!\n\nMaine personally last 6 months mein experiment kiya hai aur jo results aaye hain wo mind-blowing hain. Pehle mere views 100-200 aate the, ab consistently 10K+ aa rahe hain.\n\nLet me break it down:\n\nNumber 1 - HOOK! Pehle 3 seconds mein viewer ko surprise karo. Unexpected cheez bolo. "Kya aapko pata hai..." ya "Ye mat karna warna..." jaise openers use karo.\n\nNumber 2 - RETENTION! Video ke beech mein "Ruko, abhi best part aane wala hai" ya "Number 3 sabse shocking hai" jaise hooks daalo. Viewer skip nahi karega.\n\nNumber 3 - CTA game strong rakho! End mein sirf "Like subscribe" mat bolo. Creative bano - "Agar ye video 1000 likes cross kar gayi toh part 2 launga" - urgency create karo.\n\nNumber 4 - DAILY post karo! Starting mein quality perfect nahi hogi, but algorithm ko signal chahiye ki tum serious ho. Consistency hi sabse bada secret hai.\n\nNumber 5 - TRENDS follow karo! Trending audio, trending topics, trending formats - inko apne niche ke according adapt karo. Jo trend pe hai usse related content banao.\n\nYe 5 cheezein next 30 din karo, guarantee deta/deti hoon results aayenge! Abhi video save karo, apne ek dost ko share karo jinhe ye information chahiye, aur comment karo "DONE" agar tum ready ho!`
          }
        ]
      };
    } else {
      return {
        scripts: [
          {
            type: "Action-oriented Style",
            text: `${selectedHook}\n\nLet's talk about "${cleanTopic}" and why most people are approaching it completely wrong. I'm going to give you a step-by-step action plan that you can implement starting today.\n\n🔹 Step 1: Completely overhaul your strategy. The old methods don't work anymore. The market has changed, algorithms have been updated, and your audience expects different content now. You need to start with a fresh mindset.\n\n🔹 Step 2: Consistency is everything. So many creators try for 1-2 weeks and then give up. But the algorithm needs time to understand your content. Commit to posting daily for at least 30 days. Track your analytics, study what's working, and double down on it.\n\n🔹 Step 3: Your thumbnail and title are your first impression. If they're not compelling, nobody clicks. Use bright, contrasting colors, expressive faces, and keep text to 3-5 words maximum. A/B test different styles to find what works for your niche.\n\n🔹 Step 4: Hook viewers in the first 10 seconds. If a viewer isn't engaged within the first 10 seconds, they're scrolling away. Put your most interesting content upfront. Start with a bold claim, a surprising fact, or a provocative question.\n\n🔹 Step 5: Build a community, not just an audience. Reply to every comment, use polls and questions, and make your viewers feel valued. Community engagement is the strongest signal to any algorithm.\n\nImplement these 5 steps starting today, and in 30 days you'll see a dramatic difference. If this video was helpful, smash that like button and subscribe so you don't miss the next one. Drop a comment below telling me which step you're starting with!`
          },
          {
            type: "Educational Style",
            text: `${selectedHook}\n\nLet's take a deep dive into how "${cleanTopic}" actually works and where most people go wrong. I've spent months researching this, and I'm going to break it down in a way that actually makes sense.\n\nFirst, let's understand the algorithm. Whether it's YouTube, Instagram, or any platform, every algorithm has one primary goal: keeping users on the platform longer. This means if your content keeps viewers engaged, the algorithm will reward you by pushing your content to more people.\n\nThe most important metric here is Watch Time, specifically Average View Duration. This tells you what percentage of your video people actually watch. If it's above 50%, that's excellent. If it's below 30%, there's a fundamental problem with your content structure.\n\nSecond, engagement rate matters enormously. Likes, comments, shares - these are all signals that tell the algorithm your content is valuable. But here's the nuance: organic engagement is far more valuable than artificial engagement. The algorithm can detect patterns, so focus on creating genuine conversations in your comment section.\n\nThird, timing and frequency play a bigger role than most people realize. Research consistently shows that posting between 6-9 PM local time yields the highest reach, because that's when people are in relaxation mode and actively consuming content.\n\nFourth, and this is crucial - the quality versus quantity debate. Many experts preach quantity, but if quality suffers, it hurts you long-term. The smartest creators find a sustainable balance. Maybe that's 3 high-quality videos per week instead of 7 mediocre ones.\n\nFifth, understand your analytics deeply. Most creators glance at views and move on. But the real insights are in retention graphs, traffic sources, and audience demographics. Spend 15 minutes every day studying your analytics.\n\nSo to summarize: maximize watch time, drive organic engagement, post at optimal times, maintain quality, and study your data. Focus on these five pillars and you'll see consistent growth. Let me know in the comments which principle was most eye-opening for you!`
          },
          {
            type: "High-Energy Style",
            text: `${selectedHook}\n\nListen, I'm about to tell you something that nobody else will. 90% of the information out there about "${cleanTopic}" is completely outdated!\n\nI personally ran experiments over the last 6 months and the results were absolutely mind-blowing. My views went from 100-200 to consistently hitting 10K+. And the best part? This isn't some sketchy hack - it's a proven system.\n\nLet me break it down for you:\n\nNumber 1 - THE HOOK! You have exactly 3 seconds to grab someone's attention. Say something unexpected. Something that makes them think "Wait, WHAT?" Use openers like "Nobody talks about this but..." or "Stop scrolling, this will change everything..."\n\nNumber 2 - RETENTION LOOPS! In the middle of your video, drop lines like "But wait, the best part is coming up" or "Number 3 is the most shocking one." These psychological triggers keep viewers watching because they don't want to miss out.\n\nNumber 3 - YOUR CTA GAME! Stop just saying "like and subscribe." Get creative! Try "If this hits 1000 likes, I'll drop part 2 with the advanced strategy" - this creates urgency and gives people a reason to engage.\n\nNumber 4 - POST EVERY. SINGLE. DAY. Yes, DAILY! Your first videos won't be perfect, and that's okay. The algorithm needs to see that you're serious. Consistency is the single biggest differentiator between creators who make it and those who don't.\n\nNumber 5 - RIDE THE TRENDS! Trending audio, trending topics, trending formats - adapt them to your niche. Don't copy, ADAPT. Put your unique spin on what's already working.\n\nDo these 5 things for the next 30 days. If you don't see results, DM me and I'll personally help you figure out what's going wrong. Save this video RIGHT NOW, share it with one friend who needs to hear this, and comment "I'M IN" if you're ready to start!`
          }
        ]
      };
    }
  }

  /**
   * Generates final title, caption, hashtags based on selected hook and script.
   */
  static async generateFinalRefinement({ title, description, platform = "youtube", channelTitle = "", targetLanguage = "auto", selectedHook, selectedScript }) {
    const genAI = this._getClient();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

    let langInstruction = "";
    if (targetLanguage === "english") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE CAPTION TO BE IN ENGLISH. YOU MUST WRITE THE CAPTION IN ENGLISH ONLY. NO HINDI OR OTHER LANGUAGES.`;
    } else if (targetLanguage === "hindi") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE CAPTION TO BE IN HINDI. YOU MUST WRITE THE CAPTION ENTIRELY IN HINDI USING DEVANAGARI SCRIPT (हिंदी देवनागरी लिपि). DO NOT WRITE IN ENGLISH.`;
    } else if (targetLanguage === "hinglish") {
      langInstruction = `THE USER HAS EXPLICITLY REQUESTED THE CAPTION TO BE IN HINGLISH. YOU MUST WRITE THE CAPTION ENTIRELY IN HINGLISH (HINDI WORDS WRITTEN USING LATIN/ENGLISH ALPHABET). DO NOT WRITE IN HINDI DEVANAGARI SCRIPT OR PURE ENGLISH.`;
    } else {
      langInstruction = `AUTO-DETECT LANGUAGE RULE: Detect the language of the selected script. If it is Hindi or Hinglish, write the caption/description in that exact language/mix.`;
    }

    const prompt = `You are an expert social media growth strategist and copywriter.
I want to finalize the viral content optimization package for a video/post on ${platformName}.

Here is the details:
- Original Title: "${title}"
- Original Description: "${description || "No description provided."}"
- Selected Hook: "${selectedHook}"
- Selected Script: "${selectedScript}"

CRITICAL LANGUAGE REQUIREMENT:
${langInstruction}

Please generate:
1. An improved, high-converting catchy Title.
2. A viral-ready Caption/Description that is optimized for engagement, includes relevant emojis, questions, and a Call to Action (CTA).
3. A list of the 10-15 best-suited Hashtags (without the hash symbol) tailored to this content.

Return ONLY a valid JSON object matching this exact schema (no markdown formatting, no explanation, no code fences):
{
  "title": "Improved Catchy Title Idea",
  "caption": "Catchy caption with emojis, engaging questions, and Call to Action, ready to copy and paste",
  "hashtags": ["list", "of", "10-15", "relevant", "hashtags", "without", "the", "hash", "symbol"]
}`;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[GeminiViralService] Generating final - Trying model: ${modelName}`);
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: prompt,
        });

        const raw = (result.text || "").trim();
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned);

        if (!parsed.title || !parsed.caption || !Array.isArray(parsed.hashtags)) {
          throw new Error("Gemini returned incomplete final refinement JSON structure");
        }

        // Package everything together for the client response
        return {
          title: parsed.title,
          script: {
            hook: selectedHook,
            fullScript: selectedScript,
            structure: [
              "1. Selected opening hook",
              "2. Value delivery body",
              "3. Outro & Call to Action"
            ]
          },
          caption: parsed.caption,
          hashtags: parsed.hashtags
        };
      } catch (err) {
        lastError = err;
        console.error(`[GeminiViralService] Model ${modelName} failed for final refinement:`, err.message);
        if (err.message && (err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("429") || err.message.includes("quota"))) {
          break;
        }
      }
    }

    console.warn("[GeminiViralService] Final fallback triggered.");
    return this._buildFinalFallback(title, selectedHook, selectedScript, targetLanguage);
  }

  /**
   * Fallback for generating final details when API is down.
   */
  static _buildFinalFallback(title, selectedHook, selectedScript, targetLanguage = "auto") {
    const cleanTitle = title || "Viral Video";
    const cleanTopic = cleanTitle.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, "").trim();
    const words = cleanTopic.split(/\s+/).filter(w => w.length > 3);
    const keyword = words[0] || "viral";

    let titleIdea = `🔥 Unlocking the Secret to ${cleanTopic}`;
    let caption = `Unpopular opinion: Most people are doing "${cleanTopic}" wrong... 😳\n\nIf you've been struggling to see results, here's your sign to change your approach. Save this video so you don't forget it, and let me know your thoughts in the comments! 👇\n\n#viral #${keyword.toLowerCase().replace(/[^a-z0-9]/g, "")} #success #tips`;

    if (targetLanguage === "hindi") {
      titleIdea = `🔥 ${cleanTopic} का गुप्त रहस्य जानिए`;
      caption = `अलोकप्रिय राय: अधिकांश लोग "${cleanTopic}" को गलत तरीके से कर रहे हैं... 😳\n\nयदि आप इसके साथ परिणाम देखने के लिए संघर्ष कर रहे हैं, तो अपना दृष्टिकोण बदलने का यह सही समय है। इस वीडियो को सेव करें और कमेंट्स में अपने विचार बताएं! 👇\n\n#viral #${keyword.toLowerCase().replace(/[^a-z0-9]/g, "")} #success #tips`;
    } else if (targetLanguage === "hinglish") {
      titleIdea = `🔥 ${cleanTopic} Ka Secret Blueprint`;
      caption = `Unpopular opinion: Zyada tar log "${cleanTopic}" ko galat tarike se kar rahe hai... 😳\n\nKaise laga aapko ye video? Comment karke zaroor bataye aur aisi videos ke liye follow karein! 👇\n\n#viral #${keyword.toLowerCase().replace(/[^a-z0-9]/g, "")} #success #tips`;
    }

    return {
      title: titleIdea,
      script: {
        hook: selectedHook,
        fullScript: selectedScript,
        structure: [
          "1. Selected opening hook",
          "2. Value delivery body",
          "3. Outro & Call to Action"
        ]
      },
      caption,
      hashtags: ["viral", "trending", "growth", "strategy", "marketing", "contentcreator", keyword.toLowerCase().replace(/[^a-z0-9]/g, ""), "tips"]
    };
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

  /**
   * Generates 3 distinct scripts and a reconstructed transcript from Instagram caption/niche.
   */
  static async generateInstagramScripts({ caption, niche, targetLanguage = "hinglish" }) {
    const genAI = this._getClient();

    let langInstruction = "";
    if (targetLanguage === "english") {
      langInstruction = `THE ENTIRE OUTPUT MUST BE IN ENGLISH ONLY. NO HINDI OR HINGLISH.`;
    } else if (targetLanguage === "hindi") {
      langInstruction = `THE ENTIRE OUTPUT (except keys and visual/audio cues in brackets) MUST BE IN HINDI (using Devanagari script, हिंदी देवनागरी लिपि). E.g. "नमस्ते दोस्तों, आज हम बात करेंगे..."`;
    } else if (targetLanguage === "hinglish") {
      langInstruction = `THE ENTIRE OUTPUT (except keys and visual/audio cues in brackets) MUST BE IN HINGLISH (Hindi words written in the English alphabet/Latin script). E.g., "Doston, kya aap bhi success paana chahte ho? Toh follow karo ye 3 rules."`;
    }

    const prompt = `You are a world-class viral video scriptwriter and social media growth hacker.
I want you to analyze this Instagram video context:
- Caption/Description: "${caption || "Not provided"}"
- Niche/Topic: "${niche || "General"}"

Tasks:
1. Reconstruct the word-for-word spoken subtitles/transcript ("originalTranscript") of the original video based on the provided caption/subtitles/summary context. This must represent exactly what was spoken in the original video, formatted line-by-line.
2. Using the reconstructed subtitles as the source foundation, generate 3 different, high-retention video script variations (each about 60 seconds duration, around 120-150 spoken words). Each variation must adapt the same core message of the subtitles but rewrite it to match these specific marketing formulas:
   - Script 1: "Curiosity Loop" (Starts with a curiosity hook, raises a question, delivers value).
   - Script 2: "Controversial / Bold Claim" (Pattern interrupt hook, high-impact contrarian claim, delivers value).
   - Script 3: "Storytelling / Value-First" (Narrative hook, personal story style, delivers value).
3. Generate a highly optimized Caption and 10-15 Hashtags (without '#' symbols).

CRITICAL LANGUAGE RULE:
${langInstruction}
You MUST strictly follow this language rule. All text values for originalTranscript, title, hook, fullScript, caption must be in the specified language (Hindi, English, or Hinglish).

Return ONLY a valid JSON object matching this exact schema (no markdown, no extra explanation, no code blocks):
{
  "originalTranscript": "Estimated original video script",
  "scripts": [
    {
      "type": "Curiosity Loop",
      "title": "Script Title",
      "hook": "Opening hook",
      "fullScript": "Complete word-for-word script body with visual cues in brackets, e.g. [Visual: ...]"
    },
    {
      "type": "Controversial / Bold Claim",
      "title": "Script Title",
      "hook": "Opening hook",
      "fullScript": "Complete word-for-word script body with visual cues in brackets, e.g. [Visual: ...]"
    },
    {
      "type": "Storytelling / Value-First",
      "title": "Script Title",
      "hook": "Opening hook",
      "fullScript": "Complete word-for-word script body with visual cues in brackets, e.g. [Visual: ...]"
    }
  ],
  "caption": "Suggested caption text with emojis and CTA",
  "hashtags": ["tag1", "tag2", "tag3"]
}`;

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
    let lastError = null;

    for (const modelName of models) {
      try {
        console.log(`[GeminiViralService] generateInstagramScripts - Trying model: ${modelName}`);
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

        if (!parsed.originalTranscript || !Array.isArray(parsed.scripts) || parsed.scripts.length < 3) {
          throw new Error("Gemini returned incomplete script JSON structure");
        }

        return parsed;
      } catch (err) {
        console.error(`[GeminiViralService] generateInstagramScripts model ${modelName} failed:`, err.message);
        lastError = err;
      }
    }

    // Fallback if AI fails completely
    const cleanNiche = niche || "content creation";
    const cleanCaption = caption ? caption.substring(0, 50) : "viral topic";
    
    let fallbackTranscript = "";
    let fallbackScripts = [];
    let fallbackCaption = "";
    
    if (targetLanguage === "hindi") {
      fallbackTranscript = `नमस्ते दोस्तों! आज हम बात करेंगे ${cleanNiche} के बारे में। इस वीडियो में दिखाई गई टिप्स को ध्यान से देखें।`;
      fallbackScripts = [
        {
          type: "Curiosity Loop",
          title: "क्या आप भी ये गलती कर रहे हैं?",
          hook: `क्या आप जानते हैं कि ${cleanNiche} में 90% लोग क्यों असफल होते हैं?`,
          fullScript: `[Visual: Text overlay 'Avoid this ${cleanNiche} mistake']\nक्या आप जानते हैं कि ${cleanNiche} में 90% लोग क्यों असफल होते हैं? आज मैं आपको बताऊंगा वो 1 सीक्रेट ट्रिक जो कोई नहीं बताता।\n\n[Visual: B-Roll transitions]\nअधिकांश लोग बिना किसी प्लानिंग के काम करते हैं। आपको बस सही फॉर्म और कंसिस्टेंसी पर ध्यान देना है।\n\n[Visual: Action shot]\nइसे आज ही ट्राई करें और कमेंट में बताएं!`
        },
        {
          type: "Controversial / Bold Claim",
          title: "कंसिस्टेंसी से ज्यादा कुछ नहीं",
          hook: `हार्ड वर्क करना बंद करो! स्मार्ट वर्क ही असली गेम है।`,
          fullScript: `[Visual: Text overlay 'Stop Working Hard']\nहार्ड वर्क करना बंद करो! स्मार्ट वर्क ही असली गेम है। अगर आप ${cleanNiche} में घंटों बिता रहे हैं, तो आप गलत कर रहे हैं।\n\n[Visual: Screen recording]\nआपको बस 20% एफर्ट्स सही जगह लगाने हैं जो 80% रिजल्ट्स दें।\n\n[Visual: Outro]\nइस रील को सेव करें और अपने दोस्तों के साथ शेयर करें।`
        },
        {
          type: "Storytelling / Value-First",
          title: "मेरी 30 दिनों की यात्रा",
          hook: `मैंने सिर्फ 30 दिनों में ${cleanNiche} में अपने परिणाम बदल लिए।`,
          fullScript: `[Visual: Transformation slide]\nमैंने सिर्फ 30 दिनों में ${cleanNiche} में अपने परिणाम बदल लिए। शुरू में मुझे भी लगता था कि ये असंभव है।\n\n[Visual: Daily habits show]\nलेकिन जब मैंने ये 3 आदतें अपनाईं, तो सब बदल गया।\n\n[Visual: Outro]\nफॉलो बटन दबाएं ऐसी और वीडियो के लिए!`
        }
      ];
      fallbackCaption = `क्या आप भी ${cleanNiche} में ग्रो करना चाहते हैं? 😫 इन टिप्स को फॉलो करें और रील को सेव कर लें! #viral #${cleanNiche.replace(/\s+/g, "")} #success`;
    } else if (targetLanguage === "hinglish") {
      fallbackTranscript = `Hey guys! Aaj hum baat karenge ${cleanNiche} ke baare me. Is video me jo tips hai use dhyan se dekhna.`;
      fallbackScripts = [
        {
          type: "Curiosity Loop",
          title: "Kya aap ye mistake kar rahe ho?",
          hook: `Kya aapko pata hai ki ${cleanNiche} me 90% log kyun fail hote hai?`,
          fullScript: `[Visual: Text overlay 'Avoid this ${cleanNiche} mistake']\nKya aapko pata hai ki ${cleanNiche} me 90% log kyun fail hote hai? Aaj mai aapko bataunga wo 1 secret trick jo koi nahi batata.\n\n[Visual: B-Roll transitions]\nZyada tar log bina kisi planning ke kaam karte hai. Aapko bas sahi form aur consistency par focus karna hai.\n\n[Visual: Action shot]\nIse aaj hi try karein aur comments me batayein!`
        },
        {
          type: "Controversial / Bold Claim",
          title: "Stop Hard Work!",
          hook: `Hard work karna band karo! Smart work hi asli game hai.`,
          fullScript: `[Visual: Text overlay 'Stop Working Hard']\nHard work karna band karo! Smart work hi asli game hai. Agar aap ${cleanNiche} me ghanto laga rahe ho, to aap wrong direction me ja rahe ho.\n\n[Visual: Screen recording]\nBas 20% sahi inputs dalo jo 80% results dein.\n\n[Visual: Outro]\nIs reel ko save karein aur follow karna na bhulein!`
        },
        {
          type: "Storytelling / Value-First",
          title: "My 30-Day Growth",
          hook: `Maine bas 30 days me ${cleanNiche} me apne results change kiye.`,
          fullScript: `[Visual: Transformation slide]\nMaine bas 30 days me ${cleanNiche} me apne results change kiye. Start me mujhe bhi lagta tha ki ye impossible hai.\n\n[Visual: Daily habits show]\nBut jab maine ye 3 daily habits build ki, sab badal gaya.\n\n[Visual: Outro]\nAise aur content ke liye abhi follow button click karein!`
        }
      ];
      fallbackCaption = `Kya aap bhi ${cleanNiche} me grow karna chahte ho? 😫 In tips ko follow karo aur reel ko save kar lo! #viral #${cleanNiche.replace(/\s+/g, "")} #success`;
    } else {
      fallbackTranscript = `Hey guys! Today we are looking at ${cleanNiche}. Pay close attention to the tips shown in this video.`;
      fallbackScripts = [
        {
          type: "Curiosity Loop",
          title: "Are you making this mistake?",
          hook: `Did you know that 90% of people fail at ${cleanNiche}?`,
          fullScript: `[Visual: Text overlay 'Avoid this ${cleanNiche} mistake']\nDid you know that 90% of people fail at ${cleanNiche}? Today I'll reveal the number one secret trick that nobody tells you.\n\n[Visual: B-Roll transitions]\nMost creators upload randomly without planning. You just need to focus on correct form and consistency.\n\n[Visual: Action shot]\nTry this today and let me know in the comments!`
        },
        {
          type: "Controversial / Bold Claim",
          title: "Stop Hard Work!",
          hook: `Stop working hard! Smart work is the real deal.`,
          fullScript: `[Visual: Text overlay 'Stop Working Hard']\nStop working hard! Smart work is the real deal. If you're spending hours on ${cleanNiche}, you're doing it wrong.\n\n[Visual: Screen recording]\nIdentify the 20% high-leverage activities that generate 80% of your gains.\n\n[Visual: Outro]\nSave this reel and share it with a friend!`
        },
        {
          type: "Storytelling / Value-First",
          title: "My 30-Day Journey",
          hook: `I completely transformed my ${cleanNiche} results in 30 days.`,
          fullScript: `[Visual: Transformation slide]\nI completely transformed my ${cleanNiche} results in 30 days. At first, I thought it was impossible.\n\n[Visual: Daily habits show]\nBut once I applied these 3 simple daily habits, everything changed.\n\n[Visual: Outro]\nHit the follow button for more value like this!`
        }
      ];
      fallbackCaption = `Do you want to scale your ${cleanNiche}? 😫 Check out these tips and save this reel for later! #viral #${cleanNiche.replace(/\s+/g, "")} #success`;
    }

    return {
      originalTranscript: fallbackTranscript,
      scripts: fallbackScripts,
      caption: fallbackCaption,
      hashtags: [cleanNiche.replace(/\s+/g, ""), "viral", "trending", "growth", "instagramreels"]
    };
  }
}

module.exports = GeminiViralService;
