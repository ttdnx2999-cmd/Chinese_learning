import { GoogleGenerativeAI } from '@google/generative-ai';
import pinyin from 'pinyin';
import { TranslationService } from './TranslationService';

/**
 * Generated sentence for batch generation
 */
export interface GeneratedSentence {
  chineseText: string;
  pinyin: string;
  englishMeaning?: string;
  modernVietnamese?: string;
  usedCharacters: string[];
}

/**
 * AI Text Generator for Google AI Studio API integration
 * Generates reading comprehension texts using specified Chinese characters
 */
export class AITextGenerator {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private currentModelName: string = '';
  private translationService: TranslationService;
  
  // Model name — set by admin
  private static _preferredModel: string | null = 'gemini-flash-latest';
  private static _modelHistory: string[] = [];

  // Static config accessors
  static getModelConfig() {
    return {
      preferredModel: AITextGenerator._preferredModel,
      modelHistory: [...AITextGenerator._modelHistory],
    };
  }

  static setModelConfig({ preferredModel, modelHistory }: { preferredModel?: string; fallbackOrder?: string[]; modelHistory?: string[] }) {
    if (preferredModel !== undefined) {
      AITextGenerator._preferredModel = preferredModel || null;
    }
    if (modelHistory !== undefined) {
      AITextGenerator._modelHistory = modelHistory;
    }
    console.log('[AITextGenerator] Model config updated:', AITextGenerator.getModelConfig());
  }

  static getModelHistory(): string[] {
    return [...AITextGenerator._modelHistory];
  }

  static addToModelHistory(modelName: string): string[] {
    const trimmed = modelName.trim();
    if (!trimmed) return AITextGenerator._modelHistory;
    // Deduplicate, most recent first, max 20
    AITextGenerator._modelHistory = [trimmed, ...AITextGenerator._modelHistory.filter(m => m !== trimmed)].slice(0, 20);
    return [...AITextGenerator._modelHistory];
  }

  static removeFromModelHistory(modelName: string): string[] {
    AITextGenerator._modelHistory = AITextGenerator._modelHistory.filter(m => m !== modelName);
    return [...AITextGenerator._modelHistory];
  }

  constructor(translationService?: TranslationService) {
    this.translationService = translationService || new TranslationService();
  }

