/**
 * AdminBackupManager Service
 * 
 * Handles complete database backup and restore for admin users.
 * Exports and imports ALL data including users and their information.
 * Preserves user IDs to maintain parent-child relationships and vocabulary ownership.
 */

import { UserDAO } from '../models/User';
import { VocabularyEntryDAO, VocabularyEntry } from '../models/VocabularyEntry';
import crypto from 'crypto';

/**
 * Complete backup file structure including users and vocabulary
 */
export interface AdminBackupFile {
  version: string;
  exportedAt: string;
  users: Array<{
    id: number;
    username: string;
    secretPhraseHash: string;
    role: 'admin' | 'parent' | 'child';
    parentId?: number | null;
    isActive: boolean;
    createdAt: string;
  }>;
  vocabularyEntries: Array<{
    id: string;
    userId: number;
    chineseCharacter: string;
    pinyin: string;
    hanVietnamese?: string;
    modernVietnamese?: string;
    englishMeaning?: string;
    learningNote?: string;
    isFavorite: boolean;
    chapter: number;
    chapterLabel?: string;
    createdAt: string;
    updatedAt: string;
    sharedFrom?: string;
  }>;
  modelConfig?: {
    preferredModel: string | null;
    modelHistory: string[];
  };
  checksum: string;
}

/**
 * Result of admin backup/restore operation
 */
export interface AdminBackupResult {
  success: boolean;
  usersRestored?: number;
  entriesRestored?: number;
  errors?: string[];
}

export class AdminBackupManager {
  private static readonly BACKUP_VERSION = '2.1';

  /**
   * Export complete database including all users and vocabulary
   * Stores vocabulary by user_id for resilience against username changes
   * @returns Complete backup file
   */
  async exportCompleteDatabase(): Promise<AdminBackupFile> {
    try {
      // Get all users from auth_users table
      const { getPool } = await import('../config/database');
      const pool = getPool();

      const [users]: any = await pool.query(`
        SELECT id, username, secret_phrase_hash as secretPhraseHash, role, parent_id as parentId, 
               is_active as isActive, created_at as createdAt
        FROM auth_users
      `);

      // Get all vocabulary entries
      const [entries]: any = await pool.query(`
        SELECT id, user_id as userId, username, chinese_character as chineseCharacter, pinyin, 
               han_vietnamese as hanVietnamese, modern_vietnamese as modernVietnamese,
               english_meaning as englishMeaning, learning_note as learningNote, 
               is_favorite as isFavorite, chapter, chapter_label as chapterLabel,
               created_at as createdAt, updated_at as updatedAt, shared_from as sharedFrom
        FROM vocabulary_entries
      `);

      // Entries already have userId from the SQL query - use it directly
      const entriesForExport = entries.map((e: any) => ({
        id: e.id,
        userId: e.userId,
        chineseCharacter: e.chineseCharacter,
        pinyin: e.pinyin,
        hanVietnamese: e.hanVietnamese,
        modernVietnamese: e.modernVietnamese,
        englishMeaning: e.englishMeaning,
        learningNote: e.learningNote,
        isFavorite: e.isFavorite,
        chapter: e.chapter,
        chapterLabel: e.chapterLabel,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        sharedFrom: e.sharedFrom
      }));

      const backupFile: AdminBackupFile = {
        version: AdminBackupManager.BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        users: users.map((u: any) => ({
          id: u.id,
          username: u.username,
          secretPhraseHash: u.secretPhraseHash,
          role: u.role,
          parentId: u.parentId || null,
          isActive: u.isActive,
          createdAt: u.createdAt
        })),
        vocabularyEntries: entriesForExport,
        modelConfig: undefined,
        checksum: ''
      };

      // Include AI model config
      try {
        const { AITextGenerator } = await import('./AITextGenerator');
        const config = AITextGenerator.getModelConfig();
        backupFile.modelConfig = {
          preferredModel: config.preferredModel,
          modelHistory: config.modelHistory
        };
      } catch (e) {
        console.warn('[AdminBackupManager] Could not export model config:', e);
      }

      // Calculate checksum
      backupFile.checksum = this.calculateChecksum(backupFile);

      console.log(`[AdminBackupManager] Exported complete database: ${users.length} users, ${entries.length} vocabulary entries`);
      return backupFile;
    } catch (error) {
      console.error('[AdminBackupManager] Error exporting database:', error);
      throw error;
    }
  }

