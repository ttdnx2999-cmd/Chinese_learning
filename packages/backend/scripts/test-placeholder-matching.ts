/**
 * Test script to verify placeholder matching logic
 * Run with: npx tsx scripts/test-placeholder-matching.ts
 */

// Helper function to check if a vocab word with placeholders matches the text
const matchesWithPlaceholder = (vocabWord: string, text: string): { matches: boolean; length: number; matchedText: string } => {
  if (!vocabWord.includes('。。。')) {
    // No placeholder, use exact match
    return { 
      matches: text.startsWith(vocabWord), 
      length: vocabWord.length,
      matchedText: text.startsWith(vocabWord) ? text.substring(0, vocabWord.length) : ''
    };
  }
  
  // Has placeholder - create a regex pattern
  // Example: "从。。。到。。。" becomes /^从[^，。；？！]+到[^，。；？！]+/
  // Match until punctuation to capture full phrases
  const escapedWord = vocabWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escapedWord.replace(/。。。/g, '[^，。；？！]+');
  
  const regex = new RegExp(`^${regexPattern}`);
  const match = text.match(regex);
  
  return { 
    matches: match !== null, 
    length: match ? match[0].length : 0,
    matchedText: match ? match[0] : ''
  };
};

// Test cases
const testCases = [
  {
    name: 'Basic placeholder pattern - 从商店到酒吧',
    sentence: '从商店到酒吧',
    vocabWords: ['从。。。到。。。', '商店', '酒吧', '店', '酒', '吧'],
    expected: ['从。。。到。。。', '商店', '酒吧']
  },
  {
    name: 'Placeholder with overlapping words - 从书店到商店',
    sentence: '从书店到商店',
    vocabWords: ['从。。。到。。。', '书店', '商店', '书', '店', '商'],
    expected: ['从。。。到。。。', '书店', '商店']
  },
  {
    name: 'Placeholder with single chars - 从这到那差不多',
    sentence: '从这到那差不多',
    vocabWords: ['从。。。到。。。', '这', '那', '差不多', '差', '不', '多'],
    expected: ['从。。。到。。。', '这', '那', '差不多']
  },
  {
    name: 'Different placeholder pattern - 太冷了',
    sentence: '太冷了',
    vocabWords: ['太。。。了', '冷', '太', '了'],
    expected: ['太。。。了', '太', '冷', '了']
  },
  {
    name: 'Placeholder at sentence end - 从店到书店',
    sentence: '从店到书店',
    vocabWords: ['从。。。到。。。', '书店', '店', '书'],
    expected: ['从。。。到。。。', '店', '书店']
  },
  {
    name: 'Regular words without placeholder',
    sentence: '我喜欢游泳',
    vocabWords: ['我', '喜欢', '游泳', '喜', '欢', '游', '泳'],
    expected: ['我', '喜欢', '游泳']
  },
  {
    name: 'Mixed placeholder and regular - 我从这到那',
    sentence: '我从这到那',
    vocabWords: ['从。。。到。。。', '我', '这', '那'],
    expected: ['我', '从。。。到。。。', '这', '那']
  }
];

console.log('===== Testing Placeholder Matching =====\n');

let passCount = 0;
let failCount = 0;

for (const testCase of testCases) {
  console.log('='.repeat(70));
  console.log(`Test: ${testCase.name}`);
  console.log(`Sentence: "${testCase.sentence}"`);
  console.log(`Vocab: [${testCase.vocabWords.join(', ')}]`);
  console.log(`Expected: [${testCase.expected.join(', ')}]`);
  console.log('');

  const sortedVocabWords = [...testCase.vocabWords].sort((a, b) => b.length - a.length);
  
  const usedCharacters: string[] = [];
  let remainingText = testCase.sentence;

  // Outer loop - match vocabulary words
  while (remainingText.length > 0) {
    let matched = false;
    
    for (const char of sortedVocabWords) {
      const matchResult = matchesWithPlaceholder(char, remainingText);
      
      if (matchResult.matches) {
        if (!usedCharacters.includes(char)) {
          usedCharacters.push(char);
        }
        
        // Inner loop - if placeholder match, extract words within it
        if (char.includes('。。。') && matchResult.matchedText) {
          let innerText = matchResult.matchedText;
          while (innerText.length > 0) {
            let innerMatched = false;
            for (const innerChar of sortedVocabWords) {
              // Skip placeholder words to avoid infinite loop
              if (innerChar.includes('。。。')) continue;
              
              if (innerText.startsWith(innerChar)) {
                if (!usedCharacters.includes(innerChar)) {
                  usedCharacters.push(innerChar);
                }
                innerText = innerText.slice(innerChar.length);
                innerMatched = true;
                break;
              }
            }
            if (!innerMatched) {
              innerText = innerText.slice(1);
            }
          }
        }
        
        remainingText = remainingText.slice(matchResult.length);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      remainingText = remainingText.slice(1);
    }
  }

  console.log(`Result: [${usedCharacters.join(', ')}]`);
  
  const missing = testCase.expected.filter(e => !usedCharacters.includes(e));
  const extra = usedCharacters.filter(u => !testCase.expected.includes(u));
  
  if (missing.length === 0 && extra.length === 0) {
    console.log('✓ PASS');
    passCount++;
  } else {
    console.log('✗ FAIL');
    if (missing.length > 0) {
      console.log(`  Missing: [${missing.join(', ')}]`);
    }
    if (extra.length > 0) {
      console.log(`  Extra: [${extra.join(', ')}]`);
    }
    failCount++;
  }
  console.log('');
}

console.log('='.repeat(70));
console.log(`\nTest Summary: ${passCount} passed, ${failCount} failed out of ${testCases.length} tests`);

if (failCount === 0) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log('✗ Some tests failed');
  process.exit(1);
}
