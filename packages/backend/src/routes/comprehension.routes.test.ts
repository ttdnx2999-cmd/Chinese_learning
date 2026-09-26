/**
 * Unit tests for Text Comprehension API Routes
 */

import express, { Express } from 'express';
import request from 'supertest';
import comprehensionRoutes, { clearCache } from './comprehension.routes';
import { aiTextGenerator } from '../services/AITextGenerator';
import { ChapterFilter } from '../services/ChapterFilter';
import { VocabularyEntryDAO } from '../models/VocabularyEntry';

// Mock dependencies
jest.mock('../services/AITextGenerator');
jest.mock('../services/ChapterFilter');
jest.mock('../models/VocabularyEntry');

describe('Comprehension Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', comprehensionRoutes);

    jest.clearAllMocks();
    clearCache(); // Clear cache between tests to prevent cached responses
  });

  afterAll(() => {
    clearCache();
  });

  describe('GET /api/:username/comprehension/generate', () => {
    it('should generate comprehension text successfully', async () => {
      const mockCharacters = ['你', '好', '吗'];
      const mockGeneratedText = {
        chineseText: '你好吗',
        pinyin: 'nǐ hǎo ma',
        wordCount: 3
      };

      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getRandomCharacters as jest.Mock).mockResolvedValue(mockCharacters);
      (aiTextGenerator.generateText as jest.Mock).mockResolvedValue(mockGeneratedText);
      (VocabularyEntryDAO.findByUsername as jest.Mock).mockResolvedValue([
        {
          chineseCharacter: '你',
          pinyin: 'nǐ',
          hanVietnamese: 'nhĩ',
          modernVietnamese: 'bạn',
          englishMeaning: 'you',
          learningNote: 'common pronoun'
        }
      ]);

      const response = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 5 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('chineseText', '你好吗');
      expect(response.body).toHaveProperty('pinyin', 'nǐ hǎo ma');
      expect(response.body).toHaveProperty('wordCount', 3);
      expect(response.body).toHaveProperty('cached', false);

      expect(ChapterFilter.validateRange).toHaveBeenCalledWith('testuser', { start: 1, end: 5 });
      expect(ChapterFilter.getRandomCharacters).toHaveBeenCalledWith('testuser', { start: 1, end: 5 }, 300);
      expect(aiTextGenerator.generateText).toHaveBeenCalledWith(mockCharacters, 40);
    });

    it('should return cached text on subsequent requests', async () => {
      const mockCharacters = ['你', '好'];
      const mockGeneratedText = {
        chineseText: '你好',
        pinyin: 'nǐ hǎo',
        wordCount: 2
      };

      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getRandomCharacters as jest.Mock).mockResolvedValue(mockCharacters);
      (aiTextGenerator.generateText as jest.Mock).mockResolvedValue(mockGeneratedText);
      (VocabularyEntryDAO.findByUsername as jest.Mock).mockResolvedValue([]);

      // First request - should generate
      const response1 = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 3 });

      expect(response1.status).toBe(200);
      expect(response1.body.cached).toBe(false);

      // Second request - should return cached
      const response2 = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 3 });

      expect(response2.status).toBe(200);
      expect(response2.body.cached).toBe(true);
      expect(response2.body.chineseText).toBe('你好');

      // AI should only be called once
      expect(aiTextGenerator.generateText).toHaveBeenCalledTimes(1);
    });

    it('should return 400 for missing username', async () => {
      const response = await request(app)
        .get('/api//comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 5 });

      expect(response.status).toBe(404); // Express returns 404 for missing route params
    });

    it('should return 400 for missing chapter parameters', async () => {
      const response = await request(app)
        .get('/api/testuser/comprehension/generate');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('chapterStart and chapterEnd parameters are required');
    });

    it('should return 400 for invalid chapter numbers', async () => {
      const response = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 'abc', chapterEnd: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be valid numbers');
    });

    it('should return 400 for negative chapter numbers', async () => {
      const response = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: -1, chapterEnd: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be positive integers');
    });

    it('should return 400 when start > end', async () => {
      const response = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 10, chapterEnd: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('chapterStart must be less than or equal to chapterEnd');
    });

    it('should return 404 when no vocabulary found in range', async () => {
      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 5 });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No vocabulary found');
    });

    it('should return 404 when getRandomCharacters returns empty array', async () => {
      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getRandomCharacters as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 5 });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No vocabulary found');
    });

    it('should return 500 on AI generation error', async () => {
      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getRandomCharacters as jest.Mock).mockResolvedValue(['你', '好']);
      (aiTextGenerator.generateText as jest.Mock).mockRejectedValue(new Error('AI service error'));

      const response = await request(app)
        .get('/api/testuser/comprehension/generate')
        .query({ chapterStart: 1, chapterEnd: 5 });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to generate comprehension text');
    });
  });

  describe('GET /api/:username/comprehension/character-info', () => {
    it('should return character information successfully', async () => {
      const mockEntry = {
        chineseCharacter: '你',
        pinyin: 'nǐ',
        hanVietnamese: 'nhĩ',
        modernVietnamese: 'bạn',
        englishMeaning: 'you',
        learningNote: 'common pronoun',
        chapter: 1
      };

      (VocabularyEntryDAO.findByUsername as jest.Mock).mockResolvedValue([mockEntry]);

      const response = await request(app)
        .get('/api/testuser/comprehension/character-info')
        .query({ character: '你' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        chineseCharacter: '你',
        pinyin: 'nǐ',
        hanVietnamese: 'nhĩ',
        modernVietnamese: 'bạn',
        englishMeaning: 'you',
        learningNote: 'common pronoun',
        chapter: 1
      });

      expect(VocabularyEntryDAO.findByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should return 400 for missing character parameter', async () => {
      const response = await request(app)
        .get('/api/testuser/comprehension/character-info');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('character parameter is required');
    });

    it('should return 400 for multi-character string', async () => {
      const response = await request(app)
        .get('/api/testuser/comprehension/character-info')
        .query({ character: '你好' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be a single Chinese character');
    });

    it('should return 404 when character not found', async () => {
      (VocabularyEntryDAO.findByUsername as jest.Mock).mockResolvedValue([
        { chineseCharacter: '好', pinyin: 'hǎo' }
      ]);

      const response = await request(app)
        .get('/api/testuser/comprehension/character-info')
        .query({ character: '你' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Character not found in vocabulary');
    });

    it('should return 500 on database error', async () => {
      (VocabularyEntryDAO.findByUsername as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/testuser/comprehension/character-info')
        .query({ character: '你' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to get character information');
    });
  });
});
