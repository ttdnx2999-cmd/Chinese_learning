/**
 * Vocabulary API Routes
 * 
 * All routes use :username in the URL for human-readable paths,
 * but internally resolve username → userId for all DB operations.
 */

import { Router, Request, Response } from 'express';
import { vocabularyManager } from '../services/VocabularyManager';
import { VocabularyInput, VocabularyEntry } from '../models/VocabularyEntry';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';
import { UserDAO } from '../models/User';

const router = Router();

/**
 * Helper: resolve username to userId. Returns null if user not found.
 */
async function resolveUserId(username: string): Promise<number | null> {
  const user = await UserDAO.findByUsername(username);
  return user ? user.id : null;
}

// ==================== Public / non-username routes ====================

router.get('/vocabulary/users', async (_req: Request, res: Response) => {
  try {
    const { getPool } = await import('../config/database');
    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT DISTINCT au.username FROM vocabulary_entries ve JOIN auth_users au ON ve.user_id = au.id ORDER BY au.username ASC`
    );
    res.json(rows.map((r: any) => r.username));
  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).json({ error: 'Failed to get all users' });
  }
});

router.post('/vocabulary/users', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: 'username is required' });
    }
    // Legacy: create in users table
    const { getPool } = await import('../config/database');
    const pool = getPool();
    await pool.query('INSERT IGNORE INTO users (username) VALUES (?)', [username.trim()]);
    res.status(201).json({ username: username.trim(), message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.delete('/vocabulary/users/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ error: 'Invalid username' });
    const { getPool } = await import('../config/database');
    const pool = getPool();
    const [result] = await pool.query<any>('DELETE FROM users WHERE username = ?', [username]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.get('/vocabulary/shared', async (req: Request, res: Response) => {
  try {
    const { chapter } = req.query;
    if (!chapter) return res.status(400).json({ error: 'chapter parameter is required' });
    const chapterNum = parseInt(chapter as string, 10);
    if (isNaN(chapterNum)) return res.status(400).json({ error: 'chapter must be a valid integer' });
    const usernames = await vocabularyManager.getSharedVocabularySources(chapterNum);
    res.json(usernames);
  } catch (error) {
    console.error('Error getting shared vocabulary sources:', error);
    res.status(500).json({ error: 'Failed to get shared vocabulary sources' });
  }
});

// ==================== Batch upload ====================

router.post('/:username/vocabulary/batch', authenticateJWT, requireRole(['admin', 'parent']), async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { characters, chapter, chapterLabel } = req.body;

    if (!username || typeof username !== 'string') return res.status(400).json({ error: 'Invalid username' });
    if (!characters || typeof characters !== 'string') return res.status(400).json({ error: 'characters is required' });
    if (!chapter || typeof chapter !== 'number' || isNaN(chapter)) return res.status(400).json({ error: 'chapter must be a valid integer' });

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    const charArray = characters.split(/[,;，；\n\r]/).map((c: string) => c.trim()).filter((c: string) => c.length > 0);
    if (charArray.length === 0) return res.status(400).json({ error: 'No valid characters found' });
    if (charArray.length > 100) return res.status(400).json({ error: 'Maximum 100 characters per batch' });

    const BATCH_SIZE = 10;
    const results = [];

    for (let i = 0; i < charArray.length; i += BATCH_SIZE) {
      const batch = charArray.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (char: string) => {
        try {
          const entry = await vocabularyManager.createEntry(userId, username, {
            chineseCharacter: char,
            chapter: chapter,
            chapterLabel: chapterLabel || undefined
          });
          return { character: char, success: true, entry };
        } catch (error) {
          return { character: char, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      results.push(...await Promise.all(batchPromises));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.status(201).json({ total: charArray.length, success: successCount, failed: failCount, results });
  } catch (error) {
    console.error('Error in batch upload:', error);
    res.status(500).json({ error: 'Failed to process batch upload' });
  }
});

// ==================== CRUD ====================

router.post('/:username/vocabulary', authenticateJWT, requireRole(['admin', 'parent']), async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const entry: VocabularyInput = req.body;

    if (!username) return res.status(400).json({ error: 'Invalid username' });
    if (!entry.chineseCharacter) return res.status(400).json({ error: 'chineseCharacter is required' });
    if (!entry.chapter || isNaN(entry.chapter)) return res.status(400).json({ error: 'chapter must be a valid integer' });

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    const createdEntry = await vocabularyManager.createEntry(userId, username, entry);
    res.status(201).json(createdEntry);
  } catch (error) {
    console.error('Error creating vocabulary entry:', error);
    res.status(500).json({ error: 'Failed to create vocabulary entry' });
  }
});

router.get('/:username/vocabulary', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { chapterStart, chapterEnd, chapterLabel } = req.query;

    if (!username) return res.status(400).json({ error: 'Invalid username' });
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    // Authorization check
    const currentUserId = req.user.userId;
    const currentRole = req.user.role;
    const currentParentId = req.user.parentId;
    
    const isOwnVocabulary = userId === currentUserId;
    const isAdmin = currentRole === 'admin';
    let isParentVocabulary = false;
    if (currentRole === 'child' && currentParentId && currentParentId === userId) {
      isParentVocabulary = true;
    }

    if (!isOwnVocabulary && !isAdmin && !isParentVocabulary) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    let entries;

    if (chapterLabel && typeof chapterLabel === 'string') {
      entries = await vocabularyManager.getEntriesByChapterLabel(userId, chapterLabel);
    } else {
      let chapterRange;
      if (chapterStart && chapterEnd) {
        const start = parseInt(chapterStart as string, 10);
        const end = parseInt(chapterEnd as string, 10);
        if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: 'chapterStart and chapterEnd must be valid numbers' });
        if (start > end) return res.status(400).json({ error: 'chapterStart must be <= chapterEnd' });
        chapterRange = { start, end };
      }
      entries = await vocabularyManager.getEntries(userId, chapterRange);
    }

    // Child user requesting own vocabulary: also fetch parent's vocabulary
    if (currentRole === 'child' && isOwnVocabulary && currentParentId) {
      try {
        let parentEntries;
        if (chapterLabel && typeof chapterLabel === 'string') {
          parentEntries = await vocabularyManager.getEntriesByChapterLabel(currentParentId, chapterLabel);
        } else {
          let chapterRange;
          if (chapterStart && chapterEnd) {
            const start = parseInt(chapterStart as string, 10);
            const end = parseInt(chapterEnd as string, 10);
            if (!isNaN(start) && !isNaN(end) && start <= end) chapterRange = { start, end };
          }
          parentEntries = await vocabularyManager.getEntries(currentParentId, chapterRange);
        }
        entries = [...entries, ...parentEntries];
      } catch (error) {
        console.error('[Vocabulary] Error fetching parent vocabulary for child:', error);
      }
    }

    res.json(entries);
  } catch (error) {
    console.error('Error getting vocabulary entries:', error);
    res.status(500).json({ error: 'Failed to get vocabulary entries' });
  }
});

// ==================== Random entries ====================

router.get('/:username/vocabulary/chapters/random', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { chapterStart, chapterEnd, chapterLabel } = req.query;

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    let randomEntry;
    if (chapterLabel && typeof chapterLabel === 'string') {
      randomEntry = await vocabularyManager.getRandomByChapterLabel(userId, chapterLabel);
    } else {
      if (!chapterStart || !chapterEnd) return res.status(400).json({ error: 'chapterStart and chapterEnd are required' });
      const start = parseInt(chapterStart as string, 10);
      const end = parseInt(chapterEnd as string, 10);
      if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: 'Invalid chapter numbers' });
      if (start > end) return res.status(400).json({ error: 'chapterStart must be <= chapterEnd' });
      randomEntry = await vocabularyManager.getRandomByChapters(userId, start, end);
    }

    if (!randomEntry) return res.status(404).json({ error: 'No entries found' });
    res.json(randomEntry);
  } catch (error) {
    console.error('Error getting random entry:', error);
    res.status(500).json({ error: 'Failed to get random entry' });
  }
});

// ==================== Chapters & labels ====================

router.get('/:username/vocabulary/chapters', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });
    const chapters = await vocabularyManager.getAvailableChapters(userId);
    res.json(chapters);
  } catch (error) {
    console.error('Error getting available chapters:', error);
    res.status(500).json({ error: 'Failed to get available chapters' });
  }
});

router.get('/:username/vocabulary/chapter-labels', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });
    const labels = await vocabularyManager.getChapterLabels(userId);
    res.json(labels);
  } catch (error) {
    console.error('Error getting chapter labels:', error);
    res.status(500).json({ error: 'Failed to get chapter labels' });
  }
});

// ==================== Translate preview ====================

router.post('/:username/vocabulary/translate', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { chineseCharacter, pinyin, modernVietnamese, englishMeaning } = req.body;
    if (!chineseCharacter) return res.status(400).json({ error: 'chineseCharacter is required' });
    const preview = await vocabularyManager.previewTranslations(chineseCharacter, pinyin, modernVietnamese, englishMeaning);
    res.json(preview);
  } catch (error) {
    console.error('Error generating translation preview:', error);
    res.status(500).json({ error: 'Failed to generate translation preview' });
  }
});

// ==================== Share ====================

router.post('/:username/vocabulary/share', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { sourceUsername, chapter } = req.body;

    if (!sourceUsername || !chapter) return res.status(400).json({ error: 'sourceUsername and chapter are required' });

    const targetUserId = await resolveUserId(username);
    if (!targetUserId) return res.status(404).json({ error: `Target user "${username}" not found` });

    const sourceUserId = await resolveUserId(sourceUsername);
    if (!sourceUserId) return res.status(404).json({ error: `Source user "${sourceUsername}" not found` });

    const copiedCount = await vocabularyManager.shareChapter(sourceUserId, targetUserId, username, chapter);
    res.json({ success: true, copiedCount });
  } catch (error) {
    console.error('Error sharing vocabulary:', error);
    res.status(500).json({ error: 'Failed to share vocabulary' });
  }
});

// ==================== Toggle favorite ====================

router.post('/:username/vocabulary/favorite', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { chineseCharacter } = req.body;

    if (!chineseCharacter) return res.status(400).json({ error: 'chineseCharacter is required' });

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    const updated = await vocabularyManager.toggleFavorite(userId, chineseCharacter);
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// ==================== Get favorites ====================

router.get('/:username/vocabulary/favorites', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { chapterStart, chapterEnd, chapterLabel } = req.query;

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    // Get all favorites with optional chapter filtering
    let entries = await vocabularyManager.getEntries(userId);
    entries = entries.filter(e => e.isFavorite);

    // Apply chapter label filter
    if (chapterLabel && typeof chapterLabel === 'string') {
      entries = entries.filter(e => e.chapterLabel === chapterLabel);
    } 
    // Apply chapter range filter
    else if (chapterStart && chapterEnd) {
      const start = parseInt(chapterStart as string, 10);
      const end = parseInt(chapterEnd as string, 10);
      if (!isNaN(start) && !isNaN(end)) {
        entries = entries.filter(e => e.chapter >= start && e.chapter <= end);
      }
    }

    if (entries.length === 0) {
      return res.status(404).json({ error: 'No favorite words found' });
    }

    res.json(entries);
  } catch (error) {
    console.error('Error getting favorite entries:', error);
    res.status(500).json({ error: 'Failed to get favorite entries' });
  }
});

// ==================== Get random favorite ====================

router.get('/:username/vocabulary/favorites/random', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { chapterStart, chapterEnd, chapterLabel } = req.query;

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    let randomEntry: VocabularyEntry | null = null;

    // Use chapter label if provided
    if (chapterLabel && typeof chapterLabel === 'string') {
      randomEntry = await vocabularyManager.getRandomFavoriteByChapterLabel(userId, chapterLabel);
    } 
    // Use chapter range if provided
    else if (chapterStart && chapterEnd) {
      const start = parseInt(chapterStart as string, 10);
      const end = parseInt(chapterEnd as string, 10);
      if (!isNaN(start) && !isNaN(end)) {
        randomEntry = await vocabularyManager.getRandomFavoriteByChapters(userId, start, end);
      }
    } 
    // Get any random favorite
    else {
      randomEntry = await vocabularyManager.getRandomFavorite(userId);
    }

    if (!randomEntry) {
      return res.status(404).json({ error: 'No favorite words found' });
    }

    res.json(randomEntry);
  } catch (error) {
    console.error('Error getting random favorite entry:', error);
    res.status(500).json({ error: 'Failed to get random favorite entry' });
  }
});

// ==================== Toggle favorite (alternative POST endpoint) ====================

router.post('/:username/vocabulary/toggle-favorite', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const { chineseCharacter } = req.body;

    if (!chineseCharacter) return res.status(400).json({ error: 'chineseCharacter is required' });

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    const updated = await vocabularyManager.toggleFavorite(userId, chineseCharacter);
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// ==================== Single entry CRUD ====================

router.get('/:username/vocabulary/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username, id } = req.params;
    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    const entry = await vocabularyManager.getEntry(userId, id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (error) {
    console.error('Error getting vocabulary entry:', error);
    res.status(500).json({ error: 'Failed to get vocabulary entry' });
  }
});

router.put('/:username/vocabulary/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username, id } = req.params;
    const updates: Partial<VocabularyInput> = req.body;

    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    const updated = await vocabularyManager.updateEntry(userId, id, updates);
    if (!updated) return res.status(404).json({ error: 'Entry not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating vocabulary entry:', error);
    res.status(500).json({ error: 'Failed to update vocabulary entry' });
  }
});

router.delete('/:username/vocabulary/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { username, id } = req.params;
    const userId = await resolveUserId(username);
    if (!userId) return res.status(404).json({ error: `User "${username}" not found` });

    const deleted = await vocabularyManager.deleteEntry(userId, id);
    if (!deleted) return res.status(404).json({ error: 'Entry not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting vocabulary entry:', error);
    res.status(500).json({ error: 'Failed to delete vocabulary entry' });
  }
});

export default router;
