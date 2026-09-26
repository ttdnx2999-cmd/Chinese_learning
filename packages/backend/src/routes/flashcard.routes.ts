/**
 * Flashcard API Routes
 * 
 * Provides REST API endpoints for flashcard functionality:
 * - GET /api/:username/flashcard/next - Get next flashcard
 * - GET /api/:username/flashcard/:id/answer - Reveal flashcard answer
 */

import { Router, Request, Response } from 'express';
import { FlashcardEngine, FlashcardMode } from '../services/FlashcardEngine';
import { ChapterRange } from '../services/ChapterFilter';

const router = Router();

/**
 * GET /api/:username/flashcard/next
 * 
 * Get next flashcard for specified mode and chapter range
 * 
 * Query Parameters:
 * - mode: FlashcardMode (ChineseToMeanings, EnglishToChinese, VietnameseToChinese)
 * - chapterStart: number (required)
 * - chapterEnd: number (required)
 * 
 * Response:
 * - 200: Flashcard object
 * - 400: Invalid parameters
 * - 404: No vocabulary found
 * - 500: Server error
 */
router.get('/:username/flashcard/next', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { mode, chapterStart, chapterEnd } = req.query;

    // Validate username
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid username' 
      });
    }

    // Validate mode
    if (!mode || typeof mode !== 'string') {
      return res.status(400).json({ 
        error: 'Mode parameter is required' 
      });
    }

    if (!Object.values(FlashcardMode).includes(mode as FlashcardMode)) {
      return res.status(400).json({ 
        error: 'Invalid mode. Must be one of: ChineseToMeanings, EnglishToChinese, VietnameseToChinese' 
      });
    }

    // Validate chapter range
    if (!chapterStart || !chapterEnd) {
      return res.status(400).json({ 
        error: 'chapterStart and chapterEnd parameters are required' 
      });
    }

    const start = parseInt(chapterStart as string, 10);
    const end = parseInt(chapterEnd as string, 10);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ 
        error: 'chapterStart and chapterEnd must be valid numbers' 
      });
    }

    if (start < 1 || end < 1) {
      return res.status(400).json({ 
        error: 'Chapter numbers must be positive integers' 
      });
    }

    if (start > end) {
      return res.status(400).json({ 
        error: 'chapterStart must be less than or equal to chapterEnd' 
      });
    }

    const chapterRange: ChapterRange = { start, end };

    // Resolve username to userId
    const { UserDAO } = await import('../models/User');
    const user = await UserDAO.findByUsername(username);
    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }

    // Get next flashcard
    const flashcard = await FlashcardEngine.getNextCard(
      user.id,
      mode as FlashcardMode,
      chapterRange
    );

    res.json(flashcard);
  } catch (error) {
    console.error('Error getting next flashcard:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('No vocabulary found') || 
          error.message.includes('Invalid chapter range')) {
        return res.status(404).json({ 
          error: error.message 
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to get next flashcard' 
    });
  }
});

/**
 * GET /api/:username/flashcard/:id/answer
 * 
 * Reveal answer for a flashcard
 * 
 * Path Parameters:
 * - username: string (required)
 * - id: string (flashcard ID, required)
 * 
 * Response:
 * - 200: FlashcardAnswer object
 * - 400: Invalid parameters
 * - 404: Flashcard not found
 * - 500: Server error
 */
router.get('/:username/flashcard/:id/answer', async (req: Request, res: Response) => {
  try {
    const { username, id } = req.params;

    // Validate username
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid username' 
      });
    }

    // Validate flashcard ID
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid flashcard ID' 
      });
    }

    // Reveal answer
    const answer = await FlashcardEngine.revealAnswer(id);

    res.json(answer);
  } catch (error) {
    console.error('Error revealing flashcard answer:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || 
          error.message.includes('expired')) {
        return res.status(404).json({ 
          error: error.message 
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to reveal flashcard answer' 
    });
  }
});

export default router;
