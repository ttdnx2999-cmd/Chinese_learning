/**
 * DatabaseBackupManager Service
 * 
 * Handles database backup and restore operations with password protection.
 * Provides complete database export/import functionality with data integrity validation.
 */

import { VocabularyEntryDAO, VocabularyEntry } from '../models/VocabularyEntry';
import crypto from 'crypto';

/**
 * Backup file structure containing all vocabulary entries
 */
export interface BackupFile {
  version: string;
  exportedAt: Date;
  users?: string[]; // Optional for backward compatibility
  vocabularyEntries: VocabularyEntry[];
  checksum: string;
}

/**
 * Result of database restore operation
 */
export interface RestoreResult {
  success: boolean;
  entriesRestored: number;
  errors?: string[];
}

/**
 * Result of backup file validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * DatabaseBackupManager handles password-protected backup and restore operations
 */
export class DatabaseBackupManager {
  private static get ADMIN_PASSWORD(): string { return process.env.ADMIN_PASSWORD || ''; }
  private static readonly BACKUP_VERSION = '1.0';

  /**
   * Authenticate admin access with password
   * @param password - Password to validate
   * @returns True if password is correct
   */
  authenticate(password: string): boolean {
    return !!DatabaseBackupManager.ADMIN_PASSWORD && password === DatabaseBackupManager.ADMIN_PASSWORD;
  }

  /**
   * Authenticate user against their stored secret phrase
   * @param username - Username to authenticate
   * @param secretPhrase - User's secret phrase/password
   * @returns True if the secret phrase matches
   */
  async authenticateUser(username: string, secretPhrase: string): Promise<boolean> {
    try {
      const { UserDAO } = await import('../models/User');
      
      // Find user by username
      const user = await UserDAO.findByUsername(username);
      
      if (!user) {
        console.log(`[DatabaseBackupManager] User "${username}" not found in auth_users`);
        return false;
      }

      // Use UserDAO's verify method to compare the secret phrase
      const match = await UserDAO.verifySecretPhrase(secretPhrase, user.secretPhraseHash);
      console.log(`[DatabaseBackupManager] Password comparison result for "${username}":`, match);
      return match;
    } catch (error) {
      console.error('[DatabaseBackupManager] Error authenticating user:', error);
      return false;
    }
  }

  /**
   * Export database to backup file, optionally filtered by username
   * @param username - If provided, only export this user's vocabulary
   * @returns Backup file containing vocabulary entries
   */
  async exportDatabase(username?: string): Promise<BackupFile> {
    let entries;
    let users: string[];

    if (username) {
      // Export only this user's vocabulary
      const { UserDAO } = await import('../models/User');
      const user = await UserDAO.findByUsername(username);
      if (!user) throw new Error(`User "${username}" not found`);
      
      const { getPool } = await import('../config/database');
      const pool = getPool();
      const [rows] = await pool.query<any[]>(
        'SELECT * FROM vocabulary_entries WHERE user_id = ? ORDER BY chapter, created_at',
        [user.id]
      );
      entries = rows.map(row => ({
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
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        sharedFrom: row.shared_from || undefined
      } as any));
      users = [username];
      console.log(`[DatabaseBackupManager] Exported ${entries.length} vocabulary entries for user "${username}"`);
    } else {
      // Export all
      users = await this.getAllUsers();
      entries = await this.getAllVocabularyEntries();
    }

    const backupFile: BackupFile = {
      version: DatabaseBackupManager.BACKUP_VERSION,
      exportedAt: new Date(),
      users: users,
      vocabularyEntries: entries,
      checksum: ''
    };

    // Calculate checksum for data integrity
    backupFile.checksum = this.calculateChecksum(backupFile);

    return backupFile;
  }

