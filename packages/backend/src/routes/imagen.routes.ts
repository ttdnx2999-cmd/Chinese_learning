import express from 'express';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ImagenGenerator } from '../services/ImagenGenerator';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const execAsync = promisify(exec);

let imagenGenerator: ImagenGenerator | null = null;

// Initialize the generator lazily
const getImagenGenerator = async (): Promise<ImagenGenerator> => {
  if (!imagenGenerator) {
    try {
      imagenGenerator = new ImagenGenerator();
      await imagenGenerator.loadAllWorkspaces();
      console.log('[ImagenRoutes] Imagen generator initialized');
    } catch (error) {
      console.error('[ImagenRoutes] Failed to initialize Imagen generator:', error);
      throw error;
    }
  }
  return imagenGenerator;
};

// Create workspace with prompt photo
router.post('/workspace', upload.single('promptPhoto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No prompt photo provided' });
    }

    const generator = await getImagenGenerator();
    const workspaceId = await generator.createWorkspace(
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      workspaceId,
      message: 'Workspace created successfully',
    });
  } catch (error: any) {
    console.error('[ImagenRoutes] Error creating workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate image for a workspace
router.post('/generate/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { textPrompt, continueConversation } = req.body;

    if (!textPrompt) {
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    const generator = await getImagenGenerator();
    const result = await generator.generateImage(
      workspaceId,
      textPrompt,
      continueConversation || false
    );

    if (result.success) {
      res.json({
        success: true,
        imageUrl: result.imageUrl,
        model: result.model,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('[ImagenRoutes] Error generating image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workspace details
router.get('/workspace/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const generator = await getImagenGenerator();
    const workspace = await generator.getWorkspace(workspaceId);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(workspace);
  } catch (error: any) {
    console.error('[ImagenRoutes] Error getting workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all workspaces
router.get('/workspaces', async (req, res) => {
  try {
    const generator = await getImagenGenerator();
    const workspaces = await generator.getAllWorkspaces();
    res.json(workspaces);
  } catch (error: any) {
    console.error('[ImagenRoutes] Error getting workspaces:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete workspace
router.delete('/workspace/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const generator = await getImagenGenerator();
    const success = await generator.deleteWorkspace(workspaceId);

    if (success) {
      res.json({ success: true, message: 'Workspace deleted' });
    } else {
      res.status(404).json({ error: 'Workspace not found' });
    }
  } catch (error: any) {
    console.error('[ImagenRoutes] Error deleting workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch generate for multiple workspaces
router.post('/batch-generate', async (req, res) => {
  try {
    const { workspaceIds, textPrompt, continueConversation } = req.body;

    if (!workspaceIds || !Array.isArray(workspaceIds)) {
      return res.status(400).json({ error: 'workspaceIds array is required' });
    }

    if (!textPrompt) {
      return res.status(400).json({ error: 'Text prompt is required' });
    }

    const generator = await getImagenGenerator();
    // Start generation for all workspaces
    const results = await Promise.allSettled(
      workspaceIds.map(workspaceId =>
        generator.generateImage(workspaceId, textPrompt, continueConversation || false)
      )
    );

    const response = results.map((result, index) => ({
      workspaceId: workspaceIds[index],
      ...(result.status === 'fulfilled' ? result.value : { success: false, error: 'Generation failed' }),
    }));

    res.json({ results: response });
  } catch (error: any) {
    console.error('[ImagenRoutes] Error in batch generation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get disk space information
router.get('/disk-space', async (req, res) => {
  try {
    const platform = process.platform;
    let diskInfo;

    if (platform === 'win32') {
      // Windows: use wmic
      const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
      const lines = stdout.trim().split('\n').slice(1);
      const drives = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          return {
            drive: parts[0],
            free: parseInt(parts[1]) || 0,
            total: parseInt(parts[2]) || 0,
          };
        }
        return null;
      }).filter(Boolean);
      
      // Get the drive where the app is running
      const cwd = process.cwd();
      const driveLetter = cwd.substring(0, 2);
      const currentDrive = drives.find(d => d && d.drive === driveLetter) || drives[0];
      
      if (currentDrive) {
        diskInfo = {
          free: currentDrive.free,
          total: currentDrive.total,
          used: currentDrive.total - currentDrive.free,
        };
      }
    } else {
      // Linux/Mac: use df
      const { stdout } = await execAsync('df -k .');
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        diskInfo = {
          total: parseInt(parts[1]) * 1024, // Convert KB to bytes
          used: parseInt(parts[2]) * 1024,
          free: parseInt(parts[3]) * 1024,
        };
      }
    }

    if (diskInfo) {
      res.json({
        total: diskInfo.total,
        used: diskInfo.used,
        free: diskInfo.free,
        percentUsed: ((diskInfo.used / diskInfo.total) * 100).toFixed(2),
      });
    } else {
      res.status(500).json({ error: 'Could not retrieve disk space information' });
    }
  } catch (error: any) {
    console.error('[ImagenRoutes] Error getting disk space:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get API usage statistics
router.get('/api-usage', async (req, res) => {
  try {
    const generator = await getImagenGenerator();
    const stats = await generator.getApiUsageStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[ImagenRoutes] Error getting API usage:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
