/**
 * Integration tests for TTS API routes
 * Tests the actual TTS service integration
 */

import request from 'supertest';
import express from 'express';
import ttsRoutes from './tts.routes';

// Mock edge-tts to avoid import issues in Jest
jest.mock('edge-tts', () => ({
  ttsSave: jest.fn().mockResolvedValue(undefined)
}));

const app = express();
app.use(express.json());
app.use('/api', ttsRoutes);

describe('TTS Routes Integration', () => {
  describe('GET /api/tts/pronounce', () => {
    it('should generate real pronunciation audio for Chinese text', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('audioUrl');
      expect(response.body).toHaveProperty('format', 'mp3');
      expect(response.body).toHaveProperty('duration');
      expect(response.body.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(response.body.duration).toBeGreaterThan(0);
    });

    it('should generate audio for long Chinese text', async () => {
      const longText = '这是一个很长的中文句子，用来测试文本转语音服务是否能够处理长文本。';
      
      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: longText });

      expect(response.status).toBe(200);
      expect(response.body.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(response.body.duration).toBeGreaterThan(10);
    });

    it('should generate audio for single character', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '好' });

      expect(response.status).toBe(200);
      expect(response.body.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(response.body.duration).toBeGreaterThan(0);
    });

    it('should handle Chinese text with punctuation', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好！世界？' });

      expect(response.status).toBe(200);
      expect(response.body.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
    });

    it('should generate unique audio URLs for each request', async () => {
      const response1 = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好' });

      const response2 = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '你好' });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.audioUrl).not.toBe(response2.body.audioUrl);
    });

    it('should return 400 for empty text', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce')
        .query({ text: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing text parameter', async () => {
      const response = await request(app)
        .get('/api/tts/pronounce');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'text parameter is required' });
    });
  });
});
