import dotenv from 'dotenv';
import path from 'path';
import { AITextGenerator } from '../src/services/AITextGenerator';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testPrompt() {
  const generator = new AITextGenerator();
  
  // Test with a sample set of characters
  const testCharacters = [
    '我', '是', '学生', '他', '很', '好', '今天', '天气', '去', '学校',
    '老师', '朋友', '喜欢', '看', '书', '这', '那', '什么', '吗', '呢',
    '在', '有', '没有', '来', '不', '也', '都', '的', '了', '吧'
  ];
  
  console.log('=== Testing AI Text Generation ===');
  console.log('Test characters:', testCharacters.length);
  console.log('');
  
  for (let i = 1; i <= 10; i++) {
    console.log(`\n--- Test ${i} ---`);
    try {
      const result = await generator.generateText(testCharacters, 40);
      console.log('Generated text:', result.chineseText);
      console.log('Pinyin:', result.pinyin);
      console.log('Word count:', result.wordCount);
      console.log('Used characters:', result.usedCharacters.join(', '));
      
      // Quality check
      const issues = [];
      if (result.chineseText.includes('我是学校')) issues.push('Unnatural: 我是学校');
      if (result.chineseText.includes('喜欢那书')) issues.push('Unnatural: 喜欢那书 (should be 喜欢那本书 or 喜欢书)');
      if (result.wordCount < 10) issues.push('Too short');
      if (result.wordCount > 40) issues.push('Too long');
      
      if (issues.length > 0) {
        console.log('⚠️  Issues:', issues.join(', '));
      } else {
        console.log('✅ Quality: Good');
      }
      console.log('');
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

testPrompt();
