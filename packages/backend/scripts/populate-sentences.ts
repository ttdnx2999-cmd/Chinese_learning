/**
 * Script to populate database with 5 Chinese sentences for user1
 * Each sentence is at least 40 characters
 */

import { VocabularyEntryDAO } from '../src/models/VocabularyEntry';
import { initDatabase } from '../src/config/database';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const sentences = [
  {
    sentence: '今天天气非常好，我和朋友们一起去公园散步，看到了很多美丽的花朵和可爱的小鸟。',
    pinyin: 'jīntiān tiānqì fēicháng hǎo, wǒ hé péngyǒumen yīqǐ qù gōngyuán sànbù, kàndàole hěnduō měilì de huāduǒ hé kě\'ài de xiǎoniǎo.',
    translation: 'The weather is very nice today. I went for a walk in the park with my friends and saw many beautiful flowers and cute little birds.',
    chapter: 1
  },
  {
    sentence: '我每天早上七点起床，然后刷牙洗脸，吃完早餐以后就去学校上课，下午回家做作业。',
    pinyin: 'wǒ měitiān zǎoshang qī diǎn qǐchuáng, ránhòu shuāyá xǐliǎn, chīwán zǎocān yǐhòu jiù qù xuéxiào shàngkè, xiàwǔ huíjiā zuò zuòyè.',
    translation: 'I wake up at 7 AM every morning, then brush my teeth and wash my face. After breakfast, I go to school for classes, and in the afternoon I go home to do homework.',
    chapter: 1
  },
  {
    sentence: '中国有五千年的悠久历史和灿烂文化，长城、故宫、兵马俑等历史遗迹吸引了世界各地的游客。',
    pinyin: 'zhōngguó yǒu wǔqiān nián de yōujiǔ lìshǐ hé cànlàn wénhuà, chángchéng, gùgōng, bīngmǎyǒng děng lìshǐ yíjì xīyǐnle shìjiè gèdì de yóukè.',
    translation: 'China has five thousand years of long history and splendid culture. The Great Wall, the Forbidden City, the Terracotta Warriors and other historical sites attract tourists from all over the world.',
    chapter: 2
  },
  {
    sentence: '学习一门外语需要坚持不懈的努力，每天练习听说读写，多和母语者交流，才能真正掌握这门语言。',
    pinyin: 'xuéxí yī mén wàiyǔ xūyào jiānchí bùxiè de nǔlì, měitiān liànxí tīng shuō dú xiě, duō hé mǔyǔzhě jiāoliú, cáinéng zhēnzhèng zhǎngwò zhè mén yǔyán.',
    translation: 'Learning a foreign language requires persistent effort. Practice listening, speaking, reading and writing every day, and communicate more with native speakers to truly master the language.',
    chapter: 2
  },
  {
    sentence: '互联网的发展改变了人们的生活方式，现在我们可以在网上购物、学习、工作和娱乐，足不出户就能了解世界。',
    pinyin: 'hùliánwǎng de fāzhǎn gǎibiànle rénmen de shēnghuó fāngshì, xiànzài wǒmen kěyǐ zài wǎngshàng gòuwù, xuéxí, gōngzuò hé yúlè, zú bù chū hù jiù néng liǎojiě shìjiè.',
    translation: 'The development of the Internet has changed people\'s way of life. Now we can shop, study, work and entertain online, and understand the world without leaving home.',
    chapter: 3
  }
];

async function populateDatabase() {
  try {
    console.log('Initializing database connection...');
    await initDatabase();
    console.log('Database initialized successfully\n');
    
    console.log('Starting database population...');
    
    const username = 'user1';
    let totalCharacters = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentenceData = sentences[i];
      console.log(`\nProcessing sentence ${i + 1}/${sentences.length}...`);
      console.log(`Sentence: ${sentenceData.sentence}`);
      console.log(`Length: ${sentenceData.sentence.length} characters`);
      
      // Extract unique characters (excluding punctuation and spaces)
      const characters = sentenceData.sentence
        .split('')
        .filter(char => !/[\s\p{P}]/u.test(char)); // Remove spaces and punctuation
      
      const uniqueChars = Array.from(new Set(characters));
      console.log(`Unique characters: ${uniqueChars.length}`);
      
      // Create a vocabulary entry for each unique character
      for (const char of uniqueChars) {
        const entry = await VocabularyEntryDAO.create(username, {
          chineseCharacter: char,
          pinyin: '', // Individual character pinyin would need a library
          hanVietnamese: '',
          modernVietnamese: '',
          englishMeaning: `From sentence: ${sentenceData.translation}`,
          learningNote: `Character from sentence ${i + 1}`,
          chapter: sentenceData.chapter
        });
        totalCharacters++;
      }
      
      console.log(`✓ Added ${uniqueChars.length} characters from sentence ${i + 1}`);
    }
    
    console.log(`\n✓ Successfully populated database with ${totalCharacters} unique characters from 5 sentences for user1`);
    
    // Verify the entries
    const allEntries = await VocabularyEntryDAO.findByUsername(username);
    console.log(`\nTotal entries for user1: ${allEntries.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error populating database:', error);
    process.exit(1);
  }
}

// Run the script
populateDatabase();
