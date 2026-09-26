import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  imagePath?: string;
  model?: string;
  error?: string;
}

interface ConversationMessage {
  role: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  timestamp: Date;
}

interface Workspace {
  id: string;
  promptPhotoPath: string;
  promptPhotoUrl: string;
  generatedImages: {
    id: string;
    path: string;
    url: string;
    model: string;
    prompt: string;
    timestamp: Date;
  }[];
  conversationHistory: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export class ImagenGenerator {
  private genAI: GoogleGenerativeAI;
  private workspacesDir: string;
  private workspaces: Map<string, Workspace> = new Map();
  
  // Use Gemini 3.1 Flash Image Preview model
  private model = 'gemini-3.1-flash-image-preview';

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not found in environment variables');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.workspacesDir = path.join(process.cwd(), 'public', 'imagen-workspaces');
    this.initializeWorkspaces();
  }

  private async initializeWorkspaces() {
    try {
      await fs.mkdir(this.workspacesDir, { recursive: true });
      console.log('[ImagenGenerator] Workspaces directory initialized');
    } catch (error) {
      console.error('[ImagenGenerator] Failed to initialize workspaces:', error);
    }
  }

  async createWorkspace(promptPhotoBuffer: Buffer, originalName: string): Promise<string> {
    const workspaceId = uuidv4();
    const workspaceDir = path.join(this.workspacesDir, workspaceId);
    
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'generated'), { recursive: true });
    
    const ext = path.extname(originalName);
    const promptPhotoPath = path.join(workspaceDir, `prompt${ext}`);
    await fs.writeFile(promptPhotoPath, promptPhotoBuffer);
    
    const workspace: Workspace = {
      id: workspaceId,
      promptPhotoPath,
      promptPhotoUrl: `/imagen-workspaces/${workspaceId}/prompt${ext}`,
      generatedImages: [],
      conversationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.workspaces.set(workspaceId, workspace);
    await this.saveWorkspaceMetadata(workspaceId);
    
    console.log(`[ImagenGenerator] Created workspace: ${workspaceId}`);
    return workspaceId;
  }

  async generateImage(
    workspaceId: string,
    textPrompt: string,
    continueConversation: boolean = false
  ): Promise<GenerationResult> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    try {
      console.log(`[ImagenGenerator] Using model: ${this.model}`);
      console.log(`[ImagenGenerator] Continue conversation: ${continueConversation}`);
      
      // Track API call start
      const apiCallStart = Date.now();
      
      // Create model instance
      const model = this.genAI.getGenerativeModel({ model: this.model });

      let result;
      
      if (continueConversation && workspace.conversationHistory.length > 0) {
        // Build chat history from workspace conversation
        const history = [];
        
        for (const msg of workspace.conversationHistory) {
          if (msg.role === 'user') {
            const parts = [];
            if (msg.text) {
              parts.push({ text: msg.text });
            }
            if (msg.imageUrl) {
              // Read the image from the URL
              const imagePath = path.join(process.cwd(), 'public', msg.imageUrl);
              const imageBuffer = await fs.readFile(imagePath);
              const imageBase64 = imageBuffer.toString('base64');
              const mimeType = this.getMimeType(imagePath);
              parts.push({
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              });
            }
            history.push({
              role: 'user',
              parts,
            });
          } else if (msg.role === 'model') {
            const parts = [];
            if (msg.text) {
              parts.push({ text: msg.text });
            }
            if (msg.imageUrl) {
              // Read the generated image
              const imagePath = path.join(process.cwd(), 'public', msg.imageUrl);
              const imageBuffer = await fs.readFile(imagePath);
              const imageBase64 = imageBuffer.toString('base64');
              parts.push({
                inlineData: {
                  mimeType: 'image/png',
                  data: imageBase64,
                },
              });
            }
            history.push({
              role: 'model',
              parts,
            });
          }
        }
        
        console.log(`[ImagenGenerator] Starting chat with ${history.length} messages in history`);
        
        // Start chat with history
        const chat = model.startChat({ history });
        
        // Send the new message (no need to include previous images)
        result = await chat.sendMessage(textPrompt);
      } else {
        // First generation - include the prompt photo
        console.log(`[ImagenGenerator] First generation with prompt photo`);
        
        const promptPhotoBuffer = await fs.readFile(workspace.promptPhotoPath);
        const promptPhotoBase64 = promptPhotoBuffer.toString('base64');
        const mimeType = this.getMimeType(workspace.promptPhotoPath);
        
        result = await model.generateContent([
          {
            inlineData: {
              mimeType,
              data: promptPhotoBase64,
            },
          },
          { text: textPrompt },
        ]);
      }

      const response = result.response;
      const candidates = response.candidates;

      // Log usage metadata if available
      if (response.usageMetadata) {
        console.log(`[ImagenGenerator] Usage metadata:`, JSON.stringify(response.usageMetadata));
      }

      if (!candidates || candidates.length === 0) {
        console.log(`[ImagenGenerator] No candidates in response`);
        return { success: false, error: 'No image generated' };
      }

      // Extract image from response
      const candidate = candidates[0];
      const parts = candidate.content?.parts;

      if (!parts || parts.length === 0) {
        console.log(`[ImagenGenerator] No parts in candidate`);
        return { success: false, error: 'No image data in response' };
      }

      // Find the image part
      let imageData: string | null = null;
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }

      if (!imageData) {
        console.log(`[ImagenGenerator] No image data found in parts`);
        return { success: false, error: 'No image data in response' };
      }

      // Save generated image
      const imageId = uuidv4();
      const imagePath = path.join(
        this.workspacesDir,
        workspaceId,
        'generated',
        `${imageId}.png`
      );
      
      const buffer = Buffer.from(imageData, 'base64');
      await fs.writeFile(imagePath, buffer);
      
      const imageUrl = `/imagen-workspaces/${workspaceId}/generated/${imageId}.png`;
      
      // Update workspace
      workspace.generatedImages.push({
        id: imageId,
        path: imagePath,
        url: imageUrl,
        model: this.model,
        prompt: textPrompt,
        timestamp: new Date(),
      });
      
      workspace.conversationHistory.push({
        role: 'user',
        text: textPrompt,
        timestamp: new Date(),
      });
      
      workspace.conversationHistory.push({
        role: 'model',
        imageUrl,
        timestamp: new Date(),
      });
      
      workspace.updatedAt = new Date();
      await this.saveWorkspaceMetadata(workspaceId);
      
      // Track successful API call
      const apiCallDuration = Date.now() - apiCallStart;
      const usageMetadata = response.usageMetadata || null;
      await this.trackApiCall(true, apiCallDuration, usageMetadata);
      
      console.log(`[ImagenGenerator] Successfully generated image with ${this.model}`);
      return {
        success: true,
        imageUrl,
        imagePath,
        model: this.model,
      };
      
    } catch (error: any) {
      // Track failed API call
      await this.trackApiCall(false, 0, null);
      
      const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
      console.error(`[ImagenGenerator] Error:`, errorStr);
      return {
        success: false,
        error: `Generation failed: ${error.message || errorStr}`,
      };
    }
  }

  private async trackApiCall(success: boolean, duration: number, usageMetadata: any) {
    try {
      const statsPath = path.join(this.workspacesDir, 'api-usage-stats.json');
      let statsData = {
        config: {
          modelName: 'gemini-3.1-flash-image-preview',
          exchangeRate: {
            usdToVnd: 27000,
            currency: 'VND',
          },
          pricing: {
            inputTextCostPerMillion: 0.50,
            outputTextCostPerMillion: 3.00,
            outputImageCostPerMillion: 60.00,
            currency: 'USD',
          },
          budget: {
            totalBudgetVnd: 4000000,
            description: 'Total budget for API usage',
          },
          reference: {
            image1024px: {
              tokens: 1120,
              costUsd: 0.067,
              description: 'Cost for 1024x1024px output image',
            },
          },
        },
        usage: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          lastUpdated: new Date().toISOString(),
        },
      };

      try {
        const data = await fs.readFile(statsPath, 'utf-8');
        const existing = JSON.parse(data);
        // Preserve config if it exists, otherwise use defaults
        if (existing.config) {
          statsData.config = existing.config;
        }
        // Preserve usage data if it exists
        if (existing.usage) {
          statsData.usage = existing.usage;
        }
      } catch {
        // File doesn't exist yet, use defaults
      }

      statsData.usage.totalCalls++;
      if (success) {
        statsData.usage.successfulCalls++;
        
        // Track token usage if available
        if (usageMetadata) {
          statsData.usage.totalInputTokens = (statsData.usage.totalInputTokens || 0) + (usageMetadata.promptTokenCount || 0);
          statsData.usage.totalOutputTokens = (statsData.usage.totalOutputTokens || 0) + (usageMetadata.candidatesTokenCount || 0);
          
          // Try to extract image-specific tokens if available
          if (usageMetadata.totalTokenCount) {
            console.log(`[ImagenGenerator] Total tokens: ${usageMetadata.totalTokenCount}`);
          }
        }
      } else {
        statsData.usage.failedCalls++;
      }
      statsData.usage.lastUpdated = new Date().toISOString();

      await fs.writeFile(statsPath, JSON.stringify(statsData, null, 2));
      console.log(`[ImagenGenerator] API usage tracked: ${statsData.usage.successfulCalls} successful, ${statsData.usage.failedCalls} failed`);
      if (usageMetadata) {
        console.log(`[ImagenGenerator] Token usage: ${statsData.usage.totalInputTokens} input, ${statsData.usage.totalOutputTokens} output`);
      }
    } catch (error) {
      console.error('[ImagenGenerator] Failed to track API call:', error);
    }
  }

  async getApiUsageStats() {
    try {
      const statsPath = path.join(this.workspacesDir, 'api-usage-stats.json');
      const data = await fs.readFile(statsPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {
        config: {
          modelName: 'gemini-3.1-flash-image-preview',
          exchangeRate: {
            usdToVnd: 27000,
            currency: 'VND',
          },
          pricing: {
            inputTextCostPerMillion: 0.50,
            outputTextCostPerMillion: 3.00,
            outputImageCostPerMillion: 60.00,
            currency: 'USD',
          },
          budget: {
            totalBudgetVnd: 4000000,
            description: 'Total budget for API usage',
          },
          reference: {
            image1024px: {
              tokens: 1120,
              costUsd: 0.067,
              description: 'Cost for 1024x1024px output image',
            },
          },
        },
        usage: {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          lastUpdated: new Date().toISOString(),
        },
      };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    return this.workspaces.get(workspaceId) || null;
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    return Array.from(this.workspaces.values());
  }

  async deleteWorkspace(workspaceId: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      console.log(`[ImagenGenerator] Workspace not found: ${workspaceId}`);
      return false;
    }

    try {
      const workspaceDir = path.join(this.workspacesDir, workspaceId);
      
      // Log what we're about to delete
      console.log(`[ImagenGenerator] Deleting workspace directory: ${workspaceDir}`);
      console.log(`[ImagenGenerator] - Prompt photo: ${workspace.promptPhotoPath}`);
      console.log(`[ImagenGenerator] - Generated images: ${workspace.generatedImages.length}`);
      console.log(`[ImagenGenerator] - Conversation history: ${workspace.conversationHistory.length} messages`);
      
      // Delete the entire workspace directory (includes prompt photo, generated images, metadata.json)
      await fs.rm(workspaceDir, { recursive: true, force: true });
      
      // Remove from memory
      this.workspaces.delete(workspaceId);
      
      console.log(`[ImagenGenerator] Successfully deleted workspace: ${workspaceId}`);
      return true;
    } catch (error) {
      console.error(`[ImagenGenerator] Error deleting workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  private async saveWorkspaceMetadata(workspaceId: string) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const metadataPath = path.join(this.workspacesDir, workspaceId, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(workspace, null, 2));
  }

  private async loadWorkspaceMetadata(workspaceId: string): Promise<Workspace | null> {
    try {
      const metadataPath = path.join(this.workspacesDir, workspaceId, 'metadata.json');
      const data = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async loadAllWorkspaces() {
    try {
      const entries = await fs.readdir(this.workspacesDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const workspace = await this.loadWorkspaceMetadata(entry.name);
          if (workspace) {
            this.workspaces.set(entry.name, workspace);
          }
        }
      }
      
      console.log(`[ImagenGenerator] Loaded ${this.workspaces.size} workspaces`);
    } catch (error) {
      console.error('[ImagenGenerator] Failed to load workspaces:', error);
    }
  }
}
