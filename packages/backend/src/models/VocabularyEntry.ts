/**
 * VocabularyEntry Model
 * 
 * TypeScript interfaces and data access layer for vocabulary entries.
 * Implements CRUD operations with user isolation filtering by user_id.
 */

import { getPool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Input interface for creating or updating vocabulary entries
 */
export interface VocabularyInput {
  chineseCharacter: string;
  pinyin?: string;
  hanVietnamese?: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  learningNote?: string;
  chapter: number;
  chapterLabel?: string;
  isFavorite?: boolean;
}

/**
 * Complete vocabulary entry interface matching database schema
 */
export interface VocabularyEntry extends VocabularyInput {
  id: string;
  userId: number;
  username: string;  // kept for display/backward compat
  pinyin: string;
  chapterLabel?: string;
  isFavorite?: boolean;
  createdAt: Date;
  updatedAt: Date;
  sharedFrom?: string;
}

/**
 * Database row interface for type-safe queries
 */
interface VocabularyEntryRow extends RowDataPacket {
  id: string;
  user_id: number;
  username: string;
  chinese_character: string;
  pinyin: string;
  han_vietnamese: string | null;
  modern_vietnamese: string | null;
  english_meaning: string | null;
  learning_note: string | null;
  chapter: number;
  chapter_label: string | null;
  is_favorite: number;
  created_at: Date;
  updated_at: Date;
  shared_from: string | null;
}

/**
 * Convert database row to VocabularyEntry interface
 */
function rowToEntry(row: VocabularyEntryRow): VocabularyEntry {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    chineseCharacter: row.chinese_character,
    pinyin: row.pinyin,
    hanVietnamese: row.han_vietnamese || undefined,
    modernVietnamese: row.modern_vietnamese || undefined,
    englishMeaning: row.english_meaning || undefined,
    learningNote: row.learning_note || undefined,
    isFavorite: row.is_favorite === 1,
    chapter: row.chapter,
    chapterLabel: row.chapter_label || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sharedFrom: row.shared_from || undefined
  };
}

/**
 * Data Access Layer for VocabularyEntry
 * All methods use userId (number) for user isolation.
 */
