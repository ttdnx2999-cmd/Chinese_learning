/**
 * Script to test Google AI API and list available models
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

async function testGoogleAI() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  console.log('=== Google AI API Test ===\n');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT SET');
  
  if (!apiKey) {
    console.error('ERROR: GOOGLE_AI_API_KEY is not set in .env file');
    process.exit(1);
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    console.log('\nAttempting to list available models...\n');
    
    // Try to list models (this might not be supported by all API keys)
    try {
      // @ts-ignore - listModels might not be in types
      const models = await genAI.listModels();
      console.log('Available models:');
      console.log(models);
    } catch (error) {
      console.log('Could not list models (this is normal for some API keys)');
    }
    
    // Try different model names
    const modelsToTry = [
      'gemini-flash-lite-latest',
      'gemini-1.5-flash-lite',
      'gemini-1.5-flash-8b-latest',
      'gemini-2.0-flash-exp',
      'gemini-exp-1206',
      'gemini-2.0-flash-thinking-exp-1219',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-8b',
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'models/gemini-pro',
      'models/gemini-1.5-pro',
      'models/gemini-2.0-flash-exp',
      'models/gemini-1.5-flash-8b-latest',
    ];
    
    console.log('\n=== Testing Model Access ===\n');
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`Testing model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent('Say hello in Chinese');
        const response = await result.response;
        const text = response.text();
        
        console.log(`✓ SUCCESS with ${modelName}`);
        console.log(`  Response: ${text}\n`);
        
        // If we found a working model, we're done
        console.log(`\n=== SOLUTION ===`);
        console.log(`Use this model name in your code: "${modelName}"`);
        process.exit(0);
        
      } catch (error: any) {
        console.log(`✗ FAILED with ${modelName}`);
        console.log(`  Error: ${error.message}\n`);
      }
    }
    
    console.log('\n=== RESULT ===');
    console.log('None of the tested models worked with your API key.');
    console.log('\nPossible issues:');
    console.log('1. API key is not enabled for Gemini API');
    console.log('2. Gemini API is not available in your region');
    console.log('3. API key needs additional permissions');
    console.log('\nNext steps:');
    console.log('1. Go to https://aistudio.google.com/app/apikey');
    console.log('2. Check if your API key has "Generative Language API" enabled');
    console.log('3. Try creating a new API key');
    console.log('4. Check if Gemini is available in your country');
    
  } catch (error) {
    console.error('ERROR:', error);
  }
}

testGoogleAI();
