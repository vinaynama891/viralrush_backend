const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const authRoutes           = require("./routes/authRoutes");
const featureRoutes        = require("./routes/featureRoutes");
const communityRoutes      = require("./routes/communityRoutes");
const youtubeRoutes        = require("./routes/youtubeRoutes");
const instagramRoutes      = require("./routes/instagramRoutes");
const instagramAnalyzerRoutes = require("./routes/instagramAnalyzerRoutes");
const webhookRoutes        = require("./routes/webhookRoutes");
const viralRoutes          = require("./routes/viralRoutes");
const dmAutomationRoutes   = require("./routes/dmAutomationRoutes");
const viralContentRoutes   = require("./routes/viralContentRoutes");
const trendRoutes          = require("./routes/trendRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", (req, res) => res.json({ status: "ok", app: "Viralrush API" }));
app.get("/privacy", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>VIRALRUSH - Privacy Policy</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; background: #0d0d14; color: #e2e8f0; line-height: 1.6; max-width: 800px; margin: 0 auto; }
        h1 { color: #a78bfa; font-size: 28px; }
        h2 { color: #818cf8; margin-top: 24px; }
        p { color: #94a3b8; }
      </style>
    </head>
    <body>
      <h1>VIRALRUSH Privacy Policy</h1>
      <p>Last updated: August 1, 2026</p>
      <h2>1. Information We Collect</h2>
      <p>VIRALRUSH accesses basic profile information, connected social media accounts, and user-authorized automation permissions strictly to provide social content analytics and automation services.</p>
      <h2>2. Use of Data</h2>
      <p>We use your data solely to execute requested content scheduling, analytics reporting, and AI automation triggers. We never sell or share user data with third parties.</p>
      <h2>3. Data Protection & Removal</h2>
      <p>Users can disconnect their accounts at any time via the VIRALRUSH dashboard or request complete data erasure by contacting support@viralrush.com.</p>
    </body>
    </html>
  `);
});
app.use("/api/auth", authRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/instagram", instagramRoutes);
app.use("/api/instagram", instagramAnalyzerRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/viral",          viralRoutes);
app.use("/api/viral-content",  viralContentRoutes);
app.use("/api/dm-automation",  dmAutomationRoutes);
app.use("/api/trends",         trendRoutes);
app.use("/api", communityRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
