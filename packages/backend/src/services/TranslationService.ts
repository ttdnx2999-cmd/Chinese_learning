import { v2 } from '@google-cloud/translate';

/**
 * Translation Service using Google Cloud Translation API with fallback to mock translations
 * Provides methods to translate Chinese text to Vietnamese and English
 */
export class TranslationService {
  private translate: v2.Translate | null = null;
  private consecutiveFailures: number = 0;
  private readonly MAX_FAILURES = 3;
  private initialized: boolean = false;
  private useMockOnly: boolean = false;

  constructor() {
    // Don't initialize in constructor - do it lazily on first use
  }

  /**
   * Initialize the translation service (lazy initialization)
   */
  private initialize() {
    if (this.initialized) return;
    
    // Check if we should use mock translations only
    if (process.env.USE_MOCK_TRANSLATIONS === 'true') {
      console.log('[Translation] Using mock translations only (USE_MOCK_TRANSLATIONS=true)');
      this.useMockOnly = true;
      this.initialized = true;
      return;
    }
    
    // Initialize Google Cloud Translate with API key
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_AI_API_KEY;
    
    console.log('[Translation] Initializing with API key:', apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT FOUND');
    
    if (apiKey) {
      try {
        // Try to initialize Google Cloud Translate
        this.translate = new v2.Translate({ key: apiKey });
        console.log('[Translation] Google Cloud Translation API initialized successfully');
      } catch (error) {
        console.warn('[Translation] Failed to initialize Google Cloud Translate:', error);
        console.warn('[Translation] Falling back to mock translations');
        this.translate = null;
        this.useMockOnly = true;
      }
    } else {
      console.warn('[Translation] No API key found, using mock translations');
      this.translate = null;
      this.useMockOnly = true;
    }
    
    this.initialized = true;
  }

  /**
   * Mock translation for testing when API is unavailable
   */
  private mockTranslate(text: string, target: 'vi' | 'en'): string {
    if (target === 'vi') {
      return `[Vietnamese translation of: ${text}]`;
    } else {
      return `[English translation of: ${text}]`;
    }
  }

  /**
   * Add delay between requests to avoid rate limiting
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Translate Chinese text to Vietnamese
   */
  async translateToVietnamese(chineseText: string): Promise<string> {
    try {
      this.initialize(); // Lazy initialization
      
      if (!this.translate || this.useMockOnly) {
        return this.mockTranslate(chineseText, 'vi');
      }

      // If too many consecutive failures, use mock temporarily
      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        console.log('[Translation] Too many failures, using mock translation for Vietnamese');
        return this.mockTranslate(chineseText, 'vi');
      }

      console.log(`[Translation] Translating to Vietnamese: ${chineseText}`);
      
      const [translation] = await this.translate.translate(chineseText, {
        from: 'zh-CN',
        to: 'vi'
      });
      
      console.log(`[Translation] Vietnamese result: ${translation}`);
      this.consecutiveFailures = 0; // Reset on success
      return translation;
    } catch (error: any) {
      this.consecutiveFailures++;
      console.error('[Translation] Translation to Vietnamese failed:', error?.message || error);
      console.log(`[Translation] Consecutive failures: ${this.consecutiveFailures}/${this.MAX_FAILURES}`);
      return this.mockTranslate(chineseText, 'vi');
    }
  }

  /**
   * Translate Chinese text to English
   */
  async translateToEnglish(chineseText: string): Promise<string> {
    try {
      this.initialize(); // Lazy initialization
      
      if (!this.translate || this.useMockOnly) {
        return this.mockTranslate(chineseText, 'en');
      }

      // If too many consecutive failures, use mock temporarily
      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        console.log('[Translation] Too many failures, using mock translation for English');
        return this.mockTranslate(chineseText, 'en');
      }

      console.log(`[Translation] Translating to English: ${chineseText}`);
      
      const [translation] = await this.translate.translate(chineseText, {
        from: 'zh-CN',
        to: 'en'
      });
      
      console.log(`[Translation] English result: ${translation}`);
      this.consecutiveFailures = 0; // Reset on success
      return translation;
    } catch (error: any) {
      this.consecutiveFailures++;
      console.error('[Translation] Translation to English failed:', error?.message || error);
      console.log(`[Translation] Consecutive failures: ${this.consecutiveFailures}/${this.MAX_FAILURES}`);
      return this.mockTranslate(chineseText, 'en');
    }
  }

  /**
   * Batch translate multiple texts to a target language
   */
  async batchTranslate(texts: string[], targetLanguage: 'vi' | 'en'): Promise<string[]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const translations = await Promise.all(
        texts.map(async (text) => {
          if (targetLanguage === 'vi') {
            return await this.translateToVietnamese(text);
          } else {
            return await this.translateToEnglish(text);
          }
        })
      );
      return translations;
    } catch (error) {
      console.error('Batch translation error:', error);
      return texts.map(text => this.mockTranslate(text, targetLanguage));
    }
  }
}

// Export singleton instance
export const translationService = new TranslationService();
