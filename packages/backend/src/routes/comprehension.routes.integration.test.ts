/**
 * Integration tests for Text Comprehension API Routes
 */

import express, { Express } from 'express';
import request from 'supertest';
import comprehensionRoutes, { clearCache } from './comprehension.routes';
import { initDatabase, closeDatabase } from '../config/database';
import { VocabularyEntryDAO } from '../models/VocabularyEntry';
import { aiTextGenerator } from '../services/AITextGenerator';

// Mock AI service to avoid external API calls
jest.mock('../services/AITextGenerator');

describe('Comprehension Routes Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    await initDatabase();
    
    app = express();
    app.use(express.json());
    app.use('/api', comprehensionRoutes);
  });

  afterAll(async () => {
    clearCache();
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    const testUsernames = ['integrationuser1', 'integrationuser2'];
    for (const username of testUsernames) {
      const entries = await VocabularyEntryDAO.findByUsername(username);
      for (const entry of entries) {
        await VocabularyEntryDAO.delete(username, entry.id);
      }
    }

    jest.clearAllMocks();
  });

  describe('GET /api/:username/comprehension/generate', () => {
    it('should generate text using real vocabulary from database', async () => {
      // Create test vocabulary
      await VocabularyEntryDAO.create('integrationuser1', {
        chineseCharacter: '你',
        pinyin: 'nǐ',
        hanVietnamese: 'nhĩ',
        modernVietnamese: 'bạn',
        englishMeaning: 'you',
        learningNote: 'pronoun',
        chapter: 1
      });

      await VocabularyEntryDAO.create('integrationuser1', {
        chineseCharacter: '好',
        pinyin: 'hǎo',
        hanVietnamese: 'hảo',
        modernVietnamese: 'tốt',
        englishMeaning: 'good',
        learningNote: 'adjective',
        chapter: 1
      });

      await VocabularyEntryDAO.create('integrationuser1', {
        chineseCharacter: '吗',
        pinyin: 'ma',
        modernVietnamese: 'không',
        englishMeaning: 'question particle',
        chapter: 1
      });

      // Mock AI text generator
      (aiTextGenerator.generateText as jest.Mock).mockResolvedValue({
        chineseText: '你好吗',
        pinyin: 'nǐ hǎo ma',
        wordCount: 3
      });

      const response = await request(app)
        .get('/api/integrationuser1/comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('chineseText');
      expect(response.body).toHaveProperty('pinyin');
      expect(response.body).toHaveProperty('wordCount');
      expect(response.body.cached).toBe(false);

      // Verify AI was called with characters from database
      expect(aiTextGenerator.generateText).toHaveBeenCalled();
      const calledCharacters = (aiTextGenerator.generateText as jest.Mock).mock.calls[0][0];
      expect(calledCharacters).toEqual(expect.arrayContaining(['你', '好', '吗']));
    });

    it('should cache generated text and return cached version on second request', async () => {
      // Create test vocabulary
      await VocabularyEntryDAO.create('integrationuser1', {
        chineseCharacter: '我',
        pinyin: 'wǒ',
        modernVietnamese: 'tôi',
        englishMeaning: 'I',
        chapter: 2
      });

      // Mock AI text generator
      (aiTextGenerator.generateText as jest.Mock).mockResolvedValue({
        chineseText: '我',
        pinyin: 'wǒ',
        wordCount: 1
      });

      // First request
      const response1 = await request(app)
        .get('/api/integrationuser1/comprehension/generate')
        .query({ chapterStart: 2, chapterEnd: 2 });

      expect(response1.status).toBe(200);
      expect(response1.body.cached).toBe(false);

      // Second request - should be cached
      const response2 = await request(app)
        .get('/api/integrationuser1/comprehension/generate')
        .query({ chapterStart: 2, chapterEnd: 2 });

      expect(response2.status).toBe(200);
      expect(response2.body.cached).toBe(true);
      expect(response2.body.chineseText).toBe(response1.body.chineseText);

      // AI should only be called once
      expect(aiTextGenerator.generateText).toHaveBeenCalledTimes(1);
    });

    it('should return 404 when no vocabulary exists in chapter range', async () => {
      const response = await request(app)
        .get('/api/integrationuser1/comprehension/generate')
        .query({ chapterStart: 99, chapterEnd: 100 });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No vocabulary found');
    });

    it('should isolate vocabulary by username', async () => {
      // Create vocabulary for user1
      await VocabularyEntryDAO.create('integrationuser1', {
        chineseCharacter: '天',
        pinyin: 'tiān',
        modernVietnamese: 'trời',
        englishMeaning: 'sky',
        chapter: 3
      });

      // Create vocabulary for user2
      await VocabularyEntryDAO.create('integrationuser2', {
        chineseCharacter: '地',
        pinyin: 'dì',
        modernVietnamese: 'đất',
        englishMeaning: 'earth',
        chapter: 3
      });

      // Mock AI text generator
      (aiTextGenerator.generateText as jest.Mock).mockResolvedValue({
        chineseText: '天',
        pinyin: 'tiān',
        wordCount: 1
      });

      // Request for user1 should only get user1's vocabulary
      const response = await request(app)
        .get('/api/integrationuser1/comprehension/generate')
        .query({ chapterStart: 3, chapterEnd: 3 });

      expect(response.status).toBe(200);

      // Verify only user1's character was used
      const calledCharacters = (aiTextGenerator.generateText as jest.Mock).mock.calls[0][0];
      expect(calledCharacters).toContain('天');
      expect(calledCharacters).not.toContain('地');
    });
  });

  describe('GET /api/:username/comprehension/character-info', () => {
    it('should return character info from database', async () => {
      // Create test vocabulary
      const entry = await VocabularyEntryDAO.create('integrationuser1', {
        chineseCharacter: '学',
        pinyin: 'xué',
        hanVietnamese: 'học',
        modernVietnamese: 'học',
        englishMeaning: 'study',
        learningNote: 'common verb',
        chapter: 5
      });

      const response = await request(app)
        .get('/api/integrationuser1/comprehension/character-info')
        .query({ character: '学' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        chineseCharacter: '学',
        pinyin: 'xué',
        hanVietnamese: 'học',
        modernVietnamese: 'học',
        englishMeaning: 'study',
        learningNote: 'common verb',
        chapter: 5
      });
    });

    it('should return 404 for character not in user vocabulary', async () => {
      // Create vocabulary for different user
      await VocabularyEntryDAO.create('integrationuser2', {
        chineseCharacter: '书',
        pinyin: 'shū',
        modernVietnamese: 'sách',
        englishMeaning: 'book',
        chapter: 5
      });

      // Request from user1 should not find user2's character
      const response = await request(app)
        .get('/api/integrationuser1/comprehension/character-info')
        .query({ character: '书' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Character not found in vocabulary');
    });

    it('should handle optional fields correctly', async () => {
      // Create entry with minimal fields
      await VocabularyEntryDAO.create('integrationuser1', {
        chineseCharacter: '人',
        pinyin: 'rén',
        modernVietnamese: 'người',
        englishMeaning: 'person',
        chapter: 1
      });

      const response = await request(app)
        .get('/api/integrationuser1/comprehension/character-info')
        .query({ character: '人' });

      expect(response.status).toBe(200);
      expect(response.body.chineseCharacter).toBe('人');
      expect(response.body.pinyin).toBe('rén');
      expect(response.body.modernVietnamese).toBe('người');
      expect(response.body.englishMeaning).toBe('person');
      // Optional fields should be undefined
      expect(response.body.hanVietnamese).toBeUndefined();
      expect(response.body.learningNote).toBeUndefined();
    });
  });
});
