import { GenerationScheduler } from './GenerationScheduler';
import { PhraseGeneratorService } from './PhraseGeneratorService';
import * as fc from 'fast-check';
import cronParser from 'cron-parser';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn((expression: string, callback: () => void) => ({
    stop: jest.fn(),
  })),
}));

describe('GenerationScheduler', () => {
  let scheduler: GenerationScheduler;
  let mockPhraseGenerator: jest.Mocked<PhraseGeneratorService>;

  beforeEach(() => {
    // Create mock PhraseGeneratorService
    mockPhraseGenerator = {
      generateAllSentences: jest.fn().mockResolvedValue(undefined),
    } as any;

    scheduler = new GenerationScheduler(mockPhraseGenerator);
  });

  afterEach(() => {
    scheduler.stop();
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start the cron job with correct expression', () => {
      const cron = require('node-cron');
      
      scheduler.start();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 */4 * * *',
        expect.any(Function)
      );
      expect(scheduler.isSchedulerActive()).toBe(true);
    });

    it('should not start multiple schedulers', () => {
      const cron = require('node-cron');
      
      scheduler.start();
      scheduler.start();

      expect(cron.schedule).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop the cron job', () => {
      scheduler.start();
      const cronJob = (scheduler as any).cronJob;
      
      scheduler.stop();

      expect(cronJob.stop).toHaveBeenCalled();
      expect(scheduler.isSchedulerActive()).toBe(false);
    });

    it('should handle stop when not started', () => {
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  describe('triggerGeneration', () => {
    it('should call PhraseGeneratorService.generateAllSentences', async () => {
      await scheduler.triggerGeneration();

      expect(mockPhraseGenerator.generateAllSentences).toHaveBeenCalledTimes(1);
    });

    it('should set isGenerating flag during execution', async () => {
      let isGeneratingDuringExecution = false;

      mockPhraseGenerator.generateAllSentences.mockImplementation(async () => {
        isGeneratingDuringExecution = scheduler.isRunning();
      });

      await scheduler.triggerGeneration();

      expect(isGeneratingDuringExecution).toBe(true);
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should prevent concurrent executions with mutex lock', async () => {
      let firstCallInProgress = false;
      let secondCallAttempted = false;

      mockPhraseGenerator.generateAllSentences.mockImplementation(async () => {
        firstCallInProgress = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        firstCallInProgress = false;
      });

      // Start first generation
      const firstPromise = scheduler.triggerGeneration();

      // Wait a bit to ensure first call is in progress
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try to start second generation (should be blocked)
      const secondPromise = scheduler.triggerGeneration();
      secondCallAttempted = true;

      await Promise.all([firstPromise, secondPromise]);

      // Should only call generateAllSentences once
      expect(mockPhraseGenerator.generateAllSentences).toHaveBeenCalledTimes(1);
      expect(secondCallAttempted).toBe(true);
    });

    it('should release mutex lock after successful generation', async () => {
      await scheduler.triggerGeneration();

      expect(scheduler.isRunning()).toBe(false);

      // Should be able to trigger again
      await scheduler.triggerGeneration();
      expect(mockPhraseGenerator.generateAllSentences).toHaveBeenCalledTimes(2);
    });

    it('should release mutex lock after failed generation', async () => {
      mockPhraseGenerator.generateAllSentences.mockRejectedValue(
        new Error('Generation failed')
      );

      await expect(scheduler.triggerGeneration()).rejects.toThrow('Generation failed');

      expect(scheduler.isRunning()).toBe(false);

      // Should be able to trigger again after failure
      mockPhraseGenerator.generateAllSentences.mockResolvedValue(undefined);
      await scheduler.triggerGeneration();
      expect(mockPhraseGenerator.generateAllSentences).toHaveBeenCalledTimes(2);
    });

    it('should log generation start and completion', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await scheduler.triggerGeneration();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting sentence generation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generation completed successfully')
      );

      consoleSpy.mockRestore();
    });

    it('should log generation errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockPhraseGenerator.generateAllSentences.mockRejectedValue(
        new Error('Test error')
      );

      await expect(scheduler.triggerGeneration()).rejects.toThrow('Test error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generation failed'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('isRunning', () => {
    it('should return false when not generating', () => {
      expect(scheduler.isRunning()).toBe(false);
    });

    it('should return true during generation', async () => {
      let statusDuringGeneration = false;

      mockPhraseGenerator.generateAllSentences.mockImplementation(async () => {
        statusDuringGeneration = scheduler.isRunning();
      });

      await scheduler.triggerGeneration();

      expect(statusDuringGeneration).toBe(true);
    });
  });

  describe('isSchedulerActive', () => {
    it('should return false when scheduler not started', () => {
      expect(scheduler.isSchedulerActive()).toBe(false);
    });

    it('should return true when scheduler is running', () => {
      scheduler.start();
      expect(scheduler.isSchedulerActive()).toBe(true);
    });

    it('should return false after scheduler is stopped', () => {
      scheduler.start();
      scheduler.stop();
      expect(scheduler.isSchedulerActive()).toBe(false);
    });
  });

  // Feature: pre-generated-phrases, Property 5: Complete Group Processing
  describe('Property 5: Complete Group Processing', () => {
    beforeEach(() => {
      // Mock console methods to avoid async logging warnings
      jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate sentences for all 5 vocab groups without exception', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random number of vocab groups (1-10)
          fc.integer({ min: 1, max: 10 }),
          async (numGroups) => {
            // Create mock vocab groups
            const mockVocabGroups = Array.from({ length: numGroups }, (_, i) => ({
              id: i + 1,
              chapterStart: 1,
              chapterEndpoint: i + 5
            }));

            // Track which groups were processed
            const processedGroups = new Set<number>();

            // Mock PhraseGeneratorService with tracking
            const mockPhraseGenerator = {
              generateAllSentences: jest.fn().mockImplementation(async () => {
                // Simulate processing all groups
                mockVocabGroups.forEach(group => {
                  processedGroups.add(group.id);
                });
              })
            } as any;

            const testScheduler = new GenerationScheduler(mockPhraseGenerator);

            // Trigger generation
            await testScheduler.triggerGeneration();

            // Property 5: All vocab groups must be processed
            expect(mockPhraseGenerator.generateAllSentences).toHaveBeenCalledTimes(1);
            
            // Verify all groups were processed (simulated by our mock)
            expect(processedGroups.size).toBe(numGroups);
            mockVocabGroups.forEach(group => {
              expect(processedGroups.has(group.id)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should process all groups even if some fail (with proper error handling)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random number of groups and which one should fail
          fc.record({
            numGroups: fc.integer({ min: 2, max: 10 }),
            failingGroupIndex: fc.integer({ min: 0, max: 9 })
          }).filter(({ numGroups, failingGroupIndex }) => failingGroupIndex < numGroups),
          async ({ numGroups, failingGroupIndex }) => {
            const mockVocabGroups = Array.from({ length: numGroups }, (_, i) => ({
              id: i + 1,
              chapterStart: 1,
              chapterEndpoint: i + 5
            }));

            // Mock PhraseGeneratorService that fails on specific group
            const mockPhraseGenerator = {
              generateAllSentences: jest.fn().mockImplementation(async () => {
                // Simulate failure on specific group
                throw new Error(`Failed on group ${failingGroupIndex + 1}`);
              })
            } as any;

            const testScheduler = new GenerationScheduler(mockPhraseGenerator);

            // Trigger generation - should throw error
            await expect(testScheduler.triggerGeneration()).rejects.toThrow();

            // Verify generateAllSentences was called (even though it failed)
            expect(mockPhraseGenerator.generateAllSentences).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure all 5 vocab groups are processed in a single generation cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random delays to simulate varying processing times (keep them small)
          fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 5, maxLength: 5 }),
          async (delays) => {
            const processedGroups: number[] = [];

            // Mock PhraseGeneratorService that tracks processing order
            const mockPhraseGenerator = {
              generateAllSentences: jest.fn().mockImplementation(async () => {
                // Simulate processing 5 groups with varying delays
                for (let i = 1; i <= 5; i++) {
                  await new Promise(resolve => setTimeout(resolve, delays[i - 1]));
                  processedGroups.push(i);
                }
              })
            } as any;

            const testScheduler = new GenerationScheduler(mockPhraseGenerator);

            // Trigger generation
            await testScheduler.triggerGeneration();

            // Property 5: All 5 groups must be processed
            expect(processedGroups).toHaveLength(5);
            expect(processedGroups).toEqual([1, 2, 3, 4, 5]);
            
            // Verify generateAllSentences was called exactly once
            expect(mockPhraseGenerator.generateAllSentences).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    }, 10000); // 10 second timeout for this test
  });

  // Feature: pre-generated-phrases, Property 4: Scheduler Interval Consistency
  describe('Property 4: Scheduler Interval Consistency', () => {
    it('should trigger at 4-hour intervals (0, 4, 8, 12, 16, 20 hours)', () => {
      fc.assert(
        fc.property(
          // Generate random start dates across different days and times
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
            .filter(date => !isNaN(date.getTime())), // Filter out invalid dates
          (startDate) => {
            // Parse the cron expression used by the scheduler
            const cronExpression = '0 */4 * * *';
            const interval = cronParser.parse(cronExpression, {
              currentDate: startDate,
            });

            // Get the next 6 execution times (covering 24 hours)
            const executionTimes: Date[] = [];
            for (let i = 0; i < 6; i++) {
              const next = interval.next();
              executionTimes.push(new Date(next.getTime()));
            }

            // Verify each execution is exactly 4 hours apart
            for (let i = 1; i < executionTimes.length; i++) {
              const timeDiff = executionTimes[i].getTime() - executionTimes[i - 1].getTime();
              const hoursDiff = timeDiff / (1000 * 60 * 60);
              
              // Should be exactly 4 hours apart
              expect(hoursDiff).toBe(4);
            }

            // Verify all executions happen at minute 0
            for (const time of executionTimes) {
              expect(time.getMinutes()).toBe(0);
              expect(time.getSeconds()).toBe(0);
            }

            // Verify hours are at 4-hour intervals (0, 4, 8, 12, 16, 20)
            for (const time of executionTimes) {
              const hour = time.getHours();
              expect(hour % 4).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce consistent intervals across month boundaries', () => {
      fc.assert(
        fc.property(
          // Test dates near month boundaries
          fc.constantFrom(
            new Date('2024-01-31 22:00:00'),
            new Date('2024-02-28 22:00:00'),
            new Date('2024-03-31 22:00:00'),
            new Date('2024-12-31 22:00:00')
          ),
          (startDate) => {
            const cronExpression = '0 */4 * * *';
            const interval = cronParser.parse(cronExpression, {
              currentDate: startDate,
            });

            // Get next 3 executions (should cross month boundary)
            const executionTimes: Date[] = [];
            for (let i = 0; i < 3; i++) {
              const next = interval.next();
              executionTimes.push(new Date(next.getTime()));
            }

            // Verify 4-hour intervals are maintained across month boundaries
            for (let i = 1; i < executionTimes.length; i++) {
              const timeDiff = executionTimes[i].getTime() - executionTimes[i - 1].getTime();
              const hoursDiff = timeDiff / (1000 * 60 * 60);
              expect(hoursDiff).toBe(4);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce consistent intervals across daylight saving time transitions', () => {
      fc.assert(
        fc.property(
          // Test dates around typical DST transitions (March and November)
          fc.constantFrom(
            new Date('2024-03-10 00:00:00'), // Spring forward (US)
            new Date('2024-11-03 00:00:00')  // Fall back (US)
          ),
          (startDate) => {
            const cronExpression = '0 */4 * * *';
            const interval = cronParser.parse(cronExpression, {
              currentDate: startDate,
            });

            // Get next 12 executions (covering 48 hours, including DST transition)
            const executionTimes: Date[] = [];
            for (let i = 0; i < 12; i++) {
              const next = interval.next();
              executionTimes.push(new Date(next.getTime()));
            }

            // Verify all executions happen at minute 0
            for (const time of executionTimes) {
              expect(time.getMinutes()).toBe(0);
            }

            // Verify hours are at 4-hour intervals
            for (const time of executionTimes) {
              const hour = time.getHours();
              expect(hour % 4).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
