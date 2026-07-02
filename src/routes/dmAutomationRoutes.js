const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getAutomations,
  createAutomation,
  getAutomationById,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
  getStats,
  getAutomationLogs,
} = require("../controllers/dmAutomationController");

const router = express.Router();

router.use(protect);

router.get("/stats", getStats);
router.get("/logs", getAutomationLogs);
router.get("/", getAutomations);
router.post("/", createAutomation);
router.get("/:id", getAutomationById);
router.put("/:id", updateAutomation);
router.delete("/:id", deleteAutomation);
router.patch("/:id/toggle", toggleAutomation);

module.exports = router;
