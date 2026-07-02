const path = require("path");

const META_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const User = require("../models/User");
const CommunityNotification = require("../models/CommunityNotification");
const Community = require("../models/Community");
const Message = require("../models/Message");
const InstagramAccount = require("../models/InstagramAccount");
const { getIO } = require("../utils/socket");
const nodemailer = require("nodemailer");

// ── Helper: Fetch & cache real Instagram stats ──
// likes  = sum of like_count across ALL post types (IMAGE, CAROUSEL_ALBUM, VIDEO/Reels)
// views  = sum of 'plays' from Insights API for each VIDEO post (real Reel/video play count)
const syncInstagramStats = async (igAccount) => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  if (igAccount.lastStatsSync && (Date.now() - new Date(igAccount.lastStatsSync).getTime()) < TWO_HOURS) {
    return; // still fresh, skip
  }
  try {
    const token = igAccount.accessToken;
    const igId  = igAccount.instagramUserId;

    // ── Step 1: Fetch all media (id, type, like_count, comments_count) ──
    let allPosts = [];
    let nextUrl  = `https://graph.facebook.com/${META_VERSION}/${igId}/media?fields=id,media_type,like_count,comments_count&limit=100&access_token=${token}`;

    for (let page = 0; page < 3 && nextUrl; page++) {
      const r = await fetch(nextUrl);
      if (!r.ok) break;
      const d = await r.json();
      if (d.error || !d.data) break;
      allPosts = allPosts.concat(d.data);
      nextUrl = d.paging?.next || null;
    }

    if (allPosts.length === 0) return;

    // ── Step 2: Sum likes & comments from ALL posts ──
    let totalLikes    = 0;
    let totalComments = 0;
    const videoPosts  = []; // collect VIDEO/Reel IDs separately

    for (const post of allPosts) {
      totalLikes    += post.like_count     || 0;
      totalComments += post.comments_count || 0;
      // media_type === "VIDEO" covers both Reels and regular videos in Graph API
      if (post.media_type === "VIDEO") videoPosts.push(post.id);
    }

    // ── Step 3: Fetch real play count for each VIDEO/Reel via Insights API ──
    // 'plays' = the same view count Instagram shows on the app
    let totalViews = 0;
    if (videoPosts.length > 0) {
      const viewResults = await Promise.all(
        videoPosts.map(async (mediaId) => {
          try {
            // Try 'plays' first (Reels), fall back to 'video_views' (older videos)
            const r = await fetch(
              `https://graph.facebook.com/${META_VERSION}/${mediaId}/insights?metric=plays&access_token=${token}`
            );
            const d = await r.json();
            if (d.data && d.data.length > 0) {
              // Insights API returns values array; take last (most recent) value
              const vals = d.data[0].values;
              if (vals && vals.length > 0) return vals[vals.length - 1].value || 0;
              return d.data[0].value || 0;
            }
            // Fallback: try video_views metric
            const r2 = await fetch(
              `https://graph.facebook.com/${META_VERSION}/${mediaId}/insights?metric=video_views&access_token=${token}`
            );
            const d2 = await r2.json();
            if (d2.data && d2.data.length > 0) {
              const vals2 = d2.data[0].values;
              if (vals2 && vals2.length > 0) return vals2[vals2.length - 1].value || 0;
              return d2.data[0].value || 0;
            }
            return 0;
          } catch { return 0; }
        })
      );
      totalViews = viewResults.reduce((sum, v) => sum + (v || 0), 0);
    }

    // ── Step 4: Calculate engagement rate ──
    const followers  = igAccount.followersCount || 1;
    const avgPerPost = (totalLikes + totalComments) / allPosts.length;
    const engRate    = ((avgPerPost / followers) * 100).toFixed(2) + "%";

    // ── Step 5: Save to DB ──
    igAccount.totalLikes    = totalLikes;
    igAccount.totalViews    = totalViews;
    igAccount.avgEngagement = engRate;
    igAccount.lastStatsSync = new Date();
    await igAccount.save();

    console.log(`[IG Stats] @${igAccount.username} | posts=${allPosts.length} | reels=${videoPosts.length} | likes=${totalLikes} | views=${totalViews} | eng=${engRate}`);
  } catch (e) {
    console.warn("[syncInstagramStats] Failed:", e.message);
  }
}

// GET /api/users/search?query=
const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 1) {
      return res.json([]);
    }
    const regex = new RegExp(query.trim(), "i");
    const users = await User.find({
      username: regex,
      _id: { $ne: req.user.id },
    })
      .select("_id username name niche platform followers")
      .limit(20);
    return res.json(users);
  } catch (error) {
    next(error);
  }
};

