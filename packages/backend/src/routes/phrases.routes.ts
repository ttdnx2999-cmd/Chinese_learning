/**
 * Phrases API Routes
 * 
 * Provides REST API endpoints for pre-generated phrases feature:
 * - GET /api/phrases/vocab-groups - Get all vocab groups with sentence counts
 * - GET /api/phrases/sentences/:vocabGroupId - Get all sentences for a vocab group
 * - GET /api/phrases/character-info/:character - Get character details from vocabulary
 * - POST /api/phrases/generate - Manually trigger sentence generation
 */

import { Router, Request, Response } from 'express';
import { PhraseGeneratorService } from '../services/PhraseGeneratorService';
import { getPool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { translationService } from '../services/TranslationService';
import { authenticateJWT, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();
const phraseGenerator = new PhraseGeneratorService();

/**
 * GET /api/phrases/vocab-groups
 * 
 * Get all 5 vocab groups with chapter ranges and sentence counts
 * 
 * Response:
 * - 200: Array of vocab groups with id, chapterStart, chapterEnd, sentenceCount
 * - 500: Server error
 */
router.get('/phrases/vocab-groups', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    let userId = req.user?.userId || 0;
    
    // If child user, use parent's userId for phrases (children see parent's phrases)
    if (req.user?.role === 'child' && req.user?.parentId) {
      userId = req.user.parentId;
      console.log(`[Phrases] Child user ${req.user.username} (id=${req.user.userId}) using parent's phrases (parentId=${userId})`);
    } else if (req.user?.role === 'child') {
      // Fallback: look up parent from database if not in JWT
      const { UserDAO } = await import('../models/User');
      const currentUser = await UserDAO.findById(req.user?.userId || 0);
      if (currentUser && currentUser.parentId) {
        userId = currentUser.parentId;
        console.log(`[Phrases] Child user ${req.user?.username} using parent from DB lookup (parentId=${userId})`);
      } else {
        console.log(`[Phrases] Child user ${req.user?.username} has no parent - showing own phrases`);
      }
    }
    
    console.log(`[Phrases] GET /phrases/vocab-groups - resolved userId=${userId}, role=${req.user?.role}, parentId=${req.user?.parentId}`);
    
    // Get vocab groups filtered by this user's vocabulary
    const vocabGroups = await phraseGenerator.getVocabGroups(userId);
    
    // Query database to count sentences per group FOR THIS USER
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT vocab_group_id, COUNT(*) as count 
       FROM pre_generated_sentences 
       WHERE user_id = ?
       GROUP BY vocab_group_id`,
      [userId]
    );
    
    // Create a map of vocab_group_id to sentence count
    const sentenceCounts = new Map<number, number>();
    rows.forEach((row) => {
      sentenceCounts.set(row.vocab_group_id, row.count);
    });
    
    // Build response with sentence counts
    const response = vocabGroups.map((group) => ({
      id: group.id,
      chapterStart: group.chapterStart,
      chapterEnd: group.chapterEndpoint,
      sentenceCount: sentenceCounts.get(group.id) || 0
    }));
    
    res.json(response);
  } catch (error) {
    console.error('Error getting vocab groups:', error);
    res.status(500).json({ error: 'Failed to get vocab groups' });
  }
});

/**
 * GET /api/phrases/sentences/:vocabGroupId
 * 
 * Get all sentences for a specific vocab group
 * 
 * Parameters:
 * - vocabGroupId: Integer 1-5 representing the vocab group
 * 
 * Response:
 * - 200: Array of sentences with all fields
 * - 400: Invalid vocabGroupId parameter
 * - 500: Server error
 */
router.get('/phrases/sentences/:vocabGroupId', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const vocabGroupId = parseInt(req.params.vocabGroupId, 10);
    let userId = req.user?.userId || 0;
    
    // If child user, use parent's userId for phrases
    if (req.user?.role === 'child' && req.user?.parentId) {
      userId = req.user.parentId;
    } else if (req.user?.role === 'child') {
      // Fallback: look up parent from database if not in JWT
      const { UserDAO } = await import('../models/User');
      const currentUser = await UserDAO.findById(req.user?.userId || 0);
      if (currentUser && currentUser.parentId) {
        userId = currentUser.parentId;
      }
    }
    
    // Validate vocabGroupId (must be 1-5)
    if (isNaN(vocabGroupId) || vocabGroupId < 1 || vocabGroupId > 5) {
      return res.status(400).json({ error: 'Invalid vocabGroupId. Must be between 1 and 5.' });
    }
    
    // Query sentences from database filtered by user
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, vocab_group_id, chinese_text, pinyin, english_meaning, modern_vietnamese, used_characters, generation_timestamp
       FROM pre_generated_sentences
       WHERE vocab_group_id = ? AND user_id = ?
       ORDER BY generation_timestamp DESC`,
      [vocabGroupId, userId]
    );
    
    // Format response
    const sentences = rows.map((row) => ({
      id: row.id,
      vocabGroupId: row.vocab_group_id,
      chineseText: row.chinese_text,
      pinyin: row.pinyin,
      englishMeaning: row.english_meaning,
      modernVietnamese: row.modern_vietnamese,
      // MySQL2 automatically parses JSON columns, so check if it's already an array
      usedCharacters: typeof row.used_characters === 'string' 
        ? JSON.parse(row.used_characters) 
        : row.used_characters,
      generationTimestamp: row.generation_timestamp
    }));
    
    res.json(sentences);
  } catch (error) {
    console.error('Error getting sentences:', error);
    res.status(500).json({ error: 'Failed to get sentences' });
  }
});

