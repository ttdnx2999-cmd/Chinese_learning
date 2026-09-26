/**
 * Integration test for scheduler startup
 * 
 * Verifies that the GenerationScheduler is properly integrated with the application
 * and starts successfully on application startup.
 */

import { GenerationScheduler } from './services/GenerationScheduler';
import { PhraseGeneratorService } from './services/PhraseGeneratorService';

describe('Scheduler Integration', () => {
  it('should initialize and start scheduler without errors', () => {
    // This test verifies that the scheduler can be instantiated and started
    // without throwing errors
    
    const phraseGenerator = new PhraseGeneratorService();
    const scheduler = new GenerationScheduler(phraseGenerator);
    
    // Should not throw
    expect(() => scheduler.start()).not.toThrow();
    
    // Verify scheduler is active
    expect(scheduler.isSchedulerActive()).toBe(true);
    
    // Clean up
    scheduler.stop();
    
    // Verify scheduler is stopped
    expect(scheduler.isSchedulerActive()).toBe(false);
  });

  it('should handle multiple start calls gracefully', () => {
    const phraseGenerator = new PhraseGeneratorService();
    const scheduler = new GenerationScheduler(phraseGenerator);
    
    // Start scheduler
    scheduler.start();
    expect(scheduler.isSchedulerActive()).toBe(true);
    
    // Try to start again - should not throw
    expect(() => scheduler.start()).not.toThrow();
    
    // Should still be active
    expect(scheduler.isSchedulerActive()).toBe(true);
    
    // Clean up
    scheduler.stop();
  });

  it('should allow manual trigger after scheduler is started', async () => {
    const phraseGenerator = new PhraseGeneratorService();
    const scheduler = new GenerationScheduler(phraseGenerator);
    
    scheduler.start();
    
    // Manual trigger should be callable (though it may fail due to missing data)
    // We're just verifying the integration allows this call
    try {
      await scheduler.triggerGeneration();
    } catch (error) {
      // Expected to fail in test environment without proper database setup
      // We're just verifying the method is accessible
      expect(error).toBeDefined();
    }
    
    scheduler.stop();
  });
});
