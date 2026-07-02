const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";

// Derive a 32-byte key from JWT_SECRET or fallback
const getSecretKey = () => {
  const secret = process.env.JWT_SECRET || "viralrush_default_secret_key_for_instagram_tokens";
  return crypto.createHash("sha256").update(secret).digest();
};

/**
 * Encrypt a text string
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted string in the format iv:encryptedData
 */
const encrypt = (text) => {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};

/**
 * Decrypt an encrypted text string
 * @param {string} encryptedText - Encrypted text in the format iv:encryptedData
 * @returns {string} Decrypted original text
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return "";
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) return "";
    const iv = Buffer.from(parts.shift(), "hex");
    const encrypted = parts.join(":");
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return "";
  }
};

module.exports = {
  encrypt,
  decrypt,
};
