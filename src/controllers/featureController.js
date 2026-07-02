const CalendarItem = require("../models/CalendarItem");
const CommunityPost = require("../models/CommunityPost");
const AutomationRule = require("../models/AutomationRule");
const BrandDealApplication = require("../models/BrandDealApplication");
const BrandDeal = require("../models/BrandDeal");
const Notification = require("../models/Notification");
const Community = require("../models/Community");
const { getIO } = require("../utils/socket");
const User = require("../models/User");
const InstagramAccount = require("../models/InstagramAccount");
const { brandDeals, courses, tools } = require("../utils/mockData");
const { getPlatformMetricsForUser } = require("../services/platformMetricsService");
const { getBrandSuggestions } = require("../services/brandDealSuggestionService");
const { GoogleGenAI } = require("@google/genai");
const { sendPlanReminderEmail } = require("../utils/mailer");
const fs = require("fs");


const dashboardStats = async (req, res) => {
  res.json({
    weeklyGrowth: "+8.4%",
    monthlyGrowth: "+23.1%",
    engagementRate: "7.8%",
    totalViews: 245000,
    quickActions: ["Create Script", "Find Reels", "Open Calendar"],
  });
};



const generateScript = async (req, res) => {
  const { topic = "content growth", niche = "general creators", answers = [], duration = "30-60s" } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // Duration config
  const durationMap = {
    "15-30s": {
      label: "15–30 Second Script",
      hookWords: "under 12 words",
      bodyWords: "30-50 words (3-4 very punchy sentences)",
      ctaWords: "under 10 words",
      platform: "TikTok, Instagram Reels",
      style: "ultra-fast, punchy, every word earns its place",
    },
    "30-60s": {
      label: "30–60 Second Script",
      hookWords: "under 20 words",
      bodyWords: "60-90 words (4-5 punchy sentences)",
      ctaWords: "under 15 words",
      platform: "Reels, Shorts, TikTok",
      style: "energetic, value-packed, fast-paced",
    },
    "3-5min": {
      label: "3–5 Minute Script",
      hookWords: "2-3 sentences, 30-40 words",
      bodyWords: "250-350 words covering the topic in depth with steps, examples, and proof",
      ctaWords: "1-2 sentences, under 30 words",
      platform: "YouTube, Podcast, Long-form video",
      style: "detailed, storytelling, authoritative",
    },
  };
  const dur = durationMap[duration] || durationMap["30-60s"];

  const answerContext = answers.length > 0
    ? `\n\nCreator's personalisation answers:\n${answers.map((a, i) => `Q${i+1}: ${a.question}\nA: ${a.answer}`).join("\n\n")}`
    : "";

  const prompt = `You are an expert viral social media script writer.
Generate ONE highly personalised ${dur.label} for a ${niche} creator about: "${topic}".${answerContext}

Target platform: ${dur.platform}
Style: ${dur.style}

CRITICAL LOOP RULE — The body must END with a sentence that echoes or mirrors the opening hook almost word-for-word, so a viewer watching on loop cannot tell the video has ended and restarted. This creates a seamless, infinite loop effect.

CTA RULE — Choose the single best CTA from these engagement options based on the topic and audience:
- "Like this video if it helped you!"
- "Share this with a friend who needs to hear this!"
- "DM me '[keyword]' and I'll send you the full guide!"
- "Comment '[word]' below for my free DM automation template!"
- "Save this before you forget it!"
Pick whichever fits best and personalise it to the topic.

Return ONLY valid JSON (no markdown, no code fences):
{
  "script": {
    "hook": "Hook — ${dur.hookWords}",
    "body": "Body — ${dur.bodyWords}. Last sentence MUST echo the hook to create a seamless loop.",
    "cta": "CTA — ${dur.ctaWords} — pick and personalise from the CTA options above"
  },
  "durationLabel": "${dur.label}",
  "platform": "${dur.platform}"
}`;

  // --- Try Gemini AI first ---
  if (apiKey) {
    try {
      const genAI = new GoogleGenAI({apiKey: apiKey});
      
      const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      if (!modelNames.includes("gemini-2.5-flash")) {
        modelNames.push("gemini-2.5-flash");
      }

      for (const modelName of modelNames) {
        try {
          // const model = genAI.getGenerativeModel({ model: modelName });
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
          if (parsed.script) {
            return res.json({ ...parsed, aiGenerated: true, model: modelName });
          }
        } catch (modelErr) {
          const msg = modelErr.message || "";
          if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) break;
        }
      }
    } catch (err) {
      // Fall through to smart template
    }
  }

  // --- Smart template fallback ---
  const t = topic.trim();
  const n = niche.trim();
  const firstWord = t.split(" ")[0].toUpperCase();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const hooks = [
    `Nobody talks about this — but ${t} is the #1 thing holding ${n} creators back.`,
    `I went from zero to results with ${t}. Here's exactly what I did.`,
    `If you're a ${n} creator struggling with ${t}, you need to see this.`,
    `This ${t} strategy changed everything for my ${n} content growth.`,
  ];
  const ctas = [
    `Like this video if it helped you!`,
    `Share this with a creator friend who needs to hear this!`,
    `DM me "${firstWord}" and I'll send you the full guide!`,
    `Comment "${firstWord}" below for my free DM automation template!`,
    `Save this before you forget it!`,
  ];
  const hook = pick(hooks);
  const bodyByDuration = {
    "15-30s": `Here's the truth about ${t}: most ${n} creators skip the foundation. Nail your audience pain point, deliver one punchy insight, and close with proof. And remember — ${hook.split(" ").slice(0, 7).join(" ")}…`,
    "30-60s": `Here's the ${t} framework that works for ${n} creators right now. Step 1: pinpoint your audience's exact frustration. Step 2: deliver one clear, actionable insight they can use today. Step 3: add social proof or a result. Repeat this structure — and remember, it all starts exactly where we began: ${hook.split(" ").slice(0, 6).join(" ")}…`,
    "3-5min": `The biggest mistake creators make with ${t} is skipping the foundation: knowing exactly who they're speaking to and what those people are struggling with. Start by pinpointing the specific frustration your audience has around this topic.\n\nHere's the full framework. Open with a hook that calls out their exact situation — use their language, not industry jargon. Then deliver your core insight around ${t} in a way that feels fresh and immediately actionable. Break it into 3 clear steps your audience can execute right now.\n\nAdd social proof — a real result, a transformation story, or a compelling stat. For ${n} creators, consistency amplifies everything. Post at least 3 times per week, A/B test your hooks relentlessly, and double down on saves and shares.\n\nAnd here's what it all comes back to: ${hook.split(" ").slice(0, 8).join(" ")}…`,
  };

  return res.json({
    script: {
      hook,
      body: bodyByDuration[duration] || bodyByDuration["30-60s"],
      cta: pick(ctas),
    },
    durationLabel: (durationMap[duration] || durationMap["30-60s"]).label,
    platform: (durationMap[duration] || durationMap["30-60s"]).platform,
    aiGenerated: false,
  });
};



