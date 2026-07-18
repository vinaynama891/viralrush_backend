const { URL } = require("url");

function validateInstagramUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") {
    return false;
  }

  try {
    const parsed = new URL(urlStr.trim());

    // Protocol check
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    
    // Check if domain is instagram.com
    const isInstagram = host === "instagram.com" || host === "www.instagram.com";
    if (!isInstagram) {
      return false;
    }

    // Check if path contains reel or p
    const path = parsed.pathname;
    const isValidPath = path.startsWith("/reel/") || path.startsWith("/p/");
    if (!isValidPath) {
      return false;
    }

    // Block private IPs / localhost
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.") ||
      host.startsWith("172.17.") ||
      host.startsWith("172.18.") ||
      host.startsWith("172.19.") ||
      host.startsWith("172.20.") ||
      host.startsWith("172.21.") ||
      host.startsWith("172.22.") ||
      host.startsWith("172.23.") ||
      host.startsWith("172.24.") ||
      host.startsWith("172.25.") ||
      host.startsWith("172.26.") ||
      host.startsWith("172.27.") ||
      host.startsWith("172.28.") ||
      host.startsWith("172.29.") ||
      host.startsWith("172.30.") ||
      host.startsWith("172.31.")
    ) {
      return false;
    }

    return parsed.toString();
  } catch (err) {
    return false;
  }
}

module.exports = validateInstagramUrl;
