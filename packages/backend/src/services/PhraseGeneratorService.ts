/**
 * PhraseGeneratorService
 * 
 * Orchestrates batch generation of Chinese practice sentences for vocabulary groups.
 * Each vocab group represents cumulative vocabulary from chapter 1 to a specific chapter endpoint.
 * The 5 vocab groups are based on the 5 most recent chapters in the database.
 */

import { getPool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AITextGenerator, GeneratedSentence } from './AITextGenerator';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a vocabulary group with cumulative chapter range
 */
export interface VocabGroup {
  id: number;              // 1-5
  chapterStart: number;    // Always 1
  chapterEndpoint: number; // One of 5 most recent chapters
}

/**
 * Represents a sentence stored in the database
 */
export interface StoredSentence {
  id: string;
  vocabGroupId: number;
  chineseText: string;
  pinyin: string;
  usedCharacters: string[];
  generationTimestamp: Date;
}

/**
 * Build a weighted character pool using exponential weighting by chapter rank.
 * Uses chapter RANK (sorted position) instead of raw chapter number,
 * so large gaps between chapters (e.g. 1-30 then 401-402) don't distort weights.
 * 
 * Words from the most recently introduced chapters get ~2.7× more copies than
 * the oldest chapter, using a 50/50 blend of exponential and linear weighting.
 */
function buildWeightedPool(vocab: { character: string; chapter: number }[]): string[] {
  if (vocab.length === 0) return [];

  // Get sorted unique chapters and assign a rank (0-based index)
  const uniqueChapters = [...new Set(vocab.map(v => v.chapter))].sort((a, b) => a - b);
  const chapterRank = new Map<number, number>();
  uniqueChapters.forEach((ch, idx) => chapterRank.set(ch, idx));

  const maxRank = uniqueChapters.length - 1;

  const weightedPool: string[] = [];
  for (const v of vocab) {
    // Normalize by rank (not raw chapter number) → always 0..1 regardless of chapter gaps
    const normalizedRank = maxRank === 0
      ? 1
      : chapterRank.get(v.chapter)! / maxRank;

    const exponentialWeight = Math.exp(normalizedRank);              // 1.0 → e (≈2.718)
    const linearWeight = 1 + normalizedRank * (Math.E - 1);          // same range, linear
    const blendedWeight = 0.5 * exponentialWeight + 0.5 * linearWeight;
    const copies = Math.max(1, Math.round(blendedWeight * 10));

    for (let j = 0; j < copies; j++) {
      weightedPool.push(v.character);
    }
  }
  return weightedPool;
}

/**
 * Sample `count` characters from a weighted pool (with replacement).
 * Deduplicates the result so each character appears at most once.
 * If the pool has fewer unique characters than `count`, returns all unique characters.
 */
function sampleFromPool(pool: string[], count: number): string[] {
  if (pool.length === 0 || count <= 0) return [];

  const uniqueInPool = [...new Set(pool)];
  if (uniqueInPool.length <= count) return uniqueInPool;

  const selected = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 20; // safety valve to avoid infinite loop

  while (selected.size < count && attempts < maxAttempts) {
    selected.add(pool[Math.floor(Math.random() * pool.length)]);
    attempts++;
  }

  return [...selected];
}

/**
 * Service for generating pre-generated phrases for vocabulary groups
 */
export class PhraseGeneratorService {
  /**
   * Get 5 vocab groups based on the 5 most recent chapters in the database.
   * Each vocab group represents cumulative vocabulary from chapter 1 to a specific chapter endpoint.
   * 
   * @returns Array of 5 VocabGroup instances ordered by chapter endpoint ascending
   */
  async getVocabGroups(userId?: number): Promise<VocabGroup[]> {
    const pool = getPool();
    
    // Query for 2 most recent distinct chapters, filtered by userId if provided
    let query: string;
    let params: any[];
    
    if (userId) {
      query = `SELECT DISTINCT chapter 
       FROM vocabulary_entries 
       WHERE user_id = ?
       ORDER BY chapter DESC 
       LIMIT 2`;
      params = [userId];
    } else {
      query = `SELECT DISTINCT chapter 
       FROM vocabulary_entries 
       ORDER BY chapter DESC 
       LIMIT 2`;
      params = [];
    }
    
    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Extract chapter numbers
    const chapters = rows.map(row => row.chapter as number);
    
    // If we have fewer than 2 chapters, return what we have
    if (chapters.length === 0) {
      return [];
    }

    // Reverse to get ascending order for vocab groups
    chapters.reverse();

    // Create vocab groups with cumulative ranges (chapter 1 to N)
    const vocabGroups: VocabGroup[] = chapters.map((chapterEndpoint, index) => ({
      id: index + 1,
      chapterStart: 1,
      chapterEndpoint
    }));

    return vocabGroups;
  }