// ── Script Quiz Questions ─────────────────────────────────────────────────────
const generateScriptQuestions = async (req, res) => {
  const { topic = "", niche = "" } = req.body;
  if (!topic.trim()) return res.status(400).json({ message: "Topic is required." });

  const defaultQuestions = {
    questions: [
      {
        question: "Who is the primary target audience for this video?",
        options: ["Beginners & General Public", "Industry Professionals", "Existing Followers", "Other"]
      },
      {
        question: "What is the desired tone or style of the video?",
        options: ["Energetic & Fast-paced", "Educational & Professional", "Humorous & Casual", "Other"]
      },
      {
        question: "What is the primary goal of this video?",
        options: ["Gain Followers & Reach", "Drive Comments / Engagement", "Promote a product or link", "Other"]
      },
      {
        question: "Which platform style are you targeting?",
        options: ["Instagram Reel / TikTok", "YouTube Shorts", "YouTube Long-form", "Other"]
      },
      {
        question: "What kind of opening hook style would you prefer?",
        options: ["Bold Question or Metric", "Relatable Problem Statement", "Direct Story Introduction", "Other"]
      }
    ]
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json(defaultQuestions);
  }

  const prompt = `You are a viral content strategist. A creator wants to make a video about "${topic.trim()}" in the "${niche.trim() || "general"}" niche.

Generate exactly 5 short, specific questions to personalise their script. Each question must have exactly 3 specific, meaningful options plus "Other" as the 4th option.

Return ONLY valid JSON (no markdown, no code fences):
{
  "questions": [
    { "question": "Short question text here?", "options": ["Specific option 1", "Specific option 2", "Specific option 3", "Other"] }
  ]
}

Question themes to cover (in this order):
1. Target audience (who is the video for?)
2. Content tone/style
3. Primary goal of the video
4. Video format / platform style
5. Unique angle or hook style

Rules:
- Keep each question under 10 words
- Options must be concrete and specific to the topic & niche
- 4th option MUST always be exactly "Other"
- Return exactly 5 questions`;

  // --- Try Gemini AI first ---
  try {
    const genAI = new GoogleGenAI({ apiKey });
    const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
      .split(",").map(m => m.trim()).filter(Boolean);
    if (!modelNames.includes("gemini-2.5-flash")) {
      modelNames.push("gemini-2.5-flash");
    }

    for (const modelName of modelNames) {
      try {
        const result = await genAI.models.generateContent({ model: modelName, contents: prompt });
        const raw = (result.text || "").trim();
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.questions?.length === 5) {
          return res.json(parsed);
        }
      } catch (modelErr) {
        const msg = modelErr.message || "";
        if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) break;
      }
    }
  } catch (err) {
    console.error("Error generating script questions:", err);
  }

  // Fallback to default questions on API failure
  return res.json(defaultQuestions);
};

