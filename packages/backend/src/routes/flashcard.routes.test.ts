/**
 * Flashcard Routes Tests
 * 
 * Tests for flashcard API endpoints
 */

import request from 'supertest';
import express, { Express } from 'express';
import flashcardRoutes from './flashcard.routes';
import { FlashcardEngine, FlashcardMode } from '../services/FlashcardEngine';

// Mock FlashcardEngine
jest.mock('../services/FlashcardEngine');

describe('Flashcard Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', flashcardRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/:username/flashcard/next', () => {
    it('should return a flashcard with valid parameters', async () => {
      const mockFlashcard = {
        id: 'test-flashcard-id',
        mode: FlashcardMode.ChineseToMeanings,
        question: {
          displayText: '你好',
          fieldType: 'chinese' as const
        },
        vocabularyId: 'vocab-id-123'
      };

      (FlashcardEngine.getNextCard as jest.Mock).mockResolvedValue(mockFlashcard);

      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockFlashcard);
      expect(FlashcardEngine.getNextCard).toHaveBeenCalledWith(
        'testuser',
        FlashcardMode.ChineseToMeanings,
        { start: 1, end: 5 }
      );
    });

    it('should return 400 if mode is missing', async () => {
      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Mode parameter is required');
    });

    it('should return 400 if mode is invalid', async () => {
      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'InvalidMode',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid mode');
    });

    it('should return 400 if chapterStart is missing', async () => {
      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterEnd: '5'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapterStart and chapterEnd parameters are required');
    });

    it('should return 400 if chapterEnd is missing', async () => {
      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapterStart and chapterEnd parameters are required');
    });

    it('should return 400 if chapter numbers are not valid integers', async () => {
      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: 'abc',
          chapterEnd: '5'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapterStart and chapterEnd must be valid numbers');
    });

    it('should return 400 if chapter numbers are not positive', async () => {
      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '0',
          chapterEnd: '5'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Chapter numbers must be positive integers');
    });

    it('should return 400 if chapterStart is greater than chapterEnd', async () => {
      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '10',
          chapterEnd: '5'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapterStart must be less than or equal to chapterEnd');
    });

    it('should return 404 if no vocabulary found', async () => {
      (FlashcardEngine.getNextCard as jest.Mock).mockRejectedValue(
        new Error('No vocabulary found in specified chapter range')
      );

      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No vocabulary found');
    });

    it('should return 404 if chapter range is invalid', async () => {
      (FlashcardEngine.getNextCard as jest.Mock).mockRejectedValue(
        new Error('Invalid chapter range or no vocabulary available')
      );

      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Invalid chapter range');
    });

    it('should return 500 for unexpected errors', async () => {
      (FlashcardEngine.getNextCard as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get next flashcard');
    });

    it('should work with EnglishToChinese mode', async () => {
      const mockFlashcard = {
        id: 'test-flashcard-id',
        mode: FlashcardMode.EnglishToChinese,
        question: {
          displayText: 'hello',
          fieldType: 'english' as const
        },
        vocabularyId: 'vocab-id-123'
      };

      (FlashcardEngine.getNextCard as jest.Mock).mockResolvedValue(mockFlashcard);

      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'EnglishToChinese',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockFlashcard);
    });

    it('should work with VietnameseToChinese mode', async () => {
      const mockFlashcard = {
        id: 'test-flashcard-id',
        mode: FlashcardMode.VietnameseToChinese,
        question: {
          displayText: 'xin chào',
          fieldType: 'vietnamese' as const
        },
        vocabularyId: 'vocab-id-123'
      };

      (FlashcardEngine.getNextCard as jest.Mock).mockResolvedValue(mockFlashcard);

      const response = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'VietnameseToChinese',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockFlashcard);
    });
  });

  describe('GET /api/:username/flashcard/:id/answer', () => {
    it('should return flashcard answer with valid ID', async () => {
      const mockAnswer = {
        chinese: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: '汝好',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'Common greeting'
      };

      (FlashcardEngine.revealAnswer as jest.Mock).mockResolvedValue(mockAnswer);

      const response = await request(app)
        .get('/api/testuser/flashcard/test-flashcard-id/answer');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnswer);
      expect(FlashcardEngine.revealAnswer).toHaveBeenCalledWith('test-flashcard-id');
    });

    it('should return 404 if flashcard not found', async () => {
      (FlashcardEngine.revealAnswer as jest.Mock).mockRejectedValue(
        new Error('Flashcard not found or expired')
      );

      const response = await request(app)
        .get('/api/testuser/flashcard/invalid-id/answer');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 500 for unexpected errors', async () => {
      (FlashcardEngine.revealAnswer as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/testuser/flashcard/test-id/answer');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to reveal flashcard answer');
    });

    it('should return answer with partial fields', async () => {
      const mockAnswer = {
        chinese: '你好',
        pinyin: 'nǐ hǎo',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello'
      };

      (FlashcardEngine.revealAnswer as jest.Mock).mockResolvedValue(mockAnswer);

      const response = await request(app)
        .get('/api/testuser/flashcard/test-flashcard-id/answer');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnswer);
    });
  });
});
