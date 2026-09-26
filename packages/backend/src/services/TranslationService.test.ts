import { TranslationService } from './TranslationService';
import { Translate } from '@google-cloud/translate/build/src/v2';

// Mock the Google Translate module
jest.mock('@google-cloud/translate/build/src/v2');

describe('TranslationService', () => {
  let service: TranslationService;
  let mockTranslate: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create mock translate instance
    mockTranslate = {
      translate: jest.fn()
    };

    // Mock the Translate constructor
    (Translate as jest.MockedClass<typeof Translate>).mockImplementation(() => mockTranslate);

    // Create service instance
    service = new TranslationService();
  });

  describe('translateToVietnamese', () => {
    it('should translate Chinese text to Vietnamese', async () => {
      const chineseText = '你好';
      const expectedTranslation = 'Xin chào';
      
      mockTranslate.translate.mockResolvedValue([expectedTranslation, {} as any]);

      const result = await service.translateToVietnamese(chineseText);

      expect(result).toBe(expectedTranslation);
      expect(mockTranslate.translate).toHaveBeenCalledWith(chineseText, {
        from: 'zh-CN',
        to: 'vi'
      });
    });

    it('should handle translation errors gracefully', async () => {
      const chineseText = '你好';
      const errorMessage = 'API quota exceeded';
      
      mockTranslate.translate.mockRejectedValue(new Error(errorMessage));

      await expect(service.translateToVietnamese(chineseText))
        .rejects
        .toThrow(`Failed to translate to Vietnamese: ${errorMessage}`);
    });

    it('should handle non-Error exceptions', async () => {
      const chineseText = '你好';
      
      mockTranslate.translate.mockRejectedValue('Unknown error');

      await expect(service.translateToVietnamese(chineseText))
        .rejects
        .toThrow('Failed to translate to Vietnamese: Unknown error');
    });
  });

  describe('translateToEnglish', () => {
    it('should translate Chinese text to English', async () => {
      const chineseText = '你好';
      const expectedTranslation = 'Hello';
      
      mockTranslate.translate.mockResolvedValue([expectedTranslation, {} as any]);

      const result = await service.translateToEnglish(chineseText);

      expect(result).toBe(expectedTranslation);
      expect(mockTranslate.translate).toHaveBeenCalledWith(chineseText, {
        from: 'zh-CN',
        to: 'en'
      });
    });

    it('should handle translation errors gracefully', async () => {
      const chineseText = '你好';
      const errorMessage = 'Network timeout';
      
      mockTranslate.translate.mockRejectedValue(new Error(errorMessage));

      await expect(service.translateToEnglish(chineseText))
        .rejects
        .toThrow(`Failed to translate to English: ${errorMessage}`);
    });
  });

  describe('batchTranslate', () => {
    it('should batch translate multiple texts to Vietnamese', async () => {
      const texts = ['你好', '再见', '谢谢'];
      const expectedTranslations = ['Xin chào', 'Tạm biệt', 'Cảm ơn'];
      
      mockTranslate.translate.mockResolvedValue([expectedTranslations, {} as any]);

      const result = await service.batchTranslate(texts, 'vi');

      expect(result).toEqual(expectedTranslations);
      expect(mockTranslate.translate).toHaveBeenCalledWith(texts, {
        from: 'zh-CN',
        to: 'vi'
      });
    });

    it('should batch translate multiple texts to English', async () => {
      const texts = ['你好', '再见'];
      const expectedTranslations = ['Hello', 'Goodbye'];
      
      mockTranslate.translate.mockResolvedValue([expectedTranslations, {} as any]);

      const result = await service.batchTranslate(texts, 'en');

      expect(result).toEqual(expectedTranslations);
      expect(mockTranslate.translate).toHaveBeenCalledWith(texts, {
        from: 'zh-CN',
        to: 'en'
      });
    });

    it('should return empty array for empty input', async () => {
      const result = await service.batchTranslate([], 'vi');

      expect(result).toEqual([]);
      expect(mockTranslate.translate).not.toHaveBeenCalled();
    });

    it('should handle single translation result as array', async () => {
      const texts = ['你好'];
      const singleTranslation = 'Xin chào';
      
      // API might return single string instead of array for single item
      mockTranslate.translate.mockResolvedValue([singleTranslation, {} as any]);

      const result = await service.batchTranslate(texts, 'vi');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([singleTranslation]);
    });

    it('should handle batch translation errors gracefully', async () => {
      const texts = ['你好', '再见'];
      const errorMessage = 'Batch size exceeded';
      
      mockTranslate.translate.mockRejectedValue(new Error(errorMessage));

      await expect(service.batchTranslate(texts, 'en'))
        .rejects
        .toThrow(`Failed to batch translate: ${errorMessage}`);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string translation', async () => {
      const emptyText = '';
      const expectedTranslation = '';
      
      mockTranslate.translate.mockResolvedValue([expectedTranslation, {} as any]);

      const result = await service.translateToVietnamese(emptyText);

      expect(result).toBe(expectedTranslation);
    });

    it('should handle special characters in text', async () => {
      const textWithSpecialChars = '你好！世界？';
      const expectedTranslation = 'Xin chào! Thế giới?';
      
      mockTranslate.translate.mockResolvedValue([expectedTranslation, {} as any]);

      const result = await service.translateToVietnamese(textWithSpecialChars);

      expect(result).toBe(expectedTranslation);
    });

    it('should handle long text translation', async () => {
      const longText = '这是一个很长的中文句子，用来测试翻译服务是否能够处理长文本。';
      const expectedTranslation = 'This is a very long Chinese sentence used to test whether the translation service can handle long text.';
      
      mockTranslate.translate.mockResolvedValue([expectedTranslation, {} as any]);

      const result = await service.translateToEnglish(longText);

      expect(result).toBe(expectedTranslation);
    });
  });
});