  /**
   * Delete all existing sentences for a vocabulary group.
   * This operation is part of the sentence replacement process.
   * 
   * @param vocabGroupId - The vocab group ID (1-5) to delete sentences for
   * @param connection - Optional database connection for transaction support
   */
  async deleteSentencesForGroup(vocabGroupId: number, userId: number, connection?: any): Promise<void> {
    const pool = getPool();
    const conn = connection || pool;

    await conn.query(
      'DELETE FROM pre_generated_sentences WHERE vocab_group_id = ? AND user_id = ?',
      [vocabGroupId, userId]
    );
  }

  /**
   * Store generated sentences in the database with UUID generation.
   */
  async storeSentences(
    sentences: GeneratedSentence[], 
    vocabGroupId: number,
    userId: number,
    connection?: any
  ): Promise<void> {
    const pool = getPool();
    const conn = connection || pool;

    // Prepare batch insert
    const values = sentences.map(sentence => [
      uuidv4(), // Generate UUID for each sentence
      userId,
      vocabGroupId,
      sentence.chineseText,
      sentence.pinyin,
      sentence.englishMeaning || null,
      sentence.modernVietnamese || null,
      JSON.stringify(sentence.usedCharacters)
    ]);

    if (values.length === 0) {
      return;
    }

    // Insert all sentences in a single query
    await conn.query(
      `INSERT INTO pre_generated_sentences 
       (id, user_id, vocab_group_id, chinese_text, pinyin, english_meaning, modern_vietnamese, used_characters) 
       VALUES ?`,
      [values]
    );
  }

