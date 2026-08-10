const nodemailer = require("nodemailer");
const axios = require("axios");

// ── 1. Primary Transporter: Gmail SMTP (Sends Directly to Primary Inbox) ──
const getGmailTransporter = () => {
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "vinaynama20@gmail.com").trim();
  const rawPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "kenetjkkkqcktqfv").trim();
  const pass = rawPass.replace(/\s+/g, "");

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 7000,
    tls: { rejectUnauthorized: false },
  });
};

// ── 2. Secondary Transporter: Brevo API Fallback ──
const sendViaBrevo = async (to, subject, text, html) => {
  let apiKey = (process.env.BREVO_API_KEY || "").trim();
  if (!apiKey) return false;
  if (!apiKey.startsWith("xkeysib-") && !apiKey.startsWith("xsmtpsib-")) {
    apiKey = "xkeysib-" + apiKey;
  }

  const senderEmail = (process.env.SENDER_EMAIL || process.env.SMTP_USER || "vinaynama20@gmail.com").trim();

  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: "VIRALRUSH", email: senderEmail },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text,
      },
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 7000,
      }
    );
    console.log(`[BREVO API FALLBACK] Email delivered to ${to}`);
    return true;
  } catch (err) {
    console.error("[BREVO API FALLBACK ERROR]:", err?.response?.data || err.message);
    return false;
  }
};

const sendOTP = async (email, otp, type = "verification") => {
  const subject = type === "login" ? "VIRALRUSH - Login OTP Verification" : "VIRALRUSH - Account Verification OTP";
  const messageText = `Your VIRALRUSH ${type} OTP is: ${otp}. It is valid for 10 minutes.`;
  
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; background-color: #0d0d14; color: #ffffff; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div style="font-size: 32px; font-weight: 900; margin-bottom: 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">VIRALRUSH</div>
      <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">${type === "login" ? "Verify Your Login" : "Verify Your Account"}</h2>
      <p style="color: #9ca3af; font-size: 14px; margin-bottom: 24px;">Use the following One-Time Password (OTP) to complete your ${type}. This OTP is valid for 10 minutes.</p>
      <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #a78bfa; background: rgba(99,102,241,0.1); padding: 16px 24px; border-radius: 12px; border: 1px dashed rgba(99,102,241,0.3); display: inline-block; margin-bottom: 24px;">${otp}</div>
      <div style="font-size: 11px; color: #6b7280; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">If you did not request this, please ignore this email.</div>
    </div>
  `;

  // 1. Try Gmail SMTP first (Lands 100% in Primary Inbox)
  const gmailTransporter = getGmailTransporter();
  if (gmailTransporter) {
    try {
      const fromUser = process.env.SMTP_USER || "vinaynama20@gmail.com";
      const sendPromise = gmailTransporter.sendMail({
        from: `"VIRALRUSH" <${fromUser}>`,
        to: email,
        subject: subject,
        text: messageText,
        html: htmlContent,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gmail SMTP timed out (5s limit)")), 5000)
      );

      await Promise.race([sendPromise, timeoutPromise]);
      console.log(`[GMAIL SMTP SUCCESS] OTP delivered to ${email}`);
      return true;
    } catch (err) {
      console.error("[GMAIL SMTP ERROR]:", err.message);
    }
  }

  // 2. Try Brevo HTTP API fallback
  const sentBrevo = await sendViaBrevo(email, subject, messageText, htmlContent);
  if (sentBrevo) return true;

  // 3. Console Fallback
  console.log("\n==================================================");
  console.log("             📬 VIRALRUSH MAIL FALLBACK            ");
  console.log(`  To:      ${email}`);
  console.log(`  Type:    ${type.toUpperCase()}`);
  console.log(`  OTP:     ${otp}`);
  console.log("==================================================\n");
  return false;
};

const sendPlanReminderEmail = async (email, plan, stage = "immediate") => {
  let subject = `📅 VIRALRUSH PLANNER - Scheduled: "${plan.title}"`;
  let headline = "📅 New Content Plan Scheduled!";
  let subheader = "We've added this plan to your Content Calendar. Make sure your media is uploaded and triggers are configured in the DM Automation dashboard!";

  if (stage === "24h") {
    subject = `⏰ 24 HOUR REMINDER - Plan: "${plan.title}"`;
    headline = "⏰ 24 Hours Left to Post!";
    subheader = "Your scheduled post goes live in exactly 24 hours. Double-check your captions, tags, and media container assets before publishing!";
  } else if (stage === "2h") {
    subject = `🔥 FINAL WARNING - Plan: "${plan.title}"`;
    headline = "🔥 Post Going Live in 2 Hours!";
    subheader = "Get ready! Your scheduled post goes live in exactly 2 hours. Ensure your notifications are active so you can engage with early viewers!";
  }

  const formatDateStr = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; background-color: #0d0d14; color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div style="font-size: 28px; font-weight: 900; margin-bottom: 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center;">VIRALRUSH</div>
      <h2 style="font-size: 18px; font-weight: 700; color: #ffffff; text-align: center; margin-bottom: 20px;">${headline}</h2>
      
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 18px; margin-bottom: 24px;">
        <div style="margin-bottom: 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Plan Title</span>
          <span style="font-size: 15px; font-weight: 800; color: #ffffff;">${plan.title}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0; width: 50%;">
                <span style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Platform</span>
                <span style="font-size: 13px; font-weight: 700; color: #a78bfa;">${plan.platform}</span>
              </td>
              <td style="padding: 0; width: 50%;">
                <span style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Type</span>
                <span style="font-size: 13px; font-weight: 700; color: #c084fc;">${plan.contentType || "Post"}</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Scheduled Date</span>
          <span style="font-size: 13px; font-weight: 700; color: #22d3ee;">${formatDateStr(plan.scheduledAt)}</span>
        </div>
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 2px;">Status</span>
          <span style="display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 100px; background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); text-transform: uppercase;">${plan.status || "Pending"}</span>
        </div>
      </div>
      
      <p style="color: #9ca3af; font-size: 13px; text-align: center; line-height: 1.5; margin-bottom: 20px;">
        ${subheader}
      </p>
      
      <div style="font-size: 10px; color: #4b5563; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; text-align: center;">
        Sent automatically by VIRALRUSH Content Planner.
      </div>
    </div>
  `;

  const gmailTransporter = getGmailTransporter();
  if (gmailTransporter) {
    try {
      await gmailTransporter.sendMail({
        from: `"VIRALRUSH" <${process.env.SMTP_USER || "vinaynama20@gmail.com"}>`,
        to: email,
        subject: subject,
        text: `${headline}: "${plan.title}" scheduled for ${formatDateStr(plan.scheduledAt)}.`,
        html: htmlContent,
      });
      return true;
    } catch (err) {
      console.error(`[MAILER] Error sending plan reminder email (${stage}):`, err.message);
    }
  }
  return false;
};

module.exports = { sendOTP, sendPlanReminderEmail };
