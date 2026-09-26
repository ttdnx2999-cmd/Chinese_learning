/**
 * Test script to verify exponential weighting for vocabulary selection
 * 
 * This script simulates the vocabulary selection algorithm to verify:
 * 1. All favorite words are always included
 * 2. Later chapters are exponentially weighted (more likely to be selected)
 * 3. The distribution follows exponential weighting pattern
 */

interface VocabItem {
  character: string;
  chapter: number;
  isFavorite: boolean;
}

function selectVocabularyWithExponentialWeighting(
  vocabItems: VocabItem[],
  targetCount: number = 300
): string[] {
  // Separate favorites and non-favorites
  const favorites = vocabItems
    .filter(v => v.isFavorite)
    .map(v => v.character);
  
  const nonFavorites = vocabItems
    .filter(v => !v.isFavorite)
    .map(v => ({ character: v.character, chapter: v.chapter }));

  const selectedCharacters: string[] = [];
  
  // Step 1: Always include ALL favorite words
  selectedCharacters.push(...favorites);
  
  // Step 2: Fill remaining slots with exponentially weighted selection
  const remainingSlots = targetCount - favorites.length;
  
  if (remainingSlots > 0 && nonFavorites.length > 0) {
    const maxChapter = Math.max(...nonFavorites.map(v => v.chapter));
    const minChapter = Math.min(...nonFavorites.map(v => v.chapter));
    
    // Create weighted array
    const weightedPool: string[] = [];
    
    for (const vocab of nonFavorites) {
      // Normalize chapter to [0, 1] range
      const normalizedChapter = maxChapter === minChapter 
        ? 1 
        : (vocab.chapter - minChapter) / (maxChapter - minChapter);
      
      // Exponential weight: e^(normalizedChapter)
      const exponentialWeight = Math.exp(normalizedChapter);
      
      // Linear weight: scale to match exponential range [1, e]
      const linearWeight = 1 + normalizedChapter * (Math.E - 1);
      
      // Blend 50% exponential + 50% linear for smoother distribution
      const weight = 0.5 * exponentialWeight + 0.5 * linearWeight;
      
      const copies = Math.max(1, Math.round(weight * 10));
      
      for (let j = 0; j < copies; j++) {
        weightedPool.push(vocab.character);
      }
    }
    
    // Randomly sample from weighted pool
    for (let j = 0; j < remainingSlots; j++) {
      const randomIndex = Math.floor(Math.random() * weightedPool.length);
      selectedCharacters.push(weightedPool[randomIndex]);
    }
  } else if (remainingSlots > 0 && nonFavorites.length === 0) {
    // Only favorites exist
    for (let j = 0; j < remainingSlots; j++) {
      const randomIndex = Math.floor(Math.random() * favorites.length);
      selectedCharacters.push(favorites[randomIndex]);
    }
  }

  return selectedCharacters;
}

// Test Case 1: Mixed chapters with favorites
console.log('=== Test Case 1: Mixed chapters with favorites ===');
const testVocab1: VocabItem[] = [
  // Chapter 1 (5 words, 2 favorites)
  { character: '我', chapter: 1, isFavorite: true },
  { character: '你', chapter: 1, isFavorite: true },
  { character: '他', chapter: 1, isFavorite: false },
  { character: '她', chapter: 1, isFavorite: false },
  { character: '它', chapter: 1, isFavorite: false },
  
  // Chapter 5 (5 words, 1 favorite)
  { character: '学校', chapter: 5, isFavorite: true },
  { character: '老师', chapter: 5, isFavorite: false },
  { character: '学生', chapter: 5, isFavorite: false },
  { character: '教室', chapter: 5, isFavorite: false },
  { character: '书', chapter: 5, isFavorite: false },
  
  // Chapter 10 (5 words, 0 favorites)
  { character: '电脑', chapter: 10, isFavorite: false },
  { character: '手机', chapter: 10, isFavorite: false },
  { character: '网络', chapter: 10, isFavorite: false },
  { character: '软件', chapter: 10, isFavorite: false },
  { character: '程序', chapter: 10, isFavorite: false },
];

const selected1 = selectVocabularyWithExponentialWeighting(testVocab1, 100);

// Count occurrences by chapter
const chapterCounts1: Record<number, number> = {};
const favoriteCounts1: Record<string, number> = {};

for (const char of selected1) {
  const vocab = testVocab1.find(v => v.character === char);
  if (vocab) {
    chapterCounts1[vocab.chapter] = (chapterCounts1[vocab.chapter] || 0) + 1;
    if (vocab.isFavorite) {
      favoriteCounts1[char] = (favoriteCounts1[char] || 0) + 1;
    }
  }
}

