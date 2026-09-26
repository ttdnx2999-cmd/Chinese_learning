import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface GeneratedImage {
  id: string;
  url: string;
  model: string;
  prompt: string;
  timestamp: string;
}

interface Workspace {
  id: string;
  promptPhotoUrl: string;
  generatedImages: GeneratedImage[];
  conversationHistory: any[];
  createdAt: string;
  updatedAt: string;
}

interface DiskSpace {
  total: number;
  used: number;
  free: number;
  percentUsed: string;
}

interface ApiUsageStats {
  config: {
    modelName: string;
    exchangeRate: {
      usdToVnd: number;
      currency: string;
    };
    pricing: {
      inputTextCostPerMillion: number;
      outputTextCostPerMillion: number;
      outputImageCostPerMillion: number;
      currency: string;
    };
    budget: {
      totalBudgetVnd: number;
      description: string;
    };
    reference: {
      image1024px: {
        tokens: number;
        costUsd: number;
        description: string;
      };
    };
  };
  usage: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    lastUpdated: string;
  };
}

export default function ImagenGeneratorPage() {
  const navigate = useNavigate();
  const [textPrompt, setTextPrompt] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generatingWorkspaces, setGeneratingWorkspaces] = useState<Set<string>>(new Set());
  const [diskSpace, setDiskSpace] = useState<DiskSpace | null>(null);
  const [apiUsage, setApiUsage] = useState<ApiUsageStats | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Get config values from API response, or use defaults
  const USD_TO_VND = apiUsage?.config?.exchangeRate?.usdToVnd || 27000;
  const BUDGET_VND = apiUsage?.config?.budget?.totalBudgetVnd || 4000000;
  const INPUT_TEXT_COST_PER_1M = apiUsage?.config?.pricing?.inputTextCostPerMillion || 0.50;
  const OUTPUT_IMAGE_COST_PER_1M = apiUsage?.config?.pricing?.outputImageCostPerMillion || 60.00;
  const REFERENCE_1024PX_COST = apiUsage?.config?.reference?.image1024px?.costUsd || 0.067;

  useEffect(() => {
    loadWorkspaces();
    loadDiskSpace();
    loadApiUsage();
    
    // Add scroll listener for scroll-to-top button
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadDiskSpace = async () => {
    try {
      const response = await axios.get(`${API_URL}/imagen/disk-space`);
      setDiskSpace(response.data);
    } catch (error) {
      console.error('Failed to load disk space:', error);
    }
  };

  const loadApiUsage = async () => {
    try {
      const response = await axios.get(`${API_URL}/imagen/api-usage`);
      setApiUsage(response.data);
    } catch (error) {
      console.error('Failed to load API usage:', error);
    }
  };

  const loadWorkspaces = async () => {
    try {
      const response = await axios.get(`${API_URL}/imagen/workspaces`);
      setWorkspaces(response.data);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const handleUploadPromptPhotos = async (files: FileList) => {
    setLoading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('promptPhoto', file);
        
        const response = await axios.post(`${API_URL}/imagen/workspace`, formData);
        return response.data.workspaceId;
      });

      await Promise.all(uploadPromises);
      await loadWorkspaces();
      alert(`Successfully uploaded ${files.length} prompt photo(s)`);
    } catch (error: any) {
      console.error('Failed to upload prompt photos:', error);
      alert('Failed to upload prompt photos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateForSelected = async () => {
    if (selectedWorkspaces.size === 0) {
      alert('Please select at least one workspace');
      return;
    }

    if (!textPrompt.trim()) {
      alert('Please enter a text prompt');
      return;
    }

    const workspaceIds = Array.from(selectedWorkspaces);
    setGeneratingWorkspaces(new Set(workspaceIds));

    try {
      const response = await axios.post(`${API_URL}/imagen/batch-generate`, {
        workspaceIds,
        textPrompt,
        continueConversation: false,
      });

      const results = response.data.results;
      const successCount = results.filter((r: any) => r.success).length;
      const failCount = results.length - successCount;

      alert(`Generation complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
      
      await loadWorkspaces();
      await loadApiUsage(); // Refresh API usage stats
    } catch (error: any) {
      console.error('Batch generation failed:', error);
      alert('Batch generation failed: ' + error.message);
    } finally {
      setGeneratingWorkspaces(new Set());
    }
  };

  const toggleWorkspaceSelection = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    
    // Don't allow selecting workspaces that already have generated images
    if (workspace && workspace.generatedImages.length > 0) {
      return;
    }
    
    const newSelection = new Set(selectedWorkspaces);
    if (newSelection.has(workspaceId)) {
      newSelection.delete(workspaceId);
    } else {
      newSelection.add(workspaceId);
    }
    setSelectedWorkspaces(newSelection);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/imagen/workspace/${workspaceId}`);
      await loadWorkspaces();
      await loadDiskSpace(); // Refresh disk space after deletion
      setSelectedWorkspaces(prev => {
        const newSet = new Set(prev);
        newSet.delete(workspaceId);
        return newSet;
      });
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      alert('Failed to delete workspace: ' + error.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Separate workspaces into those with and without generated images
  // Sort workspaces with images by most recently updated first
  const workspacesWithImages = workspaces
    .filter(w => w.generatedImages.length > 0)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const workspacesWithoutImages = workspaces.filter(w => w.generatedImages.length === 0);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate actual token-based costs
  // Input tokens include text prompts + reference images (charged at text input rate)
  const inputCostUSD = ((apiUsage?.usage?.totalInputTokens || 0) / 1000000) * INPUT_TEXT_COST_PER_1M;
  
  // Output tokens are generated images (charged at image output rate)
  const outputCostUSD = ((apiUsage?.usage?.totalOutputTokens || 0) / 1000000) * OUTPUT_IMAGE_COST_PER_1M;
  
  const totalCostUSD = inputCostUSD + outputCostUSD;
  const totalCostVND = totalCostUSD * USD_TO_VND;
  const budgetUsedPercent = (totalCostVND / BUDGET_VND) * 100;
  const remainingBudgetVND = BUDGET_VND - totalCostVND;
  
  // Calculate average cost per call
  const avgCostPerCallUSD = (apiUsage?.usage?.successfulCalls || 0) > 0 
    ? totalCostUSD / (apiUsage?.usage?.successfulCalls || 1)
    : 0;
  const avgCostPerCallVND = avgCostPerCallUSD * USD_TO_VND;
  
  // Calculate max calls for budget (based on average, or use 1024px estimate if no data)
  const estimatedCostPerImage1024px = REFERENCE_1024PX_COST * USD_TO_VND;
  const maxCallsForBudget = avgCostPerCallVND > 0 
    ? Math.floor(BUDGET_VND / avgCostPerCallVND)
    : Math.floor(BUDGET_VND / estimatedCostPerImage1024px);

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>AI Image Generator (Imagen 4)</h1>

      {/* API Usage Tracking */}
      {apiUsage && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '20px', 
          backgroundColor: budgetUsedPercent > 90 ? '#fff3cd' : budgetUsedPercent > 75 ? '#fff8e1' : '#e8f5e9',
          border: `2px solid ${budgetUsedPercent > 90 ? '#ffc107' : budgetUsedPercent > 75 ? '#ffeb3b' : '#4CAF50'}`,
          borderRadius: '8px' 
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>📊 API Usage & Cost Tracking</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
            {/* API Calls */}
            <div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <strong>API Calls:</strong> {apiUsage.usage.successfulCalls} / {maxCallsForBudget} calls
              </div>
              <div style={{ height: '12px', backgroundColor: '#e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.min((apiUsage.usage.successfulCalls / maxCallsForBudget) * 100, 100)}%`, 
                  backgroundColor: budgetUsedPercent > 90 ? '#ffc107' : budgetUsedPercent > 75 ? '#ffeb3b' : '#4CAF50',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                {maxCallsForBudget - apiUsage.usage.successfulCalls} calls remaining for budget
              </div>
            </div>

            {/* Cost */}
            <div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                <strong>Cost:</strong> {formatVND(totalCostVND)} / {formatVND(BUDGET_VND)}
              </div>
              <div style={{ height: '12px', backgroundColor: '#e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.min(budgetUsedPercent, 100)}%`, 
                  backgroundColor: budgetUsedPercent > 90 ? '#ffc107' : budgetUsedPercent > 75 ? '#ffeb3b' : '#4CAF50',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                {formatVND(remainingBudgetVND)} remaining ({(100 - budgetUsedPercent).toFixed(1)}%)
              </div>
            </div>
          </div>

          <div style={{ paddingTop: '15px', borderTop: '1px solid #ddd' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <div><strong>Token Usage:</strong></div>
                <div>• Input: {apiUsage.usage.totalInputTokens?.toLocaleString() || 0} tokens</div>
                <div style={{ fontSize: '11px', color: '#999', marginLeft: '10px' }}>
                  ({formatVND(inputCostUSD * USD_TO_VND)} at ${INPUT_TEXT_COST_PER_1M}/1M)
                </div>
                <div>• Output (images): {apiUsage.usage.totalOutputTokens?.toLocaleString() || 0} tokens</div>
                <div style={{ fontSize: '11px', color: '#999', marginLeft: '10px' }}>
                  ({formatVND(outputCostUSD * USD_TO_VND)} at ${OUTPUT_IMAGE_COST_PER_1M}/1M)
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                <div><strong>Average per Image:</strong></div>
                <div>• {((apiUsage.usage.totalInputTokens || 0) / (apiUsage.usage.successfulCalls || 1)).toFixed(1)} input tokens</div>
                <div>• {((apiUsage.usage.totalOutputTokens || 0) / (apiUsage.usage.successfulCalls || 1)).toFixed(1)} output tokens</div>
                <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#2196F3' }}>
                  • Cost: {formatVND(avgCostPerCallVND)}
                </div>
                <div style={{ fontSize: '11px', color: '#999' }}>
                  (1024px = {apiUsage.config.reference.image1024px.tokens} tokens = {formatVND(REFERENCE_1024PX_COST * USD_TO_VND)})
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#999' }}>
              <div>
                {apiUsage.usage.failedCalls > 0 && (
                  <span style={{ color: '#f44336' }}>⚠️ {apiUsage.usage.failedCalls} failed calls</span>
                )}
              </div>
              <div>Last updated: {new Date(apiUsage.usage.lastUpdated).toLocaleString()}</div>
            </div>
          </div>

          {budgetUsedPercent > 90 && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
              <strong style={{ color: '#856404' }}>⚠️ Budget Alert:</strong>
              <span style={{ color: '#856404', marginLeft: '10px' }}>
                You've used {budgetUsedPercent.toFixed(1)}% of your 4 million VND budget. Consider monitoring usage carefully.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Disk Space Info */}
      {diskSpace && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: parseFloat(diskSpace.percentUsed) > 90 ? '#fff3cd' : '#d4edda',
          border: `1px solid ${parseFloat(diskSpace.percentUsed) > 90 ? '#ffc107' : '#28a745'}`,
          borderRadius: '8px' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>💾 Disk Space:</strong> {formatBytes(diskSpace.free)} free of {formatBytes(diskSpace.total)}
              <span style={{ marginLeft: '15px', color: '#666' }}>
                ({diskSpace.percentUsed}% used)
              </span>
            </div>
            {parseFloat(diskSpace.percentUsed) > 90 && (
              <span style={{ color: '#856404', fontSize: '14px' }}>
                ⚠️ Low disk space - consider deleting old workspaces
              </span>
            )}
          </div>
          <div style={{ marginTop: '8px', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${diskSpace.percentUsed}%`, 
              backgroundColor: parseFloat(diskSpace.percentUsed) > 90 ? '#ffc107' : '#28a745',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Text Prompt Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Text Prompt</h2>
        <textarea
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value)}
          placeholder="Enter your AI text prompt here..."
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '10px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          This prompt will be used for all selected workspaces
        </p>
      </div>

      {/* Upload Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Upload Prompt Photos</h2>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleUploadPromptPhotos(e.target.files)}
          disabled={loading}
          style={{ marginBottom: '10px' }}
        />
        <p style={{ fontSize: '12px', color: '#666' }}>
          Upload one or more photos to create workspaces
        </p>
      </div>

      {/* Batch Actions */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <button
          onClick={handleGenerateForSelected}
          disabled={selectedWorkspaces.size === 0 || !textPrompt.trim() || generatingWorkspaces.size > 0}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedWorkspaces.size === 0 || !textPrompt.trim() ? 'not-allowed' : 'pointer',
            opacity: selectedWorkspaces.size === 0 || !textPrompt.trim() ? 0.5 : 1,
          }}
        >
          Generate for Selected ({selectedWorkspaces.size})
        </button>
        <span style={{ marginLeft: '15px', fontSize: '14px', color: '#666' }}>
          {generatingWorkspaces.size > 0 && `Generating for ${generatingWorkspaces.size} workspace(s)...`}
        </span>
      </div>

      {/* Workspaces without Generated Images */}
      {workspacesWithoutImages.length > 0 && (
        <>
          <h2 style={{ marginTop: '30px', marginBottom: '15px' }}>Uploaded Photos (No Generated Images Yet) ({workspacesWithoutImages.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', marginBottom: '40px' }}>
            {workspacesWithoutImages.map((workspace) => (
              <div
                key={workspace.id}
                style={{
                  border: selectedWorkspaces.has(workspace.id) ? '3px solid #4CAF50' : '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: 'white',
                  position: 'relative',
                }}
              >
                {/* Selection Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedWorkspaces.has(workspace.id)}
                  onChange={() => toggleWorkspaceSelection(workspace.id)}
                  style={{ position: 'absolute', top: '10px', left: '10px', width: '20px', height: '20px', cursor: 'pointer' }}
                />

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteWorkspace(workspace.id)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    padding: '5px 10px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Delete
                </button>

                {/* Prompt Photo */}
                <div style={{ marginTop: '30px' }}>
                  <img
                    src={`${API_URL.replace('/api', '')}${workspace.promptPhotoUrl}`}
                    alt="Prompt"
                    style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
                  />
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '10px', textAlign: 'center' }}>
                    Ready for generation
                  </p>
                </div>

                {/* Generation Status */}
                {generatingWorkspaces.has(workspace.id) && (
                  <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', marginTop: '10px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>⏳ Generating...</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Workspaces with Generated Images */}
      {workspacesWithImages.length > 0 && (
        <>
          <h2 style={{ marginTop: '30px', marginBottom: '15px' }}>Workspaces with Generated Images ({workspacesWithImages.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {workspacesWithImages.map((workspace) => {
              const latestImage = workspace.generatedImages[workspace.generatedImages.length - 1];
              return (
                <div
                  key={workspace.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: 'white',
                    position: 'relative',
                  }}
                >
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteWorkspace(workspace.id)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Delete
                  </button>

                  {/* Prompt Photo */}
                  <div style={{ marginTop: '30px', marginBottom: '15px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Reference Photo</h3>
                    <img
                      src={`${API_URL.replace('/api', '')}${workspace.promptPhotoUrl}`}
                      alt="Prompt"
                      style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => navigate(`/imagen-workspace/${workspace.id}`)}
                      title="Click to view workspace details"
                    />
                  </div>

                  {/* Generation Status */}
                  {generatingWorkspaces.has(workspace.id) && (
                    <div style={{ padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '10px' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>⏳ Generating...</p>
                    </div>
                  )}

                  {/* Latest Generated Image */}
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>
                      Latest Generated Image
                    </h3>
                    <img
                      src={`${API_URL.replace('/api', '')}${latestImage.url}`}
                      alt="Latest Generated"
                      style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px', marginBottom: '8px', cursor: 'pointer' }}
                      onClick={() => navigate(`/imagen-workspace/${workspace.id}`)}
                      title="Click to view workspace details"
                    />
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px', wordBreak: 'break-word' }}>
                      <strong>Prompt:</strong> {latestImage.prompt}
                    </div>
                    <div style={{ fontSize: '10px', color: '#999' }}>
                      {new Date(latestImage.timestamp).toLocaleString()}
                    </div>
                  </div>

                  {/* View Details Button */}
                  <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                    <button
                      onClick={() => navigate(`/imagen-workspace/${workspace.id}`)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      View Details ({workspace.generatedImages.length} images) →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {workspaces.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <p>No workspaces yet. Upload prompt photos to get started!</p>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Scroll to top"
        >
          ↑
        </button>
      )}
    </div>
  );
}
