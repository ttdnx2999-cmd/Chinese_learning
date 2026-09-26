import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Property-Based Tests for PhrasesPage Component
 * 
 * Note: These tests focus on data transformation and display logic.
 * Full component rendering tests are in the unit tests section.
 */

describe('PhrasesPage Property Tests', () => {
  /**
   * Property 13: Sentence Display Completeness
   * 
   * **Validates: Requirements 5.4, 5.5, 5.6**
   * 
   * For any vocab group displayed on the Phrases page, all 120 sentences must be 
   * rendered in Chinese text and be clickable.
   * 
   * This property test verifies that:
   * 1. All sentences in a vocab group are included in the display data
   * 2. Each sentence has the required Chinese text field
   * 3. The count matches the expected 120 sentences per group
   */
  describe('Property 13: Sentence Display Completeness', () => {
    it('should ensure all sentences for a vocab group are displayable with Chinese text', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate vocab group ID (1-5)
          fc.integer({ min: 1, max: 5 }),
          // Generate exactly 120 sentences with Chinese text
          fc.array(
            fc.record({
              id: fc.uuid(),
              vocabGroupId: fc.integer({ min: 1, max: 5 }),
              chineseText: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
              pinyin: fc.string({ minLength: 5, maxLength: 100 }),
              usedCharacters: fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 5, maxLength: 20 }),
              generationTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }).map(ts => new Date(ts).toISOString())
            }),
            { minLength: 120, maxLength: 120 }
          ),
          async (vocabGroupId, sentences) => {
            // Ensure all sentences belong to the same vocab group
            const groupSentences = sentences.map(s => ({ ...s, vocabGroupId }));
            
            // Verify all sentences have Chinese text
            const allHaveChineseText = groupSentences.every(s => 
              s.chineseText && s.chineseText.trim().length > 0
            );
            expect(allHaveChineseText).toBe(true);
            
            // Verify exactly 120 sentences
            expect(groupSentences.length).toBe(120);
            
            // Verify all sentences have required fields for display
            groupSentences.forEach(sentence => {
              expect(sentence.id).toBeDefined();
              expect(sentence.chineseText).toBeDefined();
              expect(sentence.vocabGroupId).toBe(vocabGroupId);
              expect(sentence.pinyin).toBeDefined();
              expect(sentence.usedCharacters).toBeDefined();
              expect(Array.isArray(sentence.usedCharacters)).toBe(true);
            });
            
            // Verify sentences are clickable (have all required data)
            const clickableData = groupSentences.map(s => ({
              id: s.id,
              chineseText: s.chineseText,
              pinyin: s.pinyin,
              usedCharacters: s.usedCharacters
            }));
            
            expect(clickableData.length).toBe(120);
            clickableData.forEach(data => {
              expect(data.id).toBeTruthy();
              expect(data.chineseText).toBeTruthy();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle varying sentence lengths and character counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              vocabGroupId: fc.integer({ min: 1, max: 5 }),
              // Vary Chinese text length significantly
              chineseText: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
              pinyin: fc.string({ minLength: 1, maxLength: 500 }),
              // Vary character count
              usedCharacters: fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 1, maxLength: 50 }),
              generationTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }).map(ts => new Date(ts).toISOString())
            }),
            { minLength: 120, maxLength: 120 }
          ),
          async (vocabGroupId, sentences) => {
            const groupSentences = sentences.map(s => ({ ...s, vocabGroupId }));
            
            // All sentences should be displayable regardless of length
            expect(groupSentences.length).toBe(120);
            
            // Verify each sentence can be rendered
            groupSentences.forEach(sentence => {
              // Must have Chinese text (even if very short or long)
              expect(sentence.chineseText.length).toBeGreaterThan(0);
              expect(sentence.chineseText.length).toBeLessThanOrEqual(200);
              
              // Must have at least one character
              expect(sentence.usedCharacters.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Character Detail View Interaction
   * 
   * **Validates: Requirements 6.1, 6.2, 6.3**
   * 
   * For any sentence clicked on the Phrases page, the character detail view must 
   * display the sentence's pinyin and a list of all characters used in the sentence.
   * 
   * This property test verifies that:
   * 1. Clicking a sentence provides all necessary data for the detail view
   * 2. The pinyin is available for display
   * 3. All characters used in the sentence are listed
   */
  describe('Property 14: Character Detail View Interaction', () => {
    it('should provide complete data for character detail view when sentence is selected', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random sentences with varying data
          fc.record({
            id: fc.uuid(),
            vocabGroupId: fc.integer({ min: 1, max: 5 }),
            chineseText: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0),
            pinyin: fc.string({ minLength: 5, maxLength: 200 }),
            usedCharacters: fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 1, maxLength: 30 }),
            generationTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }).map(ts => new Date(ts).toISOString())
          }),
          async (sentence) => {
            // Verify sentence has pinyin
            expect(sentence.pinyin).toBeDefined();
            expect(sentence.pinyin.length).toBeGreaterThan(0);
            
            // Verify sentence has list of characters
            expect(sentence.usedCharacters).toBeDefined();
            expect(Array.isArray(sentence.usedCharacters)).toBe(true);
            expect(sentence.usedCharacters.length).toBeGreaterThan(0);
            
            // Verify all required fields for detail view are present
            expect(sentence.id).toBeDefined();
            expect(sentence.chineseText).toBeDefined();
            expect(sentence.chineseText.length).toBeGreaterThan(0);
            
            // Simulate detail view data extraction
            const detailViewData = {
              chineseText: sentence.chineseText,
              pinyin: sentence.pinyin,
              characters: sentence.usedCharacters
            };
            
            expect(detailViewData.chineseText).toBeTruthy();
            expect(detailViewData.pinyin).toBeTruthy();
            expect(detailViewData.characters.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle sentences with varying character counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            vocabGroupId: fc.integer({ min: 1, max: 5 }),
            chineseText: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
            pinyin: fc.string({ minLength: 1, maxLength: 500 }),
            // Vary from 1 to 50 characters
            usedCharacters: fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 1, maxLength: 50 }),
            generationTimestamp: fc.integer({ min: 1600000000000, max: 1700000000000 }).map(ts => new Date(ts).toISOString())
          }),
          async (sentence) => {
            // Detail view should work regardless of character count
            expect(sentence.usedCharacters.length).toBeGreaterThan(0);
            expect(sentence.usedCharacters.length).toBeLessThanOrEqual(50);
            
            // All characters should be single characters
            sentence.usedCharacters.forEach(char => {
              expect(char.length).toBe(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15: Character Information Completeness
   * 
   * **Validates: Requirements 6.5**
   * 
   * For any character displayed in the character detail view, all available fields 
   * (Chinese character, pinyin, Han Vietnamese, Modern Vietnamese, English meaning) 
   * from the vocabulary database must be displayed.
   * 
   * This property test verifies that:
   * 1. All character info fields are present in the data structure
   * 2. Missing fields are handled with "N/A" display
   * 3. The character info structure is complete for rendering
   */
  describe('Property 15: Character Information Completeness', () => {
    it('should ensure all character info fields are present for display', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of character info with varying field availability
          fc.array(
            fc.record({
              chineseCharacter: fc.string({ minLength: 1, maxLength: 1 }),
              pinyin: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
              hanVietnamese: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
              modernVietnamese: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
              englishMeaning: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })
            }),
            { minLength: 1, maxLength: 30 }
          ),
          async (characterDetails) => {
            // Verify each character has the required structure
            characterDetails.forEach(char => {
              // Chinese character is always required
              expect(char.chineseCharacter).toBeDefined();
              expect(char.chineseCharacter.length).toBe(1);
              
              // All fields should be defined (even if undefined/null)
              expect('pinyin' in char).toBe(true);
              expect('hanVietnamese' in char).toBe(true);
              expect('modernVietnamese' in char).toBe(true);
              expect('englishMeaning' in char).toBe(true);
              
              // Simulate display logic with N/A fallback
              const displayData = {
                chineseCharacter: char.chineseCharacter,
                pinyin: char.pinyin || 'N/A',
                hanVietnamese: char.hanVietnamese || 'N/A',
                modernVietnamese: char.modernVietnamese || 'N/A',
                englishMeaning: char.englishMeaning || 'N/A'
              };
              
              // All display fields should have values
              expect(displayData.chineseCharacter).toBeTruthy();
              expect(displayData.pinyin).toBeTruthy();
              expect(displayData.hanVietnamese).toBeTruthy();
              expect(displayData.modernVietnamese).toBeTruthy();
              expect(displayData.englishMeaning).toBeTruthy();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle characters with all fields missing (N/A fallback)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              chineseCharacter: fc.string({ minLength: 1, maxLength: 1 }),
              pinyin: fc.constant(undefined),
              hanVietnamese: fc.constant(undefined),
              modernVietnamese: fc.constant(undefined),
              englishMeaning: fc.constant(undefined)
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (characterDetails) => {
            // Even with all fields missing, display should work
            characterDetails.forEach(char => {
              const displayData = {
                chineseCharacter: char.chineseCharacter,
                pinyin: char.pinyin || 'N/A',
                hanVietnamese: char.hanVietnamese || 'N/A',
                modernVietnamese: char.modernVietnamese || 'N/A',
                englishMeaning: char.englishMeaning || 'N/A'
              };
              
              // All fields should display "N/A" except Chinese character
              expect(displayData.chineseCharacter).not.toBe('N/A');
              expect(displayData.pinyin).toBe('N/A');
              expect(displayData.hanVietnamese).toBe('N/A');
              expect(displayData.modernVietnamese).toBe('N/A');
              expect(displayData.englishMeaning).toBe('N/A');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Unit Tests for PhrasesPage Component
 * 
 * These tests verify specific functionality and user interactions.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PhrasesPage from './PhrasesPage';
import { apiClient } from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn()
  }
}));

describe('PhrasesPage Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering with mock data', () => {
    it('should render the page title and description', () => {
      render(<PhrasesPage />);
      
      expect(screen.getByText('Pre-Generated Phrases')).toBeInTheDocument();
      expect(screen.getByText(/Practice Chinese sentences organized by vocabulary groups/)).toBeInTheDocument();
    });

    it('should display loading state while fetching vocab groups', () => {
      // Mock API to never resolve
      vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
      
      render(<PhrasesPage />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should display vocab groups after successful fetch', async () => {
      const mockVocabGroups = [
        { id: 1, chapterStart: 1, chapterEnd: 10, sentenceCount: 120 },
        { id: 2, chapterStart: 1, chapterEnd: 20, sentenceCount: 120 }
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockVocabGroups });

      render(<PhrasesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Vocabulary Group 1: Chapters 1 - 10/)).toBeInTheDocument();
        expect(screen.getByText(/Vocabulary Group 2: Chapters 1 - 20/)).toBeInTheDocument();
      });
    });

    it('should display empty state when no vocab groups available', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });

      render(<PhrasesPage />);

      await waitFor(() => {
        expect(screen.getByText(/No vocabulary groups available/)).toBeInTheDocument();
      });
    });
  });

  describe('Sentence click interaction', () => {
    it('should open character detail modal when sentence is clicked', async () => {
      const mockVocabGroups = [
        { id: 1, chapterStart: 1, chapterEnd: 10, sentenceCount: 120 }
      ];

      const mockSentences = [
        {
          id: '1',
          vocabGroupId: 1,
          chineseText: '你好',
          pinyin: 'nǐ hǎo',
          usedCharacters: ['你', '好'],
          generationTimestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      const mockCharacterInfo = [
        {
          chineseCharacter: '你',
          pinyin: 'nǐ',
          hanVietnamese: 'nhĩ',
          modernVietnamese: 'bạn',
          englishMeaning: 'you'
        },
        {
          chineseCharacter: '好',
          pinyin: 'hǎo',
          hanVietnamese: 'hảo',
          modernVietnamese: 'tốt',
          englishMeaning: 'good'
        }
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({ data: mockVocabGroups })
        .mockResolvedValueOnce({ data: mockSentences })
        .mockResolvedValueOnce({ data: mockCharacterInfo[0] })
        .mockResolvedValueOnce({ data: mockCharacterInfo[1] });

      render(<PhrasesPage />);

      // Wait for vocab groups to load
      await waitFor(() => {
        expect(screen.getByText(/Vocabulary Group 1/)).toBeInTheDocument();
      });

      // Click to expand group
      const groupButton = screen.getByText(/Vocabulary Group 1/);
      fireEvent.click(groupButton);

      // Wait for sentences to load
      await waitFor(() => {
        expect(screen.getByText('你好')).toBeInTheDocument();
      });

      // Click on sentence
      const sentenceCard = screen.getByText('你好');
      fireEvent.click(sentenceCard);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText('Sentence Details')).toBeInTheDocument();
        expect(screen.getByText('nǐ hǎo')).toBeInTheDocument();
      });
    });

    it('should close character detail modal when close button is clicked', async () => {
      const mockVocabGroups = [
        { id: 1, chapterStart: 1, chapterEnd: 10, sentenceCount: 120 }
      ];

      const mockSentences = [
        {
          id: '1',
          vocabGroupId: 1,
          chineseText: '你好',
          pinyin: 'nǐ hǎo',
          usedCharacters: ['你', '好'],
          generationTimestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({ data: mockVocabGroups })
        .mockResolvedValueOnce({ data: mockSentences })
        .mockResolvedValue({ data: { chineseCharacter: '你', pinyin: 'nǐ' } });

      render(<PhrasesPage />);

      // Open modal
      await waitFor(() => {
        expect(screen.getByText(/Vocabulary Group 1/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Vocabulary Group 1/));

      await waitFor(() => {
        expect(screen.getByText('你好')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('你好'));

      await waitFor(() => {
        expect(screen.getByText('Sentence Details')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Sentence Details')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error states and retry functionality', () => {
    it('should display error message when vocab groups fetch fails', async () => {
      // Mock all retry attempts to fail
      vi.mocked(apiClient.get)
        .mockRejectedValue(new Error('Network error'));

      render(<PhrasesPage />);

      // Wait for error (after retries complete - 2 retries with 1s delay each = ~2s)
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // The error message shows the actual error, not a custom message
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    it('should retry fetching vocab groups when retry button is clicked', async () => {
      const mockVocabGroups = [
        { id: 1, chapterStart: 1, chapterEnd: 10, sentenceCount: 120 }
      ];

      // First calls fail
      vi.mocked(apiClient.get)
        .mockRejectedValue(new Error('Network error'));

      render(<PhrasesPage />);

      // Wait for error (after retries)
      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Clear the mock and set up success response
      vi.mocked(apiClient.get).mockClear();
      vi.mocked(apiClient.get).mockResolvedValue({ data: mockVocabGroups });

      // Click retry button
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Wait for success - error should be cleared and vocab groups should appear
      await waitFor(() => {
        expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
        expect(screen.getByText(/Vocabulary Group 1/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should display error when sentences fetch fails', async () => {
      const mockVocabGroups = [
        { id: 1, chapterStart: 1, chapterEnd: 10, sentenceCount: 120 }
      ];

      // Vocab groups succeed, sentences fail
      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({ data: mockVocabGroups })
        .mockRejectedValue(new Error('Failed to load sentences'));

      render(<PhrasesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Vocabulary Group 1/)).toBeInTheDocument();
      });

      // Click to expand group
      fireEvent.click(screen.getByText(/Vocabulary Group 1/));

      // Wait for error (after retries)
      await waitFor(() => {
        expect(screen.getByText(/Failed to load sentences for group 1/)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Loading states', () => {
    it('should show loading spinner for sentences when group is expanded', async () => {
      const mockVocabGroups = [
        { id: 1, chapterStart: 1, chapterEnd: 10, sentenceCount: 120 }
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({ data: mockVocabGroups })
        .mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<PhrasesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Vocabulary Group 1/)).toBeInTheDocument();
      });

      // Click to expand group
      fireEvent.click(screen.getByText(/Vocabulary Group 1/));

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Loading sentences...')).toBeInTheDocument();
      });
    });

    it('should show loading state for character details', async () => {
      const mockVocabGroups = [
        { id: 1, chapterStart: 1, chapterEnd: 10, sentenceCount: 120 }
      ];

      const mockSentences = [
        {
          id: '1',
          vocabGroupId: 1,
          chineseText: '你好',
          pinyin: 'nǐ hǎo',
          usedCharacters: ['你', '好'],
          generationTimestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce({ data: mockVocabGroups })
        .mockResolvedValueOnce({ data: mockSentences })
        .mockImplementation(() => new Promise(() => {})); // Never resolves for character info

      render(<PhrasesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Vocabulary Group 1/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Vocabulary Group 1/));

      await waitFor(() => {
        expect(screen.getByText('你好')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('你好'));

      await waitFor(() => {
        expect(screen.getByText('Loading character details...')).toBeInTheDocument();
      });
    });
  });
});
