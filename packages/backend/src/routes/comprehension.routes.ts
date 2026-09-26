/**
 * Text Comprehension API Routes
 * 
 * Provides REST API endpoints for text comprehension functionality:
 * - GET /api/:username/comprehension/character-info - Get character details
 */

import { Router, Request, Response } from 'express';
import { VocabularyEntryDAO } from '../models/VocabularyEntry';

const router = Router();

/**
 * GET /api/:username/comprehension/character-info
 * 
 * Get detailed information for a specific Chinese character
 * 
 * Query Parameters:
 * - character: string (required) - Single Chinese character
 * 
 * Response:
 * - 200: Character details object
 * - 400: Invalid parameters
 * - 404: Character not found
 * - 500: Server error
 */
router.get('/:username/comprehension/character-info', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { character } = req.query;

    // Validate username
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid username' 
      });
    }

    // Validate character parameter
    if (!character || typeof character !== 'string') {
      return res.status(400).json({ 
        error: 'character parameter is required' 
      });
    }

    if (character.length === 0) {
      return res.status(400).json({ 
        error: 'character cannot be empty' 
      });
    }

    // Resolve username to userId
    const { UserDAO } = await import('../models/User');
    const user = await UserDAO.findByUsername(username);
    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }

    // Find vocabulary entry for this character
    const entries = await VocabularyEntryDAO.findByUserId(user.id);
    const entry = entries.find(e => e.chineseCharacter === character);

    if (!entry) {
      return res.status(404).json({ 
        error: 'Character not found in vocabulary' 
      });
    }

    res.json({
      chineseCharacter: entry.chineseCharacter,
      pinyin: entry.pinyin,
      hanVietnamese: entry.hanVietnamese,
      modernVietnamese: entry.modernVietnamese,
      englishMeaning: entry.englishMeaning,
      isFavorite: entry.isFavorite,
      learningNote: entry.learningNote,
      chapter: entry.chapter
    });
  } catch (error) {
    console.error('Error getting character info:', error);
    res.status(500).json({ 
      error: 'Failed to get character information' 
    });
  }
});

export default router;
