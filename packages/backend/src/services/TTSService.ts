import axios from 'axios';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';

/**
 * Audio data result containing audio URL, format, and duration
 */
export interface AudioData {
  audioUrl: string;
  format: 'mp3' | 'wav';
  duration: number;
}

/**
 * TTS Service using Google Translate TTS
 * Provides text-to-speech pronunciation for Chinese characters
 */
export class TTSService {
  private readonly tempDir: string;

  constructor() {
    // Temporary directory for audio files
    this.tempDir = join(process.cwd(), 'temp', 'audio');
  }

  /**
   * Generate pronunciation audio for Chinese text using Google Translate TTS
   * @param chineseText - The Chinese text to pronounce
   * @returns Promise resolving to audio data with URL and metadata
   * @throws Error if TTS generation fails
   */
  async pronounce(chineseText: string): Promise<AudioData> {
    if (!chineseText || chineseText.trim().length === 0) {
      throw new Error('Chinese text cannot be empty');
    }

    try {
      // Generate unique filename
      const filename = `${randomUUID()}.mp3`;
      const filepath = join(this.tempDir, filename);

      // Use Google Translate TTS API (free, no API key required)
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encodeURIComponent(chineseText)}`;
      
      const response = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Save audio file
      await writeFile(filepath, response.data);

      // Return relative URL path
      const audioUrl = `/audio/${filename}`;

      // Estimate duration (rough estimate: ~0.5 seconds per character)
      const duration = Math.ceil(chineseText.length * 0.5);

      return {
        audioUrl,
        format: 'mp3',
        duration
      };
    } catch (error) {
      console.error('TTS Error details:', error);
      throw new Error(`Failed to generate pronunciation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up temporary audio file
   * @param audioUrl - The audio URL to clean up
   */
  async cleanup(audioUrl: string): Promise<void> {
    try {
      const filename = audioUrl.split('/').pop();
      if (filename) {
        const filepath = join(this.tempDir, filename);
        await unlink(filepath);
      }
    } catch (error) {
      // Ignore cleanup errors
      console.error('Failed to cleanup audio file:', error);
    }
  }
}

// Export singleton instance
export const ttsService = new TTSService();
