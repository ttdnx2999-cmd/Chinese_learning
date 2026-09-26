/**
 * VocabularyManager Service
 * 
 * Handles vocabulary CRUD operations with automatic translation for missing fields.
 * Implements user isolation by userId and chapter filtering.
 */

import { VocabularyEntryDAO, VocabularyInput, VocabularyEntry } from '../models/VocabularyEntry';
import { TranslationService } from './TranslationService';
import { ChapterRange } from './ChapterFilter';
import pinyin from 'pinyin';

/**
 * Translation preview interface for manual translation before save
 */
export interface TranslationPreview {
  pinyin: string;
  modernVietnamese: string;
  englishMeaning: string;
}

/**
 * VocabularyManager class for managing vocabulary entries
 * All methods use userId (number) for user isolation.
 */
export class VocabularyManager {
  private translationService: TranslationService;

  constructor(translationService?: TranslationService) {
    this.translationService = translationService || new TranslationService();
  }

  /**
   * Create new vocabulary entry with automatic translation for missing fields
   */
  async createEntry(userId: number, username: string, entry: VocabularyInput): Promise<VocabularyEntry> {
    const entryWithTranslations = await this.applyAutoTranslation(entry) as VocabularyInput;
    return await VocabularyEntryDAO.create(userId, username, entryWithTranslations);
  }

  /**
   * Get vocabulary entries for user with optional chapter filtering
   */
  async getEntries(userId: number, chapterRange?: ChapterRange): Promise<VocabularyEntry[]> {
    if (chapterRange) {
      return await VocabularyEntryDAO.findByUserId(userId, chapterRange.start, chapterRange.end);
    }
    return await VocabularyEntryDAO.findByUserId(userId);
  }

  /**
   * Get vocabulary entries by chapter label
   */
  async getEntriesByChapterLabel(userId: number, chapterLabel: string): Promise<VocabularyEntry[]> {
    return await VocabularyEntryDAO.findByChapterLabel(userId, chapterLabel);
  }

  /**
   * Get single vocabulary entry by ID
   */
  async getEntry(userId: number, entryId: string): Promise<VocabularyEntry | null> {
    return await VocabularyEntryDAO.findById(userId, entryId);
  }

  /**
   * Update existing vocabulary entry with automatic translation for missing fields
   */
  async updateEntry(userId: number, entryId: string, updates: Partial<VocabularyInput>): Promise<VocabularyEntry | null> {
    const updatesWithTranslations = await this.applyAutoTranslation(updates) as Partial<VocabularyInput>;
    return await VocabularyEntryDAO.update(userId, entryId, updatesWithTranslations);
  }

  /**
   * Delete vocabulary entry
   */
  async deleteEntry(userId: number, entryId: string): Promise<boolean> {
    return await VocabularyEntryDAO.delete(userId, entryId);
  }

  /**
   * Generate translations without saving (for preview)
   */
  async previewTranslations(
    chineseCharacter: string,
    existingPinyin?: string,
    existingVietnamese?: string,
    existingEnglish?: string
  ): Promise<TranslationPreview> {
    const result: TranslationPreview = {
      pinyin: existingPinyin || '',
      modernVietnamese: existingVietnamese || '',
      englishMeaning: existingEnglish || ''
    };

    if (!existingPinyin) {
      const pinyinArray = pinyin(chineseCharacter, {
        style: pinyin.STYLE_TONE,
        heteronym: false
      });
      result.pinyin = pinyinArray.map(p => p[0]).join(' ');
    }

    const needsVietnamese = !existingVietnamese;
    const needsEnglish = !existingEnglish;

    if (needsVietnamese && needsEnglish) {
      const [modernVietnamese, englishMeaning] = await Promise.all([
        this.translationService.translateToVietnamese(chineseCharacter),
        this.translationService.translateToEnglish(chineseCharacter)
      ]);
      result.modernVietnamese = modernVietnamese;
      result.englishMeaning = englishMeaning;
    } else if (needsVietnamese) {
      result.modernVietnamese = await this.translationService.translateToVietnamese(chineseCharacter);
    } else if (needsEnglish) {
      result.englishMeaning = await this.translationService.translateToEnglish(chineseCharacter);
    }

    return result;
  }