// POST /api/community/request
const sendRequest = async (req, res, next) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ message: "receiverId is required" });
    if (receiverId === req.user.id)
      return res.status(400).json({ message: "You cannot send a request to yourself" });

    // Check for existing pending request
    const duplicate = await CommunityNotification.findOne({
      senderId: req.user.id,
      receiverId,
      status: "pending",
    });
    if (duplicate) return res.status(409).json({ message: "Community request already sent" });

    // Check if community already exists between these two users
    const existingCommunity = await Community.findOne({
      members: { $all: [req.user.id, receiverId] },
    });
    if (existingCommunity)
      return res.status(409).json({ message: "You already have a community with this user" });

    const notification = await CommunityNotification.create({
      senderId: req.user.id,
      receiverId,
      type: "community_request",
      status: "pending",
    });

    const populated = await notification.populate([
      { path: "senderId", select: "username name niche platform" },
      { path: "receiverId", select: "username name" },
    ]);

    // Real-time: emit to receiver's personal room
    try {
      const io = getIO();
      io.to(receiverId.toString()).emit("new_community_request", populated);
    } catch (_) {}

    return res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// GET /api/community/notifications
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await CommunityNotification.find({ receiverId: req.user.id })
      .populate("senderId", "username name niche platform")
      .sort({ createdAt: -1 });
    return res.json(notifications);
  } catch (error) {
    next(error);
  }
};

// POST /api/community/notifications/:id/accept
const acceptRequest = async (req, res, next) => {
  try {
    const notification = await CommunityNotification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    if (notification.receiverId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });
    if (notification.status !== "pending")
      return res.status(400).json({ message: "Request is no longer pending" });

    // Guard: don't create duplicate community
    const existingCommunity = await Community.findOne({
      members: { $all: [notification.senderId, notification.receiverId] },
    });
    if (existingCommunity) {
      notification.status = "accepted";
      await notification.save();
      return res.json({ community: existingCommunity, message: "Community already exists" });
    }

    // Create community
    const community = await Community.create({
      members: [notification.senderId, notification.receiverId],
    });

    notification.status = "accepted";
    await notification.save();

    const populated = await community.populate("members", "username name niche platform");

    // Real-time: emit to both users
    try {
      const io = getIO();
      const payload = { community: populated, message: "Community created successfully!" };
      io.to(notification.senderId.toString()).emit("community_created", payload);
      io.to(notification.receiverId.toString()).emit("community_created", payload);
    } catch (_) {}

    return res.status(201).json({ community: populated });
  } catch (error) {
    next(error);
  }
};

// POST /api/community/notifications/:id/reject
const rejectRequest = async (req, res, next) => {
  try {
    const notification = await CommunityNotification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    if (notification.receiverId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });
    if (notification.status !== "pending")
      return res.status(400).json({ message: "Request is no longer pending" });

    notification.status = "rejected";
    await notification.save();

    // Real-time: notify sender of rejection
    try {
      const io = getIO();
      io.to(notification.senderId.toString()).emit("request_rejected", {
        message: "Your community request was rejected",
        notificationId: notification._id,
      });
    } catch (_) {}

    return res.json({ message: "Request rejected" });
  } catch (error) {
    next(error);
  }
};

// GET /api/community/my
const getMyCommunities = async (req, res, next) => {
  try {
    const communities = await Community.find({ members: req.user.id })
      .populate("members", "username name niche platform followers following posts totalLikes totalViews avgEngagement bio profilePicture platformProfileUrl")
      .sort({ createdAt: -1 });

    // Enrich each member with real Instagram stats
    const enriched = await Promise.all(
      communities.map(async (comm) => {
        const commObj = comm.toObject();
        commObj.members = await Promise.all(
          commObj.members.map(async (member) => {
            const igAcc = await InstagramAccount.findOne({ userId: member._id, isConnected: true });
            if (igAcc) {
              // First time: await sync so real data is in THIS response
              // Repeat visits: background (cached values used immediately)
              if (!igAcc.lastStatsSync) {
                await syncInstagramStats(igAcc);
              } else {
                syncInstagramStats(igAcc).catch(() => {});
              }
              const fresh = await InstagramAccount.findById(igAcc._id);
              return {
                ...member,
                username:       fresh.username         || member.username,
                followers:      fresh.followersCount   || member.followers      || 0,
                following:      fresh.followsCount     || member.following      || 0,
                posts:          fresh.mediaCount       || member.posts          || 0,
                totalLikes:     fresh.totalLikes        || member.totalLikes     || 0,
                totalViews:     fresh.totalViews        || member.totalViews     || 0,
                avgEngagement:  fresh.avgEngagement     || member.avgEngagement  || "0%",
                profilePicture: fresh.profilePicture    || member.profilePicture || "",
                platformProfileUrl: `https://instagram.com/${fresh.username}`,
                mediaCount:     fresh.mediaCount        || 0,
                igConnected:    true,
              };
            }
            return { ...member, igConnected: false };
          })
        );
        return commObj;
      })
    );

    return res.json(enriched);
  } catch (error) {
    next(error);
  }
};

