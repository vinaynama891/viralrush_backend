const OpenAI = require("openai");

const META_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

/**
 * Reusable utility to send an Instagram Direct Message using Meta Graph API
 * @param {string} recipientId - The Instagram-scoped User ID of the recipient
 * @param {string} message - The text message to send
 * @param {string} accessToken - The access token (long-lived or page token)
 * @returns {Promise<object>} Response from Meta API
 */
const sendInstagramMessage = async (recipientId, message, accessToken) => {
  if (!recipientId || !message || !accessToken) {
    throw new Error("Missing required parameters for sendInstagramMessage");
  }

  try {
    const url = `https://graph.facebook.com/${META_VERSION}/me/messages?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          id: recipientId,
        },
        message: {
          text: message,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Meta Graph API error response:", data);
      throw new Error(data.error?.message || "Failed to send Instagram DM via Meta API");
    }

    return data;
  } catch (error) {
    console.error("Error in sendInstagramMessage service:", error);
    throw error;
  }
};

/**
 * Fetch Instagram Professional profile details
 * @param {string} instagramUserId - Instagram Account ID
 * @param {string} accessToken - Access Token
 */
const fetchInstagramProfile = async (instagramUserId, accessToken) => {
  try {
    const url = `https://graph.facebook.com/${META_VERSION}/${instagramUserId}?fields=id,username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to fetch Instagram profile details");
    }

    return data;
  } catch (error) {
    console.error("Error in fetchInstagramProfile service:", error);
    throw error;
  }
};

/**
 * Generate natural AI reply using OpenAI based on incoming message and rule context
 * @param {string} incomingMessage - Incoming user DM
 * @param {string} keyword - Keyword matched
 * @param {string} replyTemplate - Draft reply template
 */
const generateOpenAIReply = async (incomingMessage, keyword, replyTemplate) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[Instagram Service] No OPENAI_API_KEY found, falling back to template reply.");
    return replyTemplate;
  }

  try {
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: "You are a professional automated virtual assistant for a high-traffic creator on the VIRALRUSH dashboard. Respond in a friendly, conversational, and highly helpful manner. Keep the reply extremely concise (1-2 sentences maximum, ready to send as an Instagram DM, without extra formatting, placeholders, or preamble).",
        },
        {
          role: "user",
          content: `The creator configured a reply rule for the keyword: "${keyword}".
The draft response is: "${replyTemplate}".
An incoming user message says: "${incomingMessage}".
Please write a friendly, customized DM response based on the keyword rule and draft reply. Keep it natural and punchy!`,
        },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    return reply || replyTemplate;
  } catch (error) {
    console.error("Error generating OpenAI reply in service:", error);
    return replyTemplate;
  }
};

/**
 * Reusable utility to reply to an Instagram Comment
 */
const replyToInstagramComment = async (commentId, message, accessToken) => {
  if (!commentId || !message || !accessToken) {
    throw new Error("Missing required parameters for replyToInstagramComment");
  }

  try {
    const url = `https://graph.facebook.com/${META_VERSION}/${commentId}/replies?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Meta Graph API error (Comment Reply):", data);
      throw new Error(data.error?.message || "Failed to send Instagram comment reply via Meta API");
    }

    return data;
  } catch (error) {
    console.error("Error in replyToInstagramComment service:", error);
    throw error;
  }
};

/**
 * Send an Instagram Direct Message as a private reply to a comment
 */
const sendInstagramPrivateReply = async (commentId, message, accessToken) => {
  if (!commentId || !message || !accessToken) {
    throw new Error("Missing required parameters for sendInstagramPrivateReply");
  }

  try {
    const url = `https://graph.facebook.com/${META_VERSION}/me/messages?access_token=${accessToken}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          comment_id: commentId,
        },
        message: {
          text: message,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Meta Graph API error (Private Reply):", data);
      throw new Error(data.error?.message || "Failed to send Instagram Private Reply DM via Meta API");
    }

    return data;
  } catch (error) {
    console.error("Error in sendInstagramPrivateReply service:", error);
    throw error;
  }
};


/**
 * Search Instagram public posts/Reels by hashtag using the Hashtag Search API
 * @param {string} instagramUserId - User's Instagram Business Account ID
 * @param {string} accessToken - User's Facebook Page/User Access Token
 * @param {string} keyword - Search keyword to convert to hashtag
 * @returns {Promise<Array>} List of mapped posts
 */