  /**
   * Share chapter vocabulary from one user to another
   */
  async shareChapter(sourceUserId: number, targetUserId: number, targetUsername: string, chapter: number): Promise<number> {
    const sourceEntries = await VocabularyEntryDAO.findByUserId(sourceUserId, chapter, chapter);
    
    if (sourceEntries.length === 0) {
      return 0;
    }

    let copiedCount = 0;
    for (const entry of sourceEntries) {
      const newEntry: VocabularyInput = {
        chineseCharacter: entry.chineseCharacter,
        pinyin: entry.pinyin,
        hanVietnamese: entry.hanVietnamese,
        modernVietnamese: entry.modernVietnamese,
        englishMeaning: entry.englishMeaning,
        learningNote: entry.learningNote,
        chapter: entry.chapter
      };

      await VocabularyEntryDAO.createShared(targetUserId, targetUsername, newEntry, entry.username);
      copiedCount++;
    }

    return copiedCount;
  }

  /**
   * Get available chapters for a user
   */
  async getAvailableChapters(userId: number): Promise<number[]> {
    return await VocabularyEntryDAO.getChapters(userId);
  }

  /**
   * Get users who have shared vocabulary for a specific chapter
   */
  async getSharedVocabularySources(chapter: number): Promise<string[]> {
    return await VocabularyEntryDAO.getUsersByChapter(chapter);
  }

  /**
   * Toggle favorite status for a vocabulary entry
   */
  async toggleFavorite(userId: number, chineseCharacter: string): Promise<VocabularyEntry | null> {
    return await VocabularyEntryDAO.toggleFavorite(userId, chineseCharacter);
  }

  async getRandomFavorite(userId: number): Promise<VocabularyEntry | null> {
    return await VocabularyEntryDAO.getRandomFavorite(userId);
  }

  async getRandomFavoriteByChapters(userId: number, chapterStart?: number, chapterEnd?: number): Promise<VocabularyEntry | null> {
    return await VocabularyEntryDAO.getRandomFavoriteByChapters(userId, chapterStart, chapterEnd);
  }

  async getRandomByChapters(userId: number, chapterStart: number, chapterEnd: number): Promise<VocabularyEntry | null> {
    return await VocabularyEntryDAO.getRandomByChapters(userId, chapterStart, chapterEnd);
  }

  /**
   * Get all unique chapter labels for a user
   */
  async getChapterLabels(userId: number): Promise<string[]> {
    return await VocabularyEntryDAO.getChapterLabels(userId);
  }

  /**
   * Get a random vocabulary entry by chapter label
   */
  async getRandomByChapterLabel(userId: number, chapterLabel: string): Promise<VocabularyEntry | null> {
    return await VocabularyEntryDAO.getRandomByChapterLabel(userId, chapterLabel);
  }

  /**
   * Get a random favorite vocabulary entry by chapter label
   */
  async getRandomFavoriteByChapterLabel(userId: number, chapterLabel: string): Promise<VocabularyEntry | null> {
    return await VocabularyEntryDAO.getRandomFavoriteByChapterLabel(userId, chapterLabel);
  }

  /**
   * Apply automatic translation for missing fields
   */
  private async applyAutoTranslation(
    entry: VocabularyInput | Partial<VocabularyInput>
  ): Promise<VocabularyInput | Partial<VocabularyInput>> {
    if (!entry.chineseCharacter) {
      return entry;
    }

    const result = { ...entry };

    if (!entry.pinyin) {
      const pinyinArray = pinyin(entry.chineseCharacter, {
        style: pinyin.STYLE_TONE,
        heteronym: false
      });
      result.pinyin = pinyinArray.map(p => p[0]).join(' ');
    }

    const needsVietnamese = entry.modernVietnamese === undefined || entry.modernVietnamese === '';
    const needsEnglish = entry.englishMeaning === undefined || entry.englishMeaning === '';

    if (!needsVietnamese && !needsEnglish) {
      return result;
    }

    if (needsVietnamese && needsEnglish) {
      const [modernVietnamese, englishMeaning] = await Promise.all([
        this.translationService.translateToVietnamese(entry.chineseCharacter),
        this.translationService.translateToEnglish(entry.chineseCharacter)
      ]);
      result.modernVietnamese = modernVietnamese;
      result.englishMeaning = englishMeaning;
    } else if (needsVietnamese) {
      result.modernVietnamese = await this.translationService.translateToVietnamese(entry.chineseCharacter);
    } else if (needsEnglish) {
      result.englishMeaning = await this.translationService.translateToEnglish(entry.chineseCharacter);
    }

    return result;
  }
}

// Singleton export for use in routes
export const vocabularyManager = new VocabularyManager();
