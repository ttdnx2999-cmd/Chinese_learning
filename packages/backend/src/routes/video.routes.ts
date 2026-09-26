import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { videoProcessor } from '../services/VideoProcessor';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/temp');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 20 // Max 20 files (videos/images + audio)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/mp4', 'video/quicktime', 
      'audio/mpeg', 'audio/mp4',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only MP4/MOV videos, MP3/M4A audio, and JPG/PNG/WEBP images allowed.`));
    }
  }
});

/**
 * POST /api/video/process
 * Upload video/image segments and audio file, process and return job ID
 */
router.post('/process', upload.fields([
  { name: 'media', maxCount: 15 },
  { name: 'audio', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.media || files.media.length === 0) {
      return res.status(400).json({ error: 'No media files uploaded' });
    }

    // Separate media files and determine their types
    const mediaFiles = files.media.map(f => f.path);
    const mediaTypes = files.media.map(f => {
      if (f.mimetype.startsWith('video/')) return 'video' as const;
      if (f.mimetype.startsWith('image/')) return 'image' as const;
      return 'video' as const; // fallback
    });

    // Parse media settings from JSON
    let mediaSettings = [];
    try {
      mediaSettings = JSON.parse(req.body.mediaSettings || '[]');
    } catch (error) {
      return res.status(400).json({ error: 'Invalid mediaSettings JSON' });
    }

    // Ensure we have settings for each media file
    if (mediaSettings.length !== mediaFiles.length) {
      // Fill with default settings if missing
      while (mediaSettings.length < mediaFiles.length) {
        mediaSettings.push({ trimStart: 0, trimEnd: 0, videoSpeed: 1.0, imageDuration: 3 });
      }
    }

    const audioFile = files.audio && files.audio.length > 0 ? files.audio[0].path : undefined;
    const audioSpeed = parseFloat(req.body.audioSpeed || '1.0');
    const aiEnhancement = req.body.aiEnhancement === 'true';

    // Add job to processing queue
    const jobId = await videoProcessor.addJob(mediaFiles, mediaTypes, mediaSettings, audioFile, audioSpeed, aiEnhancement);

    res.json({
      success: true,
      jobId,
      message: 'Video processing job queued',
      queueStatus: videoProcessor.getQueueStatus()
    });
  } catch (error: any) {
    console.error('Error processing video:', error);
    res.status(500).json({
      error: 'Failed to process video',
      message: error.message
    });
  }
});

/**
 * GET /api/video/status/:jobId
 * Get the status of a video processing job
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await videoProcessor.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      error: job.error,
      downloadUrl: job.status === 'completed' ? `/api/video/download/${job.id}` : null,
      streamUrl: job.status === 'completed' ? `/api/video/stream/${job.id}` : null
    });
  } catch (error: any) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      message: error.message
    });
  }
});

/**
 * GET /api/video/download/:jobId
 * Download the processed video
 */
router.get('/download/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await videoProcessor.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Video is not ready yet', status: job.status });
    }

    // Send the file
    res.download(job.outputPath, `video_${jobId}.mp4`, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download video' });
        }
      }
    });
  } catch (error: any) {
    console.error('Error downloading video:', error);
    res.status(500).json({
      error: 'Failed to download video',
      message: error.message
    });
  }
});

/**
 * GET /api/video/stream/:jobId
 * Stream the processed video for preview
 */
router.get('/stream/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    // Get the video file path directly (don't rely on job queue)
    const videoPath = await videoProcessor.getVideoPath(jobId);
    
    if (!videoPath) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Send the file for inline viewing (streaming) with absolute path
    res.sendFile(path.resolve(videoPath), (err) => {
      if (err) {
        console.error('Error streaming file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream video' });
        }
      }
    });
  } catch (error: any) {
    console.error('Error streaming video:', error);
    res.status(500).json({
      error: 'Failed to stream video',
      message: error.message
    });
  }
});

/**
 * GET /api/video/queue
 * Get current queue status
 */
router.get('/queue', (req: Request, res: Response) => {
  try {
    const status = videoProcessor.getQueueStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error getting queue status:', error);
    res.status(500).json({
      error: 'Failed to get queue status',
      message: error.message
    });
  }
});

/**
 * GET /api/video/list
 * Get list of all processed videos
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const videos = await videoProcessor.getProcessedVideos();
    res.json({
      success: true,
      videos: videos.map(v => ({
        id: v.id,
        filename: v.filename,
        createdAt: v.createdAt,
        size: v.size,
        downloadUrl: `/api/video/download/${v.id}`,
        streamUrl: `/api/video/stream/${v.id}`
      }))
    });
  } catch (error: any) {
    console.error('Error listing videos:', error);
    res.status(500).json({
      error: 'Failed to list videos',
      message: error.message
    });
  }
});

export default router;
