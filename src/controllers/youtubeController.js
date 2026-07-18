const { google } = require('googleapis');
const User = require('../models/User');
const fs = require('fs');

// ── Helper: build YouTube Data API client using API Key (used for read-only analytics) ──
const getYouTubeApiKey = () => process.env.YOUTUBE_API_KEY;

// ── Helper: build OAuth2 client (only used when GOOGLE_CLIENT_SECRET is configured) ──
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://viralrush-backend.onrender.com/api/youtube/callback'
  );
};

// Scopes required for YouTube Data API (OAuth path)
const scopes = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
];

// ────────────────────────────────────────────────────────────────────────────
// GET /api/youtube/auth-url
// Generates Google OAuth URL for secure YouTube connection
// ────────────────────────────────────────────────────────────────────────────
exports.getAuthUrl = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend .env file.'
      });
    }

    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: req.user.id.toString()
    });
    res.json({ url });
  } catch (err) {
    console.error('[YouTube] getAuthUrl error:', err);
    res.status(500).json({ message: 'Failed to generate YouTube auth URL' });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/youtube/callback
// OAuth callback — handles Google redirect after user authorizes
// ────────────────────────────────────────────────────────────────────────────
exports.handleCallback = async (req, res) => {
  const { code, state } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://viralrush-frontend.vercel.app';
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const response = await youtube.channels.list({
      part: 'snippet,statistics,contentDetails',
      mine: true
    });

    if (!response.data.items || response.data.items.length === 0) {
      return res.redirect(`${FRONTEND_URL}/dashboard?error=yt_no_channel`);
    }

    const ch = response.data.items[0];
    const userId = state;
    const user = await User.findById(userId);

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/dashboard?error=yt_user_not_found`);
    }

    user.youtube = {
      channelId: ch.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || (user.youtube?.refreshToken || ''),
      tokensExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads || '',
      channelData: {
        title: ch.snippet.title,
        description: ch.snippet.description,
        thumbnail: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url,
        customUrl: ch.snippet.customUrl || '',
        subscriberCount: ch.statistics.subscriberCount,
        viewCount: ch.statistics.viewCount,
        videoCount: ch.statistics.videoCount,
        publishedAt: ch.snippet.publishedAt
      },
      lastSync: new Date()
    };

    await user.save();
    console.log(`[YouTube OAuth] Connected channel "${ch.snippet.title}" for user ${userId}`);

    res.redirect(`${FRONTEND_URL}/dashboard?youtube_connected=true`);
  } catch (err) {
    console.error('[YouTube] Callback error:', err);
    res.redirect(`${FRONTEND_URL}/dashboard?error=yt_auth_failed`);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/youtube/analytics
// Returns channel stats + growth charts
// Works for both API key connections and OAuth connections
// ────────────────────────────────────────────────────────────────────────────
exports.getChannelAnalytics = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.youtube?.channelId) {
      return res.status(400).json({ message: 'YouTube not connected' });
    }

    const apiKey = getYouTubeApiKey();
    let channelData = user.youtube.channelData;

    // Always try to refresh channel data from YouTube API
    try {
      const youtube = google.youtube({ version: 'v3', auth: apiKey });
      const channelRes = await youtube.channels.list({
        part: 'snippet,statistics',
        id: user.youtube.channelId
      });

      if (channelRes.data.items && channelRes.data.items.length > 0) {
        const ch = channelRes.data.items[0];
        channelData = {
          ...channelData,
          title: ch.snippet.title,
          description: ch.snippet.description,
          thumbnail: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.medium?.url || channelData?.thumbnail,
          customUrl: ch.snippet.customUrl || channelData?.customUrl || '',
          subscriberCount: ch.statistics.subscriberCount || '0',
          viewCount: ch.statistics.viewCount || '0',
          videoCount: ch.statistics.videoCount || '0',
          publishedAt: ch.snippet.publishedAt
        };

        // Save updated data to DB
        user.youtube.channelData = channelData;
        user.youtube.lastSync = new Date();
        await user.save();
      }
    } catch (apiErr) {
      console.warn('[YouTube] Could not refresh channel data from API, using cached:', apiErr.message);
    }

    if (!channelData) {
      return res.status(404).json({ message: 'Channel data not available' });
    }

    // Generate growth charts based on real totals
    const viewsHistory = generateGrowthData(parseInt(channelData.viewCount) || 0, 30);
    const subHistory = generateGrowthData(parseInt(channelData.subscriberCount) || 0, 30);

    res.json({
      channel: channelData,
      analytics: { viewsHistory, subHistory }
    });
  } catch (err) {
    console.error('[YouTube] Analytics error:', err);
    res.status(500).json({ message: 'Failed to fetch analytics', error: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/youtube/videos
// Returns the channel's recent uploaded videos with stats
// ────────────────────────────────────────────────────────────────────────────
exports.getVideos = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.youtube?.channelId) {
      return res.status(400).json({ message: 'YouTube not connected' });
    }

    const apiKey = getYouTubeApiKey();
    const youtube = google.youtube({ version: 'v3', auth: apiKey });

    // Get uploads playlist ID (use saved one or fetch fresh)
    let uploadsPlaylistId = user.youtube.uploadsPlaylistId;

    if (!uploadsPlaylistId) {
      const channelRes = await youtube.channels.list({
        part: 'contentDetails',
        id: user.youtube.channelId
      });
      if (!channelRes.data.items || channelRes.data.items.length === 0) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

      // Save for next time
      user.youtube.uploadsPlaylistId = uploadsPlaylistId;
      await user.save();
    }

    // Fetch latest videos from uploads playlist
    const playlistRes = await youtube.playlistItems.list({
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: 50
    });

    if (!playlistRes.data.items || playlistRes.data.items.length === 0) {
      return res.json({ videos: [] });
    }

    const videoIds = playlistRes.data.items
      .map(item => item.snippet.resourceId.videoId)
      .join(',');

    // Fetch video statistics
    const videosRes = await youtube.videos.list({
      part: 'snippet,statistics',
      id: videoIds
    });

    const videos = (videosRes.data.items || []).map(v => ({
      id: v.id,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      publishedAt: v.snippet.publishedAt,
      viewCount: v.statistics?.viewCount || '0',
      likeCount: v.statistics?.likeCount || '0',
      commentCount: v.statistics?.commentCount || '0',
      youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`
    }));

    res.json({ videos });
  } catch (err) {
    console.error('[YouTube] Videos error:', err);
    if (err.code === 403) {
      return res.status(403).json({ message: 'YouTube API quota exceeded. Please try again later.' });
    }
    res.status(500).json({ message: 'Failed to fetch videos', error: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/youtube/disconnect
// ────────────────────────────────────────────────────────────────────────────
exports.disconnectYouTube = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.youtube = {
      channelId: '',
      accessToken: '',
      refreshToken: '',
      uploadsPlaylistId: '',
      channelData: null,
      lastSync: null
    };
    await user.save();
    res.json({ success: true, message: 'YouTube disconnected successfully' });
  } catch (err) {
    console.error('[YouTube] Disconnect error:', err);
    res.status(500).json({ message: 'Failed to disconnect YouTube' });
  }
};

// ── Helper: generate realistic growth data chart based on real totals ──
function generateGrowthData(currentTotal, days) {
  const data = [];
  if (currentTotal === 0) {
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      data.push({ date: d.toISOString().split('T')[0], value: 0 });
    }
    return data;
  }
  let current = currentTotal * 0.92;
  const step = (currentTotal - current) / days;
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toISOString().split('T')[0],
      value: Math.floor(current + Math.random() * step * 0.3)
    });
    current += step;
  }
  data[data.length - 1].value = currentTotal;
  return data;
}