const searchInstagramHashtagMedia = async (instagramUserId, accessToken, keyword) => {
  if (!instagramUserId || !accessToken || !keyword) {
    throw new Error("Missing required parameters for searchInstagramHashtagMedia");
  }

  // Clean keyword to alphanumeric single-word hashtag
  const hashtag = keyword.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (!hashtag) {
    throw new Error("Invalid keyword for Instagram hashtag search");
  }

  try {
    // 1. Get Hashtag ID
    const searchUrl = `https://graph.facebook.com/${META_VERSION}/ig_hashtag_search?user_id=${instagramUserId}&q=${hashtag}&access_token=${accessToken}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchRes.ok || !searchData.data || searchData.data.length === 0) {
      throw new Error(searchData.error?.message || `Hashtag #${hashtag} not found or search failed`);
    }

    const hashtagId = searchData.data[0].id;

    // 2. Get Top Media for the Hashtag
    const mediaUrl = `https://graph.facebook.com/${META_VERSION}/${hashtagId}/top_media?user_id=${instagramUserId}&fields=id,media_type,media_url,permalink,like_count,comments_count,caption,timestamp&access_token=${accessToken}&limit=10`;
    const mediaRes = await fetch(mediaUrl);
    const mediaData = await mediaRes.json();

    if (!mediaRes.ok) {
      throw new Error(mediaData.error?.message || "Failed to fetch top media for hashtag");
    }

    const posts = mediaData.data || [];
    const mapped = posts.map((post) => {
      // Calculate engagement rate
      const viewCount = (post.like_count || 0) * 10; // estimate views as 10x likes if not available
      const likeCount = post.like_count || 0;
      const commentCount = post.comments_count || 0;
      const engagementRate = viewCount > 0
        ? parseFloat((((likeCount + commentCount) / viewCount) * 100).toFixed(2))
        : 0;

      // Estimate viral score
      const viralScore = Math.min(Math.max(Math.round(likeCount * 0.7 + commentCount * 0.3), 80), 99);

      // Parse caption for creator or use a default one
      let creator = "instagram_creator";
      if (post.caption) {
        const match = post.caption.match(/@([a-zA-Z0-9_\.]+)/);
        if (match) creator = match[1];
      }

      return {
        videoId: post.id,
        title: post.caption ? post.caption.split("\n")[0].substring(0, 80) : "Instagram Post",
        channelTitle: creator,
        description: post.caption || "",
        thumbnail: post.media_url || "",
        publishedAt: post.timestamp || new Date().toISOString(),
        videoUrl: post.permalink || (post.id ? `https://www.instagram.com/p/${post.id}/` : ""),
        duration: post.media_type === "VIDEO" ? "Reel" : "Post",
        mediaType: post.media_type,
        viewCount,
        likeCount,
        commentCount,
        viralScore,
        engagementRate,
      };
    });

    // Prioritize Reels (VIDEO) by placing them first
    const reels = mapped.filter((post) => post.mediaType === "VIDEO");
    const otherPosts = mapped.filter((post) => post.mediaType !== "VIDEO");

    return [...reels, ...otherPosts];
  } catch (error) {
    console.error("Error in searchInstagramHashtagMedia service:", error);
    throw error;
  }
};

/**
 * Generate natural AI reply using Gemini or OpenAI based on incoming message and rule context
 */
const generateAIReply = async (commentText, keyword, aiInstruction = "", replyTemplate = "") => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (geminiKey) {
    try {
      const { GoogleGenAI } = require("@google/genai");
      const genAI = new GoogleGenAI({ apiKey: geminiKey });
      const models = (process.env.GEMINI_MODEL || "gemini-2.5-flash")
        .split(",")
        .map(m => m.trim())
        .filter(Boolean);
      if (!models.includes("gemini-2.5-flash")) {
        models.push("gemini-2.5-flash");
      }

      const prompt = `You are a professional automated virtual assistant for an Instagram creator.
Respond to this comment on a post/reel: "${commentText}"
The matching keyword was: "${keyword}".
Base instruction / persona: "${aiInstruction || "Be helpful and friendly"}"
Default reply template to guide you: "${replyTemplate}"

Write a concise, friendly reply ready to send as an Instagram DM (max 2 sentences, do not include any preamble, quotes, markdown, metadata, or placeholders). Keep it completely natural.`;

      let reply = "";
      for (const modelName of models) {
        try {
          const result = await genAI.models.generateContent({
            model: modelName,
            contents: prompt,
          });
          reply = (result.text || "").trim();
          if (reply) break;
        } catch (err) {
          console.warn(`[Instagram Service] Gemini model ${modelName} failed, trying next...:`, err.message);
        }
      }
      if (reply) return reply;
    } catch (err) {
      console.error("[Instagram Service] Gemini DM reply generation failed:", err.message);
    }
  }

  // Fallback to OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const OpenAI = require("openai");
      const client = new OpenAI({ apiKey: openaiKey });
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.7,
        max_tokens: 150,
        messages: [
          {
            role: "system",
            content: `You are a professional automated virtual assistant for an Instagram creator. Keep the reply extremely concise (1-2 sentences maximum, ready to send as an Instagram DM, without extra formatting, placeholders, or preamble). Instructions: ${aiInstruction || "Be helpful and friendly"}`
          },
          {
            role: "user",
            content: `The comment is: "${commentText}". The keyword matched was: "${keyword}". The template reply is: "${replyTemplate}". Please generate a natural DM response.`
          }
        ]
      });
      const reply = completion.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
    } catch (err) {
      console.error("[Instagram Service] OpenAI DM reply generation failed:", err.message);
    }
  }

  return replyTemplate;
};

