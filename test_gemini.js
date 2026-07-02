require('dotenv').config();

// Test with the AQ. key format using newer SDK approach
async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  const { GoogleGenAI } = require('@google/genai');
  
  console.log('=== GEMINI LIVE TEST ===');
  console.log('Key (first 25):', key?.substring(0, 25));
  console.log('');

  const g = new GoogleGenAI({ apiKey: key });

  const modelsToTry = [
    'gemini-2.0-flash',
    'gemini-1.5-flash', 
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`Trying model: ${model} ...`);
      const result = await g.models.generateContent({
        model,
        contents: 'Reply with exactly: WORKING'
      });
      console.log(`✅ SUCCESS with ${model}!`);
      console.log('Response:', result.text?.trim());
      process.exit(0);
    } catch (e) {
      const msg = e.message || '';
      // Extract just the key part of the error
      let reason = 'Unknown';
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) reason = '❌ QUOTA EXHAUSTED (free tier limit hit)';
      else if (msg.includes('API_KEY_INVALID') || msg.includes('invalid')) reason = '❌ INVALID API KEY';
      else if (msg.includes('not found') || msg.includes('404')) reason = '❌ MODEL NOT FOUND';
      else if (msg.includes('credentials') || msg.includes('authentication')) reason = '❌ AUTH ERROR - Wrong key type';
      else reason = '❌ ' + msg.substring(0, 100);
      console.log(`   ${model}: ${reason}`);
    }
  }

  console.log('');
  console.log('=== ALL MODELS FAILED ===');
  console.log('');
  console.log('SOLUTION:');
  console.log('1. Go to: https://makersuite.google.com/app/apikey  (older URL, gives AIza keys)');
  console.log('   OR: https://aistudio.google.com/apikey');
  console.log('2. Create key -> Click the KEY VALUE itself (not Copy key button)');
  console.log('3. The key shown should start with "AIza"');
  console.log('4. If you only see AQ. keys, enable billing on that project');
}

testGemini();