export class VocabularyEntryDAO {
  /**
   * Create a new vocabulary entry
   */
  static async create(userId: number, username: string, entry: VocabularyInput): Promise<VocabularyEntry> {
    const pool = getPool();
    const id = uuidv4();
    
    await pool.query<ResultSetHeader>(
      `INSERT INTO vocabulary_entries 
       (id, user_id, username, chinese_character, pinyin, han_vietnamese, modern_vietnamese, 
        english_meaning, learning_note, is_favorite, chapter, chapter_label, shared_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        username,
        entry.chineseCharacter,
        entry.pinyin || '',
        entry.hanVietnamese || null,
        entry.modernVietnamese || null,
        entry.englishMeaning || null,
        entry.learningNote || null,
        entry.isFavorite ? 1 : 0,
        entry.chapter,
        entry.chapterLabel || null,
        null
      ]
    );

    const created = await this.findById(userId, id);
    if (!created) {
      throw new Error('Failed to create vocabulary entry');
    }
    return created;
  }

  /**
   * Find a vocabulary entry by ID with user isolation
   */
  static async findById(userId: number, id: string): Promise<VocabularyEntry | null> {
    const pool = getPool();
    
    const [rows] = await pool.query<VocabularyEntryRow[]>(
      `SELECT * FROM vocabulary_entries WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return rowToEntry(rows[0]);
  }

  /**
   * Find all vocabulary entries for a user with optional chapter filtering
   */
  static async findByUserId(
    userId: number,
    chapterStart?: number,
    chapterEnd?: number
  ): Promise<VocabularyEntry[]> {
    const pool = getPool();
    let query = 'SELECT * FROM vocabulary_entries WHERE user_id = ?';
    const params: any[] = [userId];

    if (chapterStart !== undefined && chapterEnd !== undefined) {
      query += ' AND chapter >= ? AND chapter <= ?';
      params.push(chapterStart, chapterEnd);
    } else if (chapterStart !== undefined) {
      query += ' AND chapter >= ?';
      params.push(chapterStart);
    } else if (chapterEnd !== undefined) {
      query += ' AND chapter <= ?';
      params.push(chapterEnd);
    }

    query += ' ORDER BY chapter ASC, created_at ASC';

    const [rows] = await pool.query<VocabularyEntryRow[]>(query, params);

    return rows.map(rowToEntry);
  }

  /**
   * @deprecated Use findByUserId instead. Kept for backward compatibility during migration.
   */
  static async findByUsername(
    username: string,
    chapterStart?: number,
    chapterEnd?: number
  ): Promise<VocabularyEntry[]> {
    const pool = getPool();
    let query = 'SELECT * FROM vocabulary_entries WHERE username = ?';
    const params: any[] = [username];

    if (chapterStart !== undefined && chapterEnd !== undefined) {
      query += ' AND chapter >= ? AND chapter <= ?';
      params.push(chapterStart, chapterEnd);
    } else if (chapterStart !== undefined) {
      query += ' AND chapter >= ?';
      params.push(chapterStart);
    } else if (chapterEnd !== undefined) {
      query += ' AND chapter <= ?';
      params.push(chapterEnd);
    }

    query += ' ORDER BY chapter ASC, created_at ASC';

    const [rows] = await pool.query<VocabularyEntryRow[]>(query, params);

    return rows.map(rowToEntry);
  }

  /**
   * Update a vocabulary entry with user isolation
   */
  static async update(
    userId: number,
    id: string,
    updates: Partial<VocabularyInput>
  ): Promise<VocabularyEntry | null> {
    const pool = getPool();
    
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.chineseCharacter !== undefined) {
      updateFields.push('chinese_character = ?');
      params.push(updates.chineseCharacter);
    }
    if (updates.pinyin !== undefined) {
      updateFields.push('pinyin = ?');
      params.push(updates.pinyin);
    }
    if (updates.hanVietnamese !== undefined) {
      updateFields.push('han_vietnamese = ?');
      params.push(updates.hanVietnamese || null);
    }
    if (updates.modernVietnamese !== undefined) {
      updateFields.push('modern_vietnamese = ?');
      params.push(updates.modernVietnamese || null);
    }
    if (updates.englishMeaning !== undefined) {
      updateFields.push('english_meaning = ?');
      params.push(updates.englishMeaning || null);
    }
    if (updates.learningNote !== undefined) {
      updateFields.push('learning_note = ?');
      params.push(updates.learningNote || null);
    }
    if (updates.chapter !== undefined) {
      updateFields.push('chapter = ?');
      params.push(updates.chapter);
    }
    if (updates.chapterLabel !== undefined) {
      updateFields.push('chapter_label = ?');
      params.push(updates.chapterLabel || null);
    }
    if (updates.isFavorite !== undefined) {
      updateFields.push('is_favorite = ?');
      params.push(updates.isFavorite ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return this.findById(userId, id);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    const query = `UPDATE vocabulary_entries SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
    const [result] = await pool.query<ResultSetHeader>(query, params);

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(userId, id);
  }

  /**
   * Delete a vocabulary entry with user isolation
   */
  static async delete(userId: number, id: string): Promise<boolean> {
    const pool = getPool();
    
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM vocabulary_entries WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Get all unique chapters for a user
   */
  static async getChapters(userId: number): Promise<number[]> {
    const pool = getPool();
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT chapter FROM vocabulary_entries WHERE user_id = ? ORDER BY chapter ASC`,
      [userId]
    );

    return rows.map(row => row.chapter as number);
  }

  /**
   * Count vocabulary entries for a user in a specific chapter
   */
  static async countByChapter(userId: number, chapter: number): Promise<number> {
    const pool = getPool();
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM vocabulary_entries WHERE user_id = ? AND chapter = ?`,
      [userId, chapter]
    );

    return rows[0].count as number;
  }

  /**
   * Create a new vocabulary entry with shared_from field
   */
  static async createShared(userId: number, username: string, entry: VocabularyInput, sharedFrom: string): Promise<VocabularyEntry> {
    const pool = getPool();
    const id = uuidv4();
    
    await pool.query<ResultSetHeader>(
      `INSERT INTO vocabulary_entries 
       (id, user_id, username, chinese_character, pinyin, han_vietnamese, modern_vietnamese, 
        english_meaning, learning_note, is_favorite, chapter, chapter_label, shared_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        username,
        entry.chineseCharacter,
        entry.pinyin || '',
        entry.hanVietnamese || null,
        entry.modernVietnamese || null,
        entry.englishMeaning || null,
        entry.learningNote || null,
        entry.isFavorite ? 1 : 0,
        entry.chapter,
        entry.chapterLabel || null,
        sharedFrom
      ]
    );

    const created = await this.findById(userId, id);
    if (!created) {
      throw new Error('Failed to create shared vocabulary entry');
    }
    return created;
  }

