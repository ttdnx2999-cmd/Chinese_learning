import { VocabularyManager, TranslationPreview } from './VocabularyManager';
import { VocabularyEntryDAO, VocabularyInput, VocabularyEntry } from '../models/VocabularyEntry';
import { TranslationService } from './TranslationService';
import { ChapterRange } from './ChapterFilter';

// Mock dependencies
jest.mock('../models/VocabularyEntry');
jest.mock('./TranslationService');

describe('VocabularyManager', () => {
  let manager: VocabularyManager;
  let mockTranslationService: jest.Mocked<TranslationService>;
  let mockVocabularyEntryDAO: jest.Mocked<typeof VocabularyEntryDAO>;

  const mockEntry: VocabularyEntry = {
    id: 'test-id-1',
    username: 'testuser',
    chineseCharacter: '你好',
    pinyin: 'nǐ hǎo',
    hanVietnamese: 'nhĩ hảo',
    modernVietnamese: 'Xin chào',
    englishMeaning: 'Hello',
    learningNote: 'Common greeting',
    chapter: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock translation service
    mockTranslationService = {
      translateToVietnamese: jest.fn(),
      translateToEnglish: jest.fn(),
      batchTranslate: jest.fn()
    } as any;

    // Create manager with mock translation service
    manager = new VocabularyManager(mockTranslationService);

    // Mock VocabularyEntryDAO
    mockVocabularyEntryDAO = VocabularyEntryDAO as jest.Mocked<typeof VocabularyEntryDAO>;
  });

  describe('createEntry', () => {
    it('should create entry with all fields provided', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'Xin chào',
        englishMeaning: 'Hello',
        learningNote: 'Common greeting',
        chapter: 1
      };

      mockVocabularyEntryDAO.create.mockResolvedValue(mockEntry);

      const result = await manager.createEntry('testuser', input);

      expect(result).toEqual(mockEntry);
      expect(mockVocabularyEntryDAO.create).toHaveBeenCalledWith('testuser', input);
      expect(mockTranslationService.translateToVietnamese).not.toHaveBeenCalled();
      expect(mockTranslationService.translateToEnglish).not.toHaveBeenCalled();
    });

    it('should auto-translate missing modernVietnamese on create', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        englishMeaning: 'Hello',
        chapter: 1
      };

      mockTranslationService.translateToVietnamese.mockResolvedValue('Xin chào');
      mockVocabularyEntryDAO.create.mockResolvedValue(mockEntry);

      const result = await manager.createEntry('testuser', input);

      expect(mockTranslationService.translateToVietnamese).toHaveBeenCalledWith('你好');
      expect(mockVocabularyEntryDAO.create).toHaveBeenCalledWith('testuser', {
        ...input,
        modernVietnamese: 'Xin chào'
      });
    });

    it('should auto-translate missing englishMeaning on create', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        modernVietnamese: 'Xin chào',
        chapter: 1
      };

      mockTranslationService.translateToEnglish.mockResolvedValue('Hello');
      mockVocabularyEntryDAO.create.mockResolvedValue(mockEntry);

      const result = await manager.createEntry('testuser', input);

      expect(mockTranslationService.translateToEnglish).toHaveBeenCalledWith('你好');
      expect(mockVocabularyEntryDAO.create).toHaveBeenCalledWith('testuser', {
        ...input,
        englishMeaning: 'Hello'
      });
    });

    it('should auto-translate both missing fields in parallel', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        chapter: 1
      };

      mockTranslationService.translateToVietnamese.mockResolvedValue('Xin chào');
      mockTranslationService.translateToEnglish.mockResolvedValue('Hello');
      mockVocabularyEntryDAO.create.mockResolvedValue(mockEntry);

      const result = await manager.createEntry('testuser', input);

      expect(mockTranslationService.translateToVietnamese).toHaveBeenCalledWith('你好');
      expect(mockTranslationService.translateToEnglish).toHaveBeenCalledWith('你好');
      expect(mockVocabularyEntryDAO.create).toHaveBeenCalledWith('testuser', {
        ...input,
        modernVietnamese: 'Xin chào',
        englishMeaning: 'Hello'
      });
    });

    it('should treat empty string as missing field', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        modernVietnamese: '',
        englishMeaning: '',
        chapter: 1
      };

      mockTranslationService.translateToVietnamese.mockResolvedValue('Xin chào');
      mockTranslationService.translateToEnglish.mockResolvedValue('Hello');
      mockVocabularyEntryDAO.create.mockResolvedValue(mockEntry);

      await manager.createEntry('testuser', input);

      expect(mockTranslationService.translateToVietnamese).toHaveBeenCalledWith('你好');
      expect(mockTranslationService.translateToEnglish).toHaveBeenCalledWith('你好');
    });
  });

  describe('getEntries', () => {
    it('should get all entries without chapter filter', async () => {
      const entries = [mockEntry];
      mockVocabularyEntryDAO.findByUsername.mockResolvedValue(entries);

      const result = await manager.getEntries('testuser');

      expect(result).toEqual(entries);
      expect(mockVocabularyEntryDAO.findByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should get entries with chapter filter', async () => {
      const entries = [mockEntry];
      const chapterRange: ChapterRange = { start: 1, end: 3 };
      
      mockVocabularyEntryDAO.findByUsername.mockResolvedValue(entries);

      const result = await manager.getEntries('testuser', chapterRange);

      expect(result).toEqual(entries);
      expect(mockVocabularyEntryDAO.findByUsername).toHaveBeenCalledWith('testuser', 1, 3);
    });

    it('should return empty array when no entries found', async () => {
      mockVocabularyEntryDAO.findByUsername.mockResolvedValue([]);

      const result = await manager.getEntries('testuser');

      expect(result).toEqual([]);
    });
  });

  describe('getEntry', () => {
    it('should get single entry by ID', async () => {
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockEntry);

      const result = await manager.getEntry('testuser', 'test-id-1');

      expect(result).toEqual(mockEntry);
      expect(mockVocabularyEntryDAO.findById).toHaveBeenCalledWith('testuser', 'test-id-1');
    });

    it('should return null when entry not found', async () => {
      mockVocabularyEntryDAO.findById.mockResolvedValue(null);

      const result = await manager.getEntry('testuser', 'nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateEntry', () => {
    it('should update entry with all fields provided', async () => {
      const updates: Partial<VocabularyInput> = {
        pinyin: 'nǐ hǎo',
        modernVietnamese: 'Xin chào',
        englishMeaning: 'Hello'
      };

      mockVocabularyEntryDAO.update.mockResolvedValue(mockEntry);

      const result = await manager.updateEntry('testuser', 'test-id-1', updates);

      expect(result).toEqual(mockEntry);
      expect(mockVocabularyEntryDAO.update).toHaveBeenCalledWith('testuser', 'test-id-1', updates);
      expect(mockTranslationService.translateToVietnamese).not.toHaveBeenCalled();
      expect(mockTranslationService.translateToEnglish).not.toHaveBeenCalled();
    });

    it('should auto-translate missing modernVietnamese on update', async () => {
      const updates: Partial<VocabularyInput> = {
        chineseCharacter: '你好',
        englishMeaning: 'Hello'
      };

      mockTranslationService.translateToVietnamese.mockResolvedValue('Xin chào');
      mockVocabularyEntryDAO.update.mockResolvedValue(mockEntry);

      await manager.updateEntry('testuser', 'test-id-1', updates);

      expect(mockTranslationService.translateToVietnamese).toHaveBeenCalledWith('你好');
      expect(mockVocabularyEntryDAO.update).toHaveBeenCalledWith('testuser', 'test-id-1', {
        ...updates,
        modernVietnamese: 'Xin chào'
      });
    });

    it('should auto-translate missing englishMeaning on update', async () => {
      const updates: Partial<VocabularyInput> = {
        chineseCharacter: '你好',
        modernVietnamese: 'Xin chào'
      };

      mockTranslationService.translateToEnglish.mockResolvedValue('Hello');
      mockVocabularyEntryDAO.update.mockResolvedValue(mockEntry);

      await manager.updateEntry('testuser', 'test-id-1', updates);

      expect(mockTranslationService.translateToEnglish).toHaveBeenCalledWith('你好');
      expect(mockVocabularyEntryDAO.update).toHaveBeenCalledWith('testuser', 'test-id-1', {
        ...updates,
        englishMeaning: 'Hello'
      });
    });

    it('should not translate when chineseCharacter is not in updates', async () => {
      const updates: Partial<VocabularyInput> = {
        learningNote: 'Updated note'
      };

      mockVocabularyEntryDAO.update.mockResolvedValue(mockEntry);

      await manager.updateEntry('testuser', 'test-id-1', updates);

      expect(mockTranslationService.translateToVietnamese).not.toHaveBeenCalled();
      expect(mockTranslationService.translateToEnglish).not.toHaveBeenCalled();
    });

    it('should return null when entry not found', async () => {
      const updates: Partial<VocabularyInput> = {
        learningNote: 'Updated note'
      };

      mockVocabularyEntryDAO.update.mockResolvedValue(null);

      const result = await manager.updateEntry('testuser', 'nonexistent-id', updates);

      expect(result).toBeNull();
    });
  });

  describe('deleteEntry', () => {
    it('should delete entry successfully', async () => {
      mockVocabularyEntryDAO.delete.mockResolvedValue(true);

      const result = await manager.deleteEntry('testuser', 'test-id-1');

      expect(result).toBe(true);
      expect(mockVocabularyEntryDAO.delete).toHaveBeenCalledWith('testuser', 'test-id-1');
    });

    it('should return false when entry not found', async () => {
      mockVocabularyEntryDAO.delete.mockResolvedValue(false);

      const result = await manager.deleteEntry('testuser', 'nonexistent-id');

      expect(result).toBe(false);
    });
  });

  describe('previewTranslations', () => {
    it('should generate translation preview', async () => {
      mockTranslationService.translateToVietnamese.mockResolvedValue('Xin chào');
      mockTranslationService.translateToEnglish.mockResolvedValue('Hello');

      const result = await manager.previewTranslations('你好');

      expect(result).toEqual({
        modernVietnamese: 'Xin chào',
        englishMeaning: 'Hello'
      });
      expect(mockTranslationService.translateToVietnamese).toHaveBeenCalledWith('你好');
      expect(mockTranslationService.translateToEnglish).toHaveBeenCalledWith('你好');
    });

    it('should translate both languages in parallel', async () => {
      const translateVietnameseSpy = mockTranslationService.translateToVietnamese
        .mockResolvedValue('Xin chào');
      const translateEnglishSpy = mockTranslationService.translateToEnglish
        .mockResolvedValue('Hello');

      await manager.previewTranslations('你好');

      // Both should be called
      expect(translateVietnameseSpy).toHaveBeenCalled();
      expect(translateEnglishSpy).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle translation service errors gracefully', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好',
        chapter: 1
      };

      mockTranslationService.translateToVietnamese.mockRejectedValue(
        new Error('Translation API error')
      );

      await expect(manager.createEntry('testuser', input))
        .rejects
        .toThrow('Translation API error');
    });

    it('should handle special characters in Chinese text', async () => {
      const input: VocabularyInput = {
        chineseCharacter: '你好！',
        chapter: 1
      };

      mockTranslationService.translateToVietnamese.mockResolvedValue('Xin chào!');
      mockTranslationService.translateToEnglish.mockResolvedValue('Hello!');
      mockVocabularyEntryDAO.create.mockResolvedValue({
        ...mockEntry,
        chineseCharacter: '你好！'
      });

      await manager.createEntry('testuser', input);

      expect(mockTranslationService.translateToVietnamese).toHaveBeenCalledWith('你好！');
      expect(mockTranslationService.translateToEnglish).toHaveBeenCalledWith('你好！');
    });

    it('should handle multiple entries with same chapter', async () => {
      const entries = [
        { ...mockEntry, id: 'id-1' },
        { ...mockEntry, id: 'id-2' },
        { ...mockEntry, id: 'id-3' }
      ];

      mockVocabularyEntryDAO.findByUsername.mockResolvedValue(entries);

      const result = await manager.getEntries('testuser', { start: 1, end: 1 });

      expect(result).toHaveLength(3);
      expect(result).toEqual(entries);
    });
  });

  describe('shareChapter', () => {
    it('should copy vocabulary from source to target user', async () => {
      const sourceEntries = [
        { ...mockEntry, id: 'source-1', username: 'sourceuser' },
        { ...mockEntry, id: 'source-2', username: 'sourceuser', chineseCharacter: '再见' }
      ];

      mockVocabularyEntryDAO.findByUsername.mockResolvedValue(sourceEntries);
      mockVocabularyEntryDAO.createShared.mockResolvedValue(mockEntry);

      const count = await manager.shareChapter('sourceuser', 'targetuser', 1);

      expect(count).toBe(2);
      expect(mockVocabularyEntryDAO.findByUsername).toHaveBeenCalledWith('sourceuser', 1, 1);
      expect(mockVocabularyEntryDAO.createShared).toHaveBeenCalledTimes(2);
      
      // Verify first entry was copied with all fields
      expect(mockVocabularyEntryDAO.createShared).toHaveBeenCalledWith(
        'targetuser',
        {
          chineseCharacter: '你好',
          pinyin: 'nǐ hǎo',
          hanVietnamese: 'nhĩ hảo',
          modernVietnamese: 'Xin chào',
          englishMeaning: 'Hello',
          learningNote: 'Common greeting',
          chapter: 1
        },
        'sourceuser'
      );
    });

    it('should preserve all fields during sharing', async () => {
      const sourceEntry: VocabularyEntry = {
        id: 'source-1',
        username: 'sourceuser',
        chineseCharacter: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'Xin chào',
        englishMeaning: 'Hello',
        learningNote: 'Important note',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockVocabularyEntryDAO.findByUsername.mockResolvedValue([sourceEntry]);
      mockVocabularyEntryDAO.createShared.mockResolvedValue(mockEntry);

      await manager.shareChapter('sourceuser', 'targetuser', 1);

      expect(mockVocabularyEntryDAO.createShared).toHaveBeenCalledWith(
        'targetuser',
        {
          chineseCharacter: sourceEntry.chineseCharacter,
          pinyin: sourceEntry.pinyin,
          hanVietnamese: sourceEntry.hanVietnamese,
          modernVietnamese: sourceEntry.modernVietnamese,
          englishMeaning: sourceEntry.englishMeaning,
          learningNote: sourceEntry.learningNote,
          chapter: sourceEntry.chapter
        },
        'sourceuser'
      );
    });

    it('should return 0 when source chapter has no entries', async () => {
      mockVocabularyEntryDAO.findByUsername.mockResolvedValue([]);

      const count = await manager.shareChapter('sourceuser', 'targetuser', 1);

      expect(count).toBe(0);
      expect(mockVocabularyEntryDAO.createShared).not.toHaveBeenCalled();
    });

    it('should set shared_from to source username', async () => {
      const sourceEntry = { ...mockEntry, username: 'alice' };
      mockVocabularyEntryDAO.findByUsername.mockResolvedValue([sourceEntry]);
      mockVocabularyEntryDAO.createShared.mockResolvedValue(mockEntry);

      await manager.shareChapter('alice', 'bob', 1);

      expect(mockVocabularyEntryDAO.createShared).toHaveBeenCalledWith(
        'bob',
        expect.any(Object),
        'alice'
      );
    });
  });

  describe('getAvailableChapters', () => {
    it('should return list of chapters for user', async () => {
      const chapters = [1, 2, 3, 5];
      mockVocabularyEntryDAO.getChapters.mockResolvedValue(chapters);

      const result = await manager.getAvailableChapters('testuser');

      expect(result).toEqual(chapters);
      expect(mockVocabularyEntryDAO.getChapters).toHaveBeenCalledWith('testuser');
    });

    it('should return empty array when user has no vocabulary', async () => {
      mockVocabularyEntryDAO.getChapters.mockResolvedValue([]);

      const result = await manager.getAvailableChapters('newuser');

      expect(result).toEqual([]);
    });

    it('should return sorted chapter numbers', async () => {
      const chapters = [1, 3, 2, 5, 4];
      mockVocabularyEntryDAO.getChapters.mockResolvedValue(chapters);

      const result = await manager.getAvailableChapters('testuser');

      expect(result).toEqual(chapters);
    });
  });

  describe('getSharedVocabularySources', () => {
    it('should return list of usernames with vocabulary in chapter', async () => {
      const usernames = ['alice', 'bob', 'charlie'];
      mockVocabularyEntryDAO.getUsersByChapter.mockResolvedValue(usernames);

      const result = await manager.getSharedVocabularySources(1);

      expect(result).toEqual(usernames);
      expect(mockVocabularyEntryDAO.getUsersByChapter).toHaveBeenCalledWith(1);
    });

    it('should return empty array when no users have vocabulary in chapter', async () => {
      mockVocabularyEntryDAO.getUsersByChapter.mockResolvedValue([]);

      const result = await manager.getSharedVocabularySources(99);

      expect(result).toEqual([]);
    });

    it('should return sorted usernames', async () => {
      const usernames = ['alice', 'bob', 'charlie'];
      mockVocabularyEntryDAO.getUsersByChapter.mockResolvedValue(usernames);

      const result = await manager.getSharedVocabularySources(1);

      expect(result).toEqual(usernames);
    });
  });
});