/**
 * Processes an incoming comment webhook event, matches active rules,
 * generates AI/template replies, sends public and private replies, and logs execution to DB.
 */
const handleInstagramComment = async (account, fromId, commentText, commentId, commenterUsername, mediaId = "") => {
  const AutomationRule = require("../models/AutomationRule");
  const AutomationLog = require("../models/AutomationLog");
  const Lead = require("../models/Lead");

  try {
    const cleanedText = commentText.toLowerCase().trim();

    // 1. Fetch active automation rules for this user's account
    const rules = await AutomationRule.find({
      userId: account.userId,
      instagramAccountId: account.instagramUserId,
      isActive: true
    });

    // 2. Find matching rule
    const matchedRule = rules.find((rule) => {
      // If rule targets a specific post, it must match mediaId
      if (rule.postId && rule.postId !== "all" && rule.postId !== mediaId) {
        return false;
      }

      if (rule.triggerType === "any_comment") {
        return true;
      }

      if (rule.triggerType === "keyword") {
        const keyword = (rule.keyword || "").toLowerCase().trim();
        if (!keyword) return false;

        const matchType = rule.matchType || "contains";
        if (matchType === "exact") return cleanedText === keyword;
        if (matchType === "startsWith") return cleanedText.startsWith(keyword);
        return cleanedText.includes(keyword); // contains
      }

      return false;
    });

    if (!matchedRule) {
      console.log(`[Instagram Comment Service] No active automation rule matched for comment: "${commentText}"`);
      return;
    }

    console.log(`[Instagram Comment Service] Matched rule "${matchedRule.name}" (ID: ${matchedRule._id})`);

    // 3. Generate private DM reply
    let privateReplyText = matchedRule.replyMessage || "";
    if (matchedRule.dmReplyMode === "ai") {
      console.log(`[Instagram Comment Service] Generating AI reply via Gemini/OpenAI...`);
      privateReplyText = await generateAIReply(
        commentText,
        matchedRule.keyword || "Comment",
        matchedRule.aiInstruction || "",
        matchedRule.replyMessage || ""
      );
    }

    const publicReplyText = matchedRule.publicReplyText || "";
    let publicReplySent = false;
    let privateReplySent = false;
    let logError = "";

    // 4. Send public comment reply (if configured)
    if (publicReplyText) {
      try {
        await replyToInstagramComment(commentId, publicReplyText, account.accessToken);
        publicReplySent = true;
        console.log(`[Instagram Comment Service] Public reply sent to comment: "${publicReplyText}"`);
      } catch (pubErr) {
        console.error(`[Instagram Comment Service] Public comment reply failed:`, pubErr.message);
        logError += `Public Reply Error: ${pubErr.message}; `;
      }
    }

    // 5. Send private DM reply
    if (privateReplyText) {
      try {
        await sendInstagramPrivateReply(commentId, privateReplyText, account.accessToken);
        privateReplySent = true;
        console.log(`[Instagram Comment Service] Private reply DM sent: "${privateReplyText}"`);
      } catch (privErr) {
        console.error(`[Instagram Comment Service] Private reply DM failed:`, privErr.message);
        logError += `Private Reply Error: ${privErr.message}; `;
      }
    }

    // 6. Update rule stats
    if (privateReplySent || publicReplySent) {
      matchedRule.dmSentCount += 1;
      await matchedRule.save();
    }

    // 7. Create lead if configured
    if (matchedRule.createLead) {
      try {
        await Lead.findOneAndUpdate(
          { instagramAccountId: account.instagramUserId, instagramUserId: fromId },
          {
            $setOnInsert: {
              userId: account.userId,
              username: commenterUsername,
              source: "comment_automation",
              firstMessage: commentText,
              status: "new"
            }
          },
          { upsert: true }
        );
      } catch (e) {
        console.error("[Instagram Comment Service] Failed to create lead:", e.message);
      }
    }

    // 8. Save Automation Log in MongoDB
    await AutomationLog.create({
      userId: account.userId,
      automationRuleId: matchedRule._id,
      instagramAccountId: account.instagramUserId,
      commentId,
      commentText,
      commenterUsername,
      mediaId,
      publicReplySent,
      publicReplyText,
      privateReplySent,
      privateReplyText,
      status: logError ? "failed" : "success",
      error: logError || undefined
    });

  } catch (error) {
    console.error(`[Instagram Comment Service] Error in handleInstagramComment:`, error);
  }
};

module.exports = {
  sendInstagramMessage,
  fetchInstagramProfile,
  generateOpenAIReply,
  replyToInstagramComment,
  sendInstagramPrivateReply,
  searchInstagramHashtagMedia,
  
  // Custom automation functions requested
  replyToComment: replyToInstagramComment,
  sendPrivateReply: sendInstagramPrivateReply,
  generateAIReply,
  handleInstagramComment,
};
