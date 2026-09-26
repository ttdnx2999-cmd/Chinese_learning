import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables FIRST before any other imports
// Specify the path to .env file explicitly
const envPath = resolve(__dirname, '../.env');
console.log('[ENV] Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('[ENV] Error loading .env file:', result.error);
} else {
  console.log('[ENV] .env file loaded successfully');
  console.log('[ENV] GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? `${process.env.GOOGLE_AI_API_KEY.substring(0, 10)}...` : 'NOT SET');
}

import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { initDatabase } from './config/database';
import flashcardRoutes from './routes/flashcard.routes';
import vocabularyRoutes from './routes/vocabulary.routes';
import comprehensionRoutes from './routes/comprehension.routes';
import ttsRoutes from './routes/tts.routes';
import adminRoutes from './routes/admin.routes';
import phrasesRoutes from './routes/phrases.routes';
import videoRoutes from './routes/video.routes';
import imagenRoutes from './routes/imagen.routes';
import authRoutes from './routes/auth.routes';
import userManagementRoutes from './routes/user-management.routes';

// Import config AFTER dotenv has loaded
import { config } from './config/env';

// Import scheduler and phrase generator services
import { GenerationScheduler } from './services/GenerationScheduler';
import { PhraseGeneratorService } from './services/PhraseGeneratorService';
import { videoProcessor } from './services/VideoProcessor';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for database imports and large payloads

// Create temp audio directory if it doesn't exist
const audioDir = join(process.cwd(), 'temp', 'audio');
mkdir(audioDir, { recursive: true }).catch(console.error);

// Serve static audio files
app.use('/audio', express.static(audioDir));

// Serve static imagen workspaces
const imagenWorkspacesDir = join(process.cwd(), 'public', 'imagen-workspaces');
mkdir(imagenWorkspacesDir, { recursive: true }).catch(console.error);
app.use('/imagen-workspaces', express.static(imagenWorkspacesDir));

// Log API key status (without revealing the actual key)
console.log('=== API Configuration ===');
console.log('Google Translate API Key:', config.google.translateApiKey ? `Set (${config.google.translateApiKey.substring(0, 10)}...)` : 'NOT SET');
console.log('Google AI API Key:', config.google.aiApiKey ? `Set (${config.google.aiApiKey.substring(0, 10)}...)` : 'NOT SET');
console.log('========================');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Chinese Learning App API is running' });
});

// API Routes
app.use('/api', flashcardRoutes);
app.use('/api', vocabularyRoutes);
app.use('/api', comprehensionRoutes);
app.use('/api', ttsRoutes);
app.use('/api', adminRoutes);
app.use('/api', phrasesRoutes);
app.use('/api', authRoutes);
app.use('/api', userManagementRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/imagen', imagenRoutes);

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    // Initialize video processor
    try {
      console.log('[VideoProcessor] Initializing video processor...');
      await videoProcessor.initialize();
      console.log('[VideoProcessor] Video processor initialized successfully');
    } catch (videoError) {
      console.error('[VideoProcessor] Failed to initialize video processor:', videoError);
      console.error('[VideoProcessor] Video processing features will be unavailable');
    }
    
    // Initialize and start the generation scheduler
    try {
      console.log('[Scheduler] Initializing phrase generation scheduler...');
      const phraseGenerator = new PhraseGeneratorService();
      const scheduler = new GenerationScheduler(phraseGenerator);
      scheduler.start();
      console.log('[Scheduler] Phrase generation scheduler started successfully');
    } catch (schedulerError) {
      console.error('[Scheduler] Failed to start generation scheduler:', schedulerError);
      console.error('[Scheduler] Application will continue without automated phrase generation');
      // Don't exit - allow the app to run without the scheduler
    }
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
