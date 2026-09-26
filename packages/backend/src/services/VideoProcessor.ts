import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface VideoJob {
  id: string;
  mediaFiles: string[]; // Paths to uploaded videos/images
  mediaTypes: ('video' | 'image')[]; // Track type of each file
  mediaSettings: MediaSettings[]; // Trim and speed settings for each media
  audioFile?: string;
  audioSpeed: number; // Audio speed adjustment
  aiEnhancement: boolean; // Whether to apply AI enhancement
  outputPath: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  error?: string;
}

interface MediaSettings {
  trimStart: number;
  trimEnd: number;
  videoSpeed: number;
  imageDuration?: number; // Duration for images (in seconds)
}

class VideoProcessor {
  private queue: VideoJob[] = [];
  private isProcessing = false;
  private readonly uploadsDir: string;
  private readonly outputDir: string;
  private readonly tempDir: string;
  private readonly maxStoredVideos = 10;
  private readonly processingTimeout = 120000; // 2 minutes

  constructor() {
    this.uploadsDir = path.join(__dirname, '../../uploads/videos');
    this.outputDir = path.join(__dirname, '../../uploads/processed');
    this.tempDir = path.join(__dirname, '../../uploads/temp');
  }

  async initialize(): Promise<void> {
    // Create necessary directories
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
    
    console.log('[VideoProcessor] Initialized');
  }

  async addJob(
    mediaFiles: string[], 
    mediaTypes: ('video' | 'image')[], 
    mediaSettings: MediaSettings[],
    audioFile?: string, 
    audioSpeed: number = 1.0,
    aiEnhancement: boolean = false
  ): Promise<string> {
    const jobId = uuidv4();
    const outputPath = path.join(this.outputDir, `${jobId}.mp4`);

    const job: VideoJob = {
      id: jobId,
      mediaFiles,
      mediaTypes,
      mediaSettings,
      audioFile,
      audioSpeed,
      aiEnhancement,
      outputPath,
      status: 'queued',
      createdAt: new Date()
    };

    this.queue.push(job);
    console.log(`[VideoProcessor] Job ${jobId} added to queue. Queue length: ${this.queue.length}`);

    // Start processing if not already processing
    this.processQueue();

    return jobId;
  }