// ── Video Analysis → Script Generator ────────────────────────────────────────
const analyzeVideoScript = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No video file uploaded." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // cleanup and return error
    fs.unlink(req.file.path, () => {});
    return res.status(503).json({ message: "AI service not configured." });
  }

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(req.file.path);
  } catch (readErr) {
    return res.status(500).json({ message: "Could not read uploaded file." });
  } finally {
    // delete temp file regardless
    fs.unlink(req.file.path, () => {});
  }

  const mimeType = req.file.mimetype || "video/mp4";
  const base64Video = fileBuffer.toString("base64");

  const prompt = `You are an expert social media script writer. Analyze this video carefully — its content, style, pacing, key talking points, visuals, and audience.

Based on your analysis, generate TWO scripts inspired by and tailored to this video's topic and style.

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "videoSummary": "A 1-2 sentence summary of what this video is about",
  "shortForm": {
    "hook": "A powerful 1-2 sentence attention-grabbing opening hook (under 20 words)",
    "body": "3-4 punchy sentences delivering the core value/tips (60-80 words)",
    "cta": "A strong call-to-action sentence (under 15 words)"
  },
  "longForm": {
    "hook": "A compelling story or bold claim opening hook (2-3 sentences, 30-40 words)",
    "body": "6-8 detailed sentences covering the full topic with actionable steps, examples, and insights (150-200 words)",
    "cta": "A specific, engaging call-to-action (1-2 sentences, under 25 words)"
  }
}`;

  const genAI = new GoogleGenAI({ apiKey });
  const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!modelNames.includes("gemini-2.5-flash")) {
    modelNames.push("gemini-2.5-flash");
  }

  for (const modelName of modelNames) {
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Video,
                },
              },
            ],
          },
        ],
      });
      const raw = (result.text || "").trim();
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.shortForm && parsed.longForm) {
        return res.json({
          ...parsed,
          aiGenerated: true,
          model: modelName,
          fromVideo: true,
        });
      }
    } catch (modelErr) {
      const msg = modelErr.message || "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) break;
      // try next model on 404 / deprecated
    }
  }

  return res.status(500).json({
    message: "AI could not analyze the video. Please try a shorter video or use the text generator.",
  });
};

// ── Enhance Prompt ───────────────────────────────────────────────────────────
const enhancePrompt = async (req, res) => {
  const { prompt = "" } = req.body;
  if (!prompt.trim()) {
    return res.status(400).json({ message: "Please provide a prompt to enhance." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: "AI service not configured." });
  }

  const systemPrompt = `You are an expert AI prompt engineer specialising in social media content scripts.
A user has given you a rough topic or idea. Your job is to transform it into a powerful, specific, and structured script-writing prompt that will produce the best possible viral video script.

Return ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "enhancedPrompt": "A detailed, specific, well-structured prompt (60-100 words) that includes: target audience, platform context, emotional hook angle, key value propositions, and desired outcome",
  "improvements": ["Short bullet explaining what you improved (max 8 words)", "Another improvement", "Another improvement"],
  "alternativeAngles": [
    "Alternative angle 1 as a complete prompt (30-50 words)",
    "Alternative angle 2 as a complete prompt (30-50 words)",
    "Alternative angle 3 as a complete prompt (30-50 words)"
  ]
}

User's rough prompt: "${prompt.trim()}"`;

  // --- Try Gemini AI first ---
  const genAI = new GoogleGenAI({ apiKey });
  const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
    .split(",").map((m) => m.trim()).filter(Boolean);
  if (!modelNames.includes("gemini-2.5-flash")) {
    modelNames.push("gemini-2.5-flash");
  }

  for (const modelName of modelNames) {
    try {
      const result = await genAI.models.generateContent({ model: modelName, contents: systemPrompt });
      const raw = (result.text || "").trim();
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.enhancedPrompt) {
        return res.json({ ...parsed, originalPrompt: prompt.trim() });
      }
    } catch (modelErr) {
      const msg = modelErr.message || "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) break;
    }
  }

  return res.status(500).json({ message: "AI could not enhance the prompt. Please try again." });
};

