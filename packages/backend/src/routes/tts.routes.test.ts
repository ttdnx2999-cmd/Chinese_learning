/**
 * Unit tests for TTS API routes
 */

import request from 'supertest';
import express from 'express';
import ttsRoutes from './tts.routes';
import { ttsService } from '../services/TTSService';

// Mock the TTSService
jest.mock('../services/TTSService', () => ({
  ttsService: {
    pronounce: jest.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/api', ttsRoutes);

describe('TTS Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tts/pronounce', () => {
    it('should generate pronunciation audio for valid Chinese text', async () => {
      const mockAudioData = {
        audioUrl: '/audio/test-123.mp3',
        format: 'mp3' as const,
        duration: 2
      };

      (ttsService.pronounce as jest.Mock).mockResolvedValue(mockAudioData);

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAudioData);
      expect(ttsService.pronounce).toHaveBeenCalledWith('你好');
    });

    it('should return 400 if text parameter is missing', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'text parameter is required' });
      expect(ttsService.pronounce).not.toHaveBeenCalled();
    });

    it('should return 400 if text parameter is empty string', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'text parameter is required' });
      expect(ttsService.pronounce).not.toHaveBeenCalled();
    });

    it('should return 400 if text parameter is whitespace only', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'text cannot be empty' });
      expect(ttsService.pronounce).not.toHaveBeenCalled();
    });

    it('should handle long Chinese text', async () => {
      const longText = '这是一个很长的中文句子，用来测试文本转语音服务。';
      const mockAudioData = {
        audioUrl: '/audio/test-456.mp3',
        format: 'mp3' as const,
        duration: 15
      };

      (ttsService.pronounce as jest.Mock).mockResolvedValue(mockAudioData);

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: longText });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAudioData);
      expect(ttsService.pronounce).toHaveBeenCalledWith(longText);
    });

    it('should handle Chinese text with punctuation', async () => {
      const textWithPunctuation = '你好！世界？';
      const mockAudioData = {
        audioUrl: '/audio/test-789.mp3',
        format: 'mp3' as const,
        duration: 3
      };

      (ttsService.pronounce as jest.Mock).mockResolvedValue(mockAudioData);

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: textWithPunctuation });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAudioData);
      expect(ttsService.pronounce).toHaveBeenCalledWith(textWithPunctuation);
    });

    it('should handle single Chinese character', async () => {
      const mockAudioData = {
        audioUrl: '/audio/test-single.mp3',
        format: 'mp3' as const,
        duration: 1
      };

      (ttsService.pronounce as jest.Mock).mockResolvedValue(mockAudioData);

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '好' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAudioData);
      expect(ttsService.pronounce).toHaveBeenCalledWith('好');
    });

    it('should return 500 if TTS service fails', async () => {
      (ttsService.pronounce as jest.Mock).mockRejectedValue(
        new Error('TTS service unavailable')
      );

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate pronunciation' });
    });

    it('should handle mixed Chinese and English text', async () => {
      const mixedText = '你好 Hello 世界';
      const mockAudioData = {
        audioUrl: '/audio/test-mixed.mp3',
        format: 'mp3' as const,
        duration: 4
      };

      (ttsService.pronounce as jest.Mock).mockResolvedValue(mockAudioData);

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: mixedText });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAudioData);
      expect(ttsService.pronounce).toHaveBeenCalledWith(mixedText);
    });

    it('should handle Chinese text with numbers', async () => {
      const textWithNumbers = '你好123';
      const mockAudioData = {
        audioUrl: '/audio/test-numbers.mp3',
        format: 'mp3' as const,
        duration: 3
      };

      (ttsService.pronounce as jest.Mock).mockResolvedValue(mockAudioData);

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: textWithNumbers });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAudioData);
      expect(ttsService.pronounce).toHaveBeenCalledWith(textWithNumbers);
    });

    it('should handle numeric text parameter (converted to string by Express)', async () => {
      const mockAudioData = {
        audioUrl: '/audio/test-numeric.mp3',
        format: 'mp3' as const,
        duration: 1
      };

      (ttsService.pronounce as jest.Mock).mockResolvedValue(mockAudioData);

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: 123 });

      // Express converts numeric query params to strings
      expect(response.status).toBe(200);
      expect(ttsService.pronounce).toHaveBeenCalledWith('123');
    });

    it('should handle service error with empty message', async () => {
      (ttsService.pronounce as jest.Mock).mockRejectedValue(
        new Error('Chinese text cannot be empty')
      );

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Chinese text cannot be empty' });
    });

    it('should handle non-Error exceptions from service', async () => {
      (ttsService.pronounce as jest.Mock).mockRejectedValue('Unknown error');

      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to generate pronunciation' });
    });
  });
});