  private initialize() {
    if (this.genAI) {
      return; // Already initialized
    }
    
    // Read directly from process.env instead of config object
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    
    console.log('[AITextGenerator] Initializing with API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
    
    if (!apiKey) {
      throw new Error('Google AI API key is not configured. Please set GOOGLE_AI_API_KEY in .env file');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate content using the specified model (no fallback)
   * @param prompt - The prompt to send to the model
   * @returns Promise resolving to the model response
   * @throws Error if the model call fails
   */
  private async generateContentWithFallback(prompt: string): Promise<any> {
    this.initialize();
    
    const modelName = AITextGenerator._preferredModel || 'gemini-flash-latest';
    console.log(`[AITextGenerator] Using model: ${modelName}`);
    this.model = this.genAI!.getGenerativeModel({ model: modelName });
    this.currentModelName = modelName;
    
    const result = await this.model.generateContent(prompt);
    console.log(`[AITextGenerator] Successfully generated with model: ${modelName}`);
    return result;
  }

  /**
   * Generate reading comprehension text using specified characters
   * @param characters - Array of Chinese characters to use (max 300)
   * @param maxWords - Maximum number of words in generated text (default 40)
   * @returns Promise resolving to generated text with pinyin and word count
   * @throws Error if generation fails or constraints are violated
   */
  /**
   * Generate sentences for multiple vocabulary groups in a single API call
   * Uses rejection sampling: generates 75 sentences per batch, filters to 30 valid ones
   * This is optimized for the cron job to minimize API calls while ensuring quality
   * @param vocabGroupsData - Array of objects containing characters for each vocab group
   *                          Each group should have 4 batches of 300 characters
   * @returns Promise resolving to map of vocabGroupId to array of generated sentences (up to 30 per batch)
   * @throws Error if generation fails
   */
  async generateForMultipleGroups(
    vocabGroupsData: Array<{
      vocabGroupId: number;
      batches: string[][]; // 4 batches, each with 300 characters
      allVocabCharacters: string[]; // Full vocabulary list for validation
    }>
  ): Promise<Map<number, GeneratedSentence[]>> {
    // Validate input
    if (vocabGroupsData.length === 0) {
      throw new Error('vocabGroupsData cannot be empty');
    }

    for (const groupData of vocabGroupsData) {
      if (groupData.batches.length !== 4) {
        throw new Error(`Vocab group ${groupData.vocabGroupId} must have exactly 4 batches`);
      }
      for (let i = 0; i < groupData.batches.length; i++) {
        if (groupData.batches[i].length > 300) {
          throw new Error(`Vocab group ${groupData.vocabGroupId} batch ${i + 1} exceeds 300 characters`);
        }
      }
    }

    // Check if we should use mock data
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    const useMock = !apiKey || process.env.USE_MOCK_AI === 'true';

    if (useMock) {
      console.log('[AITextGenerator] Using mock data for multiple groups (API key not available or USE_MOCK_AI=true)');
      return this.generateMockForMultipleGroups(vocabGroupsData);
    }

    // Initialize on first use
    this.initialize();

    try {
      console.log('[AITextGenerator] ===== MULTI-GROUP BATCH API REQUEST =====');
      console.log('[AITextGenerator] Number of vocab groups:', vocabGroupsData.length);
      console.log('[AITextGenerator] Total batches:', vocabGroupsData.length * 4);
      console.log('[AITextGenerator] Target sentences (overshoot 40/batch):', vocabGroupsData.length * 4 * 40);

      // Minimal structural particles that are "free" — basic grammar glue
      const MINIMAL_PARTICLES = [
        '的', '了', '吗', '呢', '吧', '着', '过', '地', '得', '不',
      ];

      // Build the mega prompt for all groups and batches
      let promptSections: string[] = [];
      let sentenceCounter = 1;

      for (const groupData of vocabGroupsData) {
        for (let batchIndex = 0; batchIndex < groupData.batches.length; batchIndex++) {
          const characters = groupData.batches[batchIndex];
          
          // Use actual vocab list + minimal particles as the allowed words
          const promptChars = [...new Set([...characters, ...groupData.allVocabCharacters, ...MINIMAL_PARTICLES])];
          const charList = promptChars.join('，');

          promptSections.push(`=== GROUP ${groupData.vocabGroupId}, BATCH ${batchIndex + 1} ===
VOCABULARY: ${charList}
Output exactly 40 sentences numbered ${sentenceCounter} to ${sentenceCounter + 39}:
SENTENCE_${sentenceCounter}: [Chinese sentence only, no explanations]
SENTENCE_${sentenceCounter + 1}: [Chinese sentence only, no explanations]
...continue to SENTENCE_${sentenceCounter + 39}...`);
          sentenceCounter += 40;
        }
      }

      const megaPrompt = `You are a Chinese language teacher. Generate short Chinese sentences for practice.

RULES:
- Output ONLY the sentence after "SENTENCE_N:". NO explanations, NO English, NO parentheses, NO "Wait", NO reasoning.
- Each sentence: 5-20 Chinese characters, natural grammar, use characters from the VOCABULARY list.
- You MAY use these grammar particles freely: ${MINIMAL_PARTICLES.join(' ')}
- Sentences sometimes should have complex structure. Prioritize modal verbs, modal particles, conjunctions.

${promptSections.join('\n\n')}

IMPORTANT: Output ONLY "SENTENCE_N: [sentence]" lines. No other text whatsoever.`;

      console.log('[AITextGenerator] Mega prompt length:', megaPrompt.length);
      console.log('[AITextGenerator] Sending mega batch request to Gemini API...');

      const startTime = Date.now();
      const result = await this.generateContentWithFallback(megaPrompt);
      const endTime = Date.now();

      console.log('[AITextGenerator] Mega batch API response received in', endTime - startTime, 'ms');

      const response = await result.response;
      const responseText = response.text().trim();

      // Log token usage
      if (response.usageMetadata) {
        console.log('[AITextGenerator] ===== TOKEN USAGE =====');
        console.log('[AITextGenerator] Prompt tokens:', response.usageMetadata.promptTokenCount || 'N/A');
        console.log('[AITextGenerator] Completion tokens:', response.usageMetadata.candidatesTokenCount || 'N/A');
        console.log('[AITextGenerator] Total tokens:', response.usageMetadata.totalTokenCount || 'N/A');
        console.log('[AITextGenerator] =======================');
      }

      console.log('[AITextGenerator] Raw mega batch API response length:', responseText.length);

      // Parse the response to extract sentences
      // Updated regex to stop at GROUP/BATCH markers or next SENTENCE
      const sentenceRegex = /SENTENCE_\d+:\s*(.+?)(?=\s*(?:===\s*GROUP|SENTENCE_\d+:|$))/gs;
      const matches = [...responseText.matchAll(sentenceRegex)];

      console.log('[AITextGenerator] ===== PARSING RESULTS =====');
      console.log('[AITextGenerator] Total sentence matches found:', matches.length);
      console.log('[AITextGenerator] Expected (40 per batch × 4 batches):', vocabGroupsData.length * 4 * 40);
      
      // Write detailed parsing info to file for debugging
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(__dirname, '../../temp/parsing-log.txt');
      let logContent = `===== PARSING RESULTS =====\n`;
      logContent += `Total sentence matches found: ${matches.length}\n`;
      logContent += `Expected (40 per batch × 4 batches × ${vocabGroupsData.length} groups): ${vocabGroupsData.length * 4 * 40}\n\n`;

      // Group sentences by vocab group and batch
      const resultMap = new Map<number, GeneratedSentence[]>();
      let matchIndex = 0;

      // Track batches that need retry (got fewer than 30 valid sentences)
      const deficitBatches: Array<{
        groupData: typeof vocabGroupsData[0];
        batchIndex: number;
        deficit: number;
      }> = [];

      for (const groupData of vocabGroupsData) {
        const groupSentences: GeneratedSentence[] = [];
        console.log(`[AITextGenerator] ----- Processing Vocab Group ${groupData.vocabGroupId} -----`);
        logContent += `----- Processing Vocab Group ${groupData.vocabGroupId} -----\n`;

        // Build validation word list from actual vocab + minimal particles
        const validationWords = [...new Set([...groupData.allVocabCharacters, ...MINIMAL_PARTICLES])];
        const sortedValidationWords = [...validationWords].sort((a, b) => b.length - a.length);

        for (let batchIndex = 0; batchIndex < groupData.batches.length; batchIndex++) {
          console.log(`[AITextGenerator]   Batch ${batchIndex + 1}: Starting at matchIndex ${matchIndex}`);
          logContent += `  Batch ${batchIndex + 1}: Starting at matchIndex ${matchIndex}\n`;

          // Parse up to 40 sentences for this batch (overshoot)
          const batchCandidates: Array<GeneratedSentence & { invalidCharacters: string[] }> = [];
          
          for (let i = 0; i < 40 && matchIndex < matches.length; i++, matchIndex++) {
            const chineseText = matches[matchIndex][1].trim();

            if (!chineseText) {
              console.warn('[AITextGenerator] Skipping empty sentence');
              continue;
            }

            // Extract used characters and detect invalid ones using actual vocab list
            const chineseCharsOnly = chineseText.replace(/[\s\p{P}]/gu, '');
            const usedCharacters: string[] = [];
            const invalidCharacters: string[] = [];
            let remainingText = chineseCharsOnly;

            // Helper function to check if a vocab word with placeholders matches the text
            const matchesWithPlaceholder = (vocabWord: string, text: string): { matches: boolean; length: number; matchedText: string } => {
              if (!vocabWord.includes('。。。')) {
                return { 
                  matches: text.startsWith(vocabWord), 
                  length: vocabWord.length,
                  matchedText: text.startsWith(vocabWord) ? text.substring(0, vocabWord.length) : ''
                };
              }
              
              const escapedWord = vocabWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regexPattern = escapedWord.replace(/。。。/g, '[^，。；？！]+');
              
              const regex = new RegExp(`^${regexPattern}`);
              const match = text.match(regex);
              
              return { 
                matches: match !== null, 
                length: match ? match[0].length : 0,
                matchedText: match ? match[0] : ''
              };
            };

            while (remainingText.length > 0) {
              let matched = false;
              for (const char of sortedValidationWords) {
                const matchResult = matchesWithPlaceholder(char, remainingText);
                
                if (matchResult.matches) {
                  if (!usedCharacters.includes(char)) {
                    usedCharacters.push(char);
                  }
                  
                  // If this was a placeholder match, also extract vocabulary words from the matched text
                  if (char.includes('。。。') && matchResult.matchedText) {
                    let innerText = matchResult.matchedText;
                    while (innerText.length > 0) {
                      let innerMatched = false;
                      for (const innerChar of sortedValidationWords) {
                        if (innerChar.includes('。。。')) continue;
                        
                        if (innerText.startsWith(innerChar)) {
                          if (!usedCharacters.includes(innerChar)) {
                            usedCharacters.push(innerChar);
                          }
                          innerText = innerText.slice(innerChar.length);
                          innerMatched = true;
                          break;
                        }
                      }
                      if (!innerMatched) {
                        innerText = innerText.slice(1);
                      }
                    }
                  }
                  
                  remainingText = remainingText.slice(matchResult.length);
                  matched = true;
                  break;
                }
              }
              if (!matched) {
                // Character not in available list - track it
                const invalidChar = remainingText[0];
                if (!invalidCharacters.includes(invalidChar)) {
                  invalidCharacters.push(invalidChar);
                }
                remainingText = remainingText.slice(1);
              }
            }

            const pinyinText = this.generatePinyin(chineseText);

            batchCandidates.push({
              chineseText,
              pinyin: pinyinText,
              usedCharacters,
              invalidCharacters
            });
          }

          // Rejection sampling: filter out sentences with invalid characters
          const validSentences = batchCandidates.filter(s => s.invalidCharacters.length === 0);
          const invalidSentences = batchCandidates.filter(s => s.invalidCharacters.length > 0);

          console.log(`[AITextGenerator]   Batch ${batchIndex + 1} RESULTS:`);
          console.log(`[AITextGenerator]     - Candidates parsed: ${batchCandidates.length}`);
          console.log(`[AITextGenerator]     - Valid sentences: ${validSentences.length}`);
          console.log(`[AITextGenerator]     - Invalid sentences: ${invalidSentences.length}`);
          console.log(`[AITextGenerator]     - Ended at matchIndex: ${matchIndex}`);
          
          logContent += `  Batch ${batchIndex + 1} RESULTS:\n`;
          logContent += `    - Candidates parsed: ${batchCandidates.length}\n`;
          logContent += `    - Valid sentences: ${validSentences.length}\n`;
          logContent += `    - Invalid sentences: ${invalidSentences.length}\n`;
          logContent += `    - Ended at matchIndex: ${matchIndex}\n`;

          // Log invalid sentences for debugging
          if (invalidSentences.length > 0) {
            console.warn(`[AITextGenerator]   ⚠️  Rejected ${invalidSentences.length} sentences with invalid characters:`);
            logContent += `    ⚠️  Rejected ${invalidSentences.length} sentences:\n`;
            invalidSentences.slice(0, 3).forEach(s => {
              console.warn(`[AITextGenerator]       - "${s.chineseText}" [Invalid chars: ${s.invalidCharacters.join(', ')}]`);
              logContent += `      - "${s.chineseText}" [Invalid: ${s.invalidCharacters.join(', ')}]\n`;
            });
            if (invalidSentences.length > 3) {
              console.warn(`[AITextGenerator]       ... and ${invalidSentences.length - 3} more`);
              logContent += `      ... and ${invalidSentences.length - 3} more\n`;
            }
          }

          // Take up to 30 valid sentences (trim overshoot)
          const selectedSentences = validSentences.slice(0, 30);
          console.log(`[AITextGenerator]     - Selected for storage: ${selectedSentences.length}/30`);
          
          // Track deficit for retry
          if (selectedSentences.length < 30) {
            deficitBatches.push({
              groupData,
              batchIndex,
              deficit: 30 - selectedSentences.length
            });
            console.warn(`[AITextGenerator]   ⚠️  DEFICIT: Need ${30 - selectedSentences.length} more sentences for batch ${batchIndex + 1}`);
          }
          
          // Remove invalidCharacters property before adding to results
          selectedSentences.forEach(s => {
            delete (s as any).invalidCharacters;
            groupSentences.push(s);
          });
        }

        resultMap.set(groupData.vocabGroupId, groupSentences);
        console.log(`[AITextGenerator] Vocab Group ${groupData.vocabGroupId} COMPLETE: ${groupSentences.length} sentences (target: ${groupData.batches.length * 30})`);
        console.log(`[AITextGenerator] ----- End Vocab Group ${groupData.vocabGroupId} -----\n`);
        logContent += `Vocab Group ${groupData.vocabGroupId} COMPLETE: ${groupSentences.length} sentences\n\n`;
      }

      // === RETRY LOGIC: One retry for batches with deficit ===
      if (deficitBatches.length > 0) {
        console.log(`[AITextGenerator] ===== RETRY: ${deficitBatches.length} batches have deficits =====`);
        logContent += `\n===== RETRY: ${deficitBatches.length} batches have deficits =====\n`;

        // Build a retry prompt for all deficit batches
        let retrySections: string[] = [];
        let retrySentenceCounter = 1;

        for (const { groupData, batchIndex, deficit } of deficitBatches) {
          const characters = groupData.batches[batchIndex];
          const retryChars = [...new Set([...characters, ...groupData.allVocabCharacters, ...MINIMAL_PARTICLES])];
          const charList = retryChars.join('，');
          // Request overshoot on retry too (deficit + 10 extra)
          const retryCount = deficit + 10;

          retrySections.push(`=== GROUP ${groupData.vocabGroupId}, BATCH ${batchIndex + 1} (RETRY) ===
VOCABULARY: ${charList}
Output exactly ${retryCount} sentences numbered ${retrySentenceCounter} to ${retrySentenceCounter + retryCount - 1}:
SENTENCE_${retrySentenceCounter}: [Chinese sentence only]
...continue to SENTENCE_${retrySentenceCounter + retryCount - 1}...`);
          retrySentenceCounter += retryCount;
        }

        const retryPrompt = `You are a Chinese language teacher. Generate short Chinese sentences for practice.

RULES:
- Output ONLY the sentence after "SENTENCE_N:". NO explanations, NO English, NO parentheses, NO "Wait", NO reasoning.
- Each sentence: 5-20 Chinese characters, natural grammar, use characters from the VOCABULARY list.
- You MAY use these grammar particles freely: ${MINIMAL_PARTICLES.join(' ')}
- Sentences sometimes should have complex structure.

${retrySections.join('\n\n')}

IMPORTANT: Output ONLY "SENTENCE_N: [sentence]" lines. No other text whatsoever.`;

        try {
          console.log('[AITextGenerator] Sending retry request to Gemini API...');
          const retryResult = await this.generateContentWithFallback(retryPrompt);
          const retryResponse = await retryResult.response;
          const retryText = retryResponse.text().trim();
          const retryMatches = [...retryText.matchAll(sentenceRegex)];
          console.log(`[AITextGenerator] Retry response: ${retryMatches.length} sentences parsed`);

          let retryMatchIndex = 0;

          for (const { groupData, batchIndex, deficit } of deficitBatches) {
            const validationWords = [...new Set([...groupData.allVocabCharacters, ...MINIMAL_PARTICLES])];
            const sortedRetryWords = [...validationWords].sort((a, b) => b.length - a.length);
            const retryCount = deficit + 10;

            const retryCandidates: GeneratedSentence[] = [];

            for (let i = 0; i < retryCount && retryMatchIndex < retryMatches.length; i++, retryMatchIndex++) {
              const chineseText = retryMatches[retryMatchIndex][1].trim();
              if (!chineseText) continue;

              // Validate using actual vocab
              const chineseCharsOnly = chineseText.replace(/[\s\p{P}]/gu, '');
              const usedCharacters: string[] = [];
              let hasInvalid = false;
              let remainingText = chineseCharsOnly;

              while (remainingText.length > 0) {
                let matched = false;
                for (const char of sortedRetryWords) {
                  if (!char.includes('。。。') && remainingText.startsWith(char)) {
                    if (!usedCharacters.includes(char)) usedCharacters.push(char);
                    remainingText = remainingText.slice(char.length);
                    matched = true;
                    break;
                  }
                }
                if (!matched) {
                  hasInvalid = true;
                  remainingText = remainingText.slice(1);
                }
              }

              if (!hasInvalid) {
                retryCandidates.push({
                  chineseText,
                  pinyin: this.generatePinyin(chineseText),
                  usedCharacters
                });
              }
            }

            // Add retry results to the group
            const groupSentences = resultMap.get(groupData.vocabGroupId) || [];
            const added = retryCandidates.slice(0, deficit);
            groupSentences.push(...added);
            resultMap.set(groupData.vocabGroupId, groupSentences);

            console.log(`[AITextGenerator]   Retry Group ${groupData.vocabGroupId} Batch ${batchIndex + 1}: +${added.length}/${deficit} needed`);
            logContent += `  Retry Group ${groupData.vocabGroupId} Batch ${batchIndex + 1}: +${added.length}/${deficit} needed\n`;
          }
        } catch (retryError) {
          console.error('[AITextGenerator] Retry failed:', retryError);
          logContent += `  Retry FAILED: ${retryError}\n`;
        }
        
        console.log('[AITextGenerator] ===== END RETRY =====');
        logContent += `===== END RETRY =====\n\n`;
      }
      
      // Write log to file
      fs.writeFileSync(logPath, logContent);
      console.log(`[AITextGenerator] Detailed parsing log written to: ${logPath}`);

      console.log('[AITextGenerator] ===== END MULTI-GROUP BATCH REQUEST =====');
      console.log('[AITextGenerator] FINAL SUMMARY:');
      let totalGenerated = 0;
      for (const [groupId, sentences] of resultMap.entries()) {
        totalGenerated += sentences.length;
        console.log(`[AITextGenerator]   Group ${groupId}: ${sentences.length} sentences (target: 120)`);
      }
      console.log(`[AITextGenerator]   TOTAL: ${totalGenerated} sentences (target: ${vocabGroupsData.length * 4 * 30})`);
      console.log('[AITextGenerator] =====================================\n');

      console.log('[AITextGenerator] ===== TRANSLATING SENTENCES TO ENGLISH AND VIETNAMESE =====');
      const allSentences: GeneratedSentence[] = [];
      for (const sentences of resultMap.values()) {
        allSentences.push(...sentences);
      }
      
      console.log(`[AITextGenerator] Translating ${allSentences.length} sentences...`);
      const chineseTexts = allSentences.map(s => s.chineseText);
      
      try {
        // Translate to both English and Vietnamese in parallel
        const [englishTranslations, vietnameseTranslations] = await Promise.all([
          this.translationService.batchTranslate(chineseTexts, 'en').catch(err => {
            console.error('[AITextGenerator] English batch translation failed:', err);
            return chineseTexts.map(text => `[English: ${text}]`);
          }),
          this.translationService.batchTranslate(chineseTexts, 'vi').catch(err => {
            console.error('[AITextGenerator] Vietnamese batch translation failed:', err);
            return chineseTexts.map(text => `[Vietnamese: ${text}]`);
          })
        ]);
        
        // Assign translations back to sentences
        let translationIndex = 0;
        for (const sentences of resultMap.values()) {
          for (const sentence of sentences) {
            sentence.englishMeaning = englishTranslations[translationIndex] || `[English: ${sentence.chineseText}]`;
            sentence.modernVietnamese = vietnameseTranslations[translationIndex] || `[Vietnamese: ${sentence.chineseText}]`;
            translationIndex++;
          }
        }
        
        console.log('[AITextGenerator] Translation completed successfully');
      } catch (error) {
        console.error('[AITextGenerator] Translation process failed:', error);
        console.log('[AITextGenerator] Continuing without translations');
        
        // Assign placeholder translations if all else fails
        for (const sentences of resultMap.values()) {
          for (const sentence of sentences) {
            if (!sentence.englishMeaning) {
              sentence.englishMeaning = `[English: ${sentence.chineseText}]`;
            }
            if (!sentence.modernVietnamese) {
              sentence.modernVietnamese = `[Vietnamese: ${sentence.chineseText}]`;
            }
          }
        }
      }
      
      console.log('[AITextGenerator] ===== END TRANSLATION =====');

      return resultMap;
    } catch (error) {
      console.error('[AITextGenerator] Multi-group batch API call failed:', error);
      if (error instanceof Error) {
        console.error('[AITextGenerator] Error message:', error.message);
        console.error('[AITextGenerator] Error stack:', error.stack);
      }
      throw error; // Re-throw instead of falling back to mock data
    }
  }

  /**
   * Generate mock sentences for multiple groups (fallback when API fails)
   */
  private generateMockForMultipleGroups(
    vocabGroupsData: Array<{
      vocabGroupId: number;
      batches: string[][];
      allVocabCharacters: string[];
    }>
  ): Map<number, GeneratedSentence[]> {
    const resultMap = new Map<number, GeneratedSentence[]>();

    for (const groupData of vocabGroupsData) {
      const groupSentences: GeneratedSentence[] = [];

      for (const batch of groupData.batches) {
        const uniqueChars = Array.from(new Set(batch));

        for (let i = 0; i < 30; i++) {
          const startIdx = (i * 5) % uniqueChars.length;
          const selectedChars = uniqueChars.slice(startIdx, startIdx + Math.min(10, uniqueChars.length - startIdx));
          const chineseText = selectedChars.join('') + '。';

          groupSentences.push({
            chineseText,
            pinyin: '[Mock pinyin - API not available]',
            usedCharacters: selectedChars
          });
        }
      }

      resultMap.set(groupData.vocabGroupId, groupSentences);
    }

    return resultMap;
  }

  /**
   * Generate pinyin for Chinese text
   * @param text - Chinese text
   * @returns Pinyin with tone marks
   */
  private generatePinyin(text: string): string {
    const pinyinArray = pinyin(text, {
      style: pinyin.STYLE_TONE,
      heteronym: false
    });
    return pinyinArray.map(p => p[0]).join(' ');
  }
}

// Export singleton instance
export const aiTextGenerator = new AITextGenerator();