  /**
   * Import and restore database from backup file
   * @param backupFile - Backup file to restore
   * @param targetUsername - Optional: reassign all vocabulary to this username. If not provided, preserves original usernames
   * @returns Restore result with success status and entry count
   */
  async importDatabase(backupFile: BackupFile, targetUsername?: string): Promise<RestoreResult> {
    // Validate backup file first
    const validation = await this.validateBackupFile(backupFile);
    if (!validation.valid) {
      return {
        success: false,
        entriesRestored: 0,
        errors: validation.errors
      };
    }

    // Log backup file content for debugging
    const backupFavoritesCount = backupFile.vocabularyEntries.filter(e => e.isFavorite).length;
    console.log(`[DatabaseBackupManager] Importing backup with ${backupFile.vocabularyEntries.length} entries, ${backupFavoritesCount} marked as favorites`);

    // SAFETY CHECK: Ensure targetUsername is valid and not empty
    if (targetUsername === '' || (targetUsername && typeof targetUsername !== 'string')) {
      console.error('[DatabaseBackupManager] Invalid targetUsername provided:', targetUsername);
      return {
        success: false,
        entriesRestored: 0,
        errors: ['Invalid target username provided']
      };
    }

    try {
      // Resolve targetUsername to userId
      let targetUserId: number | null = null;
      if (targetUsername) {
        const { UserDAO } = await import('../models/User');
        const user = await UserDAO.findByUsername(targetUsername);
        if (!user) {
          return {
            success: false,
            entriesRestored: 0,
            errors: [`User "${targetUsername}" not found in auth_users`]
          };
        }
        targetUserId = user.id;
      }

      // Erase existing data - if targeting a specific user, only erase that user's vocabulary
      if (targetUserId) {
        console.log(`[DatabaseBackupManager] Erasing existing vocabulary for userId: ${targetUserId} (${targetUsername})`);
        await this.eraseUserVocabulary(targetUserId);
      } else {
        // Erase all existing data (backward compatibility)
        console.log(`[DatabaseBackupManager] Erasing all users and vocabulary`);
        await this.eraseAllUsers();
        await this.eraseAllVocabularyEntries();
      }

      // Extract users from backup (either from users field or from vocabulary entries)
      let usersToRestore: string[];
      if (targetUsername) {
        // If targeting a specific user, only restore that user
        usersToRestore = [targetUsername];
      } else if (backupFile.users && backupFile.users.length > 0) {
        usersToRestore = backupFile.users;
      } else {
        // Backward compatibility: extract unique usernames from vocabulary entries
        usersToRestore = [...new Set(backupFile.vocabularyEntries.map(entry => entry.username))];
      }

      // Restore users first (only if not targeting a specific user)
      if (!targetUsername) {
        await this.restoreUsers(usersToRestore);
      }
      
      // Restore all entries from backup using userId
      const restoredCount = await this.restoreVocabularyEntries(
        backupFile.vocabularyEntries,
        targetUserId!,
        targetUsername!
      );

      return {
        success: true,
        entriesRestored: restoredCount
      };
    } catch (error) {
      console.error('[DatabaseBackupManager] Import error:', error);
      return {
        success: false,
        entriesRestored: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error during restore']
      };
    }
  }