console.log('Total selected:', selected1.length);
console.log('Chapter distribution:', chapterCounts1);
console.log('Favorite occurrences:', favoriteCounts1);
console.log('All favorites included:', 
  testVocab1.filter(v => v.isFavorite).every(v => selected1.includes(v.character)) ? '✓' : '✗'
);

// Calculate percentage by chapter
const total1 = Object.values(chapterCounts1).reduce((a, b) => a + b, 0);
console.log('Chapter percentages:');
for (const [chapter, count] of Object.entries(chapterCounts1)) {
  console.log(`  Chapter ${chapter}: ${((count / total1) * 100).toFixed(1)}%`);
}

// Test Case 2: Large vocabulary set (simulating real usage)
console.log('\n=== Test Case 2: Large vocabulary set (chapters 1-20) ===');
const testVocab2: VocabItem[] = [];

// Generate 10 words per chapter, with 20% favorites in early chapters, 10% in later
for (let chapter = 1; chapter <= 20; chapter++) {
  const favoriteRate = chapter <= 10 ? 0.2 : 0.1;
  
  for (let i = 0; i < 10; i++) {
    testVocab2.push({
      character: `词${chapter}_${i}`,
      chapter,
      isFavorite: Math.random() < favoriteRate
    });
  }
}

const selected2 = selectVocabularyWithExponentialWeighting(testVocab2, 300);

// Count by chapter ranges
const earlyChapters = selected2.filter(char => {
  const vocab = testVocab2.find(v => v.character === char);
  return vocab && vocab.chapter <= 7;
}).length;

const midChapters = selected2.filter(char => {
  const vocab = testVocab2.find(v => v.character === char);
  return vocab && vocab.chapter > 7 && vocab.chapter <= 14;
}).length;

const lateChapters = selected2.filter(char => {
  const vocab = testVocab2.find(v => v.character === char);
  return vocab && vocab.chapter > 14;
}).length;

const totalFavorites = testVocab2.filter(v => v.isFavorite).length;
const favoritesIncluded = testVocab2.filter(v => v.isFavorite && selected2.includes(v.character)).length;

console.log('Total vocabulary:', testVocab2.length);
console.log('Total favorites:', totalFavorites);
console.log('Favorites included:', favoritesIncluded, '/', totalFavorites);
console.log('All favorites included:', favoritesIncluded === totalFavorites ? '✓' : '✗');
console.log('\nChapter range distribution:');
console.log(`  Chapters 1-7 (early): ${earlyChapters} (${((earlyChapters / 300) * 100).toFixed(1)}%)`);
console.log(`  Chapters 8-14 (mid): ${midChapters} (${((midChapters / 300) * 100).toFixed(1)}%)`);
console.log(`  Chapters 15-20 (late): ${lateChapters} (${((lateChapters / 300) * 100).toFixed(1)}%)`);

// Test Case 3: Edge case - all favorites
console.log('\n=== Test Case 3: Edge case - all favorites ===');
const testVocab3: VocabItem[] = [
  { character: '我', chapter: 1, isFavorite: true },
  { character: '你', chapter: 2, isFavorite: true },
  { character: '他', chapter: 3, isFavorite: true },
];

const selected3 = selectVocabularyWithExponentialWeighting(testVocab3, 10);
console.log('Total selected:', selected3.length);
console.log('All favorites included:', 
  testVocab3.every(v => selected3.includes(v.character)) ? '✓' : '✗'
);

// Test Case 4: Edge case - no favorites
console.log('\n=== Test Case 4: Edge case - no favorites ===');
const testVocab4: VocabItem[] = [
  { character: '早', chapter: 1, isFavorite: false },
  { character: '中', chapter: 5, isFavorite: false },
  { character: '晚', chapter: 10, isFavorite: false },
];

const selected4 = selectVocabularyWithExponentialWeighting(testVocab4, 30);
const chapterCounts4: Record<number, number> = {};

for (const char of selected4) {
  const vocab = testVocab4.find(v => v.character === char);
  if (vocab) {
    chapterCounts4[vocab.chapter] = (chapterCounts4[vocab.chapter] || 0) + 1;
  }
}

console.log('Total selected:', selected4.length);
console.log('Chapter distribution:', chapterCounts4);
console.log('Chapter 10 has most selections:', 
  chapterCounts4[10] > chapterCounts4[5] && chapterCounts4[10] > chapterCounts4[1] ? '✓' : '✗'
);

console.log('\n=== All tests completed ===');
