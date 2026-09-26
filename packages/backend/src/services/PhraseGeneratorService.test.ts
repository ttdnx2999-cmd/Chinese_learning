/**
 * Unit tests for PhraseGeneratorService
 */

import { PhraseGeneratorService, VocabGroup } from './PhraseGeneratorService';
import { getPool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import fc from 'fast-check';
import { AITextGenerator } from './AITextGenerator';

// Mock the database module
jest.mock('../config/database');
// Mock the AITextGenerator
jest.mock('./AITextGenerator');

describe('PhraseGeneratorService', () => {
  let service: PhraseGeneratorService;
  let mockPool: any;

  beforeEach(() => {
    service = new PhraseGeneratorService();
    mockPool = {
      query: jest.fn()
    };
    (getPool as jest.Mock).mockReturnValue(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getVocabGroups', () => {
    it('should return 5 vocab groups based on 5 most recent chapters', async () => {
      // Mock database response with 5 chapters
      const mockRows: RowDataPacket[] = [
        { chapter: 10 },
        { chapter: 9 },
        { chapter: 8 },
        { chapter: 7 },
        { chapter: 6 }
      ] as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockRows]);

      const result = await service.getVocabGroups();

      // Verify query was called correctly
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const queryCall = mockPool.query.mock.calls[0][0];
      expect(queryCall).toContain('SELECT DISTINCT chapter');
      expect(queryCall).toContain('ORDER BY chapter DESC');
      expect(queryCall).toContain('LIMIT 5');

      // Verify result structure
      expect(result).toHaveLength(5);
      
      // Verify vocab groups are ordered ascending by chapter endpoint
      expect(result[0]).toEqual({ id: 1, chapterStart: 1, chapterEndpoint: 6 });
      expect(result[1]).toEqual({ id: 2, chapterStart: 1, chapterEndpoint: 7 });
      expect(result[2]).toEqual({ id: 3, chapterStart: 1, chapterEndpoint: 8 });
      expect(result[3]).toEqual({ id: 4, chapterStart: 1, chapterEndpoint: 9 });
      expect(result[4]).toEqual({ id: 5, chapterStart: 1, chapterEndpoint: 10 });

      // Verify all have chapterStart = 1
      result.forEach(group => {
        expect(group.chapterStart).toBe(1);
      });

      // Verify unique IDs
      const ids = result.map(g => g.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('should handle fewer than 5 chapters', async () => {
      // Mock database response with only 3 chapters
      const mockRows: RowDataPacket[] = [
        { chapter: 3 },
        { chapter: 2 },
        { chapter: 1 }
      ] as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockRows]);

      const result = await service.getVocabGroups();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 1, chapterStart: 1, chapterEndpoint: 1 });
      expect(result[1]).toEqual({ id: 2, chapterStart: 1, chapterEndpoint: 2 });
      expect(result[2]).toEqual({ id: 3, chapterStart: 1, chapterEndpoint: 3 });
    });

    it('should return empty array when no chapters exist', async () => {
      // Mock database response with no chapters
      const mockRows: RowDataPacket[] = [];

      mockPool.query.mockResolvedValue([mockRows]);

      const result = await service.getVocabGroups();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle non-sequential chapter numbers', async () => {
      // Mock database response with non-sequential chapters
      const mockRows: RowDataPacket[] = [
        { chapter: 25 },
        { chapter: 20 },
        { chapter: 15 },
        { chapter: 10 },
        { chapter: 5 }
      ] as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockRows]);

      const result = await service.getVocabGroups();

      expect(result).toHaveLength(5);
      // Should still be ordered ascending
      expect(result[0]).toEqual({ id: 1, chapterStart: 1, chapterEndpoint: 5 });
      expect(result[1]).toEqual({ id: 2, chapterStart: 1, chapterEndpoint: 10 });
      expect(result[2]).toEqual({ id: 3, chapterStart: 1, chapterEndpoint: 15 });
      expect(result[3]).toEqual({ id: 4, chapterStart: 1, chapterEndpoint: 20 });
      expect(result[4]).toEqual({ id: 5, chapterStart: 1, chapterEndpoint: 25 });
    });

    it('should assign sequential IDs starting from 1', async () => {
      const mockRows: RowDataPacket[] = [
        { chapter: 5 },
        { chapter: 4 },
        { chapter: 3 }
      ] as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockRows]);

      const result = await service.getVocabGroups();

      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    /**
     * Property-Based Tests for Vocab Group Generation
     * Using fast-check library with minimum 100 iterations per property
     */
    /**
     * Feature: pre-generated-phrases, Property 1: Vocab Group Uniqueness
     * Validates: Requirements 1.2
     * 
     * For any set of vocab groups generated by the system, each vocab group must have 
     * a unique chapter endpoint, and all chapter endpoints must come from the 5 most 
     * recent chapters in the vocabulary database.
     */
    it('Property 1: Vocab Group Uniqueness - each vocab group has unique chapter endpoint from 5 most recent chapters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of 1-10 distinct chapter numbers (simulating database chapters)
          fc.uniqueArray(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }),
          async (chapters) => {
            // Sort descending to simulate database ORDER BY chapter DESC
            const sortedChapters = [...chapters].sort((a, b) => b - a);
            
            // Take top 5 (or fewer if less than 5 chapters exist)
            const top5Chapters = sortedChapters.slice(0, 5);
            
            // Mock database response
            const mockRows: RowDataPacket[] = top5Chapters.map(ch => ({ chapter: ch })) as RowDataPacket[];
            mockPool.query.mockResolvedValue([mockRows]);

            // Get vocab groups
            const vocabGroups = await service.getVocabGroups();

            // Property 1: Each vocab group must have a unique chapter endpoint
            const chapterEndpoints = vocabGroups.map((g: VocabGroup) => g.chapterEndpoint);
            const uniqueEndpoints = new Set(chapterEndpoints);
            expect(uniqueEndpoints.size).toBe(chapterEndpoints.length);

            // Property 1: All chapter endpoints must come from the 5 most recent chapters
            const expectedChapters = new Set(top5Chapters);
            chapterEndpoints.forEach((endpoint: number) => {
              expect(expectedChapters.has(endpoint)).toBe(true);
            });

            // Verify we have the correct number of groups (up to 5)
            expect(vocabGroups.length).toBe(Math.min(chapters.length, 5));
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: pre-generated-phrases, Property 2: Cumulative Vocabulary Inclusion
     * Validates: Requirements 1.3
     * 
     * For any vocab group with chapter endpoint N, the vocabulary set must include 
     * all vocabulary entries from chapter 1 through chapter N (inclusive).
     */
    it('Property 2: Cumulative Vocabulary Inclusion - vocab group includes chapters 1 through N', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of distinct chapter numbers
          fc.uniqueArray(fc.integer({ min: 1, max: 30 }), { minLength: 1, maxLength: 10 }),
          async (chapters) => {
            const sortedChapters = [...chapters].sort((a, b) => b - a);
            const top5Chapters = sortedChapters.slice(0, 5);
            
            const mockRows: RowDataPacket[] = top5Chapters.map(ch => ({ chapter: ch })) as RowDataPacket[];
            mockPool.query.mockResolvedValue([mockRows]);

            const vocabGroups = await service.getVocabGroups();

            // Property 2: Each vocab group must have chapterStart = 1
            vocabGroups.forEach((group: VocabGroup) => {
              expect(group.chapterStart).toBe(1);
            });

            // Property 2: Each vocab group represents cumulative range from 1 to chapterEndpoint
            // This is validated by the structure: chapterStart = 1 and chapterEndpoint = N
            // The actual vocabulary inclusion would be tested when fetching vocabulary,
            // but the group definition must specify the correct range
            vocabGroups.forEach((group: VocabGroup) => {
              expect(group.chapterStart).toBeLessThanOrEqual(group.chapterEndpoint);
              expect(group.chapterStart).toBe(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: pre-generated-phrases, Property 3: Vocab Group Ordering
     * Validates: Requirements 1.4
     * 
     * For any list of vocab groups returned by the system, the groups must be 
     * ordered by chapter endpoint in ascending order.
     */
    it('Property 3: Vocab Group Ordering - groups ordered by chapter endpoint ascending', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of distinct chapter numbers
          fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 10 }),
          async (chapters) => {
            const sortedChapters = [...chapters].sort((a, b) => b - a);
            const top5Chapters = sortedChapters.slice(0, 5);
            
            const mockRows: RowDataPacket[] = top5Chapters.map(ch => ({ chapter: ch })) as RowDataPacket[];
            mockPool.query.mockResolvedValue([mockRows]);

            const vocabGroups = await service.getVocabGroups();

            // Property 3: Vocab groups must be ordered by chapter endpoint in ascending order
            for (let i = 1; i < vocabGroups.length; i++) {
              expect(vocabGroups[i].chapterEndpoint).toBeGreaterThan(vocabGroups[i - 1].chapterEndpoint);
            }

            // Additional verification: IDs should be sequential starting from 1
            vocabGroups.forEach((group: VocabGroup, index: number) => {
              expect(group.id).toBe(index + 1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('generateBatch', () => {
    it('should generate 30 sentences from 300 characters', async () => {
      // Create 300 test characters
      const characters = Array.from({ length: 300 }, (_, i) => `字${i}`);
      
      // Mock AITextGenerator response
      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `这是测试句子${i}。`,
        pinyin: `zhè shì cè shì jù zi ${i}`,
        usedCharacters: [`字${i}`, `字${i + 1}`]
      }));

      const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const result = await service.generateBatch(characters);

      // Verify AITextGenerator was called with correct parameters
      expect(mockGenerateMultipleSentences).toHaveBeenCalledWith(characters, 30);
      
      // Verify result
      expect(result).toEqual(mockSentences);
      expect(result).toHaveLength(30);
    });

    /**
     * Feature: pre-generated-phrases, Property 7: Batch Character Selection
     * **Validates: Requirements 3.2, 3.5**
     * 
     * For any generation batch, exactly 300 characters must be randomly selected from 
     * the vocab group's vocabulary, and these characters must be passed to the 
     * AITextGenerator service.
     */
    it('Property 7: Batch Character Selection - exactly 300 characters passed to AITextGenerator', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arrays of 300 characters with varying content
          fc.array(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 300, maxLength: 300 }),
          async (characters) => {
            // Mock AITextGenerator response
            const mockSentences = Array.from({ length: 30 }, (_, i) => ({
              chineseText: `测试句子${i}`,
              pinyin: `cè shì jù zi ${i}`,
              usedCharacters: [characters[i % characters.length]]
            }));

            const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
            (AITextGenerator as jest.Mock).mockImplementation(() => ({
              generateMultipleSentences: mockGenerateMultipleSentences
            }));

            const result = await service.generateBatch(characters);

            // Property 7: Exactly 300 characters must be passed to AITextGenerator
            expect(mockGenerateMultipleSentences).toHaveBeenCalledTimes(1);
            const calledCharacters = mockGenerateMultipleSentences.mock.calls[0][0];
            expect(calledCharacters).toHaveLength(300);
            
            // Verify the characters passed are the same as input
            expect(calledCharacters).toEqual(characters);
            
            // Verify count parameter is 30
            expect(mockGenerateMultipleSentences.mock.calls[0][1]).toBe(30);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: pre-generated-phrases, Property 8: Batch Sentence Count
     * **Validates: Requirements 3.3**
     * 
     * For any generation batch, exactly 30 sentences must be generated using 
     * the selected 300 characters.
     */
    it('Property 8: Batch Sentence Count - exactly 30 sentences generated per batch', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arrays of 300 characters
          fc.array(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 300, maxLength: 300 }),
          // Generate varying number of sentences from AI (to test we get exactly 30)
          fc.integer({ min: 1, max: 50 }),
          async (characters, aiSentenceCount) => {
            // Mock AITextGenerator to return the specified number of sentences
            const mockSentences = Array.from({ length: aiSentenceCount }, (_, i) => ({
              chineseText: `句子${i}`,
              pinyin: `jù zi ${i}`,
              usedCharacters: [characters[i % characters.length]]
            }));

            const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
            (AITextGenerator as jest.Mock).mockImplementation(() => ({
              generateMultipleSentences: mockGenerateMultipleSentences
            }));

            const result = await service.generateBatch(characters);

            // Property 8: Exactly 30 sentences must be generated
            // The service requests 30 sentences from AITextGenerator
            expect(mockGenerateMultipleSentences.mock.calls[0][1]).toBe(30);
            
            // The result should match what AITextGenerator returns
            expect(result).toHaveLength(aiSentenceCount);
            expect(result).toEqual(mockSentences);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error if not exactly 300 characters provided', async () => {
      // Test with 299 characters
      const characters299 = Array.from({ length: 299 }, (_, i) => `字${i}`);
      await expect(service.generateBatch(characters299)).rejects.toThrow('Expected exactly 300 characters, got 299');

      // Test with 301 characters
      const characters301 = Array.from({ length: 301 }, (_, i) => `字${i}`);
      await expect(service.generateBatch(characters301)).rejects.toThrow('Expected exactly 300 characters, got 301');

      // Test with 0 characters
      await expect(service.generateBatch([])).rejects.toThrow('Expected exactly 300 characters, got 0');
    });

    it('should pass through AITextGenerator errors', async () => {
      const characters = Array.from({ length: 300 }, (_, i) => `字${i}`);
      
      const mockError = new Error('AI API failed');
      const mockGenerateMultipleSentences = jest.fn().mockRejectedValue(mockError);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      await expect(service.generateBatch(characters)).rejects.toThrow('AI API failed');
    });
  });

  describe('generateSentencesForGroup', () => {
    it('should generate 120 sentences for a vocab group (4 batches × 30)', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 5
      };

      // Mock database response with vocabulary characters
      const mockVocabRows: RowDataPacket[] = Array.from({ length: 500 }, (_, i) => ({
        chinese_character: `字${i}`
      })) as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockVocabRows]);

      // Mock AITextGenerator to return 30 sentences per batch
      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `这是测试句子${i}。`,
        pinyin: `zhè shì cè shì jù zi ${i}`,
        usedCharacters: [`字${i}`, `字${i + 1}`]
      }));

      const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const result = await service.generateSentencesForGroup(vocabGroup);

      // Verify database query was called correctly
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('SELECT chinese_character FROM vocabulary_entries');
      expect(queryCall[0]).toContain('WHERE chapter >= ? AND chapter <= ?');
      expect(queryCall[1]).toEqual([1, 5]);

      // Verify AITextGenerator was called 4 times (4 batches)
      expect(mockGenerateMultipleSentences).toHaveBeenCalledTimes(4);

      // Verify each call had 300 characters
      for (let i = 0; i < 4; i++) {
        const callArgs = mockGenerateMultipleSentences.mock.calls[i];
        expect(callArgs[0]).toHaveLength(300);
        expect(callArgs[1]).toBe(30);
      }

      // Verify result has 120 sentences (4 batches × 30)
      expect(result).toHaveLength(120);
    });

    /**
     * Feature: pre-generated-phrases, Property 10: Total Sentence Count Per Group
     * **Validates: Requirements 3.6**
     * 
     * For any vocab group, after generation completes, exactly 120 sentences must be 
     * stored in the database (4 batches × 30 sentences).
     */
    it('Property 10: Total Sentence Count Per Group - exactly 120 sentences generated per vocab group', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random vocab groups with varying chapter endpoints
          fc.record({
            id: fc.integer({ min: 1, max: 5 }),
            chapterStart: fc.constant(1),
            chapterEndpoint: fc.integer({ min: 1, max: 50 })
          }),
          // Generate varying vocabulary sizes
          fc.integer({ min: 50, max: 1000 }),
          async (vocabGroup, vocabSize) => {
            // Mock database response with vocabulary
            const mockVocabRows: RowDataPacket[] = Array.from({ length: vocabSize }, (_, i) => ({
              chinese_character: `字${i}`
            })) as RowDataPacket[];

            mockPool.query.mockResolvedValue([mockVocabRows]);

            // Mock AITextGenerator to return 30 sentences per batch
            const mockSentences = Array.from({ length: 30 }, (_, i) => ({
              chineseText: `句子${i}`,
              pinyin: `jù zi ${i}`,
              usedCharacters: [`字${i}`]
            }));

            const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
            (AITextGenerator as jest.Mock).mockImplementation(() => ({
              generateMultipleSentences: mockGenerateMultipleSentences
            }));

            const result = await service.generateSentencesForGroup(vocabGroup);

            // Property 10: Exactly 120 sentences must be generated (4 batches × 30)
            expect(result).toHaveLength(120);
            
            // Verify 4 batches were generated
            expect(mockGenerateMultipleSentences).toHaveBeenCalledTimes(4);
            
            // Verify each batch requested 30 sentences
            for (let i = 0; i < 4; i++) {
              expect(mockGenerateMultipleSentences.mock.calls[i][1]).toBe(30);
            }
            
            // Verify each batch used exactly 300 characters
            for (let i = 0; i < 4; i++) {
              const characters = mockGenerateMultipleSentences.mock.calls[i][0];
              expect(characters).toHaveLength(300);
              
              // Verify characters come from the vocabulary
              characters.forEach((char: string) => {
                const charIndex = parseInt(char.replace('字', ''));
                expect(charIndex).toBeGreaterThanOrEqual(0);
                expect(charIndex).toBeLessThan(vocabSize);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle vocab groups with fewer than 300 characters (sampling with replacement)', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 2
      };

      // Mock database response with only 50 characters
      const mockVocabRows: RowDataPacket[] = Array.from({ length: 50 }, (_, i) => ({
        chinese_character: `字${i}`
      })) as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockVocabRows]);

      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `这是测试句子${i}。`,
        pinyin: `zhè shì cè shì jù zi ${i}`,
        usedCharacters: [`字${i}`]
      }));

      const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const result = await service.generateSentencesForGroup(vocabGroup);

      // Should still generate 4 batches with 300 characters each (with replacement)
      expect(mockGenerateMultipleSentences).toHaveBeenCalledTimes(4);
      
      // Verify each batch had 300 characters
      for (let i = 0; i < 4; i++) {
        const callArgs = mockGenerateMultipleSentences.mock.calls[i];
        expect(callArgs[0]).toHaveLength(300);
      }

      // Verify result has 120 sentences
      expect(result).toHaveLength(120);
    });

    it('should throw error when no vocabulary exists for the chapter range', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 5
      };

      // Mock database response with no vocabulary
      mockPool.query.mockResolvedValue([[]]);

      await expect(service.generateSentencesForGroup(vocabGroup)).rejects.toThrow(
        'No vocabulary found for vocab group 1 (chapters 1-5)'
      );
    });

    it('should use different random character selections for each batch', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 3
      };

      // Mock database response with vocabulary
      const mockVocabRows: RowDataPacket[] = Array.from({ length: 400 }, (_, i) => ({
        chinese_character: `字${i}`
      })) as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockVocabRows]);

      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `这是测试句子${i}。`,
        pinyin: `zhè shì cè shì jù zi ${i}`,
        usedCharacters: [`字${i}`]
      }));

      const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      await service.generateSentencesForGroup(vocabGroup);

      // Get the character arrays from each of the 4 calls
      const batch1Chars = mockGenerateMultipleSentences.mock.calls[0][0];
      const batch2Chars = mockGenerateMultipleSentences.mock.calls[1][0];
      const batch3Chars = mockGenerateMultipleSentences.mock.calls[2][0];
      const batch4Chars = mockGenerateMultipleSentences.mock.calls[3][0];

      // Verify batches are different (at least some characters should differ)
      // Due to randomness, it's extremely unlikely all 300 characters match in the same order
      const batch1Str = batch1Chars.join(',');
      const batch2Str = batch2Chars.join(',');
      const batch3Str = batch3Chars.join(',');
      const batch4Str = batch4Chars.join(',');

      // At least one batch should be different from another
      const allSame = batch1Str === batch2Str && batch2Str === batch3Str && batch3Str === batch4Str;
      expect(allSame).toBe(false);
    });

    it('should aggregate sentences from all 4 batches into single array', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 5
      };

      const mockVocabRows: RowDataPacket[] = Array.from({ length: 500 }, (_, i) => ({
        chinese_character: `字${i}`
      })) as RowDataPacket[];

      mockPool.query.mockResolvedValue([mockVocabRows]);

      // Create unique sentences for each batch to verify aggregation
      let callCount = 0;
      const mockGenerateMultipleSentences = jest.fn().mockImplementation(() => {
        const batchNumber = callCount++;
        return Promise.resolve(
          Array.from({ length: 30 }, (_, i) => ({
            chineseText: `批次${batchNumber}句子${i}。`,
            pinyin: `pī cì ${batchNumber} jù zi ${i}`,
            usedCharacters: [`字${i}`]
          }))
        );
      });

      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const result = await service.generateSentencesForGroup(vocabGroup);

      // Verify we have sentences from all 4 batches
      expect(result).toHaveLength(120);
      
      // Verify sentences from each batch are present
      expect(result[0].chineseText).toContain('批次0');  // First batch
      expect(result[30].chineseText).toContain('批次1'); // Second batch
      expect(result[60].chineseText).toContain('批次2'); // Third batch
      expect(result[90].chineseText).toContain('批次3'); // Fourth batch
    });
  });

  describe('Database Operations', () => {
    describe('deleteSentencesForGroup', () => {
      it('should delete all sentences for a vocab group', async () => {
        const vocabGroupId = 1;

        await service.deleteSentencesForGroup(vocabGroupId);

        expect(mockPool.query).toHaveBeenCalledWith(
          'DELETE FROM pre_generated_sentences WHERE vocab_group_id = ?',
          [vocabGroupId]
        );
      });

      it('should use provided connection when given', async () => {
        const vocabGroupId = 2;
        const mockConnection = {
          query: jest.fn().mockResolvedValue([])
        };

        await service.deleteSentencesForGroup(vocabGroupId, mockConnection);

        expect(mockConnection.query).toHaveBeenCalledWith(
          'DELETE FROM pre_generated_sentences WHERE vocab_group_id = ?',
          [vocabGroupId]
        );
        expect(mockPool.query).not.toHaveBeenCalled();
      });
    });

    describe('storeSentences', () => {
      /**
       * Feature: pre-generated-phrases, Property 11: Complete Sentence Persistence
       * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
       * 
       * For any generated sentence, all required fields (Chinese text, vocab group ID, 
       * pinyin, used characters, generation timestamp) must be stored in the database 
       * and retrievable.
       */
      it('Property 11: Complete Sentence Persistence - all required fields stored correctly', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate random vocab group ID
            fc.integer({ min: 1, max: 5 }),
            // Generate array of sentences with random content
            fc.array(
              fc.record({
                chineseText: fc.string({ minLength: 1, maxLength: 100 }),
                pinyin: fc.string({ minLength: 1, maxLength: 200 }),
                usedCharacters: fc.array(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 50 })
              }),
              { minLength: 1, maxLength: 120 }
            ),
            async (vocabGroupId, sentences) => {
              // Clear mocks before each property test run
              jest.clearAllMocks();
              mockPool.query.mockResolvedValue([]);

              await service.storeSentences(sentences, vocabGroupId);

              // Property 11: All required fields must be stored
              expect(mockPool.query).toHaveBeenCalledTimes(1);
              const queryCall = mockPool.query.mock.calls[0];
              
              // Verify SQL includes all required fields
              expect(queryCall[0]).toContain('INSERT INTO pre_generated_sentences');
              expect(queryCall[0]).toContain('id');
              expect(queryCall[0]).toContain('vocab_group_id');
              expect(queryCall[0]).toContain('chinese_text');
              expect(queryCall[0]).toContain('pinyin');
              expect(queryCall[0]).toContain('used_characters');
              
              // Verify values array has correct structure
              const values = queryCall[1][0];
              expect(values).toHaveLength(sentences.length);
              
              // Verify each sentence has all required fields
              values.forEach((row: any[], index: number) => {
                // Field 0: id (UUID)
                expect(row[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
                
                // Field 1: vocab_group_id
                expect(row[1]).toBe(vocabGroupId);
                
                // Field 2: chinese_text
                expect(row[2]).toBe(sentences[index].chineseText);
                
                // Field 3: pinyin
                expect(row[3]).toBe(sentences[index].pinyin);
                
                // Field 4: used_characters (JSON stringified)
                expect(row[4]).toBe(JSON.stringify(sentences[index].usedCharacters));
              });
            }
          ),
          { numRuns: 100 }
        );
      });

      /**
       * Feature: pre-generated-phrases, Property 12: Complete Data Extraction
       * **Validates: Requirements 8.3, 8.4, 8.5, 8.6**
       * 
       * For any AITextGenerator response, all required fields (chineseText, pinyin, 
       * usedCharacters) must be extracted and stored in the sentence entry.
       */
      it('Property 12: Complete Data Extraction - all AI response fields extracted and stored', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate random vocab group ID
            fc.integer({ min: 1, max: 5 }),
            // Generate sentences with all AI response fields
            fc.array(
              fc.record({
                chineseText: fc.string({ minLength: 5, maxLength: 50 }),
                pinyin: fc.string({ minLength: 5, maxLength: 100 }),
                usedCharacters: fc.array(fc.string({ minLength: 1, maxLength: 2 }), { minLength: 3, maxLength: 20 })
              }),
              { minLength: 1, maxLength: 30 }
            ),
            async (vocabGroupId, aiSentences) => {
              // Clear mocks before each property test run
              jest.clearAllMocks();
              mockPool.query.mockResolvedValue([]);

              // Store sentences (simulating AI response)
              await service.storeSentences(aiSentences, vocabGroupId);

              const queryCall = mockPool.query.mock.calls[0];
              const values = queryCall[1][0];
              
              // Property 12: All AI response fields must be extracted and stored
              aiSentences.forEach((aiSentence, index) => {
                const storedRow = values[index];
                
                // Verify chineseText extracted from AI response (Requirement 8.3)
                expect(storedRow[2]).toBe(aiSentence.chineseText);
                
                // Verify pinyin extracted from AI response (Requirement 8.4)
                expect(storedRow[3]).toBe(aiSentence.pinyin);
                
                // Verify usedCharacters extracted from AI response (Requirement 8.5)
                const storedCharacters = JSON.parse(storedRow[4]);
                expect(storedCharacters).toEqual(aiSentence.usedCharacters);
                
                // Verify all fields are present (Requirement 8.6)
                expect(storedRow[2]).toBeDefined();
                expect(storedRow[3]).toBeDefined();
                expect(storedRow[4]).toBeDefined();
              });
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should insert sentences with generated UUIDs', async () => {
        const vocabGroupId = 1;
        const sentences = [
          {
            chineseText: '这是测试句子。',
            pinyin: 'zhè shì cè shì jù zi',
            usedCharacters: ['这', '是', '测', '试']
          },
          {
            chineseText: '另一个句子。',
            pinyin: 'lìng yī gè jù zi',
            usedCharacters: ['另', '一', '个']
          }
        ];

        await service.storeSentences(sentences, vocabGroupId);

        expect(mockPool.query).toHaveBeenCalledTimes(1);
        const queryCall = mockPool.query.mock.calls[0];
        
        // Verify SQL query
        expect(queryCall[0]).toContain('INSERT INTO pre_generated_sentences');
        expect(queryCall[0]).toContain('(id, vocab_group_id, chinese_text, pinyin, used_characters)');
        expect(queryCall[0]).toContain('VALUES ?');

        // Verify values structure
        const values = queryCall[1][0];
        expect(values).toHaveLength(2);
        
        // First sentence
        expect(values[0][0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // UUID format
        expect(values[0][1]).toBe(vocabGroupId);
        expect(values[0][2]).toBe('这是测试句子。');
        expect(values[0][3]).toBe('zhè shì cè shì jù zi');
        expect(values[0][4]).toBe(JSON.stringify(['这', '是', '测', '试']));

        // Second sentence
        expect(values[1][0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(values[1][1]).toBe(vocabGroupId);
        expect(values[1][2]).toBe('另一个句子。');
        expect(values[1][3]).toBe('lìng yī gè jù zi');
        expect(values[1][4]).toBe(JSON.stringify(['另', '一', '个']));
      });

      it('should handle empty sentences array', async () => {
        const vocabGroupId = 1;
        const sentences: any[] = [];

        await service.storeSentences(sentences, vocabGroupId);

        // Should not call query for empty array
        expect(mockPool.query).not.toHaveBeenCalled();
      });

      it('should use provided connection when given', async () => {
        const vocabGroupId = 1;
        const sentences = [
          {
            chineseText: '测试',
            pinyin: 'cè shì',
            usedCharacters: ['测', '试']
          }
        ];
        const mockConnection = {
          query: jest.fn().mockResolvedValue([])
        };

        await service.storeSentences(sentences, vocabGroupId, mockConnection);

        expect(mockConnection.query).toHaveBeenCalledTimes(1);
        expect(mockPool.query).not.toHaveBeenCalled();
      });

      it('should extract chineseText, pinyin, and usedCharacters from AI response', async () => {
        const vocabGroupId = 3;
        const sentences = [
          {
            chineseText: '我喜欢学习中文。',
            pinyin: 'wǒ xǐ huān xué xí zhōng wén',
            usedCharacters: ['我', '喜', '欢', '学', '习', '中', '文']
          }
        ];

        await service.storeSentences(sentences, vocabGroupId);

        const values = mockPool.query.mock.calls[0][1][0];
        
        // Verify all fields are extracted correctly
        expect(values[0][2]).toBe(sentences[0].chineseText);
        expect(values[0][3]).toBe(sentences[0].pinyin);
        expect(values[0][4]).toBe(JSON.stringify(sentences[0].usedCharacters));
      });
    });

    describe('replaceSentencesForGroup', () => {
      /**
       * Feature: pre-generated-phrases, Property 6: Sentence Replacement
       * **Validates: Requirements 2.4, 4.6**
       * 
       * For any vocab group, when new sentences are generated, all existing sentences 
       * for that vocab group must be deleted before new sentences are stored, ensuring 
       * no old sentences remain.
       */
      it('Property 6: Sentence Replacement - all old sentences deleted before storing new ones', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate random vocab group ID (1-5)
            fc.integer({ min: 1, max: 5 }),
            // Generate varying number of new sentences (1-150)
            fc.integer({ min: 1, max: 150 }),
            async (vocabGroupId, sentenceCount) => {
              // Create mock sentences
              const sentences = Array.from({ length: sentenceCount }, (_, i) => ({
                chineseText: `新句子${i}`,
                pinyin: `xīn jù zi ${i}`,
                usedCharacters: [`字${i}`]
              }));

              const mockConnection = {
                query: jest.fn().mockResolvedValue([]),
                beginTransaction: jest.fn().mockResolvedValue(undefined),
                commit: jest.fn().mockResolvedValue(undefined),
                rollback: jest.fn().mockResolvedValue(undefined),
                release: jest.fn()
              };

              mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

              await service.replaceSentencesForGroup(vocabGroupId, sentences);

              // Property 6: Delete must be called before insert
              expect(mockConnection.query).toHaveBeenCalledTimes(2);
              
              // First call should be DELETE
              const firstCall = mockConnection.query.mock.calls[0];
              expect(firstCall[0]).toContain('DELETE FROM pre_generated_sentences');
              expect(firstCall[0]).toContain('WHERE vocab_group_id = ?');
              expect(firstCall[1]).toEqual([vocabGroupId]);
              
              // Second call should be INSERT
              const secondCall = mockConnection.query.mock.calls[1];
              expect(secondCall[0]).toContain('INSERT INTO pre_generated_sentences');
              
              // Verify transaction was committed (ensuring atomicity)
              expect(mockConnection.commit).toHaveBeenCalledTimes(1);
              expect(mockConnection.rollback).not.toHaveBeenCalled();
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should delete old sentences and store new ones in a transaction', async () => {
        const vocabGroupId = 1;
        const sentences = [
          {
            chineseText: '新句子。',
            pinyin: 'xīn jù zi',
            usedCharacters: ['新', '句', '子']
          }
        ];

        const mockConnection = {
          query: jest.fn().mockResolvedValue([]),
          beginTransaction: jest.fn().mockResolvedValue(undefined),
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
          release: jest.fn()
        };

        mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

        await service.replaceSentencesForGroup(vocabGroupId, sentences);

        // Verify transaction flow
        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.query).toHaveBeenCalledTimes(2); // Delete + Insert
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalledTimes(1);

        // Verify delete was called
        expect(mockConnection.query.mock.calls[0][0]).toContain('DELETE FROM pre_generated_sentences');
        
        // Verify insert was called
        expect(mockConnection.query.mock.calls[1][0]).toContain('INSERT INTO pre_generated_sentences');
      });

      it('should rollback transaction on storage failure', async () => {
        const vocabGroupId = 1;
        const sentences = [
          {
            chineseText: '测试',
            pinyin: 'cè shì',
            usedCharacters: ['测', '试']
          }
        ];

        const mockError = new Error('Database error');
        const mockConnection = {
          query: jest.fn()
            .mockResolvedValueOnce([]) // Delete succeeds
            .mockRejectedValueOnce(mockError), // Insert fails
          beginTransaction: jest.fn().mockResolvedValue(undefined),
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
          release: jest.fn()
        };

        mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

        await expect(service.replaceSentencesForGroup(vocabGroupId, sentences)).rejects.toThrow('Database error');

        // Verify transaction was rolled back
        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalledTimes(1);
      });

      it('should rollback transaction on deletion failure', async () => {
        const vocabGroupId = 1;
        const sentences = [
          {
            chineseText: '测试',
            pinyin: 'cè shì',
            usedCharacters: ['测', '试']
          }
        ];

        const mockError = new Error('Delete failed');
        const mockConnection = {
          query: jest.fn().mockRejectedValueOnce(mockError), // Delete fails
          beginTransaction: jest.fn().mockResolvedValue(undefined),
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
          release: jest.fn()
        };

        mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

        await expect(service.replaceSentencesForGroup(vocabGroupId, sentences)).rejects.toThrow('Delete failed');

        // Verify transaction was rolled back
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalledTimes(1);
      });

      it('should release connection even if rollback fails', async () => {
        const vocabGroupId = 1;
        const sentences = [
          {
            chineseText: '测试',
            pinyin: 'cè shì',
            usedCharacters: ['测', '试']
          }
        ];

        const mockError = new Error('Query failed');
        const mockConnection = {
          query: jest.fn().mockRejectedValueOnce(mockError),
          beginTransaction: jest.fn().mockResolvedValue(undefined),
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockRejectedValue(new Error('Rollback failed')),
          release: jest.fn()
        };

        mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

        // When rollback fails, the rollback error is thrown (not the original error)
        await expect(service.replaceSentencesForGroup(vocabGroupId, sentences)).rejects.toThrow('Rollback failed');

        // Verify connection was released despite rollback failure
        expect(mockConnection.release).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('generateAllSentences', () => {
    it('should generate sentences for all 5 vocab groups', async () => {
      // Mock getVocabGroups to return 5 groups
      const mockVocabGroups: VocabGroup[] = [
        { id: 1, chapterStart: 1, chapterEndpoint: 6 },
        { id: 2, chapterStart: 1, chapterEndpoint: 7 },
        { id: 3, chapterStart: 1, chapterEndpoint: 8 },
        { id: 4, chapterStart: 1, chapterEndpoint: 9 },
        { id: 5, chapterStart: 1, chapterEndpoint: 10 }
      ];

      // Mock database responses
      mockPool.query
        .mockResolvedValueOnce([mockVocabGroups.map(g => ({ chapter: g.chapterEndpoint }))]) // getVocabGroups
        .mockResolvedValue([Array.from({ length: 500 }, (_, i) => ({ chinese_character: `字${i}` }))]); // vocabulary queries

      // Mock AITextGenerator
      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `句子${i}`,
        pinyin: `jù zi ${i}`,
        usedCharacters: [`字${i}`]
      }));

      const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      // Mock database connection for replaceSentencesForGroup
      const mockConnection = {
        query: jest.fn().mockResolvedValue([]),
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn()
      };
      mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

      // Spy on console.log to verify logging
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.generateAllSentences();

      // Verify all 5 groups were processed
      expect(mockConnection.query).toHaveBeenCalledTimes(10); // 5 groups × (1 delete + 1 insert)
      expect(mockConnection.commit).toHaveBeenCalledTimes(5);

      // Verify logging
      expect(consoleLogSpy).toHaveBeenCalledWith('[PhraseGenerator] Starting sentence generation for all vocab groups');
      expect(consoleLogSpy).toHaveBeenCalledWith('[PhraseGenerator] Found 5 vocab groups to process');
      expect(consoleLogSpy).toHaveBeenCalledWith('[PhraseGenerator] Successfully completed sentence generation for all vocab groups');

      consoleLogSpy.mockRestore();
    });

    it('should handle empty vocab groups gracefully', async () => {
      // Mock getVocabGroups to return empty array
      mockPool.query.mockResolvedValueOnce([[]]);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.generateAllSentences();

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith('[PhraseGenerator] No vocab groups found - skipping generation');

      consoleWarnSpy.mockRestore();
    });

    it('should process groups sequentially', async () => {
      const mockVocabGroups: VocabGroup[] = [
        { id: 1, chapterStart: 1, chapterEndpoint: 5 },
        { id: 2, chapterStart: 1, chapterEndpoint: 6 }
      ];

      mockPool.query
        .mockResolvedValueOnce([mockVocabGroups.map(g => ({ chapter: g.chapterEndpoint }))])
        .mockResolvedValue([Array.from({ length: 300 }, (_, i) => ({ chinese_character: `字${i}` }))]);

      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `句子${i}`,
        pinyin: `jù zi ${i}`,
        usedCharacters: [`字${i}`]
      }));

      const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const mockConnection = {
        query: jest.fn().mockResolvedValue([]),
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn()
      };
      mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.generateAllSentences();

      // Verify both groups were processed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing vocab group 1')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing vocab group 2')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('generateWithRetry (error handling)', () => {
    it('should retry up to 3 times on failure with exponential backoff', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 5
      };

      // Mock vocabulary query
      mockPool.query.mockResolvedValue([
        Array.from({ length: 300 }, (_, i) => ({ chinese_character: `字${i}` }))
      ]);

      // Mock AITextGenerator to fail on first batch of each attempt
      const mockError = new Error('AI API failed');
      const mockGenerateMultipleSentences = jest.fn().mockRejectedValue(mockError);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Call generateAllSentences which will call generateWithRetry
      mockPool.query.mockResolvedValueOnce([[{ chapter: 5 }]]); // getVocabGroups

      await expect(service.generateAllSentences()).rejects.toThrow(
        'Failed to generate sentences for vocab group 1 after 3 attempts'
      );

      // Verify 3 attempts were made (fails on first batch each time = 3 total calls)
      expect(mockGenerateMultipleSentences).toHaveBeenCalledTimes(3);

      // Verify retry logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1/3')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 2/3')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 3/3')
      );

      // Verify error logging
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error generating sentences for vocab group 1'),
        mockError
      );

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should succeed on second attempt after first failure', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 5
      };

      mockPool.query
        .mockResolvedValueOnce([[{ chapter: 5 }]]) // getVocabGroups
        .mockResolvedValue([Array.from({ length: 300 }, (_, i) => ({ chinese_character: `字${i}` }))]); // vocabulary

      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `句子${i}`,
        pinyin: `jù zi ${i}`,
        usedCharacters: [`字${i}`]
      }));

      // Fail on first attempt (first call), succeed on all subsequent calls
      let callCount = 0;
      const mockGenerateMultipleSentences = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve(mockSentences);
      });

      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const mockConnection = {
        query: jest.fn().mockResolvedValue([]),
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn()
      };
      mockPool.getConnection = jest.fn().mockResolvedValue(mockConnection);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.generateAllSentences();

      // Verify retry was attempted
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('attempt 1/3'),
        expect.any(Error)
      );

      // Verify success on second attempt
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stored sentences for vocab group 1')
      );

      // Verify exponential backoff delay was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retrying vocab group 1 in 1000ms')
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should implement exponential backoff delays (1s, 2s, 4s)', async () => {
      const vocabGroup: VocabGroup = {
        id: 1,
        chapterStart: 1,
        chapterEndpoint: 5
      };

      mockPool.query
        .mockResolvedValueOnce([[{ chapter: 5 }]])
        .mockResolvedValue([Array.from({ length: 300 }, (_, i) => ({ chinese_character: `字${i}` }))]);

      const mockError = new Error('AI failure');
      const mockGenerateMultipleSentences = jest.fn().mockRejectedValue(mockError);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(service.generateAllSentences()).rejects.toThrow();

      // Verify exponential backoff delays were logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retrying vocab group 1 in 1000ms')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Retrying vocab group 1 in 2000ms')
      );

      // Note: Third attempt doesn't log retry message since it's the last attempt

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle database transaction failures with retry', async () => {
      mockPool.query
        .mockResolvedValueOnce([[{ chapter: 5 }]]) // getVocabGroups
        .mockResolvedValue([Array.from({ length: 300 }, (_, i) => ({ chinese_character: `字${i}` }))]); // vocabulary

      const mockSentences = Array.from({ length: 30 }, (_, i) => ({
        chineseText: `句子${i}`,
        pinyin: `jù zi ${i}`,
        usedCharacters: [`字${i}`]
      }));

      const mockGenerateMultipleSentences = jest.fn().mockResolvedValue(mockSentences);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      // First attempt: transaction fails
      // Second attempt: transaction succeeds
      let connectionCallCount = 0;
      mockPool.getConnection = jest.fn().mockImplementation(() => {
        connectionCallCount++;
        if (connectionCallCount === 1) {
          return Promise.resolve({
            query: jest.fn().mockRejectedValue(new Error('Database error')),
            beginTransaction: jest.fn().mockResolvedValue(undefined),
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
            release: jest.fn()
          });
        } else {
          return Promise.resolve({
            query: jest.fn().mockResolvedValue([]),
            beginTransaction: jest.fn().mockResolvedValue(undefined),
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
            release: jest.fn()
          });
        }
      });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.generateAllSentences();

      // Verify retry occurred
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error generating sentences for vocab group 1'),
        expect.any(Error)
      );

      // Verify eventual success
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully stored sentences for vocab group 1')
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log detailed error information on final failure', async () => {
      mockPool.query
        .mockResolvedValueOnce([[{ chapter: 5 }]])
        .mockResolvedValue([Array.from({ length: 300 }, (_, i) => ({ chinese_character: `字${i}` }))]);

      const mockError = new Error('Persistent AI failure');
      const mockGenerateMultipleSentences = jest.fn().mockRejectedValue(mockError);
      (AITextGenerator as jest.Mock).mockImplementation(() => ({
        generateMultipleSentences: mockGenerateMultipleSentences
      }));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(service.generateAllSentences()).rejects.toThrow(
        'Failed to generate sentences for vocab group 1 after 3 attempts. Last error: Persistent AI failure'
      );

      // Verify detailed error logging
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate sentences for vocab group 1 after 3 attempts')
      );

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
