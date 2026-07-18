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