  async getJobStatus(jobId: string): Promise<VideoJob | null> {
    return this.queue.find(job => job.id === jobId) || null;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.find(j => j.status === 'queued');

    if (!job) {
      this.isProcessing = false;
      return;
    }

    job.status = 'processing';
    console.log(`[VideoProcessor] Processing job ${job.id}`);

    try {
      await this.processVideo(job);
      job.status = 'completed';
      console.log(`[VideoProcessor] Job ${job.id} completed successfully`);

      // Cleanup old videos
      await this.cleanupOldVideos();
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      console.error(`[VideoProcessor] Job ${job.id} failed:`, error.message);
    } finally {
      // Cleanup temp files for this job
      await this.cleanupTempFiles(job);
      
      this.isProcessing = false;
      
      // Process next job in queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private async processVideo(job: VideoJob): Promise<void> {
    const concatListPath = path.join(this.tempDir, `${job.id}_concat.txt`);
    const concatenatedPath = path.join(this.tempDir, `${job.id}_concat.mp4`);
    const convertedVideos: string[] = [];

    try {
      // Step 1: Process media files - convert images and apply all settings to videos in one pass
      for (let i = 0; i < job.mediaFiles.length; i++) {
        if (job.mediaTypes[i] === 'image') {
          // Images: just convert to video with specified duration
          const imageDuration = job.mediaSettings[i]?.imageDuration || 3;
          const videoPath = path.join(this.tempDir, `${job.id}_img_${i}.mp4`);
          await this.convertImageToVideo(job.mediaFiles[i], videoPath, imageDuration);
          convertedVideos.push(videoPath);
          job.mediaFiles[i] = videoPath;
          job.mediaTypes[i] = 'video';
        } else if (job.mediaTypes[i] === 'video') {
          // Videos: apply trim + speed + crop/zoom in ONE pass (faster!)
          const processedPath = path.join(this.tempDir, `${job.id}_processed_${i}.mp4`);
          await this.applyAllVideoSettings(job.mediaFiles[i], processedPath, job.mediaSettings[i]);
          convertedVideos.push(processedPath);
          job.mediaFiles[i] = processedPath;
        }
      }

      // If no audio, just concatenate all media
      if (!job.audioFile) {
        console.log('[VideoProcessor] No audio file - concatenating media only');
        
        const concatContent = job.mediaFiles.map(f => `file '${f}'`).join('\n');
        await fs.writeFile(concatListPath, concatContent);

        await this.runFFmpegCommand([
          '-f', 'concat',
          '-safe', '0',
          '-i', concatListPath,
          '-c', 'copy',
          '-y',
          job.outputPath
        ], 'Concatenating media');

        console.log(`[VideoProcessor] Video saved to: ${job.outputPath}`);

        // Apply AI enhancement if requested
        if (job.aiEnhancement) {
          await this.applyAIEnhancement(job.outputPath);
        }

        return;
      }

      // Step 2: Get audio duration
      const audioDuration = await this.getMediaDuration(job.audioFile);
      console.log(`[VideoProcessor] Audio duration: ${audioDuration}s`);
      
      // Apply audio speed if needed
      let finalAudioFile = job.audioFile;
      let finalAudioDuration = audioDuration;
      
      if (job.audioSpeed !== 1.0) {
        console.log(`[VideoProcessor] Applying audio speed: ${job.audioSpeed}x`);
        const speedAdjustedAudioPath = path.join(this.tempDir, `${job.id}_audio_speed.mp3`);
        await this.applyAudioSpeed(job.audioFile, speedAdjustedAudioPath, job.audioSpeed);
        convertedVideos.push(speedAdjustedAudioPath);
        finalAudioFile = speedAdjustedAudioPath;
        finalAudioDuration = audioDuration / job.audioSpeed;
        console.log(`[VideoProcessor] Audio duration after speed adjustment: ${finalAudioDuration}s`);
      }

      // Step 3: Calculate total video duration
      let totalVideoDuration = 0;
      const videoDurations: number[] = [];
      
      for (const videoFile of job.mediaFiles) {
        const duration = await this.getMediaDuration(videoFile);
        videoDurations.push(duration);
        totalVideoDuration += duration;
      }
      console.log(`[VideoProcessor] Total video duration: ${totalVideoDuration}s`);

      // Step 4: Build video list to match audio duration
      let finalVideoList: string[] = [];
      let currentDuration = 0;
      const MIN_FINAL_SEGMENT_DURATION = 3;

      if (totalVideoDuration >= audioDuration) {
        // Videos are longer than audio - trim to audio length
        // But ensure the final segment is at least 3 seconds
        for (let i = 0; i < job.mediaFiles.length; i++) {
          const remainingAudioTime = finalAudioDuration - currentDuration;
          
          if (remainingAudioTime <= 0) break;
          
          if (videoDurations[i] <= remainingAudioTime) {
            // This video fits completely
            finalVideoList.push(job.mediaFiles[i]);
            currentDuration += videoDurations[i];
          } else {
            // This video needs to be trimmed
            const trimDuration = remainingAudioTime;
            
            if (trimDuration >= MIN_FINAL_SEGMENT_DURATION) {
              // Trim duration is acceptable, use it
              const trimmedPath = path.join(this.tempDir, `${job.id}_trim_${i}.mp4`);
              await this.trimVideo(job.mediaFiles[i], trimmedPath, trimDuration);
              convertedVideos.push(trimmedPath);
              finalVideoList.push(trimmedPath);
              currentDuration += trimDuration;
            } else {
              // Trim duration is too short, extend previous video with last frame
              if (i > 0) {
                console.log(`[VideoProcessor] Final segment too short (${trimDuration}s), extending previous video`);
                const extendDuration = remainingAudioTime;
                const extendedPath = path.join(this.tempDir, `${job.id}_extend_${i-1}.mp4`);
                await this.extendVideoWithLastFrame(job.mediaFiles[i-1], extendedPath, extendDuration);
                convertedVideos.push(extendedPath);
                // Replace the last video in the list with the extended version
                finalVideoList[finalVideoList.length - 1] = extendedPath;
                currentDuration = finalAudioDuration;
              } else {
                // First video, just trim it even if short
                const trimmedPath = path.join(this.tempDir, `${job.id}_trim_${i}.mp4`);
                await this.trimVideo(job.mediaFiles[i], trimmedPath, trimDuration);
                convertedVideos.push(trimmedPath);
                finalVideoList.push(trimmedPath);
                currentDuration += trimDuration;
              }
            }
            break;
          }
        }
      } else {
        // Videos are shorter than audio - loop/shuffle to extend
        finalVideoList = [...job.mediaFiles];
        currentDuration = totalVideoDuration;

        while (currentDuration < finalAudioDuration) {
          const remainingTime = finalAudioDuration - currentDuration;
          
          // Shuffle and add videos again
          const shuffled = this.shuffleArray([...job.mediaFiles]);
          for (let i = 0; i < shuffled.length; i++) {
            const video = shuffled[i];
            const idx = job.mediaFiles.indexOf(video);
            const videoDuration = videoDurations[idx];
            
            if (currentDuration >= finalAudioDuration) break;
            
            const remainingAudioTime = finalAudioDuration - currentDuration;
            
            if (videoDuration <= remainingAudioTime) {
              // Video fits completely
              finalVideoList.push(video);
              currentDuration += videoDuration;
            } else {
              // Need to trim this video
              const trimDuration = remainingAudioTime;
              
              if (trimDuration >= MIN_FINAL_SEGMENT_DURATION) {
                const trimmedPath = path.join(this.tempDir, `${job.id}_trim_loop_${i}.mp4`);
                await this.trimVideo(video, trimmedPath, trimDuration);
                convertedVideos.push(trimmedPath);
                finalVideoList.push(trimmedPath);
                currentDuration += trimDuration;
              } else {
                // Extend previous video instead
                console.log(`[VideoProcessor] Final segment too short (${trimDuration}s), extending previous video`);
                const lastVideo = finalVideoList[finalVideoList.length - 1];
                const extendedPath = path.join(this.tempDir, `${job.id}_extend_loop.mp4`);
                await this.extendVideoWithLastFrame(lastVideo, extendedPath, remainingAudioTime);
                convertedVideos.push(extendedPath);
                finalVideoList[finalVideoList.length - 1] = extendedPath;
                currentDuration = finalAudioDuration;
              }
              break;
            }
          }
        }
      }

      console.log(`[VideoProcessor] Final video list: ${finalVideoList.length} segments`);

      // Step 5: Create concat file
      const concatContent = finalVideoList.map(f => `file '${f}'`).join('\n');
      await fs.writeFile(concatListPath, concatContent);

      // Step 6: Concatenate videos
      await this.runFFmpegCommand([
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        concatenatedPath
      ], 'Concatenating videos');

      // Step 7: Overlay audio and trim to audio duration
      await this.runFFmpegCommand([
        '-i', concatenatedPath,
        '-i', finalAudioFile,
        '-t', finalAudioDuration.toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        '-y',
        job.outputPath
      ], 'Overlaying audio');

      console.log(`[VideoProcessor] Video saved to: ${job.outputPath}`);

      // Step 8: Apply AI enhancement if requested
      if (job.aiEnhancement) {
        await this.applyAIEnhancement(job.outputPath);
      }
    } finally {
      // Cleanup intermediate files
      await this.safeDelete(concatListPath);
      await this.safeDelete(concatenatedPath);
      for (const converted of convertedVideos) {
        await this.safeDelete(converted);
      }
    }
  }

  private async getMediaDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
      ];

