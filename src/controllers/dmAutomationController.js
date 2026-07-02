const AutomationRule = require("../models/AutomationRule");
const DMConversation = require("../models/DMConversation");
const Lead = require("../models/Lead");
const AutomationLog = require("../models/AutomationLog");

// Get all automations
const getAutomations = async (req, res, next) => {
  try {
    const automations = await AutomationRule.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(automations);
  } catch (error) {
    next(error);
  }
};

// Create new automation
const createAutomation = async (req, res, next) => {
  try {
    const automation = await AutomationRule.create({ ...req.body, userId: req.user.id });
    res.status(201).json(automation);
  } catch (error) {
    next(error);
  }
};

// Get single automation
const getAutomationById = async (req, res, next) => {
  try {
    const automation = await AutomationRule.findOne({ _id: req.params.id, userId: req.user.id });
    if (!automation) return res.status(404).json({ message: "Automation not found" });
    res.json(automation);
  } catch (error) {
    next(error);
  }
};

// Update automation
const updateAutomation = async (req, res, next) => {
  try {
    const automation = await AutomationRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!automation) return res.status(404).json({ message: "Automation not found" });
    res.json(automation);
  } catch (error) {
    next(error);
  }
};

// Delete automation
const deleteAutomation = async (req, res, next) => {
  try {
    const automation = await AutomationRule.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!automation) return res.status(404).json({ message: "Automation not found" });
    res.json({ message: "Automation deleted" });
  } catch (error) {
    next(error);
  }
};

// Toggle active status
const toggleAutomation = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const automation = await AutomationRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isActive, active: isActive },
      { new: true }
    );
    if (!automation) return res.status(404).json({ message: "Automation not found" });
    res.json(automation);
  } catch (error) {
    next(error);
  }
};

// Get stats
const getStats = async (req, res, next) => {
  try {
    const totalAutomations = await AutomationRule.countDocuments({ userId: req.user.id });
    const activeRules = await AutomationRule.countDocuments({
      userId: req.user.id,
      $or: [{ active: true }, { isActive: true }]
    });
    const leadsCaptured = await Lead.countDocuments({ userId: req.user.id });
    
    // Sum dmSentCount from all rules
    const rules = await AutomationRule.find({ userId: req.user.id }).select('dmSentCount');
    const dmsSentToday = rules.reduce((acc, curr) => acc + (curr.dmSentCount || 0), 0);
    // In a real prod environment we might filter by today's date

    res.json({
      totalAutomations,
      activeRules,
      dmsSentToday,
      leadsCaptured
    });
  } catch (error) {
    next(error);
  }
};

// Get automation logs
const getAutomationLogs = async (req, res, next) => {
  try {
    const logs = await AutomationLog.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAutomations,
  createAutomation,
  getAutomationById,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
  getStats,
  getAutomationLogs,
};
