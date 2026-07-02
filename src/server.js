require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./app");
const connectDB = require("./config/db");
const { setIO } = require("./utils/socket");
const Message = require("./models/Message");
const ScheduledPost = require("./models/ScheduledPost");
const { runCalendarEmailReminderScheduler } = require("./services/reminderScheduler");

const META_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

setIO(io);

// Track online users: userId -> socketId
const onlineUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Authentication error"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId, socket.id);

  // Join personal room for direct notifications
  socket.join(userId);

  // Broadcast updated online users list
  io.emit("online_users", Array.from(onlineUsers.keys()));

  // Join a community chat room
  socket.on("join_community", (communityId) => {
    socket.join(`community_${communityId}`);
  });

  // Send a message
  socket.on("send_message", async (data) => {
    try {
      const { communityId, text, replyTo } = data;
      if (!communityId || !text?.trim()) return;

      console.log(`[Community Socket] Incoming send_message request from User ${userId} for Room ${communityId}: "${text}"`);

      const msgData = {
        communityId,
        senderId: userId,
        text: text.trim(),
        readBy: [userId],
        timestamp: new Date(),
      };
      if (replyTo) msgData.replyTo = replyTo;

      const message = await Message.create(msgData);

      const populated = await message.populate([
        { path: "senderId", select: "username name" },
        { path: "replyTo", populate: { path: "senderId", select: "username" } },
      ]);

      const roomName = `community_${communityId}`;
      io.to(roomName).emit("new_message", populated.toJSON ? populated.toJSON() : populated);
      console.log(`[Community Socket] Successfully saved to DB and emitted to Room "${roomName}"`);

      // ── @VR AI Responder Engine ───────────────────────────────────────
      if (text.toLowerCase().includes("@vr")) {
        console.log(`[Community AI] Trigger word @VR detected in message: "${text}"`);
        
        // Dynamically resolve or create the ViralRush AI Assistant account
        const User = require("./models/User");
        let aiUser = await User.findOne({ username: "ViralRush_AI" });
        if (!aiUser) {
          aiUser = await User.create({
            username: "ViralRush_AI",
            name: "ViralRush AI Assistant",
            email: "ai_helper@viralrush.co",
            password: "ai_bot_secure_password_123",
            niche: "AI Automation",
            platform: "Web",
            followers: 1000000
          }).catch(() => null);
        }

        if (aiUser) {
          // 1. Simulate typing delay to make it feel incredibly premium & organic
          setTimeout(() => {
            io.to(`community_${communityId}`).emit("user_typing", { userId: aiUser._id });

            // 2. Generate contextual response
            const promptText = text.replace(/@vr/gi, "").trim();
            generateAIResponseForCommunity(promptText).then(async (aiResponse) => {
              
              // 3. Drop the response after 1.5 seconds typing simulation
              setTimeout(async () => {
                try {
                  const aiMsg = await Message.create({
                    communityId,
                    senderId: aiUser._id,
                    text: aiResponse,
                    readBy: [aiUser._id, userId],
                    timestamp: new Date()
                  });

                  const populatedAiMsg = await aiMsg.populate([
                    { path: "senderId", select: "username name" },
                  ]);

                  io.to(`community_${communityId}`).emit("user_stop_typing", { userId: aiUser._id });
                  io.to(`community_${communityId}`).emit("new_message", populatedAiMsg);
                  console.log(`[Community AI] Replied: "${aiResponse}"`);
                } catch (e) {
                  console.error("[Community AI] Failed to send response:", e.message);
                }
              }, 1200);

            });
          }, 300);
        }
      }
    } catch (err) {
      console.error("send_message error:", err);
    }
  });

  // Typing indicators
  socket.on("typing", ({ communityId }) => {
    socket.to(`community_${communityId}`).emit("user_typing", { userId });
  });

  socket.on("stop_typing", ({ communityId }) => {
    socket.to(`community_${communityId}`).emit("user_stop_typing", { userId });
  });

  // Mark messages as read
  socket.on("mark_read", async ({ communityId }) => {
    try {
      await Message.updateMany(
        { communityId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      io.to(`community_${communityId}`).emit("messages_read", { communityId, readBy: userId });
    } catch (err) {
      console.error("mark_read error:", err);
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });
});

// ── SCHEDULED POST PUBLISHER ──────────────────────────────────────────────
// Polls every 60 seconds for pending posts whose scheduledAt has passed.
const runScheduledPostPublisher = async () => {
  try {
    const now = new Date();
    const duePosts = await ScheduledPost.find({ status: "pending", scheduledAt: { $lte: now } });
    if (duePosts.length === 0) return;
    console.log(`[Scheduler] Found ${duePosts.length} scheduled post(s) due for publishing`);

    for (const post of duePosts) {
      post.status = "processing";
      await post.save();
      try {
        const igId = post.instagramAccountId;
        const token = post.accessToken;

        let containerPayload;
        if (post.mediaType === "REEL") {
          containerPayload = new URLSearchParams({
            media_type: "REELS", video_url: post.cdnUrl, caption: post.caption, access_token: token,
          });
        } else {
          containerPayload = new URLSearchParams({
            image_url: post.cdnUrl, caption: post.caption, access_token: token,
          });
        }

        const containerRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${igId}/media`, {
          method: "POST", body: containerPayload
        });
        const containerData = await containerRes.json();
        if (!containerRes.ok || containerData.error || !containerData.id) {
          throw new Error(containerData.error?.message || "Failed to create media container");
        }

        const containerId = containerData.id;

        if (post.mediaType === "REEL") {
          let finished = false;
          for (let i = 0; i < 80; i++) {
            const delay = i < 10 ? 3000 : i < 30 ? 5000 : 8000;
            await new Promise(r => setTimeout(r, delay));
            const statusRes = await fetch(
              `https://graph.facebook.com/${META_VERSION}/${containerId}?fields=status_code,status&access_token=${token}`
            );
            const statusData = await statusRes.json();
            if (statusData?.status_code === "FINISHED") { finished = true; break; }
            if (statusData?.status_code === "ERROR") {
              throw new Error(statusData?.error?.message || "Video processing failed");
            }
          }
          if (!finished) throw new Error("Reel transcoding timed out");
        } else {
          await new Promise(r => setTimeout(r, 5000));
        }

        const publishRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${igId}/media_publish`, {
          method: "POST",
          body: new URLSearchParams({ creation_id: containerId, access_token: token })
        });
        const publishData = await publishRes.json();
        if (!publishRes.ok || publishData.error) {
          throw new Error(publishData.error?.message || "Failed to publish post");
        }

        post.status = "published";
        post.publishedAt = new Date();
        post.containerId = containerId;
        await post.save();
        console.log(`[Scheduler] ✅ Post ${post._id} published to Instagram`);
      } catch (err) {
        console.error(`[Scheduler] ❌ Post ${post._id} failed:`, err.message);
        post.status = "failed";
        post.errorMessage = err.message;
        await post.save();
      }
    }
  } catch (err) {
    console.error("[Scheduler] Fatal error:", err);
  }
};

/**
 * Generates dynamic growth, hashtag, scheduling, or campaign AI advice for community chats.
 * Calls Google Gemini as first priority, OpenAI as second, and curated rules as fallback.
 */
const generateAIResponseForCommunity = async (userInput) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  const apiKey = process.env.OPENAI_API_KEY;
  const cleanInput = (userInput || "").toLowerCase().trim();

  // 1. Google Gemini 1.5 Flash Integration (Highest Priority!)
  if (geminiKey) {
    try {
      console.log("[Community AI] Invoking Google Gemini 1.5 Flash API...");
      const finalPrompt = cleanInput.length > 0 
        ? cleanInput 
        : "Introduce yourself as 'ViralRush AI' and tell me in 2 punchy sentences what cool automated things you can help me do in this dashboard!";
        
      const systemPrompt = "You are 'ViralRush AI', a state-of-the-art virtual assistant built inside the ViralRush dashboard. You help content creators grow their organic audience, schedule posts, understand analytics, and optimize engagement. Keep your answers extremely conversational, friendly, encouraging, and punchy (maximum 2 sentences). Use an emoji or two!";
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${systemPrompt}\n\nUser Question: ${finalPrompt}`
              }]
            }]
          })
        }
      );
      
      const data = await response.json();
      if (!response.ok || data.error) {
        console.error("[Community AI] Gemini API returned error status:", data.error || data);
      }
      
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (reply) {
        return reply;
      }
    } catch (err) {
      console.error("[Community AI] Google Gemini network request failed:", err.message);
    }
  }

  // 2. OpenAI Integration (Second Priority)
  if (apiKey) {
    try {
      const OpenAI = require("openai");
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: 180,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "You are 'ViralRush AI', a state-of-the-art virtual assistant built inside the ViralRush dashboard. You help content creators, marketers, and influencers grow their organic audience, schedule posts, understand analytics, and optimize engagement. Keep your answers extremely conversational, friendly, encouraging, and punchy (maximum 2 sentences). Use an emoji or two!"
          },
          {
            role: "user",
            content: userInput || "Hello! Who are you?"
          }
        ]
      });
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      console.error("[Community AI] OpenAI query failed:", err.message);
    }
  }

  // 3. High-value fallback system
  if (cleanInput.includes("stats") || cleanInput.includes("analytic")) {
    return "📈 Our real-time analytics show that your Reels are gaining high watch-time retention! Try posting around 6 PM EST when your core audience goes active.";
  }
  if (cleanInput.includes("schedule") || cleanInput.includes("post") || cleanInput.includes("time")) {
    return "📅 You can easily schedule your posts and Reels directly from our 'Create Post' tab! We'll publish them automatically at your target times.";
  }
  if (cleanInput.includes("grow") || cleanInput.includes("viral") || cleanInput.includes("reach")) {
    return "🚀 Focus on high hook-retention in the first 3 seconds of your Reels! Combine that with a call-to-action to comment a keyword for auto-DM delivery.";
  }
  if (cleanInput.includes("hashtag") || cleanInput.includes("tag")) {
    return "🏷️ Use 3-5 highly relevant, niche-specific hashtags instead of generic ones (like #viral). This helps Instagram classify and index your Reels for the right explore page audience!";
  }
  if (cleanInput.includes("help") || cleanInput.includes("support")) {
    return "💡 I'm here to help! Ask me anything about audience growth, automated comments/DMs, campaign pricing, or post scheduling!";
  }
  if (cleanInput.includes("hello") || cleanInput.includes("hi") || cleanInput.includes("hey")) {
    return "👋 Hey there! I am your ViralRush AI Assistant. Ask me any question about organic growth or our dashboard tools, and I will help you scale!";
  }

  return "✨ That is a great idea! Try automating comments on your next Reel to trigger instant DM guides, increasing engagement rate by up to 250%!";
};

const bootstrap = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Viralrush backend running on port ${PORT}`);
  });
  // Set HTTP timeout to 10 minutes to allow slow CDN uploads + Meta Reel transcoding
  server.timeout = 600000;
  server.keepAliveTimeout = 600000;

  // Start the scheduled post publisher — runs every 60 seconds
  console.log("[Scheduler] Starting scheduled post publisher (60s interval)");
  setInterval(runScheduledPostPublisher, 60 * 1000);
  // Also run immediately on startup to catch any posts that were pending before restart
  setTimeout(runScheduledPostPublisher, 5000);

  // Start the Content Plan email reminder scheduler — runs every 60 seconds
  console.log("[Scheduler] Starting content planner email reminders worker (60s interval)");
  setInterval(runCalendarEmailReminderScheduler, 60 * 1000);
  setTimeout(runCalendarEmailReminderScheduler, 7000);
};

bootstrap();
