/**
 * Admin API Routes
 * 
 * Provides password-protected REST API endpoints for database backup and restore:
 * - POST /api/admin/authenticate - Authenticate with password
 * - GET /api/admin/backup - Export database backup (requires authentication)
 * - POST /api/admin/restore - Import and restore database (requires authentication)
 */

import { Router, Request, Response } from 'express';
import { DatabaseBackupManager } from '../services/DatabaseBackupManager';
import { AuthService } from '../services/AuthService';

const router = Router();
const backupManager = new DatabaseBackupManager();

// In-memory session storage for authenticated sessions
// In production, use Redis or similar for distributed sessions
interface Session {
  token: string;
  expiresAt: number;
  timeoutId?: NodeJS.Timeout;
}

const authenticatedSessions = new Map<string, Session>();

/**
 * Generate a simple session token
 */
function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Clean up expired session
 */
function cleanupSession(token: string) {
  const session = authenticatedSessions.get(token);
  if (session?.timeoutId) {
    clearTimeout(session.timeoutId);
  }
  authenticatedSessions.delete(token);
}

/**
 * Clean up all sessions (for testing)
 */
export function cleanupAllSessions() {
  for (const [token] of authenticatedSessions) {
    cleanupSession(token);
  }
  authenticatedSessions.clear();
}

/**
 * Middleware to check authentication (session-based for admin restore)
 */
function requireAdminAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  const payload = AuthService.verifyToken(token);
  if (payload?.temporaryAdmin && payload.role === 'admin') return next();
  const session = authenticatedSessions.get(token);
  
  if (!session || Date.now() > session.expiresAt) {
    if (session) {
      cleanupSession(token);
    }
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  next();
}

/**
 * POST /api/admin/authenticate
 * 
 * Authenticate with user's password and receive session token
 * Password is matched against the currently logged-in user's secret phrase
 */
router.post('/admin/authenticate', async (req: Request, res: Response) => {
  try {
    const { password, username } = req.body;

    console.log('[AdminAuth] Authentication attempt:', { username, passwordProvided: !!password });

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Verify password against user's account
    console.log('[AdminAuth] Attempting to authenticate user:', username);
    const isValid = await backupManager.authenticateUser(username, password);
    
    console.log('[AdminAuth] Authentication result:', { username, isValid });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate session token
    const token = generateSessionToken();
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour from now
    
    const session: Session = {
      token,
      expiresAt
    };

    // Set token expiration (1 hour)
    const timeoutId = setTimeout(() => {
      cleanupSession(token);
    }, 60 * 60 * 1000);
    
    session.timeoutId = timeoutId;
    authenticatedSessions.set(token, session);

    console.log('[AdminAuth] Authentication successful for user:', username);
    res.json({ 
      success: true,
      token,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/admin/backup
 * 
 * Export complete database backup (requires authentication)
 */
router.get('/admin/backup', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    // If username query param is provided, export only that user's vocabulary
    const username = req.query.username as string | undefined;
    console.log(`[AdminBackup] Export requested. Username filter: ${username || 'NONE (all users)'}`);
    const backupFile = await backupManager.exportDatabase(username);

    // Set headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chinese-learning-backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(backupFile);
  } catch (error) {
    console.error('Error exporting database:', error);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

/**
 * POST /api/admin/restore
 * 
 * Import and restore database from backup file (requires session authentication)
 * Assigns vocabulary entries to the specified username (or "admin" if not provided)
 */
router.post('/admin/restore', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    // Extract backup file and username from request
    const { backupFile, username } = req.body;

    console.log('[AdminRestore] Request received:', { 
      backupFileSize: backupFile?.vocabularyEntries?.length || 0,
      requestedUsername: username,
      timestamp: new Date().toISOString()
    });

    if (!backupFile || typeof backupFile !== 'object') {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    // Use provided username or default to "admin"
    const targetUsername = username || 'admin';
    console.log('[AdminRestore] Will restore as user:', targetUsername);

    // Restore to the specified user
    const result = await backupManager.importDatabase(backupFile, targetUsername);

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Failed to restore database',
        details: result.errors
      });
    }

    res.json({
      success: true,
      message: 'Database restored successfully',
      entriesRestored: result.entriesRestored,
      assignedTo: targetUsername
    });
  } catch (error) {
    console.error('Error restoring database:', error);
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

/**
 * GET /api/admin/export-complete
 * 
 * Export complete database including all users and vocabulary (requires authentication)
 * Only available to admin users
 */
router.get('/admin/export-complete', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { AdminBackupManager } = await import('../services/AdminBackupManager');
    const adminBackupManager = new AdminBackupManager();

    const backupFile = await adminBackupManager.exportCompleteDatabase();

    // Set headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `chinese-learning-admin-backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(backupFile);
  } catch (error) {
    console.error('Error exporting complete database:', error);
    res.status(500).json({ error: 'Failed to export complete database' });
  }
});

/**
 * POST /api/admin/import-complete
 * 
 * Import complete database backup, replacing ALL data (requires session authentication)
 * Only available to admin users
 * WARNING: This will erase all existing data!
 */
router.post('/admin/import-complete', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { backupFile } = req.body;

    if (!backupFile || typeof backupFile !== 'object') {
      return res.status(400).json({ error: 'Invalid backup file format' });
    }

    const { AdminBackupManager } = await import('../services/AdminBackupManager');
    const adminBackupManager = new AdminBackupManager();

    console.log('[AdminImportComplete] Starting complete database import');
    const result = await adminBackupManager.importCompleteDatabase(backupFile);

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Failed to import complete database',
        details: result.errors
      });
    }

    res.json({
      success: true,
      message: 'Complete database imported successfully',
      usersRestored: result.usersRestored,
      entriesRestored: result.entriesRestored
    });
  } catch (error) {
    console.error('Error importing complete database:', error);
    res.status(500).json({ error: 'Failed to import complete database' });
  }
});

export default router;