  /**
   * Replace all sentences for a vocabulary group and user with new generated sentences.
   */
  async replaceSentencesForGroup(
    vocabGroupId: number,
    userId: number,
    sentences: GeneratedSentence[]
  ): Promise<void> {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      // Start transaction
      await connection.beginTransaction();

      // Delete old sentences for this user + group
      await this.deleteSentencesForGroup(vocabGroupId, userId, connection);

      // Store new sentences
      await this.storeSentences(sentences, vocabGroupId, userId, connection);

      // Commit transaction
      await connection.commit();
    } catch (error) {
      // Rollback on any error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection back to pool
      connection.release();
    }
  }

  /**
   * Generate sentences for all 5 vocabulary groups in a SINGLE API call.
   * This is the main orchestration method optimized for cron job execution.
   * 
   * For each group:
   * 1. Prepares 4 batches of 300 characters each
   * 2. Sends all groups/batches in one API call
   * 3. Stores generated sentences for each group
   * 
   * Implements retry logic with exponential backoff (3 attempts: 1s, 2s, 4s delays).
   * Logs generation status and errors for monitoring.
   * 
   * @throws Error if all retry attempts fail
   */
  async generateAllSentences(userId?: number): Promise<void> {
    console.log(`[PhraseGenerator] Starting sentence generation for all vocab groups${userId ? ` (userId: ${userId})` : ''}`);
    
    // Get all 5 vocab groups
    const vocabGroups = await this.getVocabGroups(userId);
    
    if (vocabGroups.length === 0) {
      console.warn('[PhraseGenerator] No vocab groups found - skipping generation');
      return;
    }

    console.log(`[PhraseGenerator] Found ${vocabGroups.length} vocab groups to process`);

    // Prepare data for all groups in a single API call
    await this.generateAllGroupsInSingleCall(vocabGroups, userId);

    console.log('[PhraseGenerator] Successfully completed sentence generation for all vocab groups');
  }

  /**
   * Generate sentences for all vocab groups in a single API call with retry logic.
   * Implements exponential backoff: 1s, 2s, 4s delays between attempts.
   * 
   * @param vocabGroups - Array of VocabGroup to generate sentences for
   * @param maxAttempts - Maximum number of retry attempts (default: 3)
   * @throws Error if all retry attempts fail
   */
  private async generateAllGroupsInSingleCall(
    vocabGroups: VocabGroup[],
    userId?: number,
    maxAttempts: number = 5
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `[PhraseGenerator] Processing all ${vocabGroups.length} vocab groups in single API call - Attempt ${attempt}/${maxAttempts}`
        );

        // Prepare character batches for all groups
        const pool = getPool();
        const vocabGroupsData: Array<{
          vocabGroupId: number;
          batches: string[][];
          allVocabCharacters: string[];
        }> = [];

        for (const group of vocabGroups) {
          // Fetch all vocabulary characters with favorite status for the chapter range
          // Filter by userId if provided (user-specific generation)
          let vocabQuery: string;
          let vocabParams: any[];
          
          if (userId) {
            vocabQuery = `SELECT chinese_character, chapter, is_favorite FROM vocabulary_entries 
             WHERE user_id = ? AND chapter >= ? AND chapter <= ?`;
            vocabParams = [userId, group.chapterStart, group.chapterEndpoint];
          } else {
            vocabQuery = `SELECT chinese_character, chapter, is_favorite FROM vocabulary_entries 
             WHERE chapter >= ? AND chapter <= ?`;
            vocabParams = [group.chapterStart, group.chapterEndpoint];
          }

          const [rows] = await pool.query<RowDataPacket[]>(vocabQuery, vocabParams);

          if (rows.length === 0) {
            throw new Error(`No vocabulary found for vocab group ${group.id} (chapters ${group.chapterStart}-${group.chapterEndpoint})`);
          }

          // Separate favorites and non-favorites (same logic as generateSentencesForGroup)
          const favorites = rows
            .filter(row => row.is_favorite === 1)
            .map(row => ({ character: row.chinese_character as string, chapter: row.chapter as number }));

          const nonFavorites = rows
            .filter(row => row.is_favorite !== 1)
            .map(row => ({
              character: row.chinese_character as string,
              chapter: row.chapter as number
            }));

          console.log(`[PhraseGenerator] Group ${group.id}: ${favorites.length} favorites, ${nonFavorites.length} non-favorites`);

          // Build full vocab list (all characters in this group) for validation
          const allVocabCharacters = rows.map(row => row.chinese_character as string);

          // Prepare 4 batches of 300 characters each:
          //   - Up to 50 slots reserved for starred words (sampled via exponential weighting)
          //   - Remaining 250+ slots filled with non-favorites (exponential weighting)
          const TOTAL_SLOTS = 300;
          const STARRED_SLOTS = 50;

          const favWeightedPool = buildWeightedPool(favorites);
          const nonFavWeightedPool = buildWeightedPool(nonFavorites);

          const batches: string[][] = [];
          for (let i = 0; i < 4; i++) {
            // Sample starred words (up to STARRED_SLOTS unique characters)
            const starredSample = sampleFromPool(favWeightedPool, STARRED_SLOTS);

            // Fill remaining slots with non-favorites
            const nonFavSlots = TOTAL_SLOTS - starredSample.length;
            let nonFavSample: string[] = [];
            if (nonFavSlots > 0 && nonFavWeightedPool.length > 0) {
              nonFavSample = sampleFromPool(nonFavWeightedPool, nonFavSlots);
            } else if (nonFavSlots > 0 && nonFavWeightedPool.length === 0 && favWeightedPool.length > 0) {
              // No non-favorites at all — pad with more starred words
              nonFavSample = sampleFromPool(favWeightedPool, nonFavSlots);
            }

            batches.push([...starredSample, ...nonFavSample]);
          }

          vocabGroupsData.push({
            vocabGroupId: group.id,
            batches,
            allVocabCharacters
          });
        }

        // Generate all sentences in a single API call
        console.log('[PhraseGenerator] Calling AI text generator for all groups (single API call)...');
        const aiGenerator = new AITextGenerator();
        const resultMap = await aiGenerator.generateForMultipleGroups(vocabGroupsData);

        console.log(`[PhraseGenerator] Generated sentences for ${resultMap.size} vocab groups`);

        // Store sentences for each group
        for (const [vocabGroupId, sentences] of resultMap.entries()) {
          console.log(`[PhraseGenerator] Storing ${sentences.length} sentences for vocab group ${vocabGroupId} (userId: ${userId || 'global'})`);
          await this.replaceSentencesForGroup(vocabGroupId, userId || 0, sentences);
          console.log(`[PhraseGenerator] Successfully stored sentences for vocab group ${vocabGroupId}`);
        }

        // Success - exit retry loop
        return;

      } catch (error) {
        lastError = error as Error;
        
        console.error(
          `[PhraseGenerator] Error generating sentences for all groups ` +
          `(attempt ${attempt}/${maxAttempts}):`,
          error
        );

        // If this was the last attempt, don't wait
        if (attempt === maxAttempts) {
          break;
        }

        // Exponential backoff: 15s, 30s, 60s, 120s (gives Google time to recover from overload)
        const delayMs = Math.min(Math.pow(2, attempt - 1) * 15000, 120000);
        console.log(
          `[PhraseGenerator] Retrying all groups in ${delayMs / 1000}s...`
        );
        
        await this.sleep(delayMs);
      }
    }

    // All attempts failed
    const errorMessage = 
      `Failed to generate sentences for all groups after ${maxAttempts} attempts. ` +
      `Last error: ${lastError?.message}`;
    
    console.error(`[PhraseGenerator] ${errorMessage}`);
    throw new Error(errorMessage);
  }

  /**
   * Sleep utility for implementing retry delays.
   * 
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
