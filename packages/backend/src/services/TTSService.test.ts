import { TTSService } from './TTSService';
import { unlink } from 'fs/promises';

// Mock the edge-tts module
jest.mock('edge-tts', () => ({
  ttsSave: jest.fn()
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  unlink: jest.fn()
}));

describe('TTSService', () => {
  let service: TTSService;
  let mockTtsSave: jest.Mock;

  beforeEach(() => {
    // Get the mocked ttsSave function
    const edgeTTS = require('edge-tts');
    mockTtsSave = edgeTTS.ttsSave;
    
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock implementation to default success
    mockTtsSave.mockResolvedValue(undefined);

    // Create service instance
    service = new TTSService();
  });

  describe('pronounce', () => {
    it('should generate pronunciation audio for Chinese text', async () => {
      const chineseText = '你好';

      const result = await service.pronounce(chineseText);

      expect(result).toHaveProperty('audioUrl');
      expect(result).toHaveProperty('format', 'mp3');
      expect(result).toHaveProperty('duration');
      expect(result.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(result.duration).toBeGreaterThan(0);
      expect(mockTtsSave).toHaveBeenCalledWith(
        chineseText,
        expect.stringContaining('.mp3'),
        { voice: 'zh-CN-XiaoxiaoNeural' }
      );
    });

    it('should estimate duration based on text length', async () => {
      const shortText = '你';
      const longText = '你好世界';

      const shortResult = await service.pronounce(shortText);
      const longResult = await service.pronounce(longText);

      expect(longResult.duration).toBeGreaterThan(shortResult.duration);
    });

    it('should throw error for empty text', async () => {
      await expect(service.pronounce(''))
        .rejects
        .toThrow('Chinese text cannot be empty');

      expect(mockTtsSave).not.toHaveBeenCalled();
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(service.pronounce('   '))
        .rejects
        .toThrow('Chinese text cannot be empty');

      expect(mockTtsSave).not.toHaveBeenCalled();
    });

    it('should handle TTS generation errors gracefully', async () => {
      const chineseText = '你好';
      const errorMessage = 'TTS service unavailable';

      mockTtsSave.mockRejectedValue(new Error(errorMessage));

      await expect(service.pronounce(chineseText))
        .rejects
        .toThrow(`Failed to generate pronunciation: ${errorMessage}`);
    });

    it('should handle non-Error exceptions', async () => {
      const chineseText = '你好';

      mockTtsSave.mockRejectedValue('Unknown error');

      await expect(service.pronounce(chineseText))
        .rejects
        .toThrow('Failed to generate pronunciation: Unknown error');
    });

    it('should generate unique audio URLs for each call', async () => {
      const chineseText = '你好';

      const result1 = await service.pronounce(chineseText);
      const result2 = await service.pronounce(chineseText);

      expect(result1.audioUrl).not.toBe(result2.audioUrl);
    });

    it('should handle long Chinese text', async () => {
      const longText = '这是一个很长的中文句子，用来测试文本转语音服务是否能够处理长文本。';

      const result = await service.pronounce(longText);

      expect(result.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(result.duration).toBeGreaterThan(10); // Long text should have longer duration
      expect(mockTtsSave).toHaveBeenCalledWith(
        longText,
        expect.stringContaining('.mp3'),
        { voice: 'zh-CN-XiaoxiaoNeural' }
      );
    });

    it('should handle Chinese text with punctuation', async () => {
      const textWithPunctuation = '你好！世界？';

      const result = await service.pronounce(textWithPunctuation);

      expect(result.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(mockTtsSave).toHaveBeenCalledWith(
        textWithPunctuation,
        expect.stringContaining('.mp3'),
        { voice: 'zh-CN-XiaoxiaoNeural' }
      );
    });

    it('should return mp3 format', async () => {
      const chineseText = '你好';

      const result = await service.pronounce(chineseText);

      expect(result.format).toBe('mp3');
    });
  });

  describe('cleanup', () => {
    it('should clean up temporary audio file', async () => {
      const audioUrl = '/audio/test-file.mp3';

      await service.cleanup(audioUrl);

      expect(unlink).toHaveBeenCalledWith(
        expect.stringContaining('test-file.mp3')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const audioUrl = '/audio/test-file.mp3';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (unlink as jest.Mock).mockRejectedValue(new Error('File not found'));

      // Should not throw
      await expect(service.cleanup(audioUrl)).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid audio URL gracefully', async () => {
      const invalidUrl = 'invalid-url';

      // Should not throw
      await expect(service.cleanup(invalidUrl)).resolves.toBeUndefined();
    });

    it('should handle empty audio URL', async () => {
      const emptyUrl = '';

      // Should not throw
      await expect(service.cleanup(emptyUrl)).resolves.toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle single Chinese character', async () => {
      const singleChar = '好';

      const result = await service.pronounce(singleChar);

      expect(result.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle mixed Chinese and numbers', async () => {
      const mixedText = '你好123';

      const result = await service.pronounce(mixedText);

      expect(result.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(mockTtsSave).toHaveBeenCalledWith(
        mixedText,
        expect.stringContaining('.mp3'),
        { voice: 'zh-CN-XiaoxiaoNeural' }
      );
    });

    it('should handle Chinese text with English words', async () => {
      const mixedText = '你好 Hello 世界';

      const result = await service.pronounce(mixedText);

      expect(result.audioUrl).toMatch(/^\/audio\/.+\.mp3$/);
      expect(mockTtsSave).toHaveBeenCalledWith(
        mixedText,
        expect.stringContaining('.mp3'),
        { voice: 'zh-CN-XiaoxiaoNeural' }
      );
    });
  });
});
