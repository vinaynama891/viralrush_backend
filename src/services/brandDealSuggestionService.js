const BrandDealApplication = require("../models/BrandDealApplication");
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { brandDeals } = require("../utils/mockData");

const normalizeBrandName = (title = "") => {
  const cleaned = title
    .replace(/\s*\|.*$/, "")
    .replace(/\s*-\s*.*$/, "")
    .replace(/careers?/gi, "")
    .replace(/jobs?/gi, "")
    .trim();
  return cleaned || "Brand";
};

const fetchSerpSuggestions = async (niche) => {
  const serpApiKey = process.env.SERPAPI_KEY;
  if (!serpApiKey) return [];

  const query = `${niche} creator program careers brand ambassador`;
  const endpoint = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
    query
  )}&num=10&api_key=${serpApiKey}`;

  const response = await fetch(endpoint);
  const data = await response.json();
  if (!response.ok || !data.organic_results) return [];

  return data.organic_results
    .filter((result) => result.link && result.title)
    .slice(0, 6)
    .map((result, idx) => ({
      id: `live-${idx + 1}`,
      brandName: normalizeBrandName(result.title),
      offerTitle: result.title,
      budget: "Varies",
      niche,
      careerUrl: result.link,
      aiReason: "Live web result from current career/creator opportunity search.",
      source: "live",
    }));
};

const fetchMockSuggestions = (niche) => {
  const n = niche.toLowerCase().trim();
  return brandDeals
    .map((deal) => {
      const dn = deal.niche.toLowerCase();
      let score = 0;
      if (dn === n) score = 100;
      else if (dn.includes(n) || n.includes(dn)) score = 80;
      else if (
        (n.includes("creator") && ["marketing", "education"].includes(dn)) ||
        (n.includes("content") && ["marketing", "productivity"].includes(dn))
      ) {
        score = 60;
      } else {
        score = 30;
      }
      return {
        ...deal,
        score,
        aiReason:
          score >= 80
            ? `High match: ${deal.niche} is closely aligned with "${niche}".`
            : `Related fit for "${niche}" creators.`,
        source: "catalog",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
};

const parseGeminiModels = () => {
  const configured = process.env.GEMINI_MODEL || "";
  const list = configured
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  if (list.length) return list;
  return ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro-latest"];
};

const parseRankedJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    const cleaned = text.replace(/```json|```/gi, "").trim();
    return JSON.parse(cleaned);
  }
};

const enhanceSuggestionsWithGemini = async (niche, suggestions) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !suggestions.length) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const compact = suggestions.map((s, idx) => ({
      idx,
      brandName: s.brandName,
      offerTitle: s.offerTitle,
      niche: s.niche,
      careerUrl: s.careerUrl,
    }));

    const prompt = `Target niche: "${niche}"
Deals: ${JSON.stringify(compact)}
Return strict JSON only with key "ranked" as array of objects with keys: idx, score (0-100), aiReason (max 18 words).`;
    const models = parseGeminiModels();
    let lastModelError = "";

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const raw = result.response.text() || "";
        const parsed = parseRankedJson(raw);
        if (!parsed.ranked || !Array.isArray(parsed.ranked)) continue;

        const byIndex = new Map(parsed.ranked.map((r) => [r.idx, r]));
        return suggestions
          .map((s, idx) => {
            const ai = byIndex.get(idx);
            if (!ai) return { ...s, score: s.score || 50 };
            return {
              ...s,
              score: typeof ai.score === "number" ? ai.score : 50,
              aiReason: ai.aiReason || s.aiReason,
              aiModel: modelName,
            };
          })
          .sort((a, b) => (b.score || 0) - (a.score || 0));
      } catch (modelError) {
        lastModelError = modelError?.message || `Model ${modelName} failed`;
      }
    }

    return { error: `No configured Gemini model worked. Last error: ${lastModelError}` };
  } catch (error) {
    return { error: error?.message || "Gemini ranking failed." };
  }
};

const enhanceSuggestionsWithOpenAI = async (niche, suggestions) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !suggestions.length) return null;

  try {
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const compact = suggestions.map((s, idx) => ({
      idx,
      brandName: s.brandName,
      offerTitle: s.offerTitle,
      niche: s.niche,
      careerUrl: s.careerUrl,
    }));

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that ranks brand deals for creators by niche. Return strict JSON only.",
        },
        {
          role: "user",
          content: `Target niche: "${niche}"\nDeals: ${JSON.stringify(
            compact
          )}\nReturn JSON with key "ranked" as an array of objects with keys: idx, score (0-100), aiReason (max 18 words).`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw);
    if (!parsed.ranked || !Array.isArray(parsed.ranked)) return null;

    const byIndex = new Map(parsed.ranked.map((r) => [r.idx, r]));
    return suggestions
      .map((s, idx) => {
        const ai = byIndex.get(idx);
        if (!ai) return { ...s, score: s.score || 50 };
        return {
          ...s,
          score: typeof ai.score === "number" ? ai.score : 50,
          aiReason: ai.aiReason || s.aiReason,
        };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  } catch (error) {
    return { error: error?.message || "OpenAI ranking failed." };
  }
};

const getBrandSuggestions = async ({ niche, userId }) => {
  const liveResults = await fetchSerpSuggestions(niche);
  const baseSuggestions = liveResults.length ? liveResults : fetchMockSuggestions(niche);
  const geminiResult = await enhanceSuggestionsWithGemini(niche, baseSuggestions);
  const geminiRanked = geminiResult && !geminiResult.error ? geminiResult : null;
  const geminiError = geminiResult?.error || null;

  const openAiResult = geminiRanked ? null : await enhanceSuggestionsWithOpenAI(niche, baseSuggestions);
  const openAiRanked = openAiResult && !openAiResult.error ? openAiResult : null;
  const openAiError = openAiResult?.error || null;

  const rankedSuggestions = geminiRanked || openAiRanked || baseSuggestions;

  const applications = await BrandDealApplication.find({ userId }).select("dealId brandName");
  const appliedDealIds = new Set(applications.map((a) => a.dealId));
  const appliedBrandNames = new Set(applications.map((a) => (a.brandName || "").toLowerCase()));

  const suggestions = rankedSuggestions.map((deal) => {
    const applied =
      appliedDealIds.has(deal.id) || appliedBrandNames.has((deal.brandName || "").toLowerCase());
    return {
      ...deal,
      applied,
    };
  });

  return {
    suggestions,
    source: geminiRanked
      ? liveResults.length
        ? "live-web+gemini"
        : "catalog+gemini"
      : openAiRanked
      ? liveResults.length
        ? "live-web+openai"
        : "catalog+openai"
      : liveResults.length
      ? "live-web"
      : "catalog-fallback",
    note: geminiRanked
      ? "Suggestions are AI-ranked with Gemini."
      : openAiRanked
      ? "Suggestions are AI-ranked with OpenAI."
      : geminiError
      ? `Gemini failed: ${geminiError}`
      : openAiError
      ? `OpenAI failed: ${openAiError}`
      : liveResults.length
      ? "Suggestions are fetched from live web results."
      : "Using internal catalog. Add SERPAPI_KEY for live web and GEMINI_API_KEY/OPENAI_API_KEY for AI ranking.",
  };
};

module.exports = { getBrandSuggestions };
