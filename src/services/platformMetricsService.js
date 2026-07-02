const User = require("../models/User");

const parseYouTubeIdentity = (url) => {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    const channelIndex = parts.findIndex((p) => p === "channel");
    if (channelIndex !== -1 && parts[channelIndex + 1]) {
      return { type: "channelId", value: parts[channelIndex + 1] };
    }

    const handlePart = parts.find((p) => p.startsWith("@"));
    if (handlePart) {
      return { type: "handle", value: handlePart.replace("@", "") };
    }

    return null;
  } catch (error) {
    return null;
  }
};

const fetchYouTubeMetrics = async (profileUrl) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      followers: null,
      following: null,
      totalViews: null,
      source: "youtube",
      note: "Add YOUTUBE_API_KEY in backend .env to fetch real YouTube metrics.",
    };
  }

  const identity = parseYouTubeIdentity(profileUrl);
  if (!identity) {
    return {
      followers: null,
      following: null,
      totalViews: null,
      source: "youtube",
      note: "Unsupported YouTube URL format. Use /channel/{id} or /@handle URL.",
    };
  }

  const params =
    identity.type === "channelId"
      ? `id=${encodeURIComponent(identity.value)}`
      : `forHandle=${encodeURIComponent(identity.value)}`;
  const endpoint = `https://www.googleapis.com/youtube/v3/channels?part=statistics&${params}&key=${apiKey}`;
  const response = await fetch(endpoint);
  const data = await response.json();

  if (!response.ok || !data.items || !data.items.length) {
    return {
      followers: null,
      following: null,
      totalViews: null,
      source: "youtube",
      note: "Could not fetch YouTube metrics for this profile URL.",
    };
  }

  const stats = data.items[0].statistics;
  return {
    followers: Number(stats.subscriberCount || 0),
    following: 0,
    totalViews: Number(stats.viewCount || 0),
    source: "youtube",
    note: "YouTube provides subscribers and total channel views. Following is not provided by YouTube API.",
  };
};

const getPlatformMetricsForUser = async (userId) => {
  const user = await User.findById(userId).select("platform platformProfileUrl followers");
  if (!user) throw new Error("User not found");

  if (!user.platformProfileUrl) {
    return {
      followers: user.followers || 0,
      following: 0,
      totalViews: 0,
      source: "none",
      note: "Add your platform profile URL in account details to fetch live metrics.",
    };
  }

  const platform = (user.platform || "").toLowerCase();
  if (platform.includes("youtube")) {
    return fetchYouTubeMetrics(user.platformProfileUrl);
  }

  return {
    followers: null,
    following: null,
    totalViews: null,
    source: platform || "unknown",
    note: "Live public metrics require official API access. Currently enabled for YouTube URLs.",
  };
};

module.exports = { getPlatformMetricsForUser };
