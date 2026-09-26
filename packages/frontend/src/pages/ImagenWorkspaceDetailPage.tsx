import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface GeneratedImage {
  id: string;
  url: string;
  model: string;
  prompt: string;
  timestamp: string;
}

interface ConversationMessage {
  role: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  timestamp: string;
}

interface Workspace {
  id: string;
  promptPhotoUrl: string;
  generatedImages: GeneratedImage[];
  conversationHistory: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export default function ImagenWorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    loadWorkspace();
    
    // Add scroll listener for scroll-to-top button
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [workspaceId]);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/imagen/workspace/${workspaceId}`);
      setWorkspace(response.data);
    } catch (error) {
      console.error('Failed to load workspace:', error);
      alert('Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueConversation = async () => {
    if (!newPrompt.trim() || !workspace) return;

    setGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/imagen/generate/${workspaceId}`, {
        textPrompt: newPrompt,
        continueConversation: true,
      });

      if (response.data.success) {
        setNewPrompt('');
        await loadWorkspace();
      } else {
        alert('Generation failed: ' + response.data.error);
      }
    } catch (error: any) {
      console.error('Generation failed:', error);
      alert('Generation failed: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadImage = async (imageUrl: string, imageId: string) => {
    try {
      const fullUrl = `${API_URL.replace('/api', '')}${imageUrl}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `generated-${workspaceId}-${imageId}.png`;
      link.setAttribute('download', `generated-${workspaceId}-${imageId}.png`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(`${API_URL.replace('/api', '')}${imageUrl}`, '_blank');
    }
  };

  const handleDownloadPromptPhoto = async () => {
    if (!workspace) return;
    try {
      const fullUrl = `${API_URL.replace('/api', '')}${workspace.promptPhotoUrl}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = workspace.promptPhotoUrl.split('.').pop() || 'jpg';
      link.download = `prompt-${workspaceId}.${ext}`;
      link.setAttribute('download', `prompt-${workspaceId}.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: open in new tab
      window.open(`${API_URL.replace('/api', '')}${workspace.promptPhotoUrl}`, '_blank');
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteWorkspace = async () => {
    if (!confirm('Are you sure you want to delete this workspace? All images and conversation history will be permanently deleted.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/imagen/workspace/${workspaceId}`);
      alert('Workspace deleted successfully');
      navigate('/imagen-generator');
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      alert('Failed to delete workspace: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Workspace not found</p>
        <button onClick={() => navigate('/imagen-generator')}>Back to Gallery</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/imagen-generator')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← Back to Gallery
        </button>
        <button
          onClick={handleDeleteWorkspace}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Delete Workspace
        </button>
      </div>

      <h1>Workspace Detail</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        {/* Prompt Photo */}
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>Reference Photo</h2>
            <button
              onClick={handleDownloadPromptPhoto}
              style={{
                padding: '6px 12px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Download
            </button>
          </div>
          <img
            src={`${API_URL.replace('/api', '')}${workspace.promptPhotoUrl}`}
            alt="Prompt"
            style={{ width: '100%', borderRadius: '4px' }}
          />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            This reference photo is sent to the AI along with your text prompts.
          </p>
        </div>

        {/* Latest Generated Image */}
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
          <h2>Latest Generated Image</h2>
          {workspace.generatedImages.length > 0 ? (
            <>
              <img
                src={`${API_URL.replace('/api', '')}${workspace.generatedImages[workspace.generatedImages.length - 1].url}`}
                alt="Latest"
                style={{ width: '100%', borderRadius: '4px', marginBottom: '10px' }}
              />
              <button
                onClick={() => handleDownloadImage(
                  workspace.generatedImages[workspace.generatedImages.length - 1].url,
                  workspace.generatedImages[workspace.generatedImages.length - 1].id
                )}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Download Latest Image
              </button>
            </>
          ) : (
            <p style={{ color: '#999' }}>No images generated yet</p>
          )}
        </div>
      </div>

      {/* Continue Conversation */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9', marginBottom: '20px' }}>
        <h2>Continue Conversation</h2>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
          Enter a new prompt to generate another image based on the conversation context and reference photo.
        </p>
        <textarea
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          placeholder="Enter your prompt here... (e.g., 'make it more colorful', 'add a sunset background', etc.)"
          disabled={generating}
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '12px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            marginBottom: '10px',
            resize: 'vertical',
          }}
        />
        <button
          onClick={handleContinueConversation}
          disabled={!newPrompt.trim() || generating}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: generating ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'Generating...' : 'Generate Image'}
        </button>
      </div>

      {/* All Generated Images Gallery */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
        <h2>All Generated Images ({workspace.generatedImages.length})</h2>
        {workspace.generatedImages.length === 0 ? (
          <p style={{ color: '#999' }}>No images generated yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
            {workspace.generatedImages.map((img) => (
              <div key={img.id} style={{ border: '1px solid #eee', borderRadius: '4px', padding: '10px' }}>
                <img
                  src={`${API_URL.replace('/api', '')}${img.url}`}
                  alt="Generated"
                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px', marginBottom: '8px' }}
                />
                <p style={{ fontSize: '10px', color: '#666', margin: '5px 0', wordBreak: 'break-word' }}>
                  {img.prompt}
                </p>
                <button
                  onClick={() => handleDownloadImage(img.url, img.id)}
                  style={{
                    width: '100%',
                    padding: '6px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    marginTop: '5px',
                  }}
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversation History */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
        <h2>Conversation History ({workspace.conversationHistory.length} messages)</h2>
        <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '15px' }}>
          {workspace.conversationHistory.length === 0 ? (
            <p style={{ color: '#999' }}>No conversation yet. Start by entering a prompt above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {workspace.conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f1f8e9',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${msg.role === 'user' ? '#2196F3' : '#8BC34A'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ fontSize: '12px', color: '#666', margin: 0, fontWeight: 'bold' }}>
                      {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                    </p>
                    <p style={{ fontSize: '10px', color: '#999', margin: 0 }}>
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {msg.text && (
                    <p style={{ fontSize: '13px', margin: '8px 0', wordBreak: 'break-word' }}>
                      {msg.text}
                    </p>
                  )}
                  {msg.imageUrl && (
                    <div>
                      <img
                        src={`${API_URL.replace('/api', '')}${msg.imageUrl}`}
                        alt="Generated"
                        style={{ width: '100%', maxWidth: '300px', borderRadius: '4px', marginTop: '8px' }}
                      />
                      <button
                        onClick={() => {
                          const imgId = msg.imageUrl?.split('/').pop()?.replace('.png', '') || 'image';
                          handleDownloadImage(msg.imageUrl!, imgId);
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '4px 8px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        Download
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
