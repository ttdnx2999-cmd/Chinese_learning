/**
 * DatabaseBackupManager Tests
 */

import { DatabaseBackupManager, BackupFile, RestoreResult, ValidationResult } from './DatabaseBackupManager';
import { VocabularyEntry } from '../models/VocabularyEntry';
import crypto from 'crypto';

// Mock database module
jest.mock('../config/database', () => ({
  getPool: jest.fn()
}));

describe('DatabaseBackupManager', () => {
  let manager: DatabaseBackupManager;
  let mockPool: any;

  const mockEntry1: VocabularyEntry = {
    id: 'entry-1',
    username: 'alice',
    chineseCharacter: '你好',
    pinyin: 'nǐ hǎo',
    hanVietnamese: 'nhĩ hảo',
    modernVietnamese: 'Xin chào',
    englishMeaning: 'Hello',
    learningNote: 'Common greeting',
    chapter: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };

  const mockEntry2: VocabularyEntry = {
    id: 'entry-2',
    username: 'bob',
    chineseCharacter: '再见',
    pinyin: 'zài jiàn',
    modernVietnamese: 'Tạm biệt',
    englishMeaning: 'Goodbye',
    chapter: 2,
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new DatabaseBackupManager();

    // Mock database pool
    mockPool = {
      query: jest.fn()
    };

    const { getPool } = require('../config/database');
    getPool.mockReturnValue(mockPool);
  });

  describe('authenticate', () => {
    it('should return true for correct password', () => {
      const result = manager.authenticate('test-only-admin-password');
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', () => {
      const result = manager.authenticate('wrongpassword');
      expect(result).toBe(false);
    });

    it('should return false for empty password', () => {
      const result = manager.authenticate('');
      expect(result).toBe(false);
    });

    it('should be case-sensitive', () => {
      const result = manager.authenticate('boyachinesebach');
      expect(result).toBe(false);
    });

    it('should not accept password with extra spaces', () => {
      const result = manager.authenticate(' test-only-admin-password ');
      expect(result).toBe(false);
    });
  });

  describe('exportDatabase', () => {
    it('should export all vocabulary entries', async () => {
      const mockRows = [
        {
          id: 'entry-1',
          username: 'alice',
          chinese_character: '你好',
          pinyin: 'nǐ hǎo',
          han_vietnamese: 'nhĩ hảo',
          modern_vietnamese: 'Xin chào',
          english_meaning: 'Hello',
          learning_note: 'Common greeting',
          chapter: 1,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
          shared_from: null
        },
        {
          id: 'entry-2',
          username: 'bob',
          chinese_character: '再见',
          pinyin: 'zài jiàn',
          han_vietnamese: null,
          modern_vietnamese: 'Tạm biệt',
          english_meaning: 'Goodbye',
          learning_note: null,
          chapter: 2,
          created_at: new Date('2024-01-02T00:00:00Z'),
          updated_at: new Date('2024-01-02T00:00:00Z'),
          shared_from: null
        }
      ];

      mockPool.query.mockResolvedValue([mockRows]);

      const result = await manager.exportDatabase();

      expect(result.version).toBe('1.0');
      expect(result.exportedAt).toBeInstanceOf(Date);
      expect(result.vocabularyEntries).toHaveLength(2);
      expect(result.vocabularyEntries[0].chineseCharacter).toBe('你好');
      expect(result.vocabularyEntries[1].chineseCharacter).toBe('再见');
      expect(result.checksum).toBeTruthy();
      expect(typeof result.checksum).toBe('string');
    });

    it('should include checksum for data integrity', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await manager.exportDatabase();

      expect(result.checksum).toBeTruthy();
      expect(result.checksum.length).toBe(64); // SHA-256 hex length
    });

    it('should export empty database', async () => {
      mockPool.query.mockResolvedValue([[]]);

      const result = await manager.exportDatabase();

      expect(result.vocabularyEntries).toHaveLength(0);
      expect(result.checksum).toBeTruthy();
    });

    it('should preserve all fields including optional ones', async () => {
      const mockRows = [
        {
          id: 'entry-1',
          username: 'alice',
          chinese_character: '你好',
          pinyin: 'nǐ hǎo',
          han_vietnamese: 'nhĩ hảo',
          modern_vietnamese: 'Xin chào',
          english_meaning: 'Hello',
          learning_note: 'Common greeting',
          chapter: 1,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
          shared_from: 'bob'
        }
      ];

      mockPool.query.mockResolvedValue([mockRows]);

      const result = await manager.exportDatabase();

      expect(result.vocabularyEntries[0].hanVietnamese).toBe('nhĩ hảo');
      expect(result.vocabularyEntries[0].learningNote).toBe('Common greeting');
      expect(result.vocabularyEntries[0].sharedFrom).toBe('bob');
    });

    it('should query all entries ordered by username, chapter, created_at', async () => {
      mockPool.query.mockResolvedValue([[]]);

      await manager.exportDatabase();

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM vocabulary_entries ORDER BY username, chapter, created_at'
      );
    });
  });

  describe('validateBackupFile', () => {
    let validBackupFile: BackupFile;

    beforeEach(() => {
      validBackupFile = {
        version: '1.0',
        exportedAt: new Date('2024-01-01T00:00:00Z'),
        users: ['alice', 'bob'],
        vocabularyEntries: [mockEntry1, mockEntry2],
        checksum: ''
      };

      // Calculate valid checksum
      const dataForChecksum = {
        version: validBackupFile.version,
        exportedAt: validBackupFile.exportedAt,
        users: validBackupFile.users,
        vocabularyEntries: validBackupFile.vocabularyEntries
      };
      validBackupFile.checksum = crypto.createHash('sha256')
        .update(JSON.stringify(dataForChecksum))
        .digest('hex');
    });

    it('should validate correct backup file', async () => {
      const result = await manager.validateBackupFile(validBackupFile);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject backup file with missing version', async () => {
      const invalidFile = { ...validBackupFile, version: '' };

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing version field');
    });

    it('should reject backup file with missing exportedAt', async () => {
      const invalidFile = { ...validBackupFile, exportedAt: null as any };

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing exportedAt field');
    });

    it('should reject backup file with missing vocabularyEntries', async () => {
      const invalidFile = { ...validBackupFile, vocabularyEntries: null as any };

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing vocabularyEntries field');
    });

    it('should reject backup file with missing checksum', async () => {
      const invalidFile = { ...validBackupFile, checksum: '' };

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing checksum field');
    });

    it('should reject backup file with incompatible version', async () => {
      const invalidFile = { ...validBackupFile, version: '2.0' };

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Incompatible backup version: 2.0 (expected 1.0)');
    });

    it('should reject backup file with incorrect checksum', async () => {
      const invalidFile = { ...validBackupFile, checksum: 'invalid-checksum' };

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Checksum mismatch - backup file may be corrupted');
    });

    it('should validate vocabulary entry structure', async () => {
      const invalidEntry = { ...mockEntry1, id: '' };
      const invalidFile = {
        ...validBackupFile,
        vocabularyEntries: [invalidEntry]
      };

      // Recalculate checksum for modified data
      const dataForChecksum = {
        version: invalidFile.version,
        exportedAt: invalidFile.exportedAt,
        users: invalidFile.users,
        vocabularyEntries: invalidFile.vocabularyEntries
      };
      invalidFile.checksum = crypto.createHash('sha256')
        .update(JSON.stringify(dataForChecksum))
        .digest('hex');

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry 0: Missing id field');
    });

    it('should validate all required fields in vocabulary entries', async () => {
      const invalidEntry = {
        id: '',
        username: '',
        chineseCharacter: '',
        pinyin: '',
        chapter: null as any
      };
      const invalidFile = {
        ...validBackupFile,
        vocabularyEntries: [invalidEntry as any]
      };

      // Recalculate checksum
      const dataForChecksum = {
        version: invalidFile.version,
        exportedAt: invalidFile.exportedAt,
        users: invalidFile.users,
        vocabularyEntries: invalidFile.vocabularyEntries
      };
      invalidFile.checksum = crypto.createHash('sha256')
        .update(JSON.stringify(dataForChecksum))
        .digest('hex');

      const result = await manager.validateBackupFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Entry 0: Missing id field');
      expect(result.errors).toContain('Entry 0: Missing username field');
      expect(result.errors).toContain('Entry 0: Missing chineseCharacter field');
      expect(result.errors).toContain('Entry 0: Missing pinyin field');
      expect(result.errors).toContain('Entry 0: Missing chapter field');
    });

    it('should accept backup file with empty vocabularyEntries array', async () => {
      const emptyFile = {
        ...validBackupFile,
        vocabularyEntries: []
      };

      // Recalculate checksum
      const dataForChecksum = {
        version: emptyFile.version,
        exportedAt: emptyFile.exportedAt,
        users: emptyFile.users,
        vocabularyEntries: emptyFile.vocabularyEntries
      };
      emptyFile.checksum = crypto.createHash('sha256')
        .update(JSON.stringify(dataForChecksum))
        .digest('hex');

      const result = await manager.validateBackupFile(emptyFile);

      expect(result.valid).toBe(true);
    });
  });

  describe('importDatabase', () => {
    let validBackupFile: BackupFile;

    beforeEach(() => {
      validBackupFile = {
        version: '1.0',
        exportedAt: new Date('2024-01-01T00:00:00Z'),
        users: ['alice', 'bob'],
        vocabularyEntries: [mockEntry1, mockEntry2],
        checksum: ''
      };

      // Calculate valid checksum
      const dataForChecksum = {
        version: validBackupFile.version,
        exportedAt: validBackupFile.exportedAt,
        users: validBackupFile.users,
        vocabularyEntries: validBackupFile.vocabularyEntries
      };
      validBackupFile.checksum = crypto.createHash('sha256')
        .update(JSON.stringify(dataForChecksum))
        .digest('hex');

      mockPool.query.mockResolvedValue([{ affectedRows: 1 }]);
    });

    it('should restore all vocabulary entries', async () => {
      const result = await manager.importDatabase(validBackupFile);

      expect(result.success).toBe(true);
      expect(result.entriesRestored).toBe(2);
      expect(result.errors).toBeUndefined();
    });

    it('should erase existing entries before restore', async () => {
      await manager.importDatabase(validBackupFile);

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM vocabulary_entries');
    });

    it('should insert all entries from backup', async () => {
      await manager.importDatabase(validBackupFile);

      // Should call DELETE once, then INSERT for each entry
      expect(mockPool.query).toHaveBeenCalledTimes(3);
      
      // Check first insert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO vocabulary_entries'),
        [
          'entry-1',
          'alice',
          '你好',
          'nǐ hǎo',
          'nhĩ hảo',
          'Xin chào',
          'Hello',
          'Common greeting',
          1,
          mockEntry1.createdAt,
          mockEntry1.updatedAt,
          null
        ]
      );

      // Check second insert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO vocabulary_entries'),
        [
          'entry-2',
          'bob',
          '再见',
          'zài jiàn',
          null,
          'Tạm biệt',
          'Goodbye',
          null,
          2,
          mockEntry2.createdAt,
          mockEntry2.updatedAt,
          null
        ]
      );
    });

    it('should reject invalid backup file', async () => {
      const invalidFile = { ...validBackupFile, checksum: 'invalid' };

      const result = await manager.importDatabase(invalidFile);

      expect(result.success).toBe(false);
      expect(result.entriesRestored).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('Checksum mismatch - backup file may be corrupted');
    });

    it('should handle database errors during restore', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await manager.importDatabase(validBackupFile);

      expect(result.success).toBe(false);
      expect(result.entriesRestored).toBe(0);
      expect(result.errors).toContain('Database connection failed');
    });

    it('should restore empty backup file', async () => {
      const emptyFile = {
        ...validBackupFile,
        vocabularyEntries: []
      };

      // Recalculate checksum
      const dataForChecksum = {
        version: emptyFile.version,
        exportedAt: emptyFile.exportedAt,
        users: emptyFile.users,
        vocabularyEntries: emptyFile.vocabularyEntries
      };
      emptyFile.checksum = crypto.createHash('sha256')
        .update(JSON.stringify(dataForChecksum))
        .digest('hex');

      const result = await manager.importDatabase(emptyFile);

      expect(result.success).toBe(true);
      expect(result.entriesRestored).toBe(0);
    });

    it('should preserve timestamps during restore', async () => {
      await manager.importDatabase(validBackupFile);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO vocabulary_entries'),
        expect.arrayContaining([
          mockEntry1.createdAt,
          mockEntry1.updatedAt
        ])
      );
    });

    it('should preserve sharedFrom field during restore', async () => {
      const entryWithSharedFrom = {
        ...mockEntry1,
        sharedFrom: 'charlie'
      };

      const backupWithSharedFrom = {
        ...validBackupFile,
        vocabularyEntries: [entryWithSharedFrom]
      };

      // Recalculate checksum
      const dataForChecksum = {
        version: backupWithSharedFrom.version,
        exportedAt: backupWithSharedFrom.exportedAt,
        users: backupWithSharedFrom.users,
        vocabularyEntries: backupWithSharedFrom.vocabularyEntries
      };
      backupWithSharedFrom.checksum = crypto.createHash('sha256')
        .update(JSON.stringify(dataForChecksum))
        .digest('hex');

      await manager.importDatabase(backupWithSharedFrom);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO vocabulary_entries'),
        expect.arrayContaining(['charlie'])
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should export and then import the same data', async () => {
      const mockRows = [
        {
          id: 'entry-1',
          username: 'alice',
          chinese_character: '你好',
          pinyin: 'nǐ hǎo',
          han_vietnamese: 'nhĩ hảo',
          modern_vietnamese: 'Xin chào',
          english_meaning: 'Hello',
          learning_note: 'Common greeting',
          chapter: 1,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
          shared_from: null
        }
      ];

      mockPool.query.mockResolvedValue([mockRows]);

      // Export
      const backupFile = await manager.exportDatabase();

      // Validate
      const validation = await manager.validateBackupFile(backupFile);
      expect(validation.valid).toBe(true);

      // Import
      const result = await manager.importDatabase(backupFile);
      expect(result.success).toBe(true);
      expect(result.entriesRestored).toBe(1);
    });

    it('should handle multiple users in backup', async () => {
      const mockRows = [
        {
          id: 'entry-1',
          username: 'alice',
          chinese_character: '你好',
          pinyin: 'nǐ hǎo',
          han_vietnamese: null,
          modern_vietnamese: 'Xin chào',
          english_meaning: 'Hello',
          learning_note: null,
          chapter: 1,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
          shared_from: null
        },
        {
          id: 'entry-2',
          username: 'bob',
          chinese_character: '再见',
          pinyin: 'zài jiàn',
          han_vietnamese: null,
          modern_vietnamese: 'Tạm biệt',
          english_meaning: 'Goodbye',
          learning_note: null,
          chapter: 1,
          created_at: new Date('2024-01-02T00:00:00Z'),
          updated_at: new Date('2024-01-02T00:00:00Z'),
          shared_from: null
        },
        {
          id: 'entry-3',
          username: 'charlie',
          chinese_character: '谢谢',
          pinyin: 'xiè xiè',
          han_vietnamese: null,
          modern_vietnamese: 'Cảm ơn',
          english_meaning: 'Thank you',
          learning_note: null,
          chapter: 1,
          created_at: new Date('2024-01-03T00:00:00Z'),
          updated_at: new Date('2024-01-03T00:00:00Z'),
          shared_from: null
        }
      ];

      mockPool.query.mockResolvedValue([mockRows]);

      const backupFile = await manager.exportDatabase();
      expect(backupFile.vocabularyEntries).toHaveLength(3);

      const result = await manager.importDatabase(backupFile);
      expect(result.success).toBe(true);
      expect(result.entriesRestored).toBe(3);
    });
  });
});
