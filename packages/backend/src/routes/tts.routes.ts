/**
 * Text-to-Speech API Routes
 * 
 * Provides REST API endpoints for TTS functionality:
 * - GET /api/tts/pronounce - Generate pronunciation audio for Chinese text
 */

import { Router, Request, Response } from 'express';
import { ttsService } from '../services/TTSService';

const router = Router();

/**
 * GET /api/tts/pronounce
 * 
 * Generate pronunciation audio for Chinese text
 * 
 * Query Parameters:
 * - text: string (required) - Chinese text to pronounce
 * 
 * Response:
 * - 200: Audio data object with audioUrl, format, and duration
 * - 400: Invalid parameters
 * - 500: Server error
 */
router.get('/tts/pronounce', async (req: Request, res: Response) => {
  try {
    const { text } = req.query;

    // Validate text parameter
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'text parameter is required' 
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({ 
        error: 'text cannot be empty' 
      });
    }

    // Generate pronunciation audio
    const audioData = await ttsService.pronounce(text);

    res.json(audioData);
  } catch (error) {
    console.error('Error generating pronunciation:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('cannot be empty')) {
        return res.status(400).json({ 
          error: error.message 
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to generate pronunciation' 
    });
  }
});

export default router;