  /**
   * Get all unique usernames who have vocabulary in a specific chapter
   */
  static async getUsersByChapter(chapter: number): Promise<string[]> {
    const pool = getPool();
    
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT username FROM vocabulary_entries WHERE chapter = ? ORDER BY username ASC`,
      [chapter]
    );

    return rows.map(row => row.username as string);
  }

  /**
   * Toggle favorite status for a vocabulary entry
   */
  static async toggleFavorite(userId: number, chineseCharacter: string): Promise<VocabularyEntry | null> {
    const pool = getPool();
    
    const [rows] = await pool.query<VocabularyEntryRow[]>(
      `SELECT * FROM vocabulary_entries WHERE user_id = ? AND chinese_character = ? LIMIT 1`,
      [userId, chineseCharacter]
    );

    if (rows.length === 0) {
      return null;
    }

    const currentEntry = rowToEntry(rows[0]);
    const newFavoriteStatus = !currentEntry.isFavorite;

    await pool.query<ResultSetHeader>(
      `UPDATE vocabulary_entries SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND chinese_character = ?`,
      [newFavoriteStatus ? 1 : 0, userId, chineseCharacter]
    );

    return this.findById(userId, currentEntry.id);
  }

  /**
   * Get a random favorite vocabulary entry for a user
   */
  static async getRandomFavorite(userId: number): Promise<VocabularyEntry | null> {
    const pool = getPool();

    const [rows] = await pool.query<VocabularyEntryRow[]>(
      `SELECT * FROM vocabulary_entries WHERE user_id = ? AND is_favorite = 1 ORDER BY RAND() LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) return null;
    return rowToEntry(rows[0]);
  }

  /**
   * Get a random favorite vocabulary entry with optional chapter filtering
   */
  static async getRandomFavoriteByChapters(userId: number, chapterStart?: number, chapterEnd?: number): Promise<VocabularyEntry | null> {
    const pool = getPool();

    let query = `SELECT * FROM vocabulary_entries WHERE user_id = ? AND is_favorite = 1`;
    const params: any[] = [userId];

    if (chapterStart !== undefined && chapterEnd !== undefined) {
      query += ` AND chapter >= ? AND chapter <= ?`;
      params.push(chapterStart, chapterEnd);
    }

    query += ` ORDER BY RAND() LIMIT 1`;

    const [rows] = await pool.query<VocabularyEntryRow[]>(query, params);
    if (rows.length === 0) return null;
    return rowToEntry(rows[0]);
  }

  /**
   * Get a random vocabulary entry from specified chapters
   */
  static async getRandomByChapters(userId: number, chapterStart: number, chapterEnd: number): Promise<VocabularyEntry | null> {
    const pool = getPool();

    const [rows] = await pool.query<VocabularyEntryRow[]>(
      `SELECT * FROM vocabulary_entries WHERE user_id = ? AND chapter >= ? AND chapter <= ? ORDER BY RAND() LIMIT 1`,
      [userId, chapterStart, chapterEnd]
    );

    if (rows.length === 0) return null;
    return rowToEntry(rows[0]);
  }

  /**
   * Get all unique chapter labels for a user
   */
  static async getChapterLabels(userId: number): Promise<string[]> {
    const pool = getPool();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT chapter_label FROM vocabulary_entries
       WHERE user_id = ? AND chapter_label IS NOT NULL AND chapter_label != ''
       ORDER BY chapter_label ASC`,
      [userId]
    );

    return rows.map(row => row.chapter_label as string);
  }

  /**
   * Find vocabulary entries by chapter label
   */
  static async findByChapterLabel(userId: number, chapterLabel: string): Promise<VocabularyEntry[]> {
    const pool = getPool();

    const [rows] = await pool.query<VocabularyEntryRow[]>(
      `SELECT * FROM vocabulary_entries
       WHERE user_id = ? AND chapter_label = ?
       ORDER BY chapter ASC, created_at ASC`,
      [userId, chapterLabel]
    );

    return rows.map(rowToEntry);
  }

  /**
   * Get a random favorite vocabulary entry by chapter label
   */
  static async getRandomFavoriteByChapterLabel(userId: number, chapterLabel: string): Promise<VocabularyEntry | null> {
    const pool = getPool();

    const [rows] = await pool.query<VocabularyEntryRow[]>(
      `SELECT * FROM vocabulary_entries
       WHERE user_id = ? AND is_favorite = 1 AND chapter_label = ?
       ORDER BY RAND() LIMIT 1`,
      [userId, chapterLabel]
    );

    if (rows.length === 0) return null;
    return rowToEntry(rows[0]);
  }

  /**
   * Get a random vocabulary entry by chapter label
   */
  static async getRandomByChapterLabel(userId: number, chapterLabel: string): Promise<VocabularyEntry | null> {
    const pool = getPool();

    const [rows] = await pool.query<VocabularyEntryRow[]>(
      `SELECT * FROM vocabulary_entries
       WHERE user_id = ? AND chapter_label = ?
       ORDER BY RAND() LIMIT 1`,
      [userId, chapterLabel]
    );

    if (rows.length === 0) return null;
    return rowToEntry(rows[0]);
  }

  /**
   * Delete all vocabulary for a user
   */
  static async deleteAllForUser(userId: number): Promise<number> {
    const pool = getPool();
    
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM vocabulary_entries WHERE user_id = ?`,
      [userId]
    );

    return result.affectedRows;
  }
}
