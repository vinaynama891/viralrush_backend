const express = require("express");
const {
  verifyWebhook,
  receiveWebhookEvent
} = require("../controllers/instagramController");

const router = express.Router();

// GET verification route from Meta
router.get("/instagram", verifyWebhook);

// POST event delivery route from Meta
router.post("/instagram", receiveWebhookEvent);

module.exports = router;