// ── Enhance Script (3 Variations) ──────────────────────────────────────────────
const enhanceScript = async (req, res) => {
  const { hook = "", body = "", cta = "" } = req.body;
  if (!hook.trim() && !body.trim() && !cta.trim()) {
    return res.status(400).json({ message: "Please fill in at least one section to enhance." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ message: "AI service not configured." });

  const systemPrompt = `You are an expert viral video script writer. A creator has written this script:

HOOK: "${hook.trim() || "(not provided)"}"
BODY: "${body.trim() || "(not provided)"}"
CTA: "${cta.trim() || "(not provided)"}"

Rewrite and elevate this script into exactly 3 powerful variations. Each must be a COMPLETE, ready-to-record script (not a template) — improve hook impact, body clarity & value, and CTA conversion.

Return ONLY valid JSON (no markdown, no code fences):
{
  "variations": [
    {
      "label": "\uD83D\uDD25 High Energy",
      "style": "Bold, punchy, fast-paced — great for Reels & TikTok",
      "hook": "Complete enhanced hook (15-25 words)",
      "body": "Complete enhanced body (60-100 words)",
      "cta": "Complete enhanced CTA (10-20 words)"
    },
    {
      "label": "\uD83D\uDCA1 Educational",
      "style": "Clear, structured, authority-building — great for YouTube & LinkedIn",
      "hook": "Complete enhanced hook (15-25 words)",
      "body": "Complete enhanced body (80-120 words)",
      "cta": "Complete enhanced CTA (10-20 words)"
    },
    {
      "label": "\uD83C\uDFAD Storytelling",
      "style": "Narrative, emotional, relatable — great for all platforms",
      "hook": "Complete enhanced hook (15-25 words)",
      "body": "Complete enhanced body (80-120 words)",
      "cta": "Complete enhanced CTA (10-20 words)"
    }
  ]
}`;

  // --- Try Gemini AI first ---
  const genAI = new GoogleGenAI({ apiKey });
  const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
    .split(",").map(m => m.trim()).filter(Boolean);
  if (!modelNames.includes("gemini-2.5-flash")) {
    modelNames.push("gemini-2.5-flash");
  }

  for (const modelName of modelNames) {
    try {
      const result = await genAI.models.generateContent({ model: modelName, contents: systemPrompt });
      const raw = (result.text || "").trim();
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.variations?.length === 3) {
        return res.json(parsed);
      }
    } catch (modelErr) {
      const msg = modelErr.message || "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) break;
    }
  }

  return res.status(500).json({ message: "AI could not enhance the script. Please try again." });
};

const generateCaption = async (req, res) => {
  const { topic = "", script = "", keywords = "", niche = "" } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  let context = "";
  if (topic) context += `\nTopic: ${topic}`;
  if (script) context += `\nScript: ${script}`;
  if (keywords) context += `\nKeywords: ${keywords}`;
  if (niche) context += `\nNiche: ${niche}`;
  if (!context) context = "\nTopic: creator growth"; // default

  const prompt = `You are an expert social media manager. Generate a highly engaging caption and a list of hashtags for a social media post based on the following details:${context}

Return ONLY valid JSON (no markdown, no code fences):
{
  "caption": "Your highly engaging caption here. Include emojis and a strong call to action.",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`;

  if (apiKey) {
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey });
      const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      if (!modelNames.includes("gemini-2.5-flash")) {
        modelNames.push("gemini-2.5-flash");
      }

      for (const modelName of modelNames) {
        try {
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
          if (parsed.caption) {
            return res.json({ ...parsed, aiGenerated: true });
          }
        } catch (modelErr) {
          const msg = modelErr.message || "";
          if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) break;
        }
      }
    } catch (err) {
      // Fallback if AI generation fails
      console.error("Caption generation error:", err);
    }
  }

  // Fallback response
  const fallbackTopic = topic || "creator growth";
  res.json({
    caption: `Built this around ${fallbackTopic} so you can save time and get better reach. Which part are you trying first?`,
    hashtags: ["#viralrush", "#contentcreator", "#socialgrowth", "#creatorbusiness", `#${fallbackTopic.replace(/\s+/g, "").toLowerCase()}`],
  });
};

const analyzeMediaCaption = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No media file uploaded." });
  }

  const { topic = "", script = "", keywords = "", niche = "" } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fs.unlink(req.file.path, () => {});
    return res.status(503).json({ message: "AI service not configured." });
  }

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(req.file.path);
  } catch (readErr) {
    return res.status(500).json({ message: "Could not read uploaded file." });
  } finally {
    fs.unlink(req.file.path, () => {});
  }

  const mimeType = req.file.mimetype || "video/mp4";
  const base64Media = fileBuffer.toString("base64");

  let context = "";
  if (topic) context += `\nTopic: ${topic}`;
  if (script) context += `\nScript: ${script}`;
  if (keywords) context += `\nKeywords: ${keywords}`;
  if (niche) context += `\nNiche: ${niche}`;

  const prompt = `You are an expert social media manager. Analyze this media carefully. Based on your analysis and the following additional details, generate a highly engaging caption and a list of hashtags.

Additional details:${context}

Return ONLY valid JSON (no markdown, no code fences):
{
  "caption": "Your highly engaging caption here. Include emojis and a strong call to action.",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`;

  const genAI = new GoogleGenAI({ apiKey });
  const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!modelNames.includes("gemini-2.5-flash")) {
    modelNames.push("gemini-2.5-flash");
  }

  for (const modelName of modelNames) {
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Media,
                },
              },
            ],
          },
        ],
      });
      const raw = (result.text || "").trim();
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.caption) {
        return res.json({
          ...parsed,
          aiGenerated: true,
          model: modelName,
          fromMedia: true,
        });
      }
    } catch (modelErr) {
      const msg = modelErr.message || "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) break;
    }
  }

  return res.status(500).json({
    message: "AI could not analyze the media. Please try again.",
  });
};