/**
 * GET /api/phrases/character-info/:character
 * 
 * Get character details from vocabulary database
 * 
 * Parameters:
 * - character: Chinese character to look up
 * 
 * Response:
 * - 200: Character details (chineseCharacter, pinyin, hanVietnamese, modernVietnamese, englishMeaning, isFavorite)
 * - 404: Character not found
 * - 500: Server error
 */
router.get('/phrases/character-info/:character', async (req: Request, res: Response) => {
  try {
    const character = req.params.character;
    
    // Query vocabulary database for character details
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT chinese_character, pinyin, han_vietnamese, modern_vietnamese, english_meaning, is_favorite, chapter
       FROM vocabulary_entries
       WHERE chinese_character = ?
       LIMIT 1`,
      [character]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    const row = rows[0];
    const response = {
      chineseCharacter: row.chinese_character,
      pinyin: row.pinyin,
      hanVietnamese: row.han_vietnamese,
      modernVietnamese: row.modern_vietnamese,
      englishMeaning: row.english_meaning,
      isFavorite: row.is_favorite === 1,
      chapter: row.chapter
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting character info:', error);
    res.status(500).json({ error: 'Failed to get character info' });
  }
});

/**
 * POST /api/phrases/generate
 * 
 * Manually trigger sentence generation for all vocab groups
 * 
 * Response:
 * - 200: Success status and message
 * - 503: Generation already in progress
 * - 500: Server error
 */
router.post('/phrases/generate', authenticateJWT, requireRole(['admin', 'parent']), async (req: AuthRequest, res: Response) => {
  try {
    // Use the authenticated user's userId so generation uses THEIR vocabulary
    const userId = req.user?.userId;
    console.log(`[PhrasesRoute] Manual generation triggered by userId: ${userId}`);

    // Fire generation in the background — do NOT await it.
    // The AI call takes ~2-3 minutes; awaiting it causes Nginx to 504.
    // The frontend polls for completion via vocab-groups sentenceCount changes.
    phraseGenerator.generateAllSentences(userId).then(() => {
      console.log(`[PhrasesRoute] Background generation completed for userId: ${userId}`);
    }).catch((generationError) => {
      console.error('[PhrasesRoute] Background generation error:', generationError);
    });

    // Respond immediately so the browser/Nginx don't time out
    res.json({
      success: true,
      message: 'Sentence generation started in background'
    });

  } catch (error) {
    console.error('[PhrasesRoute] Unexpected error in /phrases/generate endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start sentence generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/phrases/translate
 * 
 * Translate Chinese text to English
 * 
 * Request body:
 * - text: Chinese text to translate
 * 
 * Response:
 * - 200: { translation: string }
 * - 400: Missing text parameter
 * - 500: Server error
 */
router.post('/phrases/translate', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }
    
    const translation = await translationService.translateToEnglish(text);
    
    res.json({ translation });
  } catch (error) {
    console.error('Error translating text:', error);
    res.status(500).json({ error: 'Failed to translate text' });
  }
});

/**
 * GET /api/phrases/model-config
 * Returns the current AI model configuration (preferred model + fallback list)
 */
router.get('/phrases/model-config', async (_req: Request, res: Response) => {
  try {
    const { AITextGenerator } = await import('../services/AITextGenerator');
    const config = AITextGenerator.getModelConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting model config:', error);
    res.status(500).json({ error: 'Failed to get model config' });
  }
});

/**
 * PUT /api/phrases/model-config
 * Update the preferred model and/or fallback list
 * Body: { preferredModel?: string, fallbackOrder?: string[] }
 */
router.put('/phrases/model-config', async (req: Request, res: Response) => {
  try {
    const { preferredModel } = req.body;

    if (!preferredModel) {
      return res.status(400).json({ error: 'preferredModel is required' });
    }

    const { AITextGenerator } = await import('../services/AITextGenerator');
    AITextGenerator.setModelConfig({ preferredModel });
    
    // Also add to model history when setting a new preferred model
    if (preferredModel) {
      AITextGenerator.addToModelHistory(preferredModel);
    }
    
    const updated = AITextGenerator.getModelConfig();
    res.json(updated);
  } catch (error) {
    console.error('Error updating model config:', error);
    res.status(500).json({ error: 'Failed to update model config' });
  }
});

/**
 * POST /api/phrases/model-history
 * Add a model name to the history
 * Body: { modelName: string }
 */
router.post('/phrases/model-history', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.body;
    if (!modelName || typeof modelName !== 'string') {
      return res.status(400).json({ error: 'modelName is required' });
    }

    const { AITextGenerator } = await import('../services/AITextGenerator');
    const updated = AITextGenerator.addToModelHistory(modelName.trim());
    res.json({ modelHistory: updated });
  } catch (error) {
    console.error('Error adding to model history:', error);
    res.status(500).json({ error: 'Failed to add to model history' });
  }
});

/**
 * DELETE /api/phrases/model-history/:modelName
 * Remove a model name from the history
 */
router.delete('/phrases/model-history/:modelName', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.params;
    if (!modelName) {
      return res.status(400).json({ error: 'modelName is required' });
    }

    const { AITextGenerator } = await import('../services/AITextGenerator');
    const updated = AITextGenerator.removeFromModelHistory(decodeURIComponent(modelName));
    res.json({ modelHistory: updated });
  } catch (error) {
    console.error('Error removing from model history:', error);
    res.status(500).json({ error: 'Failed to remove from model history' });
  }
});

export default router;
