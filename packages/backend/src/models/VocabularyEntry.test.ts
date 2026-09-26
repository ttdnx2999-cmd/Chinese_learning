/**
 * VocabularyEntry Model Tests
 * 
 * Tests for VocabularyEntry data access layer with user isolation
 * 
 * Note: These tests require a running MySQL database with the schema set up.
 * To run these tests, ensure:
 * 1. MySQL is running
 * 2. Database 'chinese_learning_app' exists
 * 3. .env file is configured with correct database credentials
 */

import { VocabularyEntryDAO, VocabularyInput, VocabularyEntry } from './VocabularyEntry';
import { initDatabase, closeDatabase, getPool } from '../config/database';

describe('VocabularyEntry Model', () => {
  const testUsername = 'test-user';
  const otherUsername = 'other-user';
  
  beforeAll(async () => {
    try {
      // Initialize database connection
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
      await pool.query('DELETE FROM vocabulary_entries WHERE username IN (?, ?)', [testUsername, otherUsername]);
      await closeDatabase();
    } catch (error) {
      console.error('Failed to clean up:', error);
    }
  });

  beforeEach(async () => {
    try {
      // Clean up before each test
      const pool = getPool();
      await pool.query('DELETE FROM vocabulary_entries WHERE username IN (?, ?)', [testUsername, otherUsername]);
    } catch (error) {
      console.error('Failed to clean up before test:', error);
      throw error;
    }
  });

  describe('create', () => {
    it('should create a new vocabulary entry with all fields', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'Common greeting',
        chapter: 1
      };

      const entry = await VocabularyEntryDAO.create(testUsername, input);

      expect(entry.id).toBeDefined();
      expect(entry.username).toBe(testUsername);
      expect(entry.chineseCharacter).toBe(input.chineseCharacter);
      expect(entry.pinyin).toBe(input.pinyin);
      expect(entry.hanVietnamese).toBe(input.hanVietnamese);
      expect(entry.modernVietnamese).toBe(input.modernVietnamese);
      expect(entry.englishMeaning).toBe(input.englishMeaning);
      expect(entry.learningNote).toBe(input.learningNote);
      expect(entry.chapter).toBe(input.chapter);
      expect(entry.createdAt).toBeInstanceOf(Date);
      expect(entry.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a vocabulary entry with minimal fields', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '好',
        chapter: 1
      };

      const entry = await VocabularyEntryDAO.create(testUsername, input);

      expect(entry.id).toBeDefined();
      expect(entry.username).toBe(testUsername);
      expect(entry.chineseCharacter).toBe(input.chineseCharacter);
      expect(entry.chapter).toBe(input.chapter);
      expect(entry.pinyin).toBe(''); // Default empty string
    });
  });

  describe('findById', () => {
    it('should find an entry by ID with user isolation', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '学习',
        pinyin: 'xué xí',
        modernVietnamese: 'học tập',
        englishMeaning: 'study',
        chapter: 2
      };

      const created = await VocabularyEntryDAO.create(testUsername, input);
      const found = await VocabularyEntryDAO.findById(testUsername, created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.chineseCharacter).toBe(input.chineseCharacter);
    });

    it('should return null for non-existent ID', async () => {
      const found = await VocabularyEntryDAO.findById(testUsername, 'non-existent-id');
      expect(found).toBeNull();
    });

    it('should enforce user isolation - cannot access other user\'s entries', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '中文',
        pinyin: 'zhōng wén',
        chapter: 1
      };

      const created = await VocabularyEntryDAO.create(testUsername, input);
      const found = await VocabularyEntryDAO.findById(otherUsername, created.id);

      expect(found).toBeNull();
    });
  });

  describe('findByUsername', () => {
    beforeEach(async () => {
      // Create test entries
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '一',
        pinyin: 'yī',
        chapter: 1
      });
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '二',
        pinyin: 'èr',
        chapter: 1
      });
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '三',
        pinyin: 'sān',
        chapter: 2
      });
      await VocabularyEntryDAO.create(otherUsername, {
        chineseCharacter: '四',
        pinyin: 'sì',
        chapter: 1
      });
    });

    it('should find all entries for a user', async () => {
      const entries = await VocabularyEntryDAO.findByUsername(testUsername);
      expect(entries).toHaveLength(3);
      expect(entries.every(e => e.username === testUsername)).toBe(true);
    });

    it('should filter by chapter range', async () => {
      const entries = await VocabularyEntryDAO.findByUsername(testUsername, 1, 1);
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.chapter === 1)).toBe(true);
    });

    it('should filter by start chapter only', async () => {
      const entries = await VocabularyEntryDAO.findByUsername(testUsername, 2);
      expect(entries).toHaveLength(1);
      expect(entries[0].chapter).toBe(2);
    });

    it('should filter by end chapter only', async () => {
      const entries = await VocabularyEntryDAO.findByUsername(testUsername, undefined, 1);
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.chapter === 1)).toBe(true);
    });

    it('should enforce user isolation', async () => {
      const entries = await VocabularyEntryDAO.findByUsername(testUsername);
      expect(entries.every(e => e.username === testUsername)).toBe(true);
      expect(entries.some(e => e.chineseCharacter === '四')).toBe(false);
    });
  });

  describe('update', () => {
    it('should update all fields of an entry', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '老',
        pinyin: 'lǎo',
        chapter: 1
      };

      const created = await VocabularyEntryDAO.create(testUsername, input);

      const updates: Partial<VocabularyInput> = {
        pinyin: 'lǎo (updated)',
        hanVietnamese: 'lão',
        modernVietnamese: 'già',
        englishMeaning: 'old',
        learningNote: 'Updated note',
        chapter: 2
      };

      const updated = await VocabularyEntryDAO.update(testUsername, created.id, updates);

      expect(updated).not.toBeNull();
      expect(updated?.pinyin).toBe(updates.pinyin);
      expect(updated?.hanVietnamese).toBe(updates.hanVietnamese);
      expect(updated?.modernVietnamese).toBe(updates.modernVietnamese);
      expect(updated?.englishMeaning).toBe(updates.englishMeaning);
      expect(updated?.learningNote).toBe(updates.learningNote);
      expect(updated?.chapter).toBe(updates.chapter);
      expect(updated?.chineseCharacter).toBe(input.chineseCharacter); // Unchanged
    });

    it('should update partial fields', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '新',
        pinyin: 'xīn',
        modernVietnamese: 'mới',
        chapter: 1
      };

      const created = await VocabularyEntryDAO.create(testUsername, input);

      const updates: Partial<VocabularyInput> = {
        englishMeaning: 'new'
      };

      const updated = await VocabularyEntryDAO.update(testUsername, created.id, updates);

      expect(updated).not.toBeNull();
      expect(updated?.englishMeaning).toBe(updates.englishMeaning);
      expect(updated?.modernVietnamese).toBe(input.modernVietnamese); // Unchanged
    });

    it('should return null when updating non-existent entry', async () => {
      const updated = await VocabularyEntryDAO.update(testUsername, 'non-existent-id', {
        englishMeaning: 'test'
      });

      expect(updated).toBeNull();
    });

    it('should enforce user isolation on updates', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '书',
        pinyin: 'shū',
        chapter: 1
      };

      const created = await VocabularyEntryDAO.create(testUsername, input);

      const updated = await VocabularyEntryDAO.update(otherUsername, created.id, {
        englishMeaning: 'book'
      });

      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an entry', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '删除',
        pinyin: 'shān chú',
        chapter: 1
      };

      const created = await VocabularyEntryDAO.create(testUsername, input);
      const deleted = await VocabularyEntryDAO.delete(testUsername, created.id);

      expect(deleted).toBe(true);

      const found = await VocabularyEntryDAO.findById(testUsername, created.id);
      expect(found).toBeNull();
    });

    it('should return false when deleting non-existent entry', async () => {
      const deleted = await VocabularyEntryDAO.delete(testUsername, 'non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should enforce user isolation on deletes', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '保护',
        pinyin: 'bǎo hù',
        chapter: 1
      };

      const created = await VocabularyEntryDAO.create(testUsername, input);
      const deleted = await VocabularyEntryDAO.delete(otherUsername, created.id);

      expect(deleted).toBe(false);

      // Entry should still exist for original user
      const found = await VocabularyEntryDAO.findById(testUsername, created.id);
      expect(found).not.toBeNull();
    });
  });

  describe('getChapters', () => {
    beforeEach(async () => {
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '一',
        pinyin: 'yī',
        chapter: 1
      });
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '二',
        pinyin: 'èr',
        chapter: 1
      });
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '三',
        pinyin: 'sān',
        chapter: 3
      });
    });

    it('should return unique chapters sorted', async () => {
      const chapters = await VocabularyEntryDAO.getChapters(testUsername);
      expect(chapters).toEqual([1, 3]);
    });

    it('should return empty array for user with no entries', async () => {
      const chapters = await VocabularyEntryDAO.getChapters('no-entries-user');
      expect(chapters).toEqual([]);
    });
  });

  describe('countByChapter', () => {
    beforeEach(async () => {
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '一',
        pinyin: 'yī',
        chapter: 1
      });
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '二',
        pinyin: 'èr',
        chapter: 1
      });
      await VocabularyEntryDAO.create(testUsername, {
        chineseCharacter: '三',
        pinyin: 'sān',
        chapter: 2
      });
    });

    it('should count entries in a chapter', async () => {
      const count = await VocabularyEntryDAO.countByChapter(testUsername, 1);
      expect(count).toBe(2);
    });

    it('should return 0 for empty chapter', async () => {
      const count = await VocabularyEntryDAO.countByChapter(testUsername, 99);
      expect(count).toBe(0);
    });
  });

  describe('createShared', () => {
    it('should create a vocabulary entry with shared_from field', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'Common greeting',
        chapter: 1
      };

      const entry = await VocabularyEntryDAO.createShared(testUsername, input, 'sourceuser');

      expect(entry.id).toBeDefined();
      expect(entry.username).toBe(testUsername);
      expect(entry.chineseCharacter).toBe(input.chineseCharacter);
      expect(entry.pinyin).toBe(input.pinyin);
      expect(entry.hanVietnamese).toBe(input.hanVietnamese);
      expect(entry.modernVietnamese).toBe(input.modernVietnamese);
      expect(entry.englishMeaning).toBe(input.englishMeaning);
      expect(entry.learningNote).toBe(input.learningNote);
      expect(entry.chapter).toBe(input.chapter);
      expect(entry.sharedFrom).toBe('sourceuser');
      expect(entry.createdAt).toBeInstanceOf(Date);
      expect(entry.updatedAt).toBeInstanceOf(Date);
    });

    it('should preserve all fields when creating shared entry', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '学习',
        pinyin: 'xué xí',
        hanVietnamese: 'học tập',
        modernVietnamese: 'học tập',
        englishMeaning: 'study',
        learningNote: 'Important verb',
        chapter: 2
      };

      const entry = await VocabularyEntryDAO.createShared(testUsername, input, 'alice');

      expect(entry.chineseCharacter).toBe(input.chineseCharacter);
      expect(entry.pinyin).toBe(input.pinyin);
      expect(entry.hanVietnamese).toBe(input.hanVietnamese);
      expect(entry.modernVietnamese).toBe(input.modernVietnamese);
      expect(entry.englishMeaning).toBe(input.englishMeaning);
      expect(entry.learningNote).toBe(input.learningNote);
      expect(entry.chapter).toBe(input.chapter);
      expect(entry.sharedFrom).toBe('alice');
    });

    it('should create shared entry with minimal fields', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '好',
        chapter: 1
      };

      const entry = await VocabularyEntryDAO.createShared(testUsername, input, 'bob');

      expect(entry.id).toBeDefined();
      expect(entry.username).toBe(testUsername);
      expect(entry.chineseCharacter).toBe(input.chineseCharacter);
      expect(entry.chapter).toBe(input.chapter);
      expect(entry.sharedFrom).toBe('bob');
      expect(entry.pinyin).toBe(''); // Default empty string
    });
  });

  describe('getUsersByChapter', () => {
    beforeEach(async () => {
      // Clean up first to ensure no leftover data from any test
      const pool = getPool();
      await pool.query('DELETE FROM vocabulary_entries WHERE username IN (?, ?, ?, ?, ?)', 
        ['alice', 'bob', 'charlie', 'integrationuser1', 'test-chapter-filter-user']);
      
      // Create entries for different users in different chapters
      await VocabularyEntryDAO.create('alice', {
        chineseCharacter: '一',
        pinyin: 'yī',
        chapter: 1
      });
      await VocabularyEntryDAO.create('bob', {
        chineseCharacter: '二',
        pinyin: 'èr',
        chapter: 1
      });
      await VocabularyEntryDAO.create('charlie', {
        chineseCharacter: '三',
        pinyin: 'sān',
        chapter: 1
      });
      await VocabularyEntryDAO.create('alice', {
        chineseCharacter: '四',
        pinyin: 'sì',
        chapter: 2
      });
      await VocabularyEntryDAO.create('bob', {
        chineseCharacter: '五',
        pinyin: 'wǔ',
        chapter: 2
      });
    });

    afterEach(async () => {
      // Clean up test users
      const pool = getPool();
      await pool.query('DELETE FROM vocabulary_entries WHERE username IN (?, ?, ?, ?, ?, ?)', 
        ['alice', 'bob', 'charlie', 'integrationuser1', 'test-chapter-filter-user', 'test-chapter-filter-user-2']);
    });

    it('should return all users with vocabulary in a chapter', async () => {
      const users = await VocabularyEntryDAO.getUsersByChapter(1);
      expect(users).toContain('alice');
      expect(users).toContain('bob');
      expect(users).toContain('charlie');
      expect(users).toHaveLength(3);
    });

    it('should return sorted usernames', async () => {
      const users = await VocabularyEntryDAO.getUsersByChapter(1);
      expect(users).toEqual(['alice', 'bob', 'charlie']);
    });

    it('should return unique usernames', async () => {
      // Add another entry for alice in chapter 1
      await VocabularyEntryDAO.create('alice', {
        chineseCharacter: '六',
        pinyin: 'liù',
        chapter: 1
      });

      const users = await VocabularyEntryDAO.getUsersByChapter(1);
      expect(users.filter(u => u === 'alice')).toHaveLength(1);
    });

    it('should return empty array for chapter with no entries', async () => {
      const users = await VocabularyEntryDAO.getUsersByChapter(99);
      expect(users).toEqual([]);
    });

    it('should return only users with entries in specified chapter', async () => {
      const users = await VocabularyEntryDAO.getUsersByChapter(2);
      expect(users).toContain('alice');
      expect(users).toContain('bob');
      expect(users).not.toContain('charlie');
      expect(users).toHaveLength(2);
    });
  });
});
