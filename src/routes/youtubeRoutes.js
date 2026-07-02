const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const {
  getAuthUrl,
  handleCallback,
  getChannelAnalytics,
  getVideos,
  disconnectYouTube,
  uploadVideo
} = require('../controllers/youtubeController');

// Configure multer storage for video uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ytUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.mp4';
      cb(null, `yt_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 250 * 1024 * 1024 }, // 250 MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isVideo = file.mimetype.startsWith('video/') || ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp'].includes(ext);
    if (isVideo) cb(null, true);
    else cb(new Error('Only video files are allowed.'));
  }
});

const router = express.Router();

// OAuth based connection (secure — user connects their own channel only)
router.get('/auth-url', protect, getAuthUrl);
router.get('/callback', handleCallback); // Google redirects here without auth header

// Video upload (requires Google OAuth connection)
router.post('/upload', protect, ytUpload.single('video'), uploadVideo);

// Channel data
router.get('/analytics', protect, getChannelAnalytics);
router.get('/videos', protect, getVideos);
router.post('/disconnect', protect, disconnectYouTube);

module.exports = router;