const createAutomationRule = async (req, res, next) => {
  try {
    const rule = await AutomationRule.create({ ...req.body, userId: req.user.id });
    res.status(201).json(rule);
  } catch (error) {
    next(error);
  }
};

const getAutomationRules = async (req, res, next) => {
  try {
    const rules = await AutomationRule.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(rules);
  } catch (error) {
    next(error);
  }
};

const updateAutomationRule = async (req, res, next) => {
  try {
    const rule = await AutomationRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!rule) {
      return res.status(404).json({ message: "Automation rule not found" });
    }
    res.json(rule);
  } catch (error) {
    next(error);
  }
};

const deleteAutomationRule = async (req, res, next) => {
  try {
    const rule = await AutomationRule.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    if (!rule) {
      return res.status(404).json({ message: "Automation rule not found" });
    }
    res.json({ message: "Rule deleted successfully" });
  } catch (error) {
    next(error);
  }
};

const getBrandDeals = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    let deals = [];
    if (user.role === "brand") {
      deals = await BrandDeal.find({ brandId: req.user.id }).sort({ createdAt: -1 });
    } else {
      deals = await BrandDeal.find({ status: "Active" }).sort({ createdAt: -1 }).populate('brandId', 'name username');
    }

    const applications = await BrandDealApplication.find({ userId: req.user.id }).select("dealId");
    const appliedDealIds = new Set(applications.map((a) => a.dealId.toString()));

    const dealsWithStatus = deals.map((deal) => {
      const d = deal.toObject();
      d.id = d._id;
      d.applied = appliedDealIds.has(d._id.toString());
      return d;
    });

    res.json(dealsWithStatus);
  } catch (error) {
    next(error);
  }
};

const suggestBrandDeals = async (req, res, next) => {
  try {
    const niche = (req.query.niche || "").toLowerCase().trim();
    if (!niche) {
      return res.status(400).json({ message: "Niche is required for AI suggestions." });
    }
    const result = await getBrandSuggestions({ niche: req.query.niche, userId: req.user.id });
    res.json({ niche: req.query.niche, ...result });
  } catch (error) {
    next(error);
  }
};

const createBrandDeal = async (req, res, next) => {
  try {
    const deal = await BrandDeal.create({
      brandId: req.user.id,
      ...req.body
    });
    res.status(201).json(deal);
  } catch (error) {
    next(error);
  }
};

const applyBrandDeal = async (req, res, next) => {
  try {
    const { dealId } = req.body;
    const existingApplication = await BrandDealApplication.findOne({
      userId: req.user.id,
      dealId,
    });

    if (existingApplication) {
      return res.json(existingApplication);
    }

    const deal = await BrandDeal.findById(dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const application = await BrandDealApplication.create({
      userId: req.user.id,
      dealId,
    });

    // Notify the brand
    await Notification.create({
      userId: deal.brandId,
      title: "New Application",
      message: "A creator has applied to your deal: " + deal.title,
      type: "Application",
    });

    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
};

const getBrandDealApplications = async (req, res, next) => {
  try {
    const deals = await BrandDeal.find({ brandId: req.user.id });
    const dealIds = deals.map(d => d._id);
    
    const applications = await BrandDealApplication.find({ dealId: { $in: dealIds } })
      .populate('userId', 'name username email platform platformProfileUrl followers following posts totalLikes totalViews avgEngagement bio profilePicture')
      .populate('dealId', 'title')
      .sort({ createdAt: -1 });

    // Enrich applicant user with live Instagram stats if connected
    const enriched = await Promise.all(
      applications.map(async (app) => {
        const appObj = app.toObject();
        if (!appObj.userId) return appObj;

        const igAcc = await InstagramAccount.findOne({ userId: appObj.userId._id, isConnected: true });
        if (igAcc) {
          appObj.userId = {
            ...appObj.userId,
            username:       igAcc.username       || appObj.userId.username,
            followers:      igAcc.followersCount || appObj.userId.followers      || 0,
            following:      igAcc.followsCount   || appObj.userId.following      || 0,
            posts:          igAcc.mediaCount     || appObj.userId.posts          || 0,
            totalLikes:     igAcc.totalLikes     || appObj.userId.totalLikes     || 0,
            totalViews:     igAcc.totalViews     || appObj.userId.totalViews     || 0,
            avgEngagement:  igAcc.avgEngagement  || appObj.userId.avgEngagement  || "0%",
            profilePicture: igAcc.profilePicture || appObj.userId.profilePicture || "",
            platformProfileUrl: `https://instagram.com/${igAcc.username}`,
            igConnected:    true,
          };
        } else {
          appObj.userId.igConnected = false;
        }
        return appObj;
      })
    );

    res.json(enriched);
  } catch (error) {
    next(error);
  }
};

const updateBrandDealApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const application = await BrandDealApplication.findById(id).populate('dealId');
    if (!application) return res.status(404).json({ message: "Application not found" });
    
    application.status = status;
    await application.save();
    
    // Notify creator
    await Notification.create({
      userId: application.userId,
      title: `Application ${status}`,
      message: `Your application for ${application.dealId.title} has been ${status.toLowerCase()}`,
      type: "Application",
    });

    if (status === 'Accepted') {
      const existingCommunity = await Community.findOne({
        members: { $all: [req.user.id, application.userId] },
      });
      if (!existingCommunity) {
        const community = await Community.create({
          members: [req.user.id, application.userId],
        });
        const populated = await community.populate("members", "username name niche platform");
        try {
          const io = getIO();
          const payload = { community: populated, message: "Community created successfully for new brand deal!" };
          io.to(req.user.id.toString()).emit("community_created", payload);
          io.to(application.userId.toString()).emit("community_created", payload);
        } catch (_) {}
      }
    }
    
    res.json(application);
  } catch (error) {
    next(error);
  }
};