      const ffprobe = spawn('ffprobe', args);
      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          if (isNaN(duration)) {
            console.error(`[VideoProcessor] Invalid duration for ${filePath}: ${output.trim()}`);
            console.error(`[VideoProcessor] FFprobe error output: ${errorOutput}`);
            reject(new Error(`Failed to get valid duration for ${filePath}`));
          } else {
            resolve(duration);
          }
        } else {
          console.error(`[VideoProcessor] FFprobe failed for ${filePath}: ${errorOutput}`);
          reject(new Error(`Failed to get duration for ${filePath}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(new Error(`FFprobe error: ${error.message}`));
      });
    });
  }

  private async runFFmpegCommand(args: string[], description: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[VideoProcessor] ${description}...`);
      console.log(`[VideoProcessor] FFmpeg command: ffmpeg ${args.join(' ')}`);
      
      const ffmpeg = spawn('ffmpeg', args);
      let errorOutput = '';

      // Timeout handling
      const timeout = setTimeout(() => {
        ffmpeg.kill('SIGKILL');
        reject(new Error(`FFmpeg timeout after ${this.processingTimeout}ms`));
      }, this.processingTimeout);

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          console.error(`[VideoProcessor] FFmpeg error output:\n${errorOutput}`);
          reject(new Error(`FFmpeg failed with code ${code}: ${errorOutput.slice(-500)}`));
        }
      });

      ffmpeg.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`FFmpeg error: ${error.message}`));
      });
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async convertImageToVideo(imagePath: string, outputPath: string, duration: number): Promise<void> {
    return this.runFFmpegCommand([
      '-loop', '1',
      '-i', imagePath,
      '-c:v', 'libx264',
      '-t', duration.toString(),
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      '-y',
      outputPath
    ], `Converting image to ${duration}s video`);
  }

  private async cropAndZoomVideo(videoPath: string, outputPath: string): Promise<void> {
    return this.runFFmpegCommand([
      '-i', videoPath,
      '-vf', 'crop=in_w*0.9:in_h*0.9,scale=in_w/0.9:in_h/0.9',
      '-c:a', 'copy',
      '-y',
      outputPath
    ], 'Cropping and zooming video (10% zoom)');
  }

  /**
   * Apply crop and zoom to a video (used for images converted to video)
   */
  private async applyCropZoom(videoPath: string, outputPath: string): Promise<void> {
    return this.runFFmpegCommand([
      '-i', videoPath,
      '-vf', 'crop=in_w*0.9:in_h*0.9,scale=in_w/0.9:in_h/0.9',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y',
      outputPath
    ], 'Applying crop and zoom');
  }

  private async applyAllVideoSettings(videoPath: string, outputPath: string, settings: MediaSettings): Promise<void> {
    const videoFilters: string[] = [];
    const args: string[] = [];
    
    // Get video duration first to handle trimEnd properly
    const videoDuration = await this.getMediaDuration(videoPath);
    const effectiveTrimStart = settings.trimStart || 0;
    const effectiveTrimEnd = (settings.trimEnd && settings.trimEnd > 0) ? settings.trimEnd : videoDuration;
    
    // Calculate the actual duration we want
    const trimDuration = effectiveTrimEnd - effectiveTrimStart;
    
    // Validate trim duration
    if (trimDuration <= 0) {
      throw new Error(`Invalid trim duration: ${trimDuration}s (start: ${effectiveTrimStart}s, end: ${effectiveTrimEnd}s)`);
    }
    
    // Input file first
    args.push('-i', videoPath);
    
    // Apply trim using -ss and -t AFTER input
    if (effectiveTrimStart > 0) {
      args.push('-ss', effectiveTrimStart.toFixed(3));
    }
    if (trimDuration < videoDuration) {
      args.push('-t', trimDuration.toFixed(3));
    }
    
    // Apply video speed if not 1.0
    if (settings.videoSpeed !== 1.0) {
      const pts = 1 / settings.videoSpeed;
      videoFilters.push(`setpts=${pts.toFixed(6)}*PTS`);
    }
    
    // Always apply crop and zoom (10% zoom)
    videoFilters.push('crop=in_w*0.9:in_h*0.9');
    videoFilters.push('scale=in_w/0.9:in_h/0.9');
    
    // Add all video filters in one pass
    if (videoFilters.length > 0) {
      args.push('-vf', videoFilters.join(','));
    }
    
    // Apply audio speed if video speed changed
    if (settings.videoSpeed !== 1.0) {
      // atempo filter only works between 0.5 and 2.0
      const speed = settings.videoSpeed;
      if (speed >= 0.5 && speed <= 2.0) {
        args.push('-filter:a', `atempo=${speed.toFixed(6)}`);
      } else if (speed < 0.5) {
        args.push('-filter:a', `atempo=0.5,atempo=${(speed / 0.5).toFixed(6)}`);
      } else {
        args.push('-filter:a', `atempo=2.0,atempo=${(speed / 2.0).toFixed(6)}`);
      }
    } else {
      args.push('-c:a', 'aac', '-b:a', '128k');
    }
    
    // Video encoding settings
    args.push('-c:v', 'libx264');
    args.push('-preset', 'fast');
    args.push('-crf', '23');
    args.push('-y', outputPath);
    
    await this.runFFmpegCommand(
      args, 
      `Processing video (trim: ${effectiveTrimStart.toFixed(1)}s-${effectiveTrimEnd.toFixed(1)}s [${trimDuration.toFixed(1)}s], speed: ${settings.videoSpeed}x, crop+zoom)`
    );
    
    // Verify the output file was created and has content
    try {
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error(`Processed video file is empty: ${outputPath}`);
      }
      console.log(`[VideoProcessor] Processed video size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (error: any) {
      throw new Error(`Failed to verify processed video: ${error.message}`);
    }
  }

  private async applyAudioSpeed(audioPath: string, outputPath: string, speed: number): Promise<void> {
    const args: string[] = ['-i', audioPath];
    
    // atempo filter only works between 0.5 and 2.0
    if (speed >= 0.5 && speed <= 2.0) {
      args.push('-filter:a', `atempo=${speed}`);
    } else if (speed < 0.5) {
      // Chain atempo filters for very slow speeds
      args.push('-filter:a', `atempo=0.5,atempo=${speed / 0.5}`);
    } else {
      // Chain atempo filters for very fast speeds
      args.push('-filter:a', `atempo=2.0,atempo=${speed / 2.0}`);
    }
    
    args.push('-y', outputPath);
    
    await this.runFFmpegCommand(args, `Applying audio speed: ${speed}x`);
  }

  private async trimVideo(videoPath: string, outputPath: string, duration: number): Promise<void> {
    return this.runFFmpegCommand([
      '-i', videoPath,
      '-t', duration.toString(),
      '-c', 'copy',
      '-y',
      outputPath
    ], `Trimming video to ${duration}s`);
  }

  private async extendVideoWithLastFrame(videoPath: string, outputPath: string, totalDuration: number): Promise<void> {
    const originalDuration = await this.getMediaDuration(videoPath);
    const freezeDuration = totalDuration - originalDuration;
    
    if (freezeDuration <= 0) {
      // No need to extend, just copy
      return this.runFFmpegCommand([
        '-i', videoPath,
        '-c', 'copy',
        '-y',
        outputPath
      ], 'Copying video');
    }

    const lastFramePath = path.join(this.tempDir, `${path.basename(outputPath)}_lastframe.png`);
    const lastFrameVideoPath = path.join(this.tempDir, `${path.basename(outputPath)}_freeze.mp4`);

    try {
      // Extract last frame
      await this.runFFmpegCommand([
        '-sseof', '-1',
        '-i', videoPath,
        '-update', '1',
        '-q:v', '1',
        '-y',
        lastFramePath
      ], 'Extracting last frame');

      // Convert last frame to video
      await this.convertImageToVideo(lastFramePath, lastFrameVideoPath, freezeDuration);

      // Concatenate original video with frozen frame
      const concatListPath = path.join(this.tempDir, `${path.basename(outputPath)}_concat.txt`);
      await fs.writeFile(concatListPath, `file '${videoPath}'\nfile '${lastFrameVideoPath}'`);

      await this.runFFmpegCommand([
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        '-y',
        outputPath
      ], `Extending video with ${freezeDuration}s freeze frame`);

      // Cleanup
      await this.safeDelete(lastFramePath);
      await this.safeDelete(lastFrameVideoPath);
      await this.safeDelete(concatListPath);
    } catch (error) {
      await this.safeDelete(lastFramePath);
      await this.safeDelete(lastFrameVideoPath);
      throw error;
    }
  }

  private async applyAIEnhancement(videoPath: string): Promise<void> {
    const tempEnhancedPath = path.join(this.tempDir, `${path.basename(videoPath)}_enhanced.mp4`);
    
    try {
      console.log('[VideoProcessor] Applying AI enhancement filters...');
      
      // Apply enhancement filters: sharpening, subtle noise, contrast and saturation boost
      await this.runFFmpegCommand([
        '-i', videoPath,
        '-vf', 'unsharp=3:3:0.5,noise=alls=5:allf=t+u,eq=contrast=1.05:saturation=1.1',
        '-c:a', 'copy',
        '-y',
        tempEnhancedPath
      ], 'Applying AI enhancement');

      // Replace original with enhanced version
      await fs.unlink(videoPath);
      await fs.rename(tempEnhancedPath, videoPath);
      
      console.log('[VideoProcessor] AI enhancement applied successfully');
    } catch (error) {
      await this.safeDelete(tempEnhancedPath);
      throw error;
    }
  }

  private async cleanupOldVideos(): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir);
      const videoFiles = files.filter(f => f.endsWith('.mp4'));

      if (videoFiles.length <= this.maxStoredVideos) {
        return;
      }

      // Get file stats with creation time
      const fileStats = await Promise.all(
        videoFiles.map(async (file) => {
          const filePath = path.join(this.outputDir, file);
          const stats = await fs.stat(filePath);
          return { file, path: filePath, mtime: stats.mtime };
        })
      );

      // Sort by modification time (oldest first)
      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // Delete oldest files
      const filesToDelete = fileStats.slice(0, fileStats.length - this.maxStoredVideos);
      
      for (const { path: filePath, file } of filesToDelete) {
        await this.safeDelete(filePath);
        console.log(`[VideoProcessor] Deleted old video: ${file}`);
      }

      console.log(`[VideoProcessor] Cleaned up ${filesToDelete.length} old videos`);
    } catch (error: any) {
      console.error('[VideoProcessor] Error cleaning up old videos:', error.message);
    }
  }

  private async cleanupTempFiles(job: VideoJob): Promise<void> {
    try {
      // Delete uploaded media files
      for (const mediaFile of job.mediaFiles) {
        await this.safeDelete(mediaFile);
      }

      // Delete uploaded audio file if exists
      if (job.audioFile) {
        await this.safeDelete(job.audioFile);
      }

      console.log(`[VideoProcessor] Cleaned up temp files for job ${job.id}`);
    } catch (error: any) {
      console.error(`[VideoProcessor] Error cleaning up temp files for job ${job.id}:`, error.message);
    }
  }

  private async safeDelete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      // Ignore errors if file doesn't exist
      if (error.code !== 'ENOENT') {
        console.error(`[VideoProcessor] Error deleting ${filePath}:`, error.message);
      }
    }
  }

  getQueueStatus(): { total: number; queued: number; processing: number; completed: number; failed: number } {
    return {
      total: this.queue.length,
      queued: this.queue.filter(j => j.status === 'queued').length,
      processing: this.queue.filter(j => j.status === 'processing').length,
      completed: this.queue.filter(j => j.status === 'completed').length,
      failed: this.queue.filter(j => j.status === 'failed').length
    };
  }

  async getProcessedVideos(): Promise<Array<{ id: string; filename: string; createdAt: Date; size: number }>> {
    try {
      const files = await fs.readdir(this.outputDir);
      const videoFiles = files.filter(f => f.endsWith('.mp4'));

      const videoInfo = await Promise.all(
        videoFiles.map(async (file) => {
          const filePath = path.join(this.outputDir, file);
          const stats = await fs.stat(filePath);
          const id = path.basename(file, '.mp4');
          
          return {
            id,
            filename: file,
            createdAt: stats.mtime,
            size: stats.size
          };
        })
      );

      // Sort by creation time (newest first)
      videoInfo.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return videoInfo;
    } catch (error: any) {
      console.error('[VideoProcessor] Error getting processed videos:', error.message);
      return [];
    }
  }

  async getVideoPath(jobId: string): Promise<string | null> {
    try {
      const videoPath = path.join(this.outputDir, `${jobId}.mp4`);
      // Check if file exists
      await fs.access(videoPath);
      return videoPath;
    } catch (error) {
      return null;
    }
  }
}

export const videoProcessor = new VideoProcessor();
