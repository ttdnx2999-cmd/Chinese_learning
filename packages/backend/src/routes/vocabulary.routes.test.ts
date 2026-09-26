/**
 * Unit tests for Vocabulary API Routes
 */

import request from 'supertest';
import express, { Express } from 'express';
import vocabularyRoutes from './vocabulary.routes';
import { vocabularyManager } from '../services/VocabularyManager';
import { VocabularyEntry } from '../models/VocabularyEntry';

// Mock the vocabulary manager
jest.mock('../services/VocabularyManager', () => ({
  vocabularyManager: {
    createEntry: jest.fn(),
    getEntries: jest.fn(),
    getEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    previewTranslations: jest.fn(),
    getAvailableChapters: jest.fn(),
    shareChapter: jest.fn(),
    getSharedVocabularySources: jest.fn()
  }
}));

describe('Vocabulary Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', vocabularyRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/:username/vocabulary', () => {
    it('should create a new vocabulary entry', async () => {
      const mockEntry: VocabularyEntry = {
        id: '123',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'common greeting',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (vocabularyManager.createEntry as jest.Mock).mockResolvedValue(mockEntry);

      const response = await request(app)
        .post('/api/testuser/vocabulary')
        .send({
          chineseCharacter: '你好',
          pinyin: 'nǐ hǎo',
          chapter: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('123');
      expect(response.body.chineseCharacter).toBe('你好');
      expect(vocabularyManager.createEntry).toHaveBeenCalledWith('testuser', {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        chapter: 1
      });
    });

    it('should return 400 if chineseCharacter is missing', async () => {
      const response = await request(app)
        .post('/api/testuser/vocabulary')
        .send({
          chapter: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chineseCharacter is required');
    });

    it('should return 400 if chapter is invalid', async () => {
      const response = await request(app)
        .post('/api/testuser/vocabulary')
        .send({
          chineseCharacter: '你好',
          chapter: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapter must be a positive integer');
    });
  });

  describe('GET /api/:username/vocabulary', () => {
    it('should get all vocabulary entries for a user', async () => {
      const mockEntries: VocabularyEntry[] = [
        {
          id: '123',
          username: 'testuser',
          chineseCharacter: '你好',
          pinyin: 'nǐ hǎo',
          hanVietnamese: 'nhĩ hảo',
          modernVietnamese: 'xin chào',
          englishMeaning: 'hello',
          learningNote: '',
          chapter: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (vocabularyManager.getEntries as jest.Mock).mockResolvedValue(mockEntries);

      const response = await request(app)
        .get('/api/testuser/vocabulary');

      expect(response.status).toBe(200);
      expect(response.body[0].id).toBe('123');
      expect(response.body[0].chineseCharacter).toBe('你好');
      expect(vocabularyManager.getEntries).toHaveBeenCalledWith('testuser', undefined);
    });

    it('should get vocabulary entries with chapter filtering', async () => {
      const mockEntries: VocabularyEntry[] = [];

      (vocabularyManager.getEntries as jest.Mock).mockResolvedValue(mockEntries);

      const response = await request(app)
        .get('/api/testuser/vocabulary?chapterStart=1&chapterEnd=3');

      expect(response.status).toBe(200);
      expect(vocabularyManager.getEntries).toHaveBeenCalledWith('testuser', {
        start: 1,
        end: 3
      });
    });

    it('should return 400 if chapter range is invalid', async () => {
      const response = await request(app)
        .get('/api/testuser/vocabulary?chapterStart=5&chapterEnd=2');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapterStart must be less than or equal to chapterEnd');
    });
  });

  describe('GET /api/:username/vocabulary/:id', () => {
    it('should get a single vocabulary entry', async () => {
      const mockEntry: VocabularyEntry = {
        id: '123',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: '',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (vocabularyManager.getEntry as jest.Mock).mockResolvedValue(mockEntry);

      const response = await request(app)
        .get('/api/testuser/vocabulary/123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('123');
      expect(response.body.chineseCharacter).toBe('你好');
      expect(vocabularyManager.getEntry).toHaveBeenCalledWith('testuser', '123');
    });

    it('should return 404 if entry not found', async () => {
      (vocabularyManager.getEntry as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/testuser/vocabulary/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Vocabulary entry not found');
    });
  });

  describe('PUT /api/:username/vocabulary/:id', () => {
    it('should update a vocabulary entry', async () => {
      const mockEntry: VocabularyEntry = {
        id: '123',
        username: 'testuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'updated note',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (vocabularyManager.updateEntry as jest.Mock).mockResolvedValue(mockEntry);

      const response = await request(app)
        .put('/api/testuser/vocabulary/123')
        .send({
          learningNote: 'updated note'
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('123');
      expect(response.body.learningNote).toBe('updated note');
      expect(vocabularyManager.updateEntry).toHaveBeenCalledWith('testuser', '123', {
        learningNote: 'updated note'
      });
    });

    it('should return 404 if entry not found', async () => {
      (vocabularyManager.updateEntry as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/testuser/vocabulary/999')
        .send({
          learningNote: 'updated note'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Vocabulary entry not found');
    });

    it('should return 400 if chapter is invalid', async () => {
      const response = await request(app)
        .put('/api/testuser/vocabulary/123')
        .send({
          chapter: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapter must be a positive integer');
    });
  });

  describe('DELETE /api/:username/vocabulary/:id', () => {
    it('should delete a vocabulary entry', async () => {
      (vocabularyManager.deleteEntry as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/testuser/vocabulary/123');

      expect(response.status).toBe(204);
      expect(vocabularyManager.deleteEntry).toHaveBeenCalledWith('testuser', '123');
    });

    it('should return 404 if entry not found', async () => {
      (vocabularyManager.deleteEntry as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/testuser/vocabulary/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Vocabulary entry not found');
    });
  });

  describe('POST /api/:username/vocabulary/translate', () => {
    it('should preview translations for a Chinese character', async () => {
      const mockPreview = {
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello'
      };

      (vocabularyManager.previewTranslations as jest.Mock).mockResolvedValue(mockPreview);

      const response = await request(app)
        .post('/api/testuser/vocabulary/translate')
        .send({
          chineseCharacter: '你好'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPreview);
      expect(vocabularyManager.previewTranslations).toHaveBeenCalledWith('你好');
    });

    it('should return 400 if chineseCharacter is missing', async () => {
      const response = await request(app)
        .post('/api/testuser/vocabulary/translate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chineseCharacter is required');
    });
  });

  describe('GET /api/:username/vocabulary/chapters', () => {
    it('should get available chapters for a user', async () => {
      const mockChapters = [1, 2, 3, 5];

      (vocabularyManager.getAvailableChapters as jest.Mock).mockResolvedValue(mockChapters);

      const response = await request(app)
        .get('/api/testuser/vocabulary/chapters');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockChapters);
      expect(vocabularyManager.getAvailableChapters).toHaveBeenCalledWith('testuser');
    });
  });

  describe('POST /api/:username/vocabulary/share', () => {
    it('should share chapter vocabulary from another user', async () => {
      (vocabularyManager.shareChapter as jest.Mock).mockResolvedValue(5);

      const response = await request(app)
        .post('/api/testuser/vocabulary/share')
        .send({
          sourceUsername: 'otheruser',
          chapter: 1
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Chapter vocabulary shared successfully',
        entriesCopied: 5
      });
      expect(vocabularyManager.shareChapter).toHaveBeenCalledWith('otheruser', 'testuser', 1);
    });

    it('should return 400 if sourceUsername is missing', async () => {
      const response = await request(app)
        .post('/api/testuser/vocabulary/share')
        .send({
          chapter: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('sourceUsername is required');
    });

    it('should return 400 if chapter is invalid', async () => {
      const response = await request(app)
        .post('/api/testuser/vocabulary/share')
        .send({
          sourceUsername: 'otheruser',
          chapter: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapter must be a positive integer');
    });
  });

  describe('GET /api/vocabulary/shared', () => {
    it('should get users with shared vocabulary for a chapter', async () => {
      const mockUsernames = ['user1', 'user2', 'user3'];

      (vocabularyManager.getSharedVocabularySources as jest.Mock).mockResolvedValue(mockUsernames);

      const response = await request(app)
        .get('/api/vocabulary/shared?chapter=1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUsernames);
      expect(vocabularyManager.getSharedVocabularySources).toHaveBeenCalledWith(1);
    });

    it('should return 400 if chapter parameter is missing', async () => {
      const response = await request(app)
        .get('/api/vocabulary/shared');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapter parameter is required');
    });

    it('should return 400 if chapter is invalid', async () => {
      const response = await request(app)
        .get('/api/vocabulary/shared?chapter=invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('chapter must be a positive integer');
    });
  });
});