// GET /api/community/:communityId/messages?page=1
const getChatHistory = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found" });
    if (!community.members.map((m) => m.toString()).includes(req.user.id))
      return res.status(403).json({ message: "Not a member of this community" });

    const messages = await Message.find({ communityId })
      .populate("senderId", "username name")
      .populate({ path: "replyTo", populate: { path: "senderId", select: "username" } })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.json(messages.reverse());
  } catch (error) {
    next(error);
  }
};

// POST /api/community/:communityId/messages/read
const markRead = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    await Message.updateMany(
      { communityId, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    return res.json({ message: "Marked as read" });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/community/:communityId
const deleteCommunity = async (req, res, next) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) return res.status(404).json({ message: "Community not found" });
    if (!community.members.map(m => m.toString()).includes(req.user.id))
      return res.status(403).json({ message: "Not a member" });

    await Message.deleteMany({ communityId: community._id });
    await community.deleteOne();

    try {
      const io = getIO();
      community.members.forEach(memberId => {
        io.to(memberId.toString()).emit("community_deleted", { communityId: community._id });
      });
    } catch (_) {}

    return res.json({ message: "Community deleted" });
  } catch (error) { next(error); }
};

// DELETE /api/community/messages/:messageId
const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.senderId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not your message" });

    await message.deleteOne();

    try {
      const io = getIO();
      io.to(`community_${message.communityId}`).emit("message_deleted", {
        messageId: message._id,
        communityId: message.communityId,
      });
    } catch (_) {}

    return res.json({ message: "Message deleted" });
  } catch (error) { next(error); }
};

// PUT /api/community/messages/:messageId
const editMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text is required" });

    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.senderId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not your message" });

    message.text = text.trim();
    message.edited = true;
    await message.save();

    const populated = await message.populate("senderId", "username name");

    try {
      const io = getIO();
      io.to(`community_${message.communityId}`).emit("message_edited", populated);
    } catch (_) {}

    return res.json(populated);
  } catch (error) { next(error); }
};

// POST /api/community/:communityId/upload
const uploadImage = async (req, res, next) => {
  try {
    const { communityId } = req.params;

    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found" });
    if (!community.members.map(m => m.toString()).includes(req.user.id))
      return res.status(403).json({ message: "Not a member" });

    const imageUrl = `/uploads/${req.file.filename}`;

    const message = await Message.create({
      communityId,
      senderId: req.user.id,
      text: "",
      imageUrl,
      readBy: [req.user.id],
      timestamp: new Date(),
    });

    const populated = await message.populate([
      { path: "senderId", select: "username name" },
      { path: "replyTo", populate: { path: "senderId", select: "username" } },
    ]);

    try {
      const io = getIO();
      io.to(`community_${communityId}`).emit("new_message", populated);
    } catch (_) {}

    return res.status(201).json(populated);
  } catch (error) { next(error); }
};

// POST /api/community/:communityId/close
const closeDeal = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { finalPrice } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found" });
    if (!community.members.map(m => m.toString()).includes(req.user.id))
      return res.status(403).json({ message: "Not a member" });

    // Mark as closed and store the final price
    community.isClosed = true;
    community.finalPrice = finalPrice || 0;
    await community.save();

    const populated = await community.populate("members", "username name niche platform");

    try {
      const io = getIO();
      // Emit to both users in the community
      community.members.forEach(memberId => {
        io.to(memberId.toString()).emit("deal_closed", { communityId: community._id, finalPrice });
      });
      // Also emit to the community room itself just in case
      io.to(`community_${communityId}`).emit("deal_closed", { communityId: community._id, finalPrice });
    } catch (_) {}

    return res.json({ message: "Deal closed successfully", community: populated });
  } catch (error) { next(error); }
};

// PUT /api/community/:communityId/payment
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { paymentStatus } = req.body;

    if (!["unpaid", "half", "paid"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status" });
    }

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found" });
    if (!community.members.map(m => m.toString()).includes(req.user.id))
      return res.status(403).json({ message: "Not a member" });

    community.paymentStatus = paymentStatus;
    await community.save();

    const populated = await community.populate("members", "username name niche platform");
    
    // Optionally emit an event if needed
    try {
      const io = getIO();
      community.members.forEach(memberId => {
        io.to(memberId.toString()).emit("payment_updated", { communityId: community._id, paymentStatus });
      });
    } catch (_) {}

    return res.json({ message: "Payment status updated", community: populated });
  } catch (error) { next(error); }
};