// Helper: Get Google OAuth2 client with auto token refresh
const getAuthorizedClient = async (user) => {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.youtube.accessToken,
    refresh_token: user.youtube.refreshToken,
    expiry_date: user.youtube.tokensExpiry ? new Date(user.youtube.tokensExpiry).getTime() : null
  });

  const isExpired = user.youtube.tokensExpiry && new Date() >= new Date(new Date(user.youtube.tokensExpiry).getTime() - 120000);
  if (isExpired || !user.youtube.accessToken) {
    if (!user.youtube.refreshToken) {
      throw new Error('No refresh token available. Please reconnect your YouTube account.');
    }
    try {
      console.log('[YouTube] Access token expired. Refreshing...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      
      user.youtube.accessToken = credentials.access_token;
      if (credentials.refresh_token) {
        user.youtube.refreshToken = credentials.refresh_token;
      }
      user.youtube.tokensExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
      await user.save();
      console.log('[YouTube] Access token refreshed successfully.');
    } catch (err) {
      console.error('[YouTube] Failed to refresh access token:', err.message);
      throw new Error('YouTube session expired. Please reconnect your account.');
    }
  }
  return oauth2Client;
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/youtube/upload
// Uploads a video to YouTube (requires OAuth connection)
// ────────────────────────────────────────────────────────────────────────────
exports.uploadVideo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user?.youtube?.channelId) {
      return res.status(400).json({ message: 'YouTube not connected' });
    }

    if (!user.youtube.accessToken || user.youtube.accessToken === 'apikey') {
      return res.status(400).json({
        message: 'YouTube OAuth session is not valid. Please disconnect and reconnect your YouTube account via Google Sign-In.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    const { title, description, privacyStatus } = req.body;
    if (!title || !title.trim()) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Video title is required' });
    }

    console.log(`[YouTube] Starting upload of "${title}" for user ${user._id}`);
    
    const authClient = await getAuthorizedClient(user);
    const youtube = google.youtube({ version: 'v3', auth: authClient });

    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: title.trim(),
          description: description ? description.trim() : '',
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: privacyStatus || 'public',
        },
      },
      media: {
        body: fs.createReadStream(req.file.path),
      },
    });

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.log(`[YouTube] Video uploaded successfully. Video ID: ${response.data.id}`);

    res.json({
      success: true,
      videoId: response.data.id,
      videoUrl: `https://www.youtube.com/watch?v=${response.data.id}`,
      title: response.data.snippet.title
    });

  } catch (err) {
    console.error('[YouTube] Video upload error:', err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('[YouTube] Failed to delete temporary file:', unlinkErr.message);
      }
    }
    res.status(500).json({ message: 'Failed to upload video to YouTube', error: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/youtube/lookup-competitor?q=<channel name or handle>
// Searches for a YouTube channel by name/handle and returns real stats
// ────────────────────────────────────────────────────────────────────────────
exports.lookupCompetitor = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });
    }

    const apiKey = getYouTubeApiKey();
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'YouTube API key not configured' });
    }

    const youtube = google.youtube({ version: 'v3', auth: apiKey });
    const searchTerm = q.trim().replace(/^@/, '');

    // Step 1: Search for the channel
    const searchRes = await youtube.search.list({
      part: 'snippet',
      q: searchTerm,
      type: 'channel',
      maxResults: 1
    });

    if (!searchRes.data.items || searchRes.data.items.length === 0) {
      return res.status(404).json({ success: false, message: `No YouTube channel found for "${searchTerm}"` });
    }

    const channelId = searchRes.data.items[0].snippet.channelId;
    const snippet = searchRes.data.items[0].snippet;

    // Step 2: Get detailed statistics for that channel
    const channelRes = await youtube.channels.list({
      part: 'snippet,statistics,brandingSettings',
      id: channelId
    });

    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel details not found' });
    }

    const ch = channelRes.data.items[0];
    const stats = ch.statistics;
    const chSnippet = ch.snippet;

    // Step 3: Get channel's top 15 videos sorted by view count
    let topVideos = [];
    try {
      const videosRes = await youtube.search.list({
        part: 'id,snippet',
        channelId: channelId,
        maxResults: 15,
        order: 'viewCount',
        type: 'video'
      });

      if (videosRes.data.items && videosRes.data.items.length > 0) {
        const videoIds = videosRes.data.items.map(item => item.id.videoId).filter(Boolean).join(',');
        if (videoIds) {
          const statsRes = await youtube.videos.list({
            part: 'id,snippet,statistics,contentDetails',
            id: videoIds
          });

          if (statsRes.data.items) {
            topVideos = statsRes.data.items.map(v => {
              // Parse ISO 8601 duration (PT4M13S) to human readable
              const isoDuration = v.contentDetails?.duration || '';
              const dMatch = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
              let durationStr = 'N/A';
              let durationSeconds = 0;
              if (dMatch) {
                const h = parseInt(dMatch[1] || '0', 10);
                const m = parseInt(dMatch[2] || '0', 10);
                const s = parseInt(dMatch[3] || '0', 10);
                durationSeconds = h * 3600 + m * 60 + s;
                const parts = [];
                if (h) parts.push(`${h}h`);
                if (m) parts.push(`${m}m`);
                if (s) parts.push(`${s}s`);
                durationStr = parts.join(' ') || 'N/A';
              }
              return {
                id: v.id,
                title: v.snippet?.title || 'No Title',
                thumbnail: v.snippet?.thumbnails?.high?.url || v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
                publishedAt: v.snippet?.publishedAt || '',
                views: v.statistics?.viewCount || '0',
                likes: v.statistics?.likeCount || '0',
                comments: v.statistics?.commentCount || '0',
                duration: durationStr,
                durationSeconds: durationSeconds,
                link: `https://www.youtube.com/watch?v=${v.id}`
              };
            });
          }
        }
      }
    } catch (videoErr) {
      console.warn('[YouTube] Failed to fetch top videos for competitor:', videoErr.message);
    }

    res.json({
      success: true,
      data: {
        channelId: channelId,
        name: chSnippet.title,
        handle: chSnippet.customUrl || `@${searchTerm}`,
        description: chSnippet.description || '',
        thumbnail: chSnippet.thumbnails?.high?.url || chSnippet.thumbnails?.medium?.url || chSnippet.thumbnails?.default?.url || '',
        subscriberCount: stats.subscriberCount || '0',
        videoCount: stats.videoCount || '0',
        viewCount: stats.viewCount || '0',
        hiddenSubscriberCount: stats.hiddenSubscriberCount || false,
        publishedAt: chSnippet.publishedAt || '',
        country: chSnippet.country || '',
        topVideos: topVideos
      }
    });

  } catch (err) {
    console.error('[YouTube] lookupCompetitor error:', err);
    res.status(500).json({ success: false, message: 'Failed to lookup competitor channel', error: err.message });
  }
};

