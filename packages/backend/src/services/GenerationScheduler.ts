import * as cron from 'node-cron';
import { PhraseGeneratorService } from './PhraseGeneratorService';

/**
 * GenerationScheduler manages automated sentence generation on a 4-hour schedule.
 * 
 * Features:
 * - Runs cron job every 4 hours
 * - Prevents concurrent executions with mutex lock
 * - Supports manual triggering for testing
 * - Logs generation status and errors
 */
export class GenerationScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isGenerating: boolean = false;
  private phraseGenerator: PhraseGeneratorService;

  constructor(phraseGenerator: PhraseGeneratorService) {
    this.phraseGenerator = phraseGenerator;
  }

  /**
   * Start the scheduler to run 4 times per day
   * Cron expression: "0 2,8,14,20 * * *" means at minute 0 of hours 2, 8, 14, and 20 UTC
   * Vietnam time (UTC+7): 09:00, 15:00, 21:00, 03:00
   * Only 1 refresh during sleep hours (03:00)
   */
  start(): void {
    if (this.cronJob) {
      console.log('[GenerationScheduler] Scheduler already running');
      return;
    }

    // Schedule for 02:00, 08:00, 14:00, 20:00 UTC (09:00, 15:00, 21:00, 03:00 Vietnam time)
    this.cronJob = cron.schedule('0 2,8,14,20 * * *', async () => {
      console.log('[GenerationScheduler] Cron job triggered');
      await this.triggerGeneration();
    });

    console.log('[GenerationScheduler] Scheduler started - will run at 02:00, 08:00, 14:00, 20:00 UTC (09:00, 15:00, 21:00, 03:00 Vietnam time)');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[GenerationScheduler] Scheduler stopped');
    }
  }

  /**
   * Manually trigger generation (for testing or admin use)
   * Uses mutex lock to prevent concurrent executions
   */
  async triggerGeneration(): Promise<void> {
    // Mutex lock - prevent concurrent executions
    if (this.isGenerating) {
      console.log('[GenerationScheduler] Generation already in progress, skipping');
      return;
    }

    this.isGenerating = true;
    const startTime = Date.now();

    try {
      console.log('[GenerationScheduler] Starting sentence generation...');
      
      // Generate for each user that has vocabulary
      const { getPool } = await import('../config/database');
      const pool = getPool();
      const [users]: any = await pool.query(
        `SELECT DISTINCT au.id, au.username FROM vocabulary_entries ve JOIN auth_users au ON ve.user_id = au.id WHERE au.role IN ('admin', 'parent')`
      );
      
      console.log(`[GenerationScheduler] Generating sentences for ${users.length} users`);
      
      for (const user of users) {
        try {
          console.log(`[GenerationScheduler] Generating for user: ${user.username} (id=${user.id})`);
          await this.phraseGenerator.generateAllSentences(user.id);
        } catch (userError) {
          console.error(`[GenerationScheduler] Failed for user ${user.username}:`, userError);
          // Continue with other users
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[GenerationScheduler] Generation completed successfully in ${duration}s`);
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`[GenerationScheduler] Generation failed after ${duration}s:`, error);
      throw error;
    } finally {
      // Release mutex lock
      this.isGenerating = false;
    }
  }

  /**
   * Check if generation is currently in progress
   */
  isRunning(): boolean {
    return this.isGenerating;
  }

  /**
   * Check if scheduler is active
   */
  isSchedulerActive(): boolean {
    return this.cronJob !== null;
  }
}