// POST /api/community/:communityId/bill
const generateBill = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { amount, creatorTxId, brandTxId, pdfBase64 } = req.body;

    const community = await Community.findById(communityId).populate("members");
    if (!community) return res.status(404).json({ message: "Community not found" });

    // Identify creator (the one who is NOT the brand)
    const creator = community.members.find(m => m._id.toString() !== req.user.id);
    if (!creator) return res.status(404).json({ message: "Creator not found in community" });

    // Convert base64 to buffer for email attachment
    const pdfBuffer = Buffer.from(pdfBase64.split(",")[1] || pdfBase64, 'base64');

    // Update payment status to fully paid when bill is sent
    community.paymentStatus = "paid";
    await community.save();

    // Create Nodemailer transport
    let transporter;
    try {
      if (process.env.SMTP_SERVICE) {
        transporter = nodemailer.createTransport({
          service: process.env.SMTP_SERVICE,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.ethereal.email",
          port: process.env.SMTP_PORT || 587,
          auth: {
            user: process.env.SMTP_USER || "test@ethereal.email",
            pass: process.env.SMTP_PASS || "testpass"
          }
        });
      }

      await transporter.sendMail({
        from: '"ViralRush Billing" <billing@viralrush.com>',
        to: creator.email || "creator@example.com", // Fallback if no email is set
        subject: "Your Payment Bill from ViralRush",
        text: `Hello ${creator.username},\n\nPlease find attached your payment bill for the amount of $${amount}.\nBrand Transaction ID: ${brandTxId}\nCreator Transaction ID: ${creatorTxId}\n\nThank you for using ViralRush!`,
        attachments: [
          {
            filename: `bill_${communityId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
    } catch (mailErr) {
      console.log("Email failed to send (likely due to missing SMTP config), but PDF generated.", mailErr.message);
    }

    return res.json({ message: "Bill generated and sent successfully" });
  } catch (error) { next(error); }
};

// PUT /api/community/creator-stats  (creator apni stats update kare)
const updateCreatorStats = async (req, res, next) => {
  try {
    const { followers, following, posts, totalLikes, totalViews, avgEngagement, bio, profilePicture, platformProfileUrl, niche, platform } = req.body;
    const updates = {};
    if (followers !== undefined) updates.followers = followers;
    if (following !== undefined) updates.following = following;
    if (posts !== undefined) updates.posts = posts;
    if (totalLikes !== undefined) updates.totalLikes = totalLikes;
    if (totalViews !== undefined) updates.totalViews = totalViews;
    if (avgEngagement !== undefined) updates.avgEngagement = avgEngagement;
    if (bio !== undefined) updates.bio = bio;
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;
    if (platformProfileUrl !== undefined) updates.platformProfileUrl = platformProfileUrl;
    if (niche !== undefined) updates.niche = niche;
    if (platform !== undefined) updates.platform = platform;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true })
      .select("-password -otp -otpExpiry");
    return res.json({ message: "Stats updated", user });
  } catch (error) { next(error); }
};

// POST /api/community/:communityId/refresh-stats
// Brand force-refresh kare creator ke Instagram stats (cache bypass)
const forceRefreshCreatorStats = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId).populate("members", "_id username");
    if (!community) return res.status(404).json({ message: "Community not found" });
    if (!community.members.map(m => m._id.toString()).includes(req.user.id))
      return res.status(403).json({ message: "Not a member" });

    // Find the other member (the creator)
    const creatorMember = community.members.find(m => m._id.toString() !== req.user.id);
    if (!creatorMember) return res.status(404).json({ message: "Creator not found" });

    const igAcc = await InstagramAccount.findOne({ userId: creatorMember._id, isConnected: true });
    if (!igAcc) return res.status(404).json({ message: "Creator has no Instagram connected" });

    // Force reset cache timestamp so syncInstagramStats runs fresh
    igAcc.lastStatsSync = null;
    await igAcc.save();

    // Now run sync and await it
    await syncInstagramStats(igAcc);

    const fresh = await InstagramAccount.findById(igAcc._id);
    return res.json({
      message: "Stats refreshed",
      stats: {
        followers:     fresh.followersCount,
        following:     fresh.followsCount,
        posts:         fresh.mediaCount,
        totalLikes:    fresh.totalLikes,
        totalViews:    fresh.totalViews,
        avgEngagement: fresh.avgEngagement,
        mediaCount:    fresh.mediaCount,
        lastSync:      fresh.lastStatsSync,
      }
    });
  } catch (error) { next(error); }
};

module.exports = {
  searchUsers,
  sendRequest,
  getNotifications,
  acceptRequest,
  rejectRequest,
  getMyCommunities,
  getChatHistory,
  markRead,
  deleteCommunity,
  deleteMessage,
  editMessage,
  uploadImage,
  closeDeal,
  updatePaymentStatus,
  generateBill,
  updateCreatorStats,
  forceRefreshCreatorStats,
};
