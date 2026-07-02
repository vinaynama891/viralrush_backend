const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey });

async function test() {
  const models = ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.0-flash-lite"];
  for (const m of models) {
    try {
      console.log(`Testing model: ${m}...`);
      const response = await genAI.models.generateContent({
        model: m,
        contents: "Hello, say 'API is working' if you receive this."
      });
      console.log(`Success with ${m}! Response:`, response.text);
      return;
    } catch (err) {
      console.error(`Failed with ${m}:`, err.message);
    }
  }
}

test();