const listCommunityPosts = async (req, res, next) => {
  try {
    const niche = req.query.niche;
    const query = niche ? { niche: new RegExp(niche, "i") } : {};
    const posts = await CommunityPost.find(query).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    next(error);
  }
};

const createCommunityPost = async (req, res, next) => {
  try {
    const post = await CommunityPost.create(req.body);
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
};

const likePost = async (req, res, next) => {
  try {
    const post = await CommunityPost.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
    res.json(post);
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const post = await CommunityPost.findById(req.params.id);
    post.comments.push({ author: req.body.author, text: req.body.text });
    await post.save();
    res.json(post);
  } catch (error) {
    next(error);
  }
};

const listCalendarItems = async (req, res, next) => {
  try {
    const items = await CalendarItem.find({ userId: req.user.id }).sort({ scheduledAt: 1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

const addCalendarItem = async (req, res, next) => {
  try {
    const item = await CalendarItem.create({ ...req.body, userId: req.user.id });
    
    // Trigger asynchronous email reminder to the registered user
    const userEmail = req.user.email;
    if (userEmail) {
      sendPlanReminderEmail(userEmail, item).catch((err) => {
        console.error("[Calendar] Failed to send email reminder:", err.message);
      });
    } else {
      User.findById(req.user.id).select("email").then((u) => {
        if (u?.email) {
          sendPlanReminderEmail(u.email, item).catch(() => {});
        }
      });
    }

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

const updateCalendarItem = async (req, res, next) => {
  try {
    const item = await CalendarItem.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, req.body, { new: true });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

const deleteCalendarItem = async (req, res, next) => {
  try {
    await CalendarItem.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ message: "Deleted" });
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res) => {
  res.json({
    charts: {
      views: [1200, 2200, 3400, 4100, 5000, 6100, 7400],
      likes: [120, 240, 360, 420, 520, 610, 790],
      engagement: [5.2, 6.1, 6.4, 6.9, 7.2, 7.8, 8.1],
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    suggestions: [
      "Post 30-45 second reels during peak evening hours.",
      "Reuse top-performing hooks in your next 5 videos.",
      "Increase CTA clarity to improve comment velocity.",
    ],
  });
};

const academy = async (req, res) => res.json(courses);
const toolsMarketplace = async (req, res) => res.json(tools);

const facelessIdeas = async (req, res) => {
  const niche = req.query.niche || "general";
  res.json([
    `Screen-record a step-by-step tutorial in ${niche}.`,
    `Use stock footage + voiceover with a myth-busting format.`,
    `Create list-style reels with on-screen text and B-roll.`,
  ]);
};

const collabAgreement = async (req, res) => {
  const { creatorName, brandName, deliverables, payment } = req.body;
  const agreement = `Collaboration Agreement\n\nCreator: ${creatorName}\nBrand: ${brandName}\nDeliverables: ${deliverables}\nPayment: ${payment}\n\nTerms:\n1. Creator will deliver content as agreed.\n2. Brand will process payment on completion.\n3. Both parties can request one revision.\n`;
  res.json({ agreementText: agreement });
};

const reports = async (req, res) => {
  try {
    const CalendarItem = require("../models/CalendarItem");
    const AutomationRule = require("../models/AutomationRule");
    const ViralContentSearch = require("../models/ViralContentSearch");
    const SavedIdea = require("../models/SavedIdea");
    const UserActivity = require("../models/UserActivity");

    const scheduledCount = await CalendarItem.countDocuments({ userId: req.user.id });
    const rulesCount = await AutomationRule.countDocuments({ userId: req.user.id });
    const searchesCount = await ViralContentSearch.countDocuments({ userId: req.user.id });
    const scriptsCount = await SavedIdea.countDocuments({ userId: req.user.id });

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    oneMonthAgo.setHours(0, 0, 0, 0);

    // Fetch user activities over the last 30 days
    const activities = await UserActivity.find({
      userId: req.user.id,
      date: { $gte: oneMonthAgo }
    });

    const now = new Date();

    // Group items into 30 days array
    const dailyData = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return {
        date: d,
        searches: 0,
        scripts: 0,
        calendar: 0,
        rules: 0,
        time: 0
      };
    });

    // Populate dailyData from UserActivity
    activities.forEach(act => {
      const actDate = new Date(act.date);
      actDate.setHours(0, 0, 0, 0);
      const diffTime = now.setHours(0, 0, 0, 0) - actDate.getTime();
      const idx = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (idx >= 0 && idx < 30) {
        // Convert active seconds to minutes
        dailyData[idx].time = Math.round(act.durationSeconds / 60);
      }
    });

    // Seed/Fallbacks for other actions (searches, scripts) to make dashboard rich
    const searches = await ViralContentSearch.find({
      userId: req.user.id,
      createdAt: { $gte: oneMonthAgo }
    }).select("createdAt");

    const savedIdeas = await SavedIdea.find({
      userId: req.user.id,
      createdAt: { $gte: oneMonthAgo }
    }).select("createdAt");

    const calendarItems = await CalendarItem.find({
      userId: req.user.id,
      createdAt: { $gte: oneMonthAgo }
    }).select("createdAt");

    const automationRules = await AutomationRule.find({
      userId: req.user.id,
      createdAt: { $gte: oneMonthAgo }
    }).select("createdAt");

    const getDayIndex = (date) => {
      const itemDate = new Date(date);
      itemDate.setHours(0, 0, 0, 0);
      const diffTime = now.setHours(0, 0, 0, 0) - itemDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    };

    searches.forEach(item => {
      const idx = getDayIndex(item.createdAt);
      if (idx >= 0 && idx < 30) dailyData[idx].searches++;
    });
    savedIdeas.forEach(item => {
      const idx = getDayIndex(item.createdAt);
      if (idx >= 0 && idx < 30) dailyData[idx].scripts++;
    });

    // Build todayUsage hourly slots using hourly tracked minutes or fallbacks
    const todaySlots = [
      { day: "09:00", date: "Today 09:00 AM", time: 0, searches: 0, scripts: 0, color: "linear-gradient(to top, #7c3aed, #c084fc)" },
      { day: "12:00", date: "Today 12:00 PM", time: 0, searches: 0, scripts: 0, color: "linear-gradient(to top, #3b82f6, #60a5fa)" },
      { day: "15:00", date: "Today 03:00 PM", time: 0, searches: 0, scripts: 0, color: "linear-gradient(to top, #ec4899, #f472b6)" },
      { day: "18:00", date: "Today 06:00 PM", time: 0, searches: 0, scripts: 0, color: "linear-gradient(to top, #10b981, #34d399)" },
      { day: "21:00", date: "Today 09:00 PM", time: 0, searches: 0, scripts: 0, color: "linear-gradient(to top, #f59e0b, #fbbf24)" },
    ];

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const todayActivity = activities.find(act => new Date(act.date).getTime() === startOfToday.getTime());
    if (todayActivity && todayActivity.hourlySeconds) {
      todaySlots.forEach(slot => {
        let key = "21";
        if (slot.day === "09:00") key = "9";
        else if (slot.day === "12:00") key = "12";
        else if (slot.day === "15:00") key = "15";
        else if (slot.day === "18:00") key = "18";

        const seconds = todayActivity.hourlySeconds.get(key) || 0;
        slot.time = Math.round(seconds / 60);
      });
    }

    // Ensure today slots have a baseline if they are empty
    todaySlots.forEach(slot => {
      slot.time = Math.max(10, slot.time); // min 10 mins baseline
    });

    // Build weeklyUsage (last 7 days chronological)
    const weeklyUsage = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const realMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayName = dayNames[d.getDay()];
      const dateStr = `${realMonthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
      
      const dayData = dailyData[i];
      weeklyUsage.push({
        day: dayName,
        date: dateStr,
        time: Math.max(15, dayData.time), // baseline 15m or actual tracked time
        searches: dayData.searches,
        scripts: dayData.scripts,
        color: i === 0 
          ? "linear-gradient(to top, #8b5cf6, #ec4899)"
          : i % 2 === 0 
            ? "linear-gradient(to top, #7c3aed, #c084fc)" 
            : "linear-gradient(to top, #3b82f6, #60a5fa)"
      });
    }

    // Build monthlyUsage (last 4 weeks chronological)
    const monthlyUsage = [];
    for (let w = 3; w >= 0; w--) {
      const startDayIdx = w * 7 + 6;
      const endDayIdx = w * 7;
      
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - startDayIdx);
      
      const endDate = new Date(now);
      endDate.setDate(now.getDate() - endDayIdx);
      
      const label = `${realMonthNames[startDate.getMonth()]} ${startDate.getDate()} - ${realMonthNames[endDate.getMonth()]} ${endDate.getDate()}`;
      
      let weekTime = 0;
      let weekSearches = 0;
      let weekScripts = 0;
      
      for (let i = endDayIdx; i <= startDayIdx; i++) {
        if (dailyData[i]) {
          weekTime += dailyData[i].time;
          weekSearches += dailyData[i].searches;
          weekScripts += dailyData[i].scripts;
        }
      }
      
      monthlyUsage.push({
        day: `Wk ${4 - w}`,
        date: label,
        time: Math.max(120, weekTime), // baseline 120m or actual tracked time
        searches: weekSearches,
        scripts: weekScripts,
        color: w === 0 
          ? "linear-gradient(to top, #10b981, #34d399)" 
          : w % 2 === 0 
            ? "linear-gradient(to top, #7c3aed, #c084fc)" 
            : "linear-gradient(to top, #3b82f6, #60a5fa)"
      });
    }

    // Calculate time spent values per field
    const huntingTime = Math.max(30, searchesCount * 12); 
    const scriptingTime = Math.max(45, scriptsCount * 25); 
    const automationTime = Math.max(10, rulesCount * 15); 
    const schedulingTime = Math.max(15, scheduledCount * 10); 
    const filmingTime = Math.max(60, scheduledCount * 50); 

    res.json({
      scheduledCount,
      rulesCount,
      searchesCount,
      scriptsCount,
      timeSpent: {
        hunting: huntingTime,
        scripting: scriptingTime,
        automation: automationTime,
        scheduling: schedulingTime,
        filming: filmingTime
      },
      todayUsage: todaySlots,
      weeklyUsage,
      monthlyUsage,
      weekly: { summary: "Reach increased by 14% with improved save rate.", topPost: "3 Hook Templates Reel" },
      monthly: { summary: "Follower growth accelerated with consistent posting cadence.", topCategory: "Education" },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load reports", error: error.message });
  }
};

const reportsHeartbeat = async (req, res) => {
  try {
    const UserActivity = require("../models/UserActivity");
    const { seconds = 30 } = req.body;

    const now = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    const currentHour = now.getHours();
    let slotKey = "21";
    if (currentHour < 10) slotKey = "9";
    else if (currentHour < 13) slotKey = "12";
    else if (currentHour < 16) slotKey = "15";
    else if (currentHour < 19) slotKey = "18";

    await UserActivity.findOneAndUpdate(
      { userId: req.user.id, date: todayMidnight },
      {
        $inc: {
          durationSeconds: seconds,
          [`hourlySeconds.${slotKey}`]: seconds
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ message: "Heartbeat recorded successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to record heartbeat", error: error.message });
  }
};

const listNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

const createNotification = async (req, res, next) => {
  try {
    const n = await Notification.create({ ...req.body, userId: req.user.id });
    res.status(201).json(n);
  } catch (error) {
    next(error);
  }
};

const linkInBioPreview = async (req, res) => {
  const { creatorName, bio, links = [] } = req.body;
  res.json({ slug: creatorName.toLowerCase().replace(/\s+/g, "-"), creatorName, bio, links });
};

const platformMetrics = async (req, res, next) => {
  try {
    const metrics = await getPlatformMetricsForUser(req.user.id);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  dashboardStats,
  generateScript,
  analyzeVideoScript,
  generateScriptQuestions,
  enhancePrompt,
  enhanceScript,
  generateCaption,
  analyzeMediaCaption,
  createAutomationRule,
  getAutomationRules,
  updateAutomationRule,
  deleteAutomationRule,
  getBrandDeals,
  suggestBrandDeals,
  createBrandDeal,
  applyBrandDeal,
  getBrandDealApplications,
  updateBrandDealApplicationStatus,
  listCommunityPosts,
  createCommunityPost,
  likePost,
  addComment,
  listCalendarItems,
  addCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
  analytics,
  academy,
  toolsMarketplace,
  facelessIdeas,
  collabAgreement,
  reports,
  reportsHeartbeat,
  listNotifications,
  createNotification,
  linkInBioPreview,
  platformMetrics,
};
