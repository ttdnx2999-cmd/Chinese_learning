/**
 * FlashcardEngine Service
 * 
 * Manages flashcard presentation logic and vocabulary selection.
 * Supports three flashcard modes: Chinese→Meanings, English→Chinese, Vietnamese→Chinese.
 */

import { VocabularyEntryDAO, VocabularyEntry } from '../models/VocabularyEntry';
import { ChapterFilter, ChapterRange } from './ChapterFilter';
import { v4 as uuidv4 } from 'uuid';

/**
 * Flashcard mode enumeration
 */
export enum FlashcardMode {
  ChineseToMeanings = 'ChineseToMeanings',
  EnglishToChinese = 'EnglishToChinese',
  VietnameseToChinese = 'VietnameseToChinese'
}

/**
 * Flashcard question interface
 */
export interface FlashcardQuestion {
  displayText: string;
  fieldType: 'chinese' | 'english' | 'vietnamese';
}

/**
 * Flashcard answer interface
 */
export interface FlashcardAnswer {
  chinese?: string;
  pinyin?: string;
  hanVietnamese?: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  learningNote?: string;
}

/**
 * Flashcard interface
 */
export interface Flashcard {
  id: string;
  mode: FlashcardMode;
  question: FlashcardQuestion;
  vocabularyId: string;
}

/**
 * FlashcardEngine class for managing flashcard presentation
 */
export class FlashcardEngine {
  private static flashcardCache: Map<string, VocabularyEntry> = new Map();

  /**
   * Get next flashcard for specified mode and chapter range
   * @param userId - Owner user ID
   * @param mode - Flashcard mode
   * @param chapterRange - Chapter range for vocabulary selection
   * @returns Flashcard with question
   */
  static async getNextCard(
    userId: number,
    mode: FlashcardMode,
    chapterRange: ChapterRange
  ): Promise<Flashcard> {
    // Validate chapter range
    const isValid = await ChapterFilter.validateRange(userId, chapterRange);
    if (!isValid) {
      throw new Error('Invalid chapter range or no vocabulary available');
    }

    // Get vocabulary IDs in range
    const vocabularyIds = await ChapterFilter.getVocabularyInRange(userId, chapterRange);
    
    if (vocabularyIds.length === 0) {
      throw new Error('No vocabulary found in specified chapter range');
    }

    // Select random vocabulary ID
    const randomIndex = Math.floor(Math.random() * vocabularyIds.length);
    const selectedId = vocabularyIds[randomIndex];

    // Fetch vocabulary entry
    const entry = await VocabularyEntryDAO.findById(userId, selectedId);
    
    if (!entry) {
      throw new Error('Selected vocabulary entry not found');
    }

    // Generate flashcard ID and cache the entry
    const flashcardId = uuidv4();
    this.flashcardCache.set(flashcardId, entry);

    // Format question based on mode
    const question = this.formatQuestion(entry, mode);

    return {
      id: flashcardId,
      mode,
      question,
      vocabularyId: entry.id
    };
  }

  /**
   * Reveal answer for current flashcard
   * @param flashcardId - Flashcard ID
   * @returns Flashcard answer with mode-specific fields
   */
  static async revealAnswer(flashcardId: string): Promise<FlashcardAnswer> {
    // Retrieve cached vocabulary entry
    const entry = this.flashcardCache.get(flashcardId);
    
    if (!entry) {
      throw new Error('Flashcard not found or expired');
    }

    // Format answer based on the flashcard mode (inferred from entry)
    // Since we don't store mode with cache, we return all relevant fields
    // and let the client decide what to display based on their mode
    const answer: FlashcardAnswer = {
      chinese: entry.chineseCharacter,
      pinyin: entry.pinyin,
      hanVietnamese: entry.hanVietnamese,
      modernVietnamese: entry.modernVietnamese,
      englishMeaning: entry.englishMeaning,
      learningNote: entry.learningNote
    };

    // Clean up cache after revealing answer
    this.flashcardCache.delete(flashcardId);

    return answer;
  }

  /**
   * Format question based on flashcard mode
   * @param entry - Vocabulary entry
   * @param mode - Flashcard mode
   * @returns Formatted question
   */
  private static formatQuestion(entry: VocabularyEntry, mode: FlashcardMode): FlashcardQuestion {
    switch (mode) {
      case FlashcardMode.ChineseToMeanings:
        return {
          displayText: entry.chineseCharacter,
          fieldType: 'chinese'
        };
      
      case FlashcardMode.EnglishToChinese:
        return {
          displayText: entry.englishMeaning || '',
          fieldType: 'english'
        };
      
      case FlashcardMode.VietnameseToChinese:
        return {
          displayText: entry.modernVietnamese || '',
          fieldType: 'vietnamese'
        };
      
      default:
        throw new Error(`Unsupported flashcard mode: ${mode}`);
    }
  }

  /**
   * Clear expired flashcards from cache
   * This method can be called periodically to prevent memory leaks
   */
  static clearCache(): void {
    this.flashcardCache.clear();
  }
}
