import { AITextGenerator } from './AITextGenerator';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fc from 'fast-check';

// Mock the Google Generative AI module
jest.mock('@google/generative-ai');

describe('AITextGenerator', () => {
  let service: AITextGenerator;
  let mockModel: any;
  let mockGenAI: any;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    // Save original API key
    originalApiKey = process.env.GOOGLE_AI_API_KEY;
    
    // Set a fake API key to prevent mock data fallback
    process.env.GOOGLE_AI_API_KEY = 'test-api-key';
    
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create mock model instance
    mockModel = {
      generateContent: jest.fn()
    };

    // Create mock GenAI instance
    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    };

    // Mock the GoogleGenerativeAI constructor
    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(() => mockGenAI);

    // Create service instance
    service = new AITextGenerator();
  });

  afterEach(() => {
    // Restore original API key
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_AI_API_KEY;
    } else {
      process.env.GOOGLE_AI_API_KEY = originalApiKey;
    }
  });

  describe('generateText', () => {
    it('should generate Chinese text from character list', async () => {
      const characters = ['你', '好', '我', '是', '学', '生'];
      const generatedText = '你好我是学生';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      expect(result.wordCount).toBe(6);
      expect(result.pinyin).toBe(''); // Pinyin not implemented yet
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('你好我是学生')
      );
    });

    it('should enforce 40-word maximum limit by default', async () => {
      const characters = ['你', '好', '我', '是'];
      const generatedText = '你好';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters);

      expect(result.wordCount).toBeLessThanOrEqual(40);
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Maximum 40 words')
      );
    });

    it('should accept custom maxWords parameter', async () => {
      const characters = ['你', '好', '我'];
      const generatedText = '你好';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 20);

      expect(result.wordCount).toBeLessThanOrEqual(20);
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Maximum 20 words')
      );
    });

    it('should handle up to 300 input characters', async () => {
      const characters = Array(300).fill('你');
      const generatedText = '你好世界';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      expect(mockModel.generateContent).toHaveBeenCalled();
    });

    it('should reject more than 300 input characters', async () => {
      const characters = Array(301).fill('你');

      await expect(service.generateText(characters, 40))
        .rejects
        .toThrow('Characters array exceeds maximum limit of 300');

      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should reject empty character array', async () => {
      const characters: string[] = [];

      await expect(service.generateText(characters, 40))
        .rejects
        .toThrow('Characters array cannot be empty');

      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should reject invalid maxWords (zero)', async () => {
      const characters = ['你', '好'];

      await expect(service.generateText(characters, 0))
        .rejects
        .toThrow('maxWords must be between 1 and 40');
    });

    it('should reject invalid maxWords (negative)', async () => {
      const characters = ['你', '好'];

      await expect(service.generateText(characters, -5))
        .rejects
        .toThrow('maxWords must be between 1 and 40');
    });

    it('should reject invalid maxWords (over 40)', async () => {
      const characters = ['你', '好'];

      await expect(service.generateText(characters, 41))
        .rejects
        .toThrow('maxWords must be between 1 and 40');
    });

    it('should handle duplicate characters by creating unique list', async () => {
      const characters = ['你', '好', '你', '好', '我'];
      const generatedText = '你好我';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      // Prompt should contain unique characters only
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('你好我')
      );
    });

    it('should truncate text if generated text exceeds maxWords', async () => {
      const characters = ['你', '好', '世', '界', '我', '是', '学', '生'];
      const longText = '你好世界我是学生今天天气很好';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => longText
        }
      });

      const result = await service.generateText(characters, 5);

      expect(result.wordCount).toBeLessThanOrEqual(5);
      expect(result.chineseText.length).toBeLessThanOrEqual(longText.length);
    });

    it('should handle text with punctuation correctly', async () => {
      const characters = ['你', '好', '吗', '？'];
      const generatedText = '你好吗？';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      // Word count should not include punctuation
      expect(result.wordCount).toBe(3); // 你好吗 (excluding ？)
    });

    it('should handle text with whitespace correctly', async () => {
      const characters = ['你', '好', '世', '界'];
      const generatedText = '你好 世界';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      // Word count should not include whitespace
      expect(result.wordCount).toBe(4);
    });

    it('should handle API errors gracefully', async () => {
      const characters = ['你', '好'];
      const errorMessage = 'API quota exceeded';
      
      mockModel.generateContent.mockRejectedValue(new Error(errorMessage));

      await expect(service.generateText(characters, 40))
        .rejects
        .toThrow(`Failed to generate text: ${errorMessage}`);
    });

    it('should handle non-Error exceptions', async () => {
      const characters = ['你', '好'];
      
      mockModel.generateContent.mockRejectedValue('Unknown error');

      await expect(service.generateText(characters, 40))
        .rejects
        .toThrow('Failed to generate text: Unknown error');
    });

    it('should handle empty generated text', async () => {
      const characters = ['你', '好'];
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => '   '
        }
      });

      await expect(service.generateText(characters, 40))
        .rejects
        .toThrow('Generated text is empty');
    });

    it('should trim whitespace from generated text', async () => {
      const characters = ['你', '好'];
      const generatedText = '  你好  ';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe('你好');
    });
  });

  describe('Edge cases', () => {
    it('should handle single character input', async () => {
      const characters = ['你'];
      const generatedText = '你';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      expect(result.wordCount).toBe(1);
    });

    it('should handle maxWords of 1', async () => {
      const characters = ['你', '好'];
      const generatedText = '你好';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 1);

      expect(result.wordCount).toBeLessThanOrEqual(1);
    });

    it('should handle complex Chinese punctuation', async () => {
      const characters = ['你', '好', '吗'];
      const generatedText = '你好吗？！。，';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      // Should only count actual characters, not punctuation
      expect(result.wordCount).toBe(3);
    });

    it('should handle mixed traditional and simplified characters', async () => {
      const characters = ['你', '好', '學', '生'];
      const generatedText = '你好學生';
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => generatedText
        }
      });

      const result = await service.generateText(characters, 40);

      expect(result.chineseText).toBe(generatedText);
      expect(result.wordCount).toBe(4);
    });
  });

  describe('generateMultipleSentences - Unit Tests', () => {
    // Task 2.3: Test with 300 characters input
    it('should handle exactly 300 characters input and generate 30 sentences', async () => {
      // Create exactly 300 characters
      const characters = Array(300).fill(0).map((_, i) => 
        ['你', '好', '我', '是', '学', '生', '很', '的', '吗', '呢'][i % 10]
      );
      const count = 30;
      
      // Mock response with 30 sentences
      const mockResponse = Array.from({ length: count }, (_, i) => 
        `SENTENCE_${i + 1}: 你好我是学生。`
      ).join('\n');
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse,
          usageMetadata: {
            promptTokenCount: 500,
            candidatesTokenCount: 800,
            totalTokenCount: 1300
          }
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      // Verify 300 characters were accepted
      expect(mockModel.generateContent).toHaveBeenCalled();
      
      // Verify 30 sentences were returned
      expect(result).toHaveLength(count);
      
      // Verify each sentence has required structure
      result.forEach((sentence: any) => {
        expect(sentence).toHaveProperty('chineseText');
        expect(sentence).toHaveProperty('pinyin');
        expect(sentence).toHaveProperty('usedCharacters');
        expect(typeof sentence.chineseText).toBe('string');
        expect(sentence.chineseText.length).toBeGreaterThan(0);
      });
    });

    // Task 2.3: Test response parsing for 30 sentences
    it('should correctly parse response with 30 sentences in expected format', async () => {
      const characters = ['你', '好', '我', '是', '学', '生', '很', '的', '吗', '呢'];
      const count = 30;
      
      // Create realistic mock response with varied sentences
      const mockResponse = Array.from({ length: count }, (_, i) => {
        const sentences = [
          '你好吗？',
          '我是学生。',
          '他很好。',
          '这是我的书。',
          '你去哪里？',
          '我很高兴。',
          '今天天气好。',
          '我喜欢学习。',
          '你叫什么名字？',
          '我住在北京。'
        ];
        return `SENTENCE_${i + 1}: ${sentences[i % sentences.length]}`;
      }).join('\n');
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse,
          usageMetadata: {
            promptTokenCount: 200,
            candidatesTokenCount: 400,
            totalTokenCount: 600
          }
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      // Verify parsing extracted all 30 sentences
      expect(result).toHaveLength(30);
      
      // Verify each sentence was parsed correctly
      result.forEach((sentence: any, index: number) => {
        // Should have extracted Chinese text
        expect(sentence.chineseText).toBeTruthy();
        expect(typeof sentence.chineseText).toBe('string');
        
        // Should have generated pinyin
        expect(sentence.pinyin).toBeDefined();
        expect(typeof sentence.pinyin).toBe('string');
        
        // Should have extracted used characters
        expect(Array.isArray(sentence.usedCharacters)).toBe(true);
        expect(sentence.usedCharacters.length).toBeGreaterThan(0);
      });
      
      // Verify API was called once
      expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining(`Create ${count} SHORT, NATURAL Chinese sentences`)
      );
    });

    // Task 2.3: Test error handling for API failures
    it('should handle API failures gracefully and fallback to mock data', async () => {
      const characters = ['你', '好', '我', '是', '学', '生'];
      const count = 30;
      
      // Simulate API failure
      mockModel.generateContent.mockRejectedValue(new Error('API quota exceeded'));

      const result = await service.generateMultipleSentences(characters, count);

      // Should fallback to mock data and still return sentences
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(count);
      
      // Mock sentences should still have required structure
      result.forEach((sentence: any) => {
        expect(sentence).toHaveProperty('chineseText');
        expect(sentence).toHaveProperty('pinyin');
        expect(sentence).toHaveProperty('usedCharacters');
      });
    });

    it('should handle network timeout errors', async () => {
      const characters = ['你', '好', '我'];
      const count = 30;
      
      // Simulate network timeout
      mockModel.generateContent.mockRejectedValue(new Error('Request timeout'));

      const result = await service.generateMultipleSentences(characters, count);

      // Should fallback gracefully
      expect(result).toBeDefined();
      expect(result.length).toBe(count);
    });

    it('should handle malformed API responses', async () => {
      const characters = ['你', '好', '我'];
      const count = 30;
      
      // Simulate malformed response (no SENTENCE_ format)
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'This is not a valid response format'
        }
      });

      // Should throw error when no sentences can be parsed
      await expect(service.generateMultipleSentences(characters, count))
        .rejects
        .toThrow('No sentences were generated');
    });

    it('should generate multiple sentences from character list', async () => {
      const characters = ['你', '好', '我', '是', '学', '生'];
      const count = 30;
      
      // Mock response with 30 sentences
      const mockResponse = Array.from({ length: count }, (_, i) => 
        `SENTENCE_${i + 1}: 你好我是学生。`
      ).join('\n');
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse,
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 200,
            totalTokenCount: 300
          }
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      expect(result).toHaveLength(count);
      expect(result[0]).toHaveProperty('chineseText');
      expect(result[0]).toHaveProperty('pinyin');
      expect(result[0]).toHaveProperty('usedCharacters');
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining(`Create ${count} SHORT, NATURAL Chinese sentences`)
      );
    });

    it('should default to 30 sentences when count not specified', async () => {
      const characters = ['你', '好', '我'];
      const defaultCount = 30;
      
      const mockResponse = Array.from({ length: defaultCount }, (_, i) => 
        `SENTENCE_${i + 1}: 你好。`
      ).join('\n');
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse
        }
      });

      const result = await service.generateMultipleSentences(characters);

      expect(result).toHaveLength(defaultCount);
    });

    it('should handle up to 300 input characters', async () => {
      const characters = Array(300).fill('你');
      const count = 30;
      
      const mockResponse = Array.from({ length: count }, (_, i) => 
        `SENTENCE_${i + 1}: 你。`
      ).join('\n');
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      expect(result).toHaveLength(count);
      expect(mockModel.generateContent).toHaveBeenCalled();
    });

    it('should reject more than 300 input characters', async () => {
      const characters = Array(301).fill('你');

      await expect(service.generateMultipleSentences(characters, 30))
        .rejects
        .toThrow('Characters array exceeds maximum limit of 300');

      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should reject empty character array', async () => {
      const characters: string[] = [];

      await expect(service.generateMultipleSentences(characters, 30))
        .rejects
        .toThrow('Characters array cannot be empty');

      expect(mockModel.generateContent).not.toHaveBeenCalled();
    });

    it('should reject invalid count (zero)', async () => {
      const characters = ['你', '好'];

      await expect(service.generateMultipleSentences(characters, 0))
        .rejects
        .toThrow('count must be between 1 and 50');
    });

    it('should reject invalid count (negative)', async () => {
      const characters = ['你', '好'];

      await expect(service.generateMultipleSentences(characters, -5))
        .rejects
        .toThrow('count must be between 1 and 50');
    });

    it('should reject invalid count (over 50)', async () => {
      const characters = ['你', '好'];

      await expect(service.generateMultipleSentences(characters, 51))
        .rejects
        .toThrow('count must be between 1 and 50');
    });

    it('should extract pinyin for each sentence', async () => {
      const characters = ['你', '好'];
      const count = 3;
      
      const mockResponse = `SENTENCE_1: 你好。
SENTENCE_2: 你好吗？
SENTENCE_3: 我很好。`;
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      expect(result).toHaveLength(3);
      result.forEach((sentence: any) => {
        expect(sentence.pinyin).toBeTruthy();
        expect(typeof sentence.pinyin).toBe('string');
      });
    });

    it('should extract used characters for each sentence', async () => {
      const characters = ['你', '好', '我', '很'];
      const count = 2;
      
      const mockResponse = `SENTENCE_1: 你好。
SENTENCE_2: 我很好。`;
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      expect(result).toHaveLength(2);
      result.forEach((sentence: any) => {
        expect(Array.isArray(sentence.usedCharacters)).toBe(true);
        expect(sentence.usedCharacters.length).toBeGreaterThan(0);
      });
    });

    it('should handle API errors gracefully by falling back to mock data', async () => {
      const characters = ['你', '好'];
      const count = 30;
      
      mockModel.generateContent.mockRejectedValue(new Error('API quota exceeded'));

      const result = await service.generateMultipleSentences(characters, count);

      // Should fallback to mock data
      expect(result).toHaveLength(count);
      expect(result[0]).toHaveProperty('chineseText');
      expect(result[0]).toHaveProperty('pinyin');
      expect(result[0]).toHaveProperty('usedCharacters');
    });

    it('should warn when fewer sentences generated than requested', async () => {
      const characters = ['你', '好'];
      const count = 30;
      
      // Mock response with only 20 sentences
      const mockResponse = Array.from({ length: 20 }, (_, i) => 
        `SENTENCE_${i + 1}: 你好。`
      ).join('\n');
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      expect(result.length).toBeLessThan(count);
      expect(result.length).toBe(20);
    });

    it('should skip empty sentences in response', async () => {
      const characters = ['你', '好'];
      const count = 5;
      
      const mockResponse = `SENTENCE_1: 你好。
SENTENCE_2: 
SENTENCE_3: 我很好。
SENTENCE_4:   
SENTENCE_5: 你好吗？`;
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => mockResponse
        }
      });

      const result = await service.generateMultipleSentences(characters, count);

      // Should only have 3 valid sentences (skipping empty ones)
      expect(result.length).toBe(3);
      result.forEach((sentence: any) => {
        expect(sentence.chineseText).toBeTruthy();
      });
    });

    it('should throw error when no sentences are generated', async () => {
      const characters = ['你', '好'];
      const count = 30;
      
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid response with no sentences'
        }
      });

      await expect(service.generateMultipleSentences(characters, count))
        .rejects
        .toThrow('No sentences were generated');
    });
  });

  describe('Feature: pre-generated-phrases, Property 9: AITextGenerator Integration', () => {
    /**
     * **Validates: Requirements 3.4, 8.1, 8.2**
     * 
     * Property: For any sentence generation request, the Phrase Generator must invoke 
     * the AITextGenerator service and receive 30 sentences per API call.
     * 
     * This property verifies that:
     * 1. The generateMultipleSentences method is invoked with valid parameters
     * 2. The method returns exactly 30 sentences (or the requested count)
     * 3. Each sentence has the required structure (chineseText, pinyin, usedCharacters)
     * 4. The method handles various character set sizes correctly
     */
    it('should always return the requested number of sentences with valid structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random character arrays (1-300 characters)
          fc.array(fc.constantFrom('你', '好', '我', '是', '学', '生', '很', '的', '吗', '呢'), { minLength: 1, maxLength: 300 }),
          // Generate random sentence counts (1-50)
          fc.integer({ min: 1, max: 50 }),
          async (characters, count) => {
            // Clear mocks for this iteration
            jest.clearAllMocks();
            
            // Mock response with the requested number of sentences
            const mockResponse = Array.from({ length: count }, (_, i) => 
              `SENTENCE_${i + 1}: ${characters.slice(0, Math.min(5, characters.length)).join('')}。`
            ).join('\n');
            
            mockModel.generateContent.mockResolvedValue({
              response: {
                text: () => mockResponse,
                usageMetadata: {
                  promptTokenCount: 100,
                  candidatesTokenCount: 200,
                  totalTokenCount: 300
                }
              }
            });

            // Execute the method
            const result = await service.generateMultipleSentences(characters, count);

            // Property assertions
            // 1. Result should be an array
            expect(Array.isArray(result)).toBe(true);
            
            // 2. Result should have the requested number of sentences
            expect(result.length).toBe(count);
            
            // 3. Each sentence should have the required structure
            result.forEach((sentence: any, index: number) => {
              expect(sentence).toHaveProperty('chineseText');
              expect(sentence).toHaveProperty('pinyin');
              expect(sentence).toHaveProperty('usedCharacters');
              
              // 4. chineseText should be a non-empty string
              expect(typeof sentence.chineseText).toBe('string');
              expect(sentence.chineseText.length).toBeGreaterThan(0);
              
              // 5. pinyin should be a string
              expect(typeof sentence.pinyin).toBe('string');
              
              // 6. usedCharacters should be an array
              expect(Array.isArray(sentence.usedCharacters)).toBe(true);
            });
            
            // 7. The API should have been called exactly once
            expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
            
            // 8. The API should have been called with a prompt containing the count
            expect(mockModel.generateContent).toHaveBeenCalledWith(
              expect.stringContaining(`Create ${count} SHORT, NATURAL Chinese sentences`)
            );
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in the design
      );
    });

    /**
     * **Validates: Requirements 3.4, 8.1, 8.2**
     * 
     * Property: The AITextGenerator service must be invoked with exactly 300 characters
     * for batch generation (as specified in the phrase generation workflow).
     * 
     * This property verifies that:
     * 1. When called with 300 characters, the method succeeds
     * 2. The method returns 30 sentences by default
     * 3. All required fields are present in each sentence
     */
    it('should handle batch generation with 300 characters and return 30 sentences', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate exactly 300 characters
          fc.constant(Array(300).fill('你')),
          async (characters) => {
            // Clear mocks for this iteration
            jest.clearAllMocks();
            
            const expectedCount = 30; // Default count
            
            // Mock response with 30 sentences
            const mockResponse = Array.from({ length: expectedCount }, (_, i) => 
              `SENTENCE_${i + 1}: 你好我是学生。`
            ).join('\n');
            
            mockModel.generateContent.mockResolvedValue({
              response: {
                text: () => mockResponse
              }
            });

            // Execute with default count (30)
            const result = await service.generateMultipleSentences(characters);

            // Property assertions
            // 1. Should return exactly 30 sentences
            expect(result.length).toBe(expectedCount);
            
            // 2. Each sentence should have valid structure
            result.forEach((sentence: any) => {
              expect(sentence.chineseText).toBeTruthy();
              expect(sentence.pinyin).toBeDefined();
              expect(Array.isArray(sentence.usedCharacters)).toBe(true);
            });
            
            // 3. API should be invoked once
            expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.4, 8.1, 8.2**
     * 
     * Property: The AITextGenerator must correctly extract and return all required fields
     * (chineseText, pinyin, usedCharacters) for each generated sentence.
     * 
     * This property verifies that:
     * 1. All sentences have non-empty chineseText
     * 2. All sentences have pinyin (can be empty string but must be defined)
     * 3. All sentences have usedCharacters array
     * 4. The structure is consistent across all sentences
     */
    it('should extract all required fields for every sentence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('你', '好', '我', '是', '学', '生'), { minLength: 10, maxLength: 100 }),
          fc.integer({ min: 5, max: 30 }),
          async (characters, count) => {
            // Mock response with varied sentences
            const mockResponse = Array.from({ length: count }, (_, i) => {
              const chars = characters.slice(i % 5, (i % 5) + 3);
              return `SENTENCE_${i + 1}: ${chars.join('')}。`;
            }).join('\n');
            
            mockModel.generateContent.mockResolvedValue({
              response: {
                text: () => mockResponse
              }
            });

            const result = await service.generateMultipleSentences(characters, count);

            // Property assertions
            result.forEach((sentence: any, index: number) => {
              // 1. chineseText must be non-empty
              expect(sentence.chineseText).toBeTruthy();
              expect(sentence.chineseText.length).toBeGreaterThan(0);
              
              // 2. pinyin must be defined (string type)
              expect(sentence.pinyin).toBeDefined();
              expect(typeof sentence.pinyin).toBe('string');
              
              // 3. usedCharacters must be an array
              expect(Array.isArray(sentence.usedCharacters)).toBe(true);
              
              // 4. All three fields must be present
              const keys = Object.keys(sentence);
              expect(keys).toContain('chineseText');
              expect(keys).toContain('pinyin');
              expect(keys).toContain('usedCharacters');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
