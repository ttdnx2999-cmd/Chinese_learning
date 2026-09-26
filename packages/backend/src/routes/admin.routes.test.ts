/**
 * Unit tests for Admin API Routes
 */

import request from 'supertest';
import express from 'express';
import { BackupFile } from '../services/DatabaseBackupManager';

// Mock the DatabaseBackupManager before importing routes
const mockAuthenticate = jest.fn();
const mockExportDatabase = jest.fn();
const mockImportDatabase = jest.fn();

jest.mock('../services/DatabaseBackupManager', () => {
  return {
    DatabaseBackupManager: jest.fn().mockImplementation(() => {
      return {
        authenticate: mockAuthenticate,
        exportDatabase: mockExportDatabase,
        importDatabase: mockImportDatabase
      };
    })
  };
});

// Import routes after mocking
import adminRoutes, { cleanupAllSessions } from './admin.routes';

describe('Admin Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create Express app with admin routes
    app = express();
    app.use(express.json());
    app.use('/api', adminRoutes);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up all sessions after each test to prevent timer leaks
    cleanupAllSessions();
  });

  afterAll(() => {
    // Final cleanup
    cleanupAllSessions();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('POST /api/admin/authenticate', () => {
    it('should authenticate with correct password and return token', async () => {
      mockAuthenticate.mockReturnValue(true);

      const response = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn', 3600);
      expect(typeof response.body.token).toBe('string');
    });

    it('should reject authentication with incorrect password', async () => {
      mockAuthenticate.mockReturnValue(false);

      const response = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid password');
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/api/admin/authenticate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Password is required');
    });

    it('should return 400 if password is not a string', async () => {
      const response = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 12345 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Password is required');
    });
  });

  describe('GET /api/admin/backup', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/backup');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid or expired session');
    });

    it('should export database with valid authentication', async () => {
      // First authenticate
      mockAuthenticate.mockReturnValue(true);
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Mock backup file
      const mockBackupFile: BackupFile = {
        version: '1.0',
        exportedAt: new Date(),
        users: ['testuser'],
        vocabularyEntries: [
          {
            id: '1',
            username: 'testuser',
            chineseCharacter: '你好',
            pinyin: 'nǐ hǎo',
            hanVietnamese: 'nhĩ hảo',
            modernVietnamese: 'xin chào',
            englishMeaning: 'hello',
            learningNote: 'common greeting',
            chapter: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        checksum: 'abc123'
      };

      mockExportDatabase.mockResolvedValue(mockBackupFile);

      // Export database
      const response = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version', '1.0');
      expect(response.body).toHaveProperty('vocabularyEntries');
      expect(response.body.vocabularyEntries).toHaveLength(1);
      expect(response.body).toHaveProperty('checksum', 'abc123');
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should handle export errors gracefully', async () => {
      // First authenticate
      mockAuthenticate.mockReturnValue(true);
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Mock export error
      mockExportDatabase.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to export database');
    });
  });

  describe('POST /api/admin/restore', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/admin/restore')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', 'Bearer invalid-token')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid or expired session');
    });

    it('should restore database with valid authentication and backup file', async () => {
      // First authenticate
      mockAuthenticate.mockReturnValue(true);
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Mock backup file
      const backupFile: BackupFile = {
        version: '1.0',
        exportedAt: new Date(),
        users: ['testuser'],
        vocabularyEntries: [
          {
            id: '1',
            username: 'testuser',
            chineseCharacter: '你好',
            pinyin: 'nǐ hǎo',
            hanVietnamese: 'nhĩ hảo',
            modernVietnamese: 'xin chào',
            englishMeaning: 'hello',
            learningNote: 'common greeting',
            chapter: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        checksum: 'abc123'
      };

      mockImportDatabase.mockResolvedValue({
        success: true,
        entriesRestored: 1
      });

      const response = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(backupFile);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Database restored successfully');
      expect(response.body).toHaveProperty('entriesRestored', 1);
    });

    it('should return 400 for invalid backup file format', async () => {
      // First authenticate
      mockAuthenticate.mockReturnValue(true);
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      // Mock importDatabase to return validation failure for invalid data
      mockImportDatabase.mockResolvedValue({
        success: false,
        entriesRestored: 0,
        errors: ['Invalid backup file format']
      });

      // Send invalid data (missing required fields)
      const response = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send({ invalid: 'data' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Failed to restore database');
    });

    it('should return 400 when restore fails validation', async () => {
      // First authenticate
      mockAuthenticate.mockReturnValue(true);
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      const backupFile: BackupFile = {
        version: '1.0',
        exportedAt: new Date(),
        users: [],
        vocabularyEntries: [],
        checksum: 'invalid'
      };

      mockImportDatabase.mockResolvedValue({
        success: false,
        entriesRestored: 0,
        errors: ['Checksum mismatch - backup file may be corrupted']
      });

      const response = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(backupFile);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Failed to restore database');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toContain('Checksum mismatch - backup file may be corrupted');
    });

    it('should handle restore errors gracefully', async () => {
      // First authenticate
      mockAuthenticate.mockReturnValue(true);
      const authResponse = await request(app)
        .post('/api/admin/authenticate')
        .send({ password: 'test-only-admin-password' });

      const token = authResponse.body.token;

      const backupFile: BackupFile = {
        version: '1.0',
        exportedAt: new Date(),
        users: [],
        vocabularyEntries: [],
        checksum: 'abc123'
      };

      mockImportDatabase.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', `Bearer ${token}`)
        .send(backupFile);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to restore database');
    });
  });

  describe('Authentication token expiration', () => {
    it('should expire token after timeout', async () => {
      jest.useFakeTimers();

      try {
        // Authenticate
        mockAuthenticate.mockReturnValue(true);
        const authResponse = await request(app)
          .post('/api/admin/authenticate')
          .send({ password: 'test-only-admin-password' });

        const token = authResponse.body.token;

        // Token should work immediately
        mockExportDatabase.mockResolvedValue({
          version: '1.0',
          exportedAt: new Date(),
          users: [],
          vocabularyEntries: [],
          checksum: 'abc123'
        });

        let response = await request(app)
          .get('/api/admin/backup')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);

        // Fast-forward time by 1 hour + 1ms to ensure timeout fires
        jest.advanceTimersByTime(60 * 60 * 1000 + 1);

        // Token should be expired
        response = await request(app)
          .get('/api/admin/backup')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'Invalid or expired session');
      } finally {
        // Always restore real timers
        jest.useRealTimers();
      }
    });
  });
});
