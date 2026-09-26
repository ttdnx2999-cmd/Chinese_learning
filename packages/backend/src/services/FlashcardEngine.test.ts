/**
 * FlashcardEngine Tests
 * 
 * Unit tests for FlashcardEngine service covering all three flashcard modes
 * and integration with ChapterFilter and VocabularyEntry.
 */

import { FlashcardEngine, FlashcardMode, Flashcard, FlashcardAnswer } from './FlashcardEngine';
import { VocabularyEntryDAO, VocabularyEntry } from '../models/VocabularyEntry';
import { ChapterFilter, ChapterRange } from './ChapterFilter';

// Mock dependencies
jest.mock('../models/VocabularyEntry');
jest.mock('./ChapterFilter');

const mockVocabularyEntryDAO = VocabularyEntryDAO as jest.Mocked<typeof VocabularyEntryDAO>;
const mockChapterFilter = ChapterFilter as jest.Mocked<typeof ChapterFilter>;

describe('FlashcardEngine', () => {
  const testUsername = 'testuser';
  const testChapterRange: ChapterRange = { start: 1, end: 5 };

  const mockVocabularyEntry: VocabularyEntry = {
    id: 'vocab-123',
    username: testUsername,
    chineseCharacter: '你好',
    pinyin: 'nǐ hǎo',
    hanVietnamese: 'nhĩ hảo',
    modernVietnamese: 'xin chào',
    englishMeaning: 'hello',
    learningNote: 'Common greeting',
    chapter: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    FlashcardEngine.clearCache();
  });

  describe('getNextCard', () => {
    it('should return a flashcard with Chinese question for ChineseToMeanings mode', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      // Act
      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Assert
      expect(flashcard).toBeDefined();
      expect(flashcard.mode).toBe(FlashcardMode.ChineseToMeanings);
      expect(flashcard.question.displayText).toBe('你好');
      expect(flashcard.question.fieldType).toBe('chinese');
      expect(flashcard.vocabularyId).toBe('vocab-123');
      expect(mockChapterFilter.validateRange).toHaveBeenCalledWith(testUsername, testChapterRange);
      expect(mockChapterFilter.getVocabularyInRange).toHaveBeenCalledWith(testUsername, testChapterRange);
    });

    it('should return a flashcard with English question for EnglishToChinese mode', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      // Act
      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.EnglishToChinese,
        testChapterRange
      );

      // Assert
      expect(flashcard.mode).toBe(FlashcardMode.EnglishToChinese);
      expect(flashcard.question.displayText).toBe('hello');
      expect(flashcard.question.fieldType).toBe('english');
    });

    it('should return a flashcard with Vietnamese question for VietnameseToChinese mode', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      // Act
      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.VietnameseToChinese,
        testChapterRange
      );

      // Assert
      expect(flashcard.mode).toBe(FlashcardMode.VietnameseToChinese);
      expect(flashcard.question.displayText).toBe('xin chào');
      expect(flashcard.question.fieldType).toBe('vietnamese');
    });

    it('should throw error when chapter range is invalid', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(false);

      // Act & Assert
      await expect(
        FlashcardEngine.getNextCard(testUsername, FlashcardMode.ChineseToMeanings, testChapterRange)
      ).rejects.toThrow('Invalid chapter range or no vocabulary available');
    });

    it('should throw error when no vocabulary found in range', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue([]);

      // Act & Assert
      await expect(
        FlashcardEngine.getNextCard(testUsername, FlashcardMode.ChineseToMeanings, testChapterRange)
      ).rejects.toThrow('No vocabulary found in specified chapter range');
    });

    it('should throw error when selected vocabulary entry not found', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        FlashcardEngine.getNextCard(testUsername, FlashcardMode.ChineseToMeanings, testChapterRange)
      ).rejects.toThrow('Selected vocabulary entry not found');
    });

    it('should select random vocabulary from multiple entries', async () => {
      // Arrange
      const vocabularyIds = ['vocab-1', 'vocab-2', 'vocab-3', 'vocab-4', 'vocab-5'];
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(vocabularyIds);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      // Act
      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Assert
      expect(flashcard).toBeDefined();
      expect(mockVocabularyEntryDAO.findById).toHaveBeenCalledWith(
        testUsername,
        expect.stringMatching(/vocab-\d/)
      );
    });

    it('should handle vocabulary entry with missing optional fields', async () => {
      // Arrange
      const minimalEntry: VocabularyEntry = {
        id: 'vocab-minimal',
        username: testUsername,
        chineseCharacter: '好',
        pinyin: 'hǎo',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-minimal']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(minimalEntry);

      // Act
      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.EnglishToChinese,
        testChapterRange
      );

      // Assert
      expect(flashcard.question.displayText).toBe('');
      expect(flashcard.question.fieldType).toBe('english');
    });
  });

  describe('revealAnswer', () => {
    it('should return complete answer for ChineseToMeanings mode', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Act
      const answer = await FlashcardEngine.revealAnswer(flashcard.id);

      // Assert
      expect(answer).toEqual({
        chinese: '你好',
        pinyin: 'nǐ hǎo',
        hanVietnamese: 'nhĩ hảo',
        modernVietnamese: 'xin chào',
        englishMeaning: 'hello',
        learningNote: 'Common greeting'
      });
    });

    it('should return answer for EnglishToChinese mode', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.EnglishToChinese,
        testChapterRange
      );

      // Act
      const answer = await FlashcardEngine.revealAnswer(flashcard.id);

      // Assert
      expect(answer.chinese).toBe('你好');
      expect(answer.pinyin).toBe('nǐ hǎo');
    });

    it('should return answer for VietnameseToChinese mode', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.VietnameseToChinese,
        testChapterRange
      );

      // Act
      const answer = await FlashcardEngine.revealAnswer(flashcard.id);

      // Assert
      expect(answer.chinese).toBe('你好');
      expect(answer.pinyin).toBe('nǐ hǎo');
    });

    it('should throw error when flashcard ID not found', async () => {
      // Act & Assert
      await expect(
        FlashcardEngine.revealAnswer('non-existent-id')
      ).rejects.toThrow('Flashcard not found or expired');
    });

    it('should remove flashcard from cache after revealing answer', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Act
      await FlashcardEngine.revealAnswer(flashcard.id);

      // Assert - second call should fail
      await expect(
        FlashcardEngine.revealAnswer(flashcard.id)
      ).rejects.toThrow('Flashcard not found or expired');
    });

    it('should handle answer with undefined optional fields', async () => {
      // Arrange
      const minimalEntry: VocabularyEntry = {
        id: 'vocab-minimal',
        username: testUsername,
        chineseCharacter: '好',
        pinyin: 'hǎo',
        chapter: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-minimal']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(minimalEntry);

      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Act
      const answer = await FlashcardEngine.revealAnswer(flashcard.id);

      // Assert
      expect(answer.chinese).toBe('好');
      expect(answer.pinyin).toBe('hǎo');
      expect(answer.hanVietnamese).toBeUndefined();
      expect(answer.modernVietnamese).toBeUndefined();
      expect(answer.englishMeaning).toBeUndefined();
      expect(answer.learningNote).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached flashcards', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      const flashcard = await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Act
      FlashcardEngine.clearCache();

      // Assert
      await expect(
        FlashcardEngine.revealAnswer(flashcard.id)
      ).rejects.toThrow('Flashcard not found or expired');
    });
  });

  describe('Integration with ChapterFilter', () => {
    it('should use ChapterFilter to validate range before generating flashcard', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      // Act
      await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Assert
      expect(mockChapterFilter.validateRange).toHaveBeenCalledWith(testUsername, testChapterRange);
      expect(mockChapterFilter.getVocabularyInRange).toHaveBeenCalledWith(testUsername, testChapterRange);
    });

    it('should use ChapterFilter to get vocabulary IDs in range', async () => {
      // Arrange
      mockChapterFilter.validateRange.mockResolvedValue(true);
      mockChapterFilter.getVocabularyInRange.mockResolvedValue(['vocab-123']);
      mockVocabularyEntryDAO.findById.mockResolvedValue(mockVocabularyEntry);

      // Act
      await FlashcardEngine.getNextCard(
        testUsername,
        FlashcardMode.ChineseToMeanings,
        testChapterRange
      );

      // Assert
      expect(mockChapterFilter.getVocabularyInRange).toHaveBeenCalledWith(
        testUsername,
        testChapterRange
      );
    });
  });
});
