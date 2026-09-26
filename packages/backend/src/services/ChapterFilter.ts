/**
 * ChapterFilter Service
 * 
 * Filters vocabulary based on user-selected chapter range.
 * Provides chapter range validation and random character sampling for AI text generation.
 * Uses user_id for all queries.
 */

import { getPool } from '../config/database';
import { RowDataPacket } from 'mysql2';

/**
 * Chapter range interface
 */
export interface ChapterRange {
  start: number;
  end: number;
}

/**
 * ChapterFilter class for filtering vocabulary by chapter range
 */
export class ChapterFilter {
  /**
   * Get vocabulary IDs within chapter range
   * @param userId - Owner user ID
   * @param range - Chapter range (inclusive)
   * @returns Array of vocabulary entry IDs
   */
  static async getVocabularyInRange(userId: number, range: ChapterRange): Promise<string[]> {
    const pool = getPool();
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM vocabulary_entries 
       WHERE user_id = ? AND chapter >= ? AND chapter <= ?
       ORDER BY chapter ASC, created_at ASC`,
      [userId, range.start, range.end]
    );

    return rows.map(row => row.id as string);
  }

  /**
   * Get random sample of characters from chapter range
   * Prioritizes favorite words - includes ALL favorites first, then fills remaining with random words
   * @param userId - Owner user ID
   * @param range - Chapter range (inclusive)
   * @param count - Maximum number of characters to return (up to 300)
   * @returns Array of Chinese characters (favorites + random)
   */
  static async getRandomCharacters(userId: number, range: ChapterRange, count: number): Promise<string[]> {
    const pool = getPool();
    
    const limitedCount = Math.min(count, 300);
    
    // First, get ALL favorite words from the chapter range
    const [favoriteRows] = await pool.query<RowDataPacket[]>(
      `SELECT chinese_character FROM vocabulary_entries 
       WHERE user_id = ? AND chapter >= ? AND chapter <= ? AND is_favorite = 1
       ORDER BY chinese_character ASC`,
      [userId, range.start, range.end]
    );
    
    const favoriteCharacters = favoriteRows.map(row => row.chinese_character as string);
    console.log(`[ChapterFilter] Found ${favoriteCharacters.length} favorite characters in range`);
    
    const remainingCount = limitedCount - favoriteCharacters.length;
    
    if (remainingCount <= 0) {
      console.log(`[ChapterFilter] Using only favorite characters (${favoriteCharacters.length})`);
      return favoriteCharacters.slice(0, limitedCount);
    }
    
    // Get random non-favorite characters to fill the remaining slots
    const [randomRows] = await pool.query<RowDataPacket[]>(
      `SELECT chinese_character FROM vocabulary_entries 
       WHERE user_id = ? AND chapter >= ? AND chapter <= ? AND is_favorite = 0
       ORDER BY RAND()
       LIMIT ?`,
      [userId, range.start, range.end, remainingCount]
    );
    
    const randomCharacters = randomRows.map(row => row.chinese_character as string);
    console.log(`[ChapterFilter] Added ${randomCharacters.length} random characters`);
    
    const allCharacters = [...favoriteCharacters, ...randomCharacters];
    console.log(`[ChapterFilter] Total characters: ${allCharacters.length} (${favoriteCharacters.length} favorites + ${randomCharacters.length} random)`);
    
    return allCharacters;
  }

  /**
   * Validate chapter range
   * @param userId - Owner user ID
   * @param range - Chapter range to validate
   * @returns True if range is valid and contains vocabulary, false otherwise
   */
  static async validateRange(userId: number, range: ChapterRange): Promise<boolean> {
    if (range.start < 0 || range.end < 0) return false;
    if (range.start > range.end) return false;

    const pool = getPool();
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM vocabulary_entries 
       WHERE user_id = ? AND chapter >= ? AND chapter <= ?`,
      [userId, range.start, range.end]
    );

    const count = rows[0].count as number;
    return count > 0;
  }
}
