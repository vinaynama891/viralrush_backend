require('dotenv').config();
const GeminiViralService = require('./src/services/geminiViralService');

async function testRefinement() {
  try {
    console.log('Testing Hindi refinement...');
    const result = await GeminiViralService.refineVideoContent({
      title: 'Lose Weight Fast in 10 Days',
      description: 'This video explains how to lose weight in 10 days using simple home remedies and diet control.',
      platform: 'youtube',
      channelTitle: 'Fitness Coach',
      targetLanguage: 'hindi'
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

testRefinement();
