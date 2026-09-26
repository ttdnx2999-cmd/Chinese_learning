/**
 * Flashcard Routes Integration Tests
 * 
 * Integration tests for flashcard API endpoints with real FlashcardEngine
 */

import request from 'supertest';
import express, { Express } from 'express';
import flashcardRoutes from './flashcard.routes';
import { VocabularyEntryDAO } from '../models/VocabularyEntry';
import { FlashcardEngine } from '../services/FlashcardEngine';
import { ChapterFilter } from '../services/ChapterFilter';

// Mock the database layer
jest.mock('../models/VocabularyEntry');
jest.mock('../services/ChapterFilter');

describe('Flashcard Routes Integration', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', flashcardRoutes);
    jest.clearAllMocks();
    FlashcardEngine.clearCache();
  });

  afterEach(() => {
    FlashcardEngine.clearCache();
  });

  describe('Full flashcard workflow', () => {
    it('should get a flashcard and reveal its answer', async () => {
      // Mock vocabulary data
      const mockVocabulary = {
        id: 'vocab-123',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: '汝好',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'Common greeting',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock ChapterFilter and VocabularyEntryDAO
      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getVocabularyInRange as jest.Mock).mockResolvedValue(['vocab-123']);
      (VocabularyEntryDAO.findById as jest.Mock).mockResolvedValue(mockVocabulary);

      // Step 1: Get next flashcard
      const nextResponse = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(nextResponse.status).toBe(200);
      expect(nextResponse.body).toHaveProperty('id');
      expect(nextResponse.body).toHaveProperty('mode', 'ChineseToMeanings');
      expect(nextResponse.body).toHaveProperty('question');
      expect(nextResponse.body.question.displayText).toBe('你好');
      expect(nextResponse.body.question.fieldType).toBe('chinese');

      const flashcardId = nextResponse.body.id;

      // Step 2: Reveal answer
      const answerResponse = await request(app)
        .get(`/api/testuser/flashcard/${flashcardId}/answer`);

      expect(answerResponse.status).toBe(200);
      expect(answerResponse.body).toEqual({
        chinese: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: '汝好',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'Common greeting'
      });

      // Step 3: Try to reveal answer again (should fail - cache cleared)
      const secondAnswerResponse = await request(app)
        .get(`/api/testuser/flashcard/${flashcardId}/answer`);

      expect(secondAnswerResponse.status).toBe(404);
      expect(secondAnswerResponse.body.error).toContain('not found');
    });

    it('should work with EnglishToChinese mode', async () => {
      const mockVocabulary = {
        id: 'vocab-456',
        username: 'testuser',
        chineseCharacter: '谢谢',
        pinyin: 'xiè xiè',
        hanVietnamese: '謝謝',
        modernVietnamese: 'cảm ơn',
        englishMeaning: 'thank you',
        learningNote: 'Expression of gratitude',
        chapter: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getVocabularyInRange as jest.Mock).mockResolvedValue(['vocab-456']);
      (VocabularyEntryDAO.findById as jest.Mock).mockResolvedValue(mockVocabulary);

      const nextResponse = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'EnglishToChinese',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(nextResponse.status).toBe(200);
      expect(nextResponse.body.question.displayText).toBe('thank you');
      expect(nextResponse.body.question.fieldType).toBe('english');

      const answerResponse = await request(app)
        .get(`/api/testuser/flashcard/${nextResponse.body.id}/answer`);

      expect(answerResponse.status).toBe(200);
      expect(answerResponse.body.chinese).toBe('谢谢');
      expect(answerResponse.body.pinyin).toBe('xiè xiè');
    });

    it('should work with VietnameseToChinese mode', async () => {
      const mockVocabulary = {
        id: 'vocab-789',
        username: 'testuser',
        chineseCharacter: '再见',
        pinyin: 'zài jiàn',
        hanVietnamese: '再見',
        modernVietnamese: 'tạm biệt',
        englishMeaning: 'goodbye',
        learningNote: 'Farewell expression',
        chapter: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getVocabularyInRange as jest.Mock).mockResolvedValue(['vocab-789']);
      (VocabularyEntryDAO.findById as jest.Mock).mockResolvedValue(mockVocabulary);

      const nextResponse = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'VietnameseToChinese',
          chapterStart: '1',
          chapterEnd: '5'
        });

      expect(nextResponse.status).toBe(200);
      expect(nextResponse.body.question.displayText).toBe('tạm biệt');
      expect(nextResponse.body.question.fieldType).toBe('vietnamese');

      const answerResponse = await request(app)
        .get(`/api/testuser/flashcard/${nextResponse.body.id}/answer`);

      expect(answerResponse.status).toBe(200);
      expect(answerResponse.body.chinese).toBe('再见');
      expect(answerResponse.body.pinyin).toBe('zài jiàn');
    });

    it('should handle multiple flashcards independently', async () => {
      const mockVocabulary1 = {
        id: 'vocab-1',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: '汝好',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'Greeting',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockVocabulary2 = {
        id: 'vocab-2',
        username: 'testuser',
        chineseCharacter: '谢谢',
        pinyin: 'xiè xiè',
        hanVietnamese: '謝謝',
        modernVietnamese: 'cảm ơn',
        englishMeaning: 'thank you',
        learningNote: 'Gratitude',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (ChapterFilter.validateRange as jest.Mock).mockResolvedValue(true);
      (ChapterFilter.getVocabularyInRange as jest.Mock).mockResolvedValue(['vocab-1', 'vocab-2']);

      // Mock findById to return different vocabulary based on ID
      (VocabularyEntryDAO.findById as jest.Mock)
        .mockResolvedValueOnce(mockVocabulary1)
        .mockResolvedValueOnce(mockVocabulary2);

      // Get first flashcard
      const response1 = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1',
          chapterEnd: '1'
        });

      expect(response1.status).toBe(200);
      const flashcardId1 = response1.body.id;

      // Get second flashcard
      const response2 = await request(app)
        .get('/api/testuser/flashcard/next')
        .query({
          mode: 'ChineseToMeanings',
          chapterStart: '1',
          chapterEnd: '1'
        });

      expect(response2.status).toBe(200);
      const flashcardId2 = response2.body.id;

      // Flashcard IDs should be different
      expect(flashcardId1).not.toBe(flashcardId2);

      // Reveal both answers
      const answer1 = await request(app)
        .get(`/api/testuser/flashcard/${flashcardId1}/answer`);
      
      const answer2 = await request(app)
        .get(`/api/testuser/flashcard/${flashcardId2}/answer`);

      expect(answer1.status).toBe(200);
      expect(answer2.status).toBe(200);
    });
  });
});
