import dotenv from 'dotenv';
import path from 'path';
import { TranslationService } from '../src/services/TranslationService';

// Load environment variables from the correct path
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testGoogleTranslate() {
  console.log('=== Testing Google Translate API ===\n');
  console.log(`API Key present: ${process.env.GOOGLE_TRANSLATE_API_KEY ? 'Yes' : 'No'}\n`);

  // Create a new instance after env is loaded
  const translationService = new TranslationService();

  const testChinese = '你好';
  
  try {
    console.log(`Testing Chinese text: ${testChinese}\n`);

    // Test Vietnamese translation
    console.log('1. Testing Vietnamese translation...');
    const vietnamese = await translationService.translateToVietnamese(testChinese);
    console.log(`   Result: ${vietnamese}\n`);

    // Test English translation
    console.log('2. Testing English translation...');
    const english = await translationService.translateToEnglish(testChinese);
    console.log(`   Result: ${english}\n`);

    // Test batch translation
    console.log('3. Testing batch translation...');
    const batchTexts = ['你好', '谢谢', '再见'];
    console.log(`   Input: ${batchTexts.join(', ')}`);
    const batchResults = await translationService.batchTranslate(batchTexts, 'en');
    console.log(`   Results: ${batchResults.join(', ')}\n`);

    console.log('✓ All tests completed successfully!');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

testGoogleTranslate();
