/**
 * Integration tests for Admin API Routes
 * 
 * Tests the complete flow of authentication, backup, and restore operations
 * with real database interactions.
 */

import request from 'supertest';
import express from 'express';
import adminRoutes from './admin.routes';
import { initDatabase, getPool, closeDatabase } from '../config/database';
import { VocabularyEntryDAO } from '../models/VocabularyEntry';

describe('Admin Routes Integration Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Initialize database
    await initDatabase();

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api', adminRoutes);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clear database before each test
    const pool = getPool();
    await pool.query('DELETE FROM vocabulary_entries');
  });

  describe('Complete backup and restore workflow', () => {
    it('should authenticate, backup, restore database successfully', async () => {
      // Step 1: Create test data
      const testEntries = [
        {
          username: 'user1',
          chineseCharacter: '你好',
          pinyin: 'nǐ hǎo',
          hanVietnamese: 'nhĩ hảo',
          modernVietnamese: 'xin chào',
          englishMeaning: 'hello',
          learningNote: 'common greeting',
          chapter: 1
        },
        {
          username: 'user1',
          chineseCharacter: '谢谢',
          pinyin: 'xiè xiè',
          hanVietnamese: 'tạ tạ',
          modernVietnamese: 'cảm ơn',
          englishMeaning: 'thank you',
          learningNote: 'polite expression',
          chapter: 1
        },
        {
          username: 'user2',
          chineseCharacter: '再见',
          pinyin: 'zài jiàn',
          hanVietnamese: 'tái kiến',
          modernVietnamese: 'tạm biệt',
          englishMeaning: 'goodbye',
          learningNote: 'farewell',
          chapter: 2
        }
      ];

      for (const entry of testEntries) {
        const { username, ...entryData } = entry;
        await VocabularyEntryDAO.create(username, entryData);
      }

      // Step 2: Authenticate
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      expect(authResponse.status).toBe(200);
      expect(authResponse.body).toHaveProperty('token');
      const token = authResponse.body.token;

      // Step 3: Export backup
      const backupResponse = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', `Bearer ${token}`);

      expect(backupResponse.status).toBe(200);
      expect(backupResponse.body).toHaveProperty('version', '1.0');
      expect(backupResponse.body).toHaveProperty('vocabularyEntries');
      expect(backupResponse.body.vocabularyEntries).toHaveLength(3);
      expect(backupResponse.body).toHaveProperty('checksum');

      const backupFile = backupResponse.body;

      // Step 4: Verify backup contains all data
      const backupEntry1 = backupFile.vocabularyEntries.find((e: any) => e.chineseCharacter === '你好');
      expect(backupEntry1).toBeDefined();
      expect(backupEntry1.chineseCharacter).toBe('你好');
      expect(backupEntry1.username).toBe('user1');

      // Step 5: Add new entry to database (to verify it gets erased)
      await VocabularyEntryDAO.create('user3', {
        chineseCharacter: '早上好',
        pinyin: 'zǎo shàng hǎo',
        modernVietnamese: 'chào buổi sáng',
        englishMeaning: 'good morning',
        chapter: 1
      });

      // Verify 4 entries exist
      let pool = getPool();
      let [allRows] = await pool.query('SELECT * FROM vocabulary_entries');
      expect((allRows as any[]).length).toBe(4);

      // Step 6: Restore from backup
      const restoreResponse = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(backupFile);

      if (restoreResponse.status !== 200) {
        console.log('Restore failed with status:', restoreResponse.status);
        console.log('Error details:', JSON.stringify(restoreResponse.body, null, 2));
      }

      expect(restoreResponse.status).toBe(200);
      expect(restoreResponse.body).toHaveProperty('success', true);
      expect(restoreResponse.body).toHaveProperty('entriesRestored', 3);

      // Step 7: Verify database was restored correctly
      pool = getPool();
      const [restoredRows] = await pool.query('SELECT * FROM vocabulary_entries');
      const restoredEntries = restoredRows as any[];
      expect(restoredEntries).toHaveLength(3);

      // Verify original entries are restored
      const restored1 = restoredEntries.find(e => e.chinese_character === '你好');
      expect(restored1).toBeDefined();
      expect(restored1?.username).toBe('user1');

      const restored2 = restoredEntries.find(e => e.chinese_character === '谢谢');
      expect(restored2).toBeDefined();
      expect(restored2?.username).toBe('user1');

      const restored3 = restoredEntries.find(e => e.chinese_character === '再见');
      expect(restored3).toBeDefined();
      expect(restored3?.username).toBe('user2');

      // Verify new entry was erased
      const erased = restoredEntries.find(e => e.chinese_character === '早上好');
      expect(erased).toBeUndefined();
    });

    it('should reject restore with corrupted backup file', async () => {
      // Authenticate
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Create corrupted backup file (invalid checksum)
      const corruptedBackup = {
        version: '1.0',
        exportedAt: new Date(),
        vocabularyEntries: [
          {
            id: 'test-1',
            username: 'user1',
            chineseCharacter: '你好',
            pinyin: 'nǐ hǎo',
            modernVietnamese: 'xin chào',
            englishMeaning: 'hello',
            chapter: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        checksum: 'invalid-checksum'
      };

      const restoreResponse = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(corruptedBackup);

      expect(restoreResponse.status).toBe(400);
      expect(restoreResponse.body).toHaveProperty('error', 'Failed to restore database');
      expect(restoreResponse.body.details).toContain('Checksum mismatch - backup file may be corrupted');
    });

    it('should reject restore with missing required fields', async () => {
      // Authenticate
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Create backup with missing required fields
      const invalidBackup = {
        version: '1.0',
        exportedAt: new Date(),
        vocabularyEntries: [
          {
            id: 'test-1',
            username: 'user1',
            // Missing chineseCharacter
            pinyin: 'nǐ hǎo',
            chapter: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        checksum: 'dummy'
      };

      const restoreResponse = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidBackup);

      expect(restoreResponse.status).toBe(400);
      expect(restoreResponse.body).toHaveProperty('error', 'Failed to restore database');
    });

    it('should preserve all fields during backup and restore', async () => {
      // Create entry with all fields populated
      const completeEntry = {
        chineseCharacter: '学习',
        pinyin: 'xué xí',
        hanVietnamese: 'học tập',
        modernVietnamese: 'học tập',
        englishMeaning: 'to study',
        learningNote: 'important verb',
        chapter: 5
      };

      await VocabularyEntryDAO.create('testuser', completeEntry);

      // Authenticate
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Backup
      const backupResponse = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', `Bearer ${token}`);

      expect(backupResponse.status).toBe(200);
      const backupFile = backupResponse.body;

      // Verify all fields in backup
      const backedUpEntry = backupFile.vocabularyEntries[0];
      expect(backedUpEntry.username).toBe('testuser');
      expect(backedUpEntry.chineseCharacter).toBe('学习');
      expect(backedUpEntry.pinyin).toBe('xué xí');
      expect(backedUpEntry.hanVietnamese).toBe('học tập');
      expect(backedUpEntry.modernVietnamese).toBe('học tập');
      expect(backedUpEntry.englishMeaning).toBe('to study');
      expect(backedUpEntry.learningNote).toBe('important verb');
      expect(backedUpEntry.chapter).toBe(5);

      // Clear database
      let pool = getPool();
      await pool.query('DELETE FROM vocabulary_entries');

      // Restore
      const restoreResponse = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(backupFile);

      expect(restoreResponse.status).toBe(200);

      // Verify all fields after restore
      pool = getPool();
      const [restoredRows] = await pool.query('SELECT * FROM vocabulary_entries WHERE username = ?', ['testuser']);
      const restoredEntries = restoredRows as any[];
      expect(restoredEntries).toHaveLength(1);

      const restoredEntry = restoredEntries[0];
      expect(restoredEntry.username).toBe('testuser');
      expect(restoredEntry.chinese_character).toBe('学习');
      expect(restoredEntry.pinyin).toBe('xué xí');
      expect(restoredEntry.han_vietnamese).toBe('học tập');
      expect(restoredEntry.modern_vietnamese).toBe('học tập');
      expect(restoredEntry.english_meaning).toBe('to study');
      expect(restoredEntry.learning_note).toBe('important verb');
      expect(restoredEntry.chapter).toBe(5);
    });
  });

  describe('Authentication security', () => {
    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid password');
    });

    it('should reject backup without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/backup');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication required');
    });

    it('should reject restore without authentication', async () => {
      const response = await request(app)
        .post('/api/admin/restore')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication required');
    });

    it('should reject operations with invalid token', async () => {
      const backupResponse = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', 'Bearer invalid-token');

      expect(backupResponse.status).toBe(401);

      const restoreResponse = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', 'Bearer invalid-token')
        .send({});

      expect(restoreResponse.status).toBe(401);
    });
  });

  describe('Empty database handling', () => {
    it('should backup and restore empty database', async () => {
      // Authenticate
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Backup empty database
      const backupResponse = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', `Bearer ${token}`);

      expect(backupResponse.status).toBe(200);
      expect(backupResponse.body.vocabularyEntries).toHaveLength(0);

      const backupFile = backupResponse.body;

      // Restore empty backup
      const restoreResponse = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(backupFile);

      expect(restoreResponse.status).toBe(200);
      expect(restoreResponse.body.entriesRestored).toBe(0);

      // Verify database is still empty
      const pool = getPool();
      const [rows] = await pool.query('SELECT * FROM vocabulary_entries');
      expect((rows as any[]).length).toBe(0);
    });
  });
});
