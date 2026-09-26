/**
 * Unit tests for Phrases API Routes
 */

import request from 'supertest';
import express, { Express } from 'express';
import { VocabGroup } from '../services/PhraseGeneratorService';
import { RowDataPacket } from 'mysql2';

// Mock the database pool
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({
  getPool: jest.fn(() => ({
    query: mockQuery
  }))
}));

// Mock the PhraseGeneratorService
const mockGetVocabGroups = jest.fn();
const mockGenerateAllSentences = jest.fn();
jest.mock('../services/PhraseGeneratorService', () => ({
  PhraseGeneratorService: jest.fn().mockImplementation(() => ({
    getVocabGroups: mockGetVocabGroups,
    generateAllSentences: mockGenerateAllSentences
  }))
}));

// Import routes after mocks are set up
import phrasesRoutes from './phrases.routes';

describe('Phrases Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', phrasesRoutes);
    
    jest.clearAllMocks();
  });

  describe('GET /api/phrases/vocab-groups', () => {
    it('should return vocab groups with sentence counts', async () => {
      // Mock vocab groups from service
      const mockVocabGroups: VocabGroup[] = [
        { id: 1, chapterStart: 1, chapterEndpoint: 10 },
        { id: 2, chapterStart: 1, chapterEndpoint: 15 },
        { id: 3, chapterStart: 1, chapterEndpoint: 20 },
        { id: 4, chapterStart: 1, chapterEndpoint: 25 },
        { id: 5, chapterStart: 1, chapterEndpoint: 30 }
      ];
      
      mockGetVocabGroups.mockResolvedValue(mockVocabGroups);
      
      // Mock sentence counts from database
      const mockSentenceCounts: RowDataPacket[] = [
        { vocab_group_id: 1, count: 120 },
        { vocab_group_id: 2, count: 120 },
        { vocab_group_id: 3, count: 120 },
        { vocab_group_id: 4, count: 120 },
        { vocab_group_id: 5, count: 120 }
      ] as RowDataPacket[];
      
      mockQuery.mockResolvedValue([mockSentenceCounts]);
      
      const response = await request(app).get('/api/phrases/vocab-groups');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(5);
      expect(response.body[0]).toEqual({
        id: 1,
        chapterStart: 1,
        chapterEnd: 10,
        sentenceCount: 120
      });
      expect(response.body[4]).toEqual({
        id: 5,
        chapterStart: 1,
        chapterEnd: 30,
        sentenceCount: 120
      });
      
      expect(mockGetVocabGroups).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT vocab_group_id, COUNT(*) as count')
      );
    });

    it('should return vocab groups with zero sentence counts when no sentences exist', async () => {
      // Mock vocab groups from service
      const mockVocabGroups: VocabGroup[] = [
        { id: 1, chapterStart: 1, chapterEndpoint: 10 },
        { id: 2, chapterStart: 1, chapterEndpoint: 15 },
        { id: 3, chapterStart: 1, chapterEndpoint: 20 },
        { id: 4, chapterStart: 1, chapterEndpoint: 25 },
        { id: 5, chapterStart: 1, chapterEndpoint: 30 }
      ];
      
      mockGetVocabGroups.mockResolvedValue(mockVocabGroups);
      
      // Mock empty sentence counts (no sentences generated yet)
      mockQuery.mockResolvedValue([[]]);
      
      const response = await request(app).get('/api/phrases/vocab-groups');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(5);
      expect(response.body[0]).toEqual({
        id: 1,
        chapterStart: 1,
        chapterEnd: 10,
        sentenceCount: 0
      });
      expect(response.body[4]).toEqual({
        id: 5,
        chapterStart: 1,
        chapterEnd: 30,
        sentenceCount: 0
      });
    });

    it('should return vocab groups with partial sentence counts', async () => {
      // Mock vocab groups from service
      const mockVocabGroups: VocabGroup[] = [
        { id: 1, chapterStart: 1, chapterEndpoint: 10 },
        { id: 2, chapterStart: 1, chapterEndpoint: 15 },
        { id: 3, chapterStart: 1, chapterEndpoint: 20 },
        { id: 4, chapterStart: 1, chapterEndpoint: 25 },
        { id: 5, chapterStart: 1, chapterEndpoint: 30 }
      ];
      
      mockGetVocabGroups.mockResolvedValue(mockVocabGroups);
      
      // Mock partial sentence counts (only some groups have sentences)
      const mockSentenceCounts: RowDataPacket[] = [
        { vocab_group_id: 1, count: 120 },
        { vocab_group_id: 3, count: 60 }
      ] as RowDataPacket[];
      
      mockQuery.mockResolvedValue([mockSentenceCounts]);
      
      const response = await request(app).get('/api/phrases/vocab-groups');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(5);
      expect(response.body[0].sentenceCount).toBe(120);
      expect(response.body[1].sentenceCount).toBe(0);
      expect(response.body[2].sentenceCount).toBe(60);
      expect(response.body[3].sentenceCount).toBe(0);
      expect(response.body[4].sentenceCount).toBe(0);
    });

    it('should return 500 if service throws an error', async () => {
      mockGetVocabGroups.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app).get('/api/phrases/vocab-groups');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get vocab groups');
    });

    it('should return 500 if database query fails', async () => {
      const mockVocabGroups: VocabGroup[] = [
        { id: 1, chapterStart: 1, chapterEndpoint: 10 }
      ];
      
      mockGetVocabGroups.mockResolvedValue(mockVocabGroups);
      mockQuery.mockRejectedValue(new Error('Query failed'));
      
      const response = await request(app).get('/api/phrases/vocab-groups');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get vocab groups');
    });
  });

  describe('GET /api/phrases/sentences/:vocabGroupId', () => {
    it('should return sentences for valid vocab group', async () => {
      const mockSentences: RowDataPacket[] = [
        {
          id: 'uuid-1',
          vocab_group_id: 1,
          chinese_text: '我喜欢学习中文',
          pinyin: 'wǒ xǐhuān xuéxí zhōngwén',
          used_characters: JSON.stringify(['我', '喜', '欢', '学', '习', '中', '文']),
          generation_timestamp: new Date('2024-01-01T00:00:00Z')
        },
        {
          id: 'uuid-2',
          vocab_group_id: 1,
          chinese_text: '今天天气很好',
          pinyin: 'jīntiān tiānqì hěn hǎo',
          used_characters: JSON.stringify(['今', '天', '气', '很', '好']),
          generation_timestamp: new Date('2024-01-01T00:00:00Z')
        }
      ] as RowDataPacket[];
      
      mockQuery.mockResolvedValue([mockSentences]);
      
      const response = await request(app).get('/api/phrases/sentences/1');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual({
        id: 'uuid-1',
        vocabGroupId: 1,
        chineseText: '我喜欢学习中文',
        pinyin: 'wǒ xǐhuān xuéxí zhōngwén',
        usedCharacters: ['我', '喜', '欢', '学', '习', '中', '文'],
        generationTimestamp: expect.any(String)
      });
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE vocab_group_id = ?'),
        [1]
      );
    });

    it('should return empty array when no sentences exist for vocab group', async () => {
      mockQuery.mockResolvedValue([[]]);
      
      const response = await request(app).get('/api/phrases/sentences/3');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 400 for invalid vocab group ID (non-numeric)', async () => {
      const response = await request(app).get('/api/phrases/sentences/invalid');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid vocabGroupId. Must be between 1 and 5.');
    });

    it('should return 400 for vocab group ID less than 1', async () => {
      const response = await request(app).get('/api/phrases/sentences/0');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid vocabGroupId. Must be between 1 and 5.');
    });

    it('should return 400 for vocab group ID greater than 5', async () => {
      const response = await request(app).get('/api/phrases/sentences/6');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid vocabGroupId. Must be between 1 and 5.');
    });

    it('should return 500 if database query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));
      
      const response = await request(app).get('/api/phrases/sentences/1');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get sentences');
    });
  });

  describe('GET /api/phrases/character-info/:character', () => {
    it('should return character info for existing character', async () => {
      const mockCharacterInfo: RowDataPacket[] = [
        {
          chinese_character: '我',
          pinyin: 'wǒ',
          han_vietnamese: 'ngã',
          modern_vietnamese: 'tôi',
          english_meaning: 'I, me'
        }
      ] as RowDataPacket[];
      
      mockQuery.mockResolvedValue([mockCharacterInfo]);
      
      const response = await request(app).get('/api/phrases/character-info/我');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        chineseCharacter: '我',
        pinyin: 'wǒ',
        hanVietnamese: 'ngã',
        modernVietnamese: 'tôi',
        englishMeaning: 'I, me'
      });
      
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE chinese_character = ?'),
        ['我']
      );
    });

    it('should return 404 for non-existent character', async () => {
      mockQuery.mockResolvedValue([[]]);
      
      const response = await request(app).get('/api/phrases/character-info/不存在');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Character not found');
    });

    it('should return 500 if database query fails', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));
      
      const response = await request(app).get('/api/phrases/character-info/我');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get character info');
    });
  });

  describe('POST /api/phrases/generate', () => {
    it('should trigger generation and return success', async () => {
      mockGenerateAllSentences.mockResolvedValue(undefined);
      
      const response = await request(app).post('/api/phrases/generate');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Sentence generation completed successfully'
      });
      
      expect(mockGenerateAllSentences).toHaveBeenCalledTimes(1);
    });

    it('should return 503 if generation already in progress', async () => {
      mockGenerateAllSentences.mockRejectedValue(
        new Error('Generation already in progress')
      );
      
      const response = await request(app).post('/api/phrases/generate');
      
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        error: 'Generation already in progress'
      });
    });

    it('should return 500 if generation fails', async () => {
      mockGenerateAllSentences.mockRejectedValue(new Error('AI API error'));
      
      const response = await request(app).post('/api/phrases/generate');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to generate sentences'
      });
    });
  });
});
