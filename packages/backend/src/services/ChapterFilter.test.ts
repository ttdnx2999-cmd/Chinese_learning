/**
 * ChapterFilter Service Tests
 */

import { ChapterFilter, ChapterRange } from './ChapterFilter';
import { VocabularyEntryDAO, VocabularyInput } from '../models/VocabularyEntry';
import { initDatabase, closeDatabase, getPool } from '../config/database';

describe('ChapterFilter', () => {
  const testUsername = 'test-chapter-filter-user';
  const testUsername2 = 'test-chapter-filter-user-2';
  let testEntryIds: string[] = [];

  beforeAll(async () => {
    try {
      await initDatabase();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data
      const pool = getPool();
      await pool.query('DELETE FROM vocabulary_entries WHERE username IN (?, ?)', [testUsername, testUsername2]);
      await closeDatabase();
    } catch (error) {
      console.error('Failed to clean up:', error);
    }
  });

  beforeEach(async () => {
    try {
      // Clean up before each test
      const pool = getPool();
      await pool.query('DELETE FROM vocabulary_entries WHERE username IN (?, ?)', [testUsername, testUsername2]);
      testEntryIds = [];

      // Create test vocabulary entries across multiple chapters
      const testEntries: VocabularyInput[] = [
        { chineseCharacter: '你', pinyin: 'nǐ', chapter: 1, englishMeaning: 'you' },
        { chineseCharacter: '好', pinyin: 'hǎo', chapter: 1, englishMeaning: 'good' },
        { chineseCharacter: '我', pinyin: 'wǒ', chapter: 2, englishMeaning: 'I/me' },
        { chineseCharacter: '是', pinyin: 'shì', chapter: 2, englishMeaning: 'to be' },
        { chineseCharacter: '学', pinyin: 'xué', chapter: 3, englishMeaning: 'to study' },
        { chineseCharacter: '生', pinyin: 'shēng', chapter: 3, englishMeaning: 'student' },
        { chineseCharacter: '中', pinyin: 'zhōng', chapter: 5, englishMeaning: 'middle' },
        { chineseCharacter: '国', pinyin: 'guó', chapter: 5, englishMeaning: 'country' },
      ];

      for (const entry of testEntries) {
        const created = await VocabularyEntryDAO.create(testUsername, entry);
        testEntryIds.push(created.id);
        // Small delay to ensure distinct timestamps (MySQL has second precision)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Failed to set up test data:', error);
      throw error;
    }
  });

  describe('getVocabularyInRange', () => {
    it('should return vocabulary IDs within single chapter', async () => {
      const range: ChapterRange = { start: 1, end: 1 };
      const ids = await ChapterFilter.getVocabularyInRange(testUsername, range);

      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining([testEntryIds[0], testEntryIds[1]]));
    });

    it('should return vocabulary IDs within multiple chapters', async () => {
      const range: ChapterRange = { start: 1, end: 3 };
      const ids = await ChapterFilter.getVocabularyInRange(testUsername, range);

      expect(ids).toHaveLength(6);
      expect(ids).toEqual(expect.arrayContaining(testEntryIds.slice(0, 6)));
    });

    it('should return empty array for chapter range with no vocabulary', async () => {
      const range: ChapterRange = { start: 10, end: 15 };
      const ids = await ChapterFilter.getVocabularyInRange(testUsername, range);

      expect(ids).toHaveLength(0);
    });

    it('should return vocabulary IDs in order by chapter and creation time', async () => {
      const range: ChapterRange = { start: 1, end: 5 };
      const ids = await ChapterFilter.getVocabularyInRange(testUsername, range);

      // Should be ordered by chapter (1, 1, 2, 2, 3, 3, 5, 5)
      expect(ids).toHaveLength(8);
      
      // Verify all expected IDs are present
      expect(ids).toEqual(expect.arrayContaining(testEntryIds));
      
      // Verify ordering by chapter (first 2 should be chapter 1, next 2 chapter 2, etc.)
      // We can't rely on exact ID order due to timestamp precision, but we can verify chapter grouping
      const entries = await Promise.all(ids.map(id => VocabularyEntryDAO.findById(testUsername, id)));
      const chapters = entries.map(e => e?.chapter);
      
      // Chapters should be in ascending order
      for (let i = 1; i < chapters.length; i++) {
        expect(chapters[i]!).toBeGreaterThanOrEqual(chapters[i-1]!);
      }
    });

    it('should isolate vocabulary by username', async () => {
      // Create entry for different user
      await VocabularyEntryDAO.create(testUsername2, {
        chineseCharacter: '人',
        pinyin: 'rén',
        chapter: 1,
        englishMeaning: 'person'
      });

      const range: ChapterRange = { start: 1, end: 1 };
      const ids = await ChapterFilter.getVocabularyInRange(testUsername, range);

      // Should only return entries for testUsername
      expect(ids).toHaveLength(2);
    });
  });

  describe('getRandomCharacters', () => {
    it('should return random characters within chapter range', async () => {
      const range: ChapterRange = { start: 1, end: 3 };
      const characters = await ChapterFilter.getRandomCharacters(testUsername, range, 4);

      expect(characters).toHaveLength(4);
      // All characters should be from chapters 1-3
      const expectedChars = ['你', '好', '我', '是', '学', '生'];
      characters.forEach(char => {
        expect(expectedChars).toContain(char);
      });
    });

    it('should limit characters to requested count', async () => {
      const range: ChapterRange = { start: 1, end: 5 };
      const characters = await ChapterFilter.getRandomCharacters(testUsername, range, 3);

      expect(characters).toHaveLength(3);
    });

    it('should limit characters to 300 maximum', async () => {
      const range: ChapterRange = { start: 1, end: 5 };
      const characters = await ChapterFilter.getRandomCharacters(testUsername, range, 500);

      // Should return all available (8) but respect the 300 limit in implementation
      expect(characters.length).toBeLessThanOrEqual(300);
    });

    it('should return empty array for chapter range with no vocabulary', async () => {
      const range: ChapterRange = { start: 10, end: 15 };
      const characters = await ChapterFilter.getRandomCharacters(testUsername, range, 10);

      expect(characters).toHaveLength(0);
    });

    it('should return fewer characters if count exceeds available vocabulary', async () => {
      const range: ChapterRange = { start: 1, end: 1 };
      const characters = await ChapterFilter.getRandomCharacters(testUsername, range, 10);

      // Only 2 characters in chapter 1
      expect(characters).toHaveLength(2);
    });

    it('should isolate characters by username', async () => {
      // Create entry for different user
      await VocabularyEntryDAO.create(testUsername2, {
        chineseCharacter: '人',
        pinyin: 'rén',
        chapter: 1,
        englishMeaning: 'person'
      });

      const range: ChapterRange = { start: 1, end: 1 };
      const characters = await ChapterFilter.getRandomCharacters(testUsername, range, 10);

      // Should only return characters for testUsername
      expect(characters).toHaveLength(2);
      expect(characters).not.toContain('人');
    });
  });

  describe('validateRange', () => {
    it('should return true for valid range with vocabulary', async () => {
      const range: ChapterRange = { start: 1, end: 3 };
      const isValid = await ChapterFilter.validateRange(testUsername, range);

      expect(isValid).toBe(true);
    });

    it('should return false for range with no vocabulary', async () => {
      const range: ChapterRange = { start: 10, end: 15 };
      const isValid = await ChapterFilter.validateRange(testUsername, range);

      expect(isValid).toBe(false);
    });

    it('should return false for negative start chapter', async () => {
      const range: ChapterRange = { start: -1, end: 3 };
      const isValid = await ChapterFilter.validateRange(testUsername, range);

      expect(isValid).toBe(false);
    });

    it('should return false for negative end chapter', async () => {
      const range: ChapterRange = { start: 1, end: -1 };
      const isValid = await ChapterFilter.validateRange(testUsername, range);

      expect(isValid).toBe(false);
    });

    it('should return false when start is greater than end', async () => {
      const range: ChapterRange = { start: 5, end: 1 };
      const isValid = await ChapterFilter.validateRange(testUsername, range);

      expect(isValid).toBe(false);
    });

    it('should return true for single chapter range', async () => {
      const range: ChapterRange = { start: 1, end: 1 };
      const isValid = await ChapterFilter.validateRange(testUsername, range);

      expect(isValid).toBe(true);
    });

    it('should return true for chapter 0 if vocabulary exists', async () => {
      // Create entry in chapter 0
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '零',
        pinyin: 'líng',
        chapter: 0,
        englishMeaning: 'zero'
      });

      const range: ChapterRange = { start: 0, end: 0 };
      const isValid = await ChapterFilter.validateRange(testUsername, range);

      expect(isValid).toBe(true);
    });

    it('should isolate validation by username', async () => {
      // testUsername2 has no vocabulary in chapter 1
      const range: ChapterRange = { start: 1, end: 1 };
      const isValid = await ChapterFilter.validateRange(testUsername2, range);

      expect(isValid).toBe(false);
    });
  });
});
