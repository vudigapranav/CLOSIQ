import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.log('Real API verification blocked because GEMINI_API_KEY is not configured.');
  process.exit(0);
}

console.log('Testing Real Gemini API Integration...');
const ai = new GoogleGenAI({ apiKey });

async function runTests() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'Say hello in 3 words for CLOSIQ AI Stylist.'
    });
    console.log('Gemini API Connection Test Successful:', response.text?.trim());
  } catch (err) {
    console.error('Gemini API Test Failed:', err.message);
  }
}

runTests();