  /**
   * Import complete database backup, replacing all data
   * Preserves user IDs to maintain parent-child relationships
   * Uses userId from backup to resolve vocabulary ownership (falls back to username)
   * @param backupFile - Complete backup file to import
   * @returns Result of import operation
   */
  async importCompleteDatabase(backupFile: AdminBackupFile): Promise<AdminBackupResult> {
    try {
      // Validate backup file
      const validation = this.validateBackupFile(backupFile);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      const { getPool } = await import('../config/database');
      const pool = getPool();

      console.log(`[AdminBackupManager] Starting complete database import: ${backupFile.users.length} users, ${backupFile.vocabularyEntries.length} entries`);

      // Start transaction
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Disable foreign key checks temporarily
        console.log('[AdminBackupManager] Disabling foreign key checks...');
        await connection.query('SET FOREIGN_KEY_CHECKS=0');

        // Delete all existing data
        console.log('[AdminBackupManager] Clearing existing data...');
        await connection.query('DELETE FROM vocabulary_entries');
        await connection.query('DELETE FROM vocabulary_sharing');
        await connection.query('DELETE FROM auth_users');
        await connection.query('DELETE FROM users');

        // Reset auto-increment so IDs can be set explicitly
        await connection.query('ALTER TABLE auth_users AUTO_INCREMENT = 1');

        // Build userId -> username mapping from backup for vocabulary restoration
        const userIdToUsername: Record<number, string> = {};
        for (const user of backupFile.users) {
          if (user.id) {
            userIdToUsername[user.id] = user.username;
          }
        }

        // Restore users WITH their original IDs
        let usersRestored = 0;
        for (const user of backupFile.users) {
          // Convert ISO datetime to MySQL format
          const createdAtFormatted = new Date(user.createdAt).toISOString().slice(0, 19).replace('T', ' ');
          
          await connection.query(
            `INSERT INTO auth_users (id, username, secret_phrase_hash, role, parent_id, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              user.id,
              user.username,
              user.secretPhraseHash,
              user.role,
              user.parentId || null,
              user.isActive ? 1 : 0,
              createdAtFormatted
            ]
          );
          usersRestored++;

          // Also add to legacy users table for backward compatibility
          await connection.query(
            `INSERT IGNORE INTO users (username) VALUES (?)`,
            [user.username]
          );
        }

        // Set auto-increment to be higher than the max ID we just inserted
        const maxUserId = Math.max(...backupFile.users.map(u => u.id || 0), 0);
        await connection.query(`ALTER TABLE auth_users AUTO_INCREMENT = ${maxUserId + 1}`);

        // Restore vocabulary entries
        let entriesRestored = 0;
        for (const entry of backupFile.vocabularyEntries) {
          const { v4: uuidv4 } = await import('uuid');
          
          // Generate new UUID for each entry to ensure no conflicts
          const newEntryId = uuidv4();

          // Convert ISO datetimes to MySQL format
          const createdAtFormatted = new Date(entry.createdAt).toISOString().slice(0, 19).replace('T', ' ');
          const updatedAtFormatted = new Date(entry.updatedAt).toISOString().slice(0, 19).replace('T', ' ');

          // Resolve username from userId using the backup's user mapping
          let resolvedUsername = '';
          let resolvedUserId = entry.userId || 0;
          if (entry.userId && userIdToUsername[entry.userId]) {
            resolvedUsername = userIdToUsername[entry.userId];
          } else if ((entry as any).username) {
            // Fallback for older v2.0 backup files that still have username
            resolvedUsername = (entry as any).username;
            // Try to find userId from username
            const matchingUser = backupFile.users.find(u => u.username === resolvedUsername);
            if (matchingUser) resolvedUserId = matchingUser.id;
          }

          if (!resolvedUsername) {
            console.warn(`[AdminBackupManager] Skipping entry - cannot resolve username for userId: ${entry.userId}`);
            continue;
          }

          await connection.query(
            `INSERT INTO vocabulary_entries 
             (id, user_id, username, chinese_character, pinyin, han_vietnamese, modern_vietnamese,
              english_meaning, learning_note, is_favorite, chapter, chapter_label, created_at, updated_at, shared_from)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newEntryId,
              resolvedUserId,
              resolvedUsername,
              entry.chineseCharacter,
              entry.pinyin,
              entry.hanVietnamese || null,
              entry.modernVietnamese || null,
              entry.englishMeaning || null,
              entry.learningNote || null,
              entry.isFavorite ? 1 : 0,
              entry.chapter,
              entry.chapterLabel || null,
              createdAtFormatted,
              updatedAtFormatted,
              entry.sharedFrom || null
            ]
          );
          entriesRestored++;
        }

        // Re-enable foreign key checks and commit
        console.log('[AdminBackupManager] Re-enabling foreign key checks...');
        await connection.query('SET FOREIGN_KEY_CHECKS=1');
        
        await connection.commit();
        connection.release();

        console.log(`[AdminBackupManager] Import successful: ${usersRestored} users, ${entriesRestored} entries`);

        // Restore AI model config if present in backup
        if (backupFile.modelConfig) {
          try {
            const { AITextGenerator } = await import('./AITextGenerator');
            AITextGenerator.setModelConfig({
              preferredModel: backupFile.modelConfig.preferredModel || undefined,
              modelHistory: backupFile.modelConfig.modelHistory || []
            });
            console.log('[AdminBackupManager] Restored model config:', backupFile.modelConfig);
          } catch (e) {
            console.warn('[AdminBackupManager] Could not restore model config:', e);
          }
        }

        return {
          success: true,
          usersRestored,
          entriesRestored
        };
      } catch (err) {
        console.log('[AdminBackupManager] Re-enabling foreign key checks on error...');
        await connection.query('SET FOREIGN_KEY_CHECKS=1');
        await connection.rollback();
        connection.release();
        throw err;
      }
    } catch (error) {
      console.error('[AdminBackupManager] Error importing database:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error during import']
      };
    }
  }

  /**
   * Validate backup file format and integrity
   */
  private validateBackupFile(backupFile: AdminBackupFile): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!backupFile.version) {
      errors.push('Missing version field');
    }

    // Accept both v2.0 and v2.1 backup files
    const validVersions = ['2.0', '2.1'];
    if (!validVersions.includes(backupFile.version)) {
      errors.push(`Incompatible backup version: ${backupFile.version} (expected one of ${validVersions.join(', ')})`);
    }

    if (!backupFile.exportedAt) {
      errors.push('Missing exportedAt field');
    }

    if (!Array.isArray(backupFile.users)) {
      errors.push('Missing or invalid users array');
    }

    if (!Array.isArray(backupFile.vocabularyEntries)) {
      errors.push('Missing or invalid vocabularyEntries array');
    }

    if (!backupFile.checksum) {
      errors.push('Missing checksum');
    }

    // Validate checksum
    const calculatedChecksum = this.calculateChecksum(backupFile);
    if (backupFile.checksum !== calculatedChecksum) {
      errors.push('Checksum mismatch - backup file may be corrupted');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(backupFile: AdminBackupFile): string {
    const dataForChecksum: any = {
      version: backupFile.version,
      exportedAt: backupFile.exportedAt,
      users: backupFile.users,
      vocabularyEntries: backupFile.vocabularyEntries
    };

    // Only include modelConfig in checksum if it exists (backward compat)
    if (backupFile.modelConfig) {
      dataForChecksum.modelConfig = backupFile.modelConfig;
    }

    const dataString = JSON.stringify(dataForChecksum);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }
}