  /**
   * Validate backup file format and integrity
   * @param backupFile - Backup file to validate
   * @returns Validation result with errors if invalid
   */
  async validateBackupFile(backupFile: BackupFile): Promise<ValidationResult> {
    const errors: string[] = [];

    // Check required fields
    if (!backupFile.version) {
      errors.push('Missing version field');
    }

    if (!backupFile.exportedAt) {
      errors.push('Missing exportedAt field');
    }

    // Users field is optional for backward compatibility with old backups
    // If missing, we'll extract users from vocabulary entries

    if (!backupFile.vocabularyEntries) {
      errors.push('Missing vocabularyEntries field');
    }

    if (!backupFile.checksum) {
      errors.push('Missing checksum field');
    }

    // Validate version compatibility
    if (backupFile.version !== DatabaseBackupManager.BACKUP_VERSION) {
      errors.push(`Incompatible backup version: ${backupFile.version} (expected ${DatabaseBackupManager.BACKUP_VERSION})`);
    }

    // Validate checksum
    const calculatedChecksum = this.calculateChecksum(backupFile);
    if (backupFile.checksum !== calculatedChecksum) {
      errors.push('Checksum mismatch - backup file may be corrupted');
    }

    // Validate vocabulary entries structure
    if (Array.isArray(backupFile.vocabularyEntries)) {
      for (let i = 0; i < backupFile.vocabularyEntries.length; i++) {
        const entry = backupFile.vocabularyEntries[i];
        const entryErrors = this.validateVocabularyEntry(entry, i);
        errors.push(...entryErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Calculate checksum for backup file integrity validation
   * @param backupFile - Backup file to calculate checksum for
   * @returns Checksum string
   */
  private calculateChecksum(backupFile: BackupFile): string {
    // Create a copy without checksum for calculation
    const dataForChecksum: any = {
      version: backupFile.version,
      exportedAt: backupFile.exportedAt,
      vocabularyEntries: backupFile.vocabularyEntries
    };

    // Include users field only if it exists (for backward compatibility)
    if (backupFile.users) {
      dataForChecksum.users = backupFile.users;
    }

    const dataString = JSON.stringify(dataForChecksum);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Validate a single vocabulary entry structure
   * @param entry - Entry to validate
   * @param index - Entry index for error reporting
   * @returns Array of validation errors
   */
  private validateVocabularyEntry(entry: any, index: number): string[] {
    const errors: string[] = [];

    if (!entry.id) {
      errors.push(`Entry ${index}: Missing id field`);
    }

    if (!entry.username) {
      errors.push(`Entry ${index}: Missing username field`);
    }

    if (!entry.chineseCharacter) {
      errors.push(`Entry ${index}: Missing chineseCharacter field`);
    }

    if (!entry.pinyin) {
      errors.push(`Entry ${index}: Missing pinyin field`);
    }

    if (entry.chapter === undefined || entry.chapter === null) {
      errors.push(`Entry ${index}: Missing chapter field`);
    }

    return errors;
  }

  /**
   * Get all users from the database
   * @returns Array of usernames
   */
  private async getAllUsers(): Promise<string[]> {
    const { getPool } = await import('../config/database');
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      'SELECT username FROM users ORDER BY username'
    );

    return rows.map(row => row.username);
  }

  /**
   * Get all vocabulary entries from all users
   * @returns Array of all vocabulary entries
   */
  private async getAllVocabularyEntries(): Promise<VocabularyEntry[]> {
    const { getPool } = await import('../config/database');
    const pool = getPool();

    const [rows] = await pool.query<any[]>(
      'SELECT * FROM vocabulary_entries ORDER BY user_id, chapter, created_at'
    );

    const entries = rows.map(row => ({
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
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sharedFrom: row.shared_from || undefined
    } as any));

    const favoritesCount = entries.filter(e => e.isFavorite).length;
    console.log(`[DatabaseBackupManager] Exported ${entries.length} vocabulary entries, ${favoritesCount} marked as favorites`);

    return entries;
  }

  /**
   * Erase all users from database
   */
  private async eraseAllUsers(): Promise<void> {
    const { getPool } = await import('../config/database');
    const pool = getPool();

    await pool.query('DELETE FROM users');
  }

  /**
   * Erase all vocabulary entries from database
   */
  private async eraseAllVocabularyEntries(): Promise<void> {
    const { getPool } = await import('../config/database');
    const pool = getPool();

    await pool.query('DELETE FROM vocabulary_entries');
  }

  /**
   * Erase vocabulary entries for a specific user by userId
   * @param userId - User ID whose vocabulary should be erased
   */
  private async eraseUserVocabulary(userId: number): Promise<void> {
    const { getPool } = await import('../config/database');
    const pool = getPool();

    await pool.query('DELETE FROM vocabulary_entries WHERE user_id = ?', [userId]);
    console.log(`[DatabaseBackupManager] Erased vocabulary for userId: ${userId}`);
  }

  /**
   * Restore users from backup
   * @param users - Array of usernames to restore
   * @returns Number of users restored
   */
  private async restoreUsers(users: string[]): Promise<number> {
    const { getPool } = await import('../config/database');
    const pool = getPool();

    let restoredCount = 0;

    for (const username of users) {
      await pool.query(
        `INSERT INTO users (username) VALUES (?)`,
        [username]
      );
      restoredCount++;
    }

    return restoredCount;
  }

  /**
   * Restore vocabulary entries from backup
   * @param entries - Entries to restore
   * @param targetUserId - User ID to assign entries to
   * @param targetUsername - Username to assign entries to
   * @returns Number of entries restored
   */
  private async restoreVocabularyEntries(entries: VocabularyEntry[], targetUserId: number, targetUsername: string): Promise<number> {
    const { getPool } = await import('../config/database');
    const pool = getPool();
    const { v4: uuidv4 } = await import('uuid');

    let restoredCount = 0;
    let favoritesCount = 0;

    for (const entry of entries) {
      const createdAt = this.toMySQLDateTime(entry.createdAt);
      const updatedAt = this.toMySQLDateTime(entry.updatedAt);

      const newEntryId = uuidv4();

      const isFavoriteValue = entry.isFavorite === true || (entry.isFavorite as any) === 1 ? 1 : 0;
      if (isFavoriteValue === 1) favoritesCount++;

      await pool.query(
        `INSERT INTO vocabulary_entries 
         (id, user_id, username, chinese_character, pinyin, han_vietnamese, modern_vietnamese, 
          english_meaning, learning_note, is_favorite, chapter, chapter_label, created_at, updated_at, shared_from)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newEntryId,
          targetUserId,
          targetUsername,
          entry.chineseCharacter,
          entry.pinyin,
          entry.hanVietnamese || null,
          entry.modernVietnamese || null,
          entry.englishMeaning || null,
          entry.learningNote || null,
          isFavoriteValue,
          entry.chapter,
          (entry as any).chapterLabel || null,
          createdAt,
          updatedAt,
          entry.sharedFrom || null
        ]
      );
      
      restoredCount++;
    }

    console.log(`[DatabaseBackupManager] Restored ${restoredCount} vocabulary entries for userId ${targetUserId}, ${favoritesCount} marked as favorites`);

    return restoredCount;
  }

  /**
   * Convert Date object or ISO string to MySQL datetime format
   * @param date - Date object or ISO string
   * @returns MySQL datetime string (YYYY-MM-DD HH:MM:SS)
   */
  private toMySQLDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}
