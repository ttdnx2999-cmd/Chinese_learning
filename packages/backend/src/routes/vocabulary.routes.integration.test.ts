/**
 * Integration tests for Vocabulary API Routes
 * 
 * Tests the vocabulary routes with actual VocabularyManager service
 */

import request from 'supertest';
import express, { Express } from 'express';
import vocabularyRoutes from './vocabulary.routes';
import { VocabularyEntryDAO } from '../models/VocabularyEntry';
import { TranslationService } from '../services/TranslationService';

// Mock the DAO and TranslationService
jest.mock('../models/VocabularyEntry');
jest.mock('../services/TranslationService');

describe('Vocabulary Routes Integration', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', vocabularyRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/:username/vocabulary', () => {
    it('should create entry with automatic translation', async () => {
      const mockCreatedEntry = {
        id: '123',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: '',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: '',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (TranslationService.prototype.translateToVietnamese as jest.Mock).mockResolvedValue('xin chào');
      (TranslationService.prototype.translateToEnglish as jest.Mock).mockResolvedValue('hello');
      (VocabularyEntryDAO.create as jest.Mock).mockResolvedValue(mockCreatedEntry);

      const response = await request(app)
        .post('/api/testuser/vocabulary')
        .send({
          chineseCharacter: '你好',
          pinyin: 'nǐ hǎo',
          chapter: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.chineseCharacter).toBe('你好');
      expect(VocabularyEntryDAO.create).toHaveBeenCalled();
    });
  });

  describe('GET /api/:username/vocabulary', () => {
    it('should retrieve entries with chapter filtering', async () => {
      const mockEntries = [
        {
          id: '1',
          username: 'testuser',
          chineseCharacter: '你',
          pinyin: 'nǐ',
          hanVietnamese: '',
          modernVietnamese: 'bạn',
          englishMeaning: 'you',
          learningNote: '',
          chapter: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          username: 'testuser',
          chineseCharacter: '好',
          pinyin: 'hǎo',
          hanVietnamese: '',
          modernVietnamese: 'tốt',
          englishMeaning: 'good',
          learningNote: '',
          chapter: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (VocabularyEntryDAO.findByUsername as jest.Mock).mockResolvedValue(mockEntries);

      const response = await request(app)
        .get('/api/testuser/vocabulary?chapterStart=1&chapterEnd=2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(VocabularyEntryDAO.findByUsername).toHaveBeenCalledWith('testuser', 1, 2);
    });
  });

  describe('GET /api/:username/vocabulary/:id', () => {
    it('should retrieve a single entry', async () => {
      const mockEntry = {
        id: '123',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: '',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: '',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (VocabularyEntryDAO.findById as jest.Mock).mockResolvedValue(mockEntry);

      const response = await request(app)
        .get('/api/testuser/vocabulary/123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('123');
      expect(VocabularyEntryDAO.findById).toHaveBeenCalledWith('testuser', '123');
    });
  });

  describe('PUT /api/:username/vocabulary/:id', () => {
    it('should update entry with automatic translation for missing fields', async () => {
      const mockUpdatedEntry = {
        id: '123',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: '',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'updated note',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (VocabularyEntryDAO.update as jest.Mock).mockResolvedValue(mockUpdatedEntry);

      const response = await request(app)
        .put('/api/testuser/vocabulary/123')
        .send({
          learningNote: 'updated note'
        });

      expect(response.status).toBe(200);
      expect(response.body.learningNote).toBe('updated note');
      expect(VocabularyEntryDAO.update).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/:username/vocabulary/:id', () => {
    it('should delete an entry', async () => {
      (VocabularyEntryDAO.delete as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/testuser/vocabulary/123');

      expect(response.status).toBe(204);
      expect(VocabularyEntryDAO.delete).toHaveBeenCalledWith('testuser', '123');
    });
  });

  describe('POST /api/:username/vocabulary/translate', () => {
    it('should preview translations', async () => {
      (TranslationService.prototype.translateToVietnamese as jest.Mock).mockResolvedValue('xin chào');
      (TranslationService.prototype.translateToEnglish as jest.Mock).mockResolvedValue('hello');

      const response = await request(app)
        .post('/api/testuser/vocabulary/translate')
        .send({
          chineseCharacter: '你好'
        });

      expect(response.status).toBe(200);
      expect(response.body.modernVietnamese).toBe('xin chào');
      expect(response.body.englishMeaning).toBe('hello');
    });
  });

  describe('GET /api/:username/vocabulary/chapters', () => {
    it('should get available chapters', async () => {
      (VocabularyEntryDAO.getChapters as jest.Mock).mockResolvedValue([1, 2, 3]);

      const response = await request(app)
        .get('/api/testuser/vocabulary/chapters');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([1, 2, 3]);
      expect(VocabularyEntryDAO.getChapters).toHaveBeenCalledWith('testuser');
    });
  });

  describe('POST /api/:username/vocabulary/share', () => {
    it('should share chapter vocabulary', async () => {
      const mockSourceEntries = [
        {
          id: '1',
          username: 'sourceuser',
          chineseCharacter: '你',
          pinyin: 'nǐ',
          hanVietnamese: '',
          modernVietnamese: 'bạn',
          englishMeaning: 'you',
          learningNote: '',
          chapter: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (VocabularyEntryDAO.findByUsername as jest.Mock).mockResolvedValue(mockSourceEntries);
      (VocabularyEntryDAO.createShared as jest.Mock).mockResolvedValue({
        ...mockSourceEntries[0],
        id: '2',
        username: 'testuser'
      });

      const response = await request(app)
        .post('/api/testuser/vocabulary/share')
        .send({
          sourceUsername: 'sourceuser',
          chapter: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.entriesCopied).toBe(1);
      expect(VocabularyEntryDAO.findByUsername).toHaveBeenCalledWith('sourceuser', 1, 1);
      expect(VocabularyEntryDAO.createShared).toHaveBeenCalled();
    });
  });

  describe('GET /api/vocabulary/shared', () => {
    it('should get users with shared vocabulary', async () => {
      (VocabularyEntryDAO.getUsersByChapter as jest.Mock).mockResolvedValue(['user1', 'user2']);

      const response = await request(app)
        .get('/api/vocabulary/shared?chapter=1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(['user1', 'user2']);
      expect(VocabularyEntryDAO.getUsersByChapter).toHaveBeenCalledWith(1);
    });
  });
});
