const CalendarItem = require("../models/CalendarItem");
const User = require("../models/User");
const { sendPlanReminderEmail } = require("../utils/mailer");

/**
 * Background scheduler polling worker to deliver 24-hour and 2-hour warnings
 * for scheduled content planner posts.
 */
const runCalendarEmailReminderScheduler = async () => {
  try {
    const now = Date.now();

    // Query for calendar plans that are scheduled in the future
    const upcomingPlans = await CalendarItem.find({
      scheduledAt: { $gt: new Date() }
    });

    if (upcomingPlans.length === 0) return;

    for (const plan of upcomingPlans) {
      const diffMs = plan.scheduledAt.getTime() - now;
      const hoursLeft = diffMs / (1000 * 60 * 60);

      // Ensure 'immediate' is marked as sent (since it is dispatched on creation)
      if (!plan.remindersSent.includes("immediate")) {
        plan.remindersSent.push("immediate");
        await plan.save();
      }

      // Stage 2: 24-Hour Reminder Alert
      if (hoursLeft <= 24 && !plan.remindersSent.includes("24h")) {
        const u = await User.findById(plan.userId).select("email");
        if (u?.email) {
          console.log(`[Reminder Scheduler] Sending 24h reminder for plan "${plan.title}" to ${u.email}`);
          await sendPlanReminderEmail(u.email, plan, "24h");
        }
        plan.remindersSent.push("24h");
        await plan.save();
      }

      // Stage 3: 2-Hour Final Warning Alert
      if (hoursLeft <= 2 && !plan.remindersSent.includes("2h")) {
        const u = await User.findById(plan.userId).select("email");
        if (u?.email) {
          console.log(`[Reminder Scheduler] Sending 2h final warning for plan "${plan.title}" to ${u.email}`);
          await sendPlanReminderEmail(u.email, plan, "2h");
        }
        plan.remindersSent.push("2h");
        await plan.save();
      }
    }
  } catch (err) {
    console.error("[Reminder Scheduler] Polling run failed:", err.message);
  }
};

module.exports = { runCalendarEmailReminderScheduler };
