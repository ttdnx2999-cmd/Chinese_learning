import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  error?: string;
  downloadUrl?: string;
  streamUrl?: string;
}

interface ProcessedVideo {
  id: string;
  filename: string;
  createdAt: string;
  size: number;
  downloadUrl: string;
  streamUrl: string;
}

interface MediaSettings {
  trimStart: number;
  trimEnd: number;
  videoSpeed: number;
  imageDuration?: number; // Duration for images (in seconds)
}

export default function VideoProcessorPage() {
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaSettings, setMediaSettings] = useState<MediaSettings[]>([]);
  const [mediaDurations, setMediaDurations] = useState<number[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSpeed, setAudioSpeed] = useState(1.0);
  const [aiEnhancement, setAiEnhancement] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processedVideos, setProcessedVideos] = useState<ProcessedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'video' | 'image' | 'audio'; name: string; settings?: MediaSettings; duration?: number; audioSpeed?: number } | null>(null);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Append new files to existing ones instead of replacing
      setMediaFiles(prev => [...prev, ...files]);
      
      // Initialize settings for new files
      const newSettings = files.map(() => ({
        trimStart: 0,
        trimEnd: 0, // Will be set when duration is loaded
        videoSpeed: 1.0,
        imageDuration: 3 // Default 3 seconds for images
      }));
      setMediaSettings(prev => [...prev, ...newSettings]);
      
      // Initialize durations (will be loaded asynchronously)
      const newDurations = files.map(() => 0);
      setMediaDurations(prev => [...prev, ...newDurations]);
      
      // Load durations for video files
      files.forEach((file, index) => {
        if (file.type.startsWith('video/')) {
          loadVideoDuration(file, mediaFiles.length + index);
        } else {
          // Images default to 3 seconds
          const globalIndex = mediaFiles.length + index;
          setMediaDurations(prev => {
            const updated = [...prev];
            updated[globalIndex] = 3;
            return updated;
          });
          setMediaSettings(prev => {
            const updated = [...prev];
            updated[globalIndex] = { ...updated[globalIndex], trimEnd: 3 };
            return updated;
          });
        }
      });
      
      // Clear the input so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  const loadVideoDuration = (file: File, index: number) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      setMediaDurations(prev => {
        const updated = [...prev];
        updated[index] = duration;
        return updated;
      });
      setMediaSettings(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], trimEnd: duration };
        return updated;
      });
      URL.revokeObjectURL(video.src);
    };
    
    video.src = URL.createObjectURL(file);
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaSettings(prev => prev.filter((_, i) => i !== index));
    setMediaDurations(prev => prev.filter((_, i) => i !== index));
  };

  const moveMedia = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...mediaFiles];
    const newSettings = [...mediaSettings];
    const newDurations = [...mediaDurations];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newFiles.length) {
      [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
      [newSettings[index], newSettings[newIndex]] = [newSettings[newIndex], newSettings[index]];
      [newDurations[index], newDurations[newIndex]] = [newDurations[newIndex], newDurations[index]];
      setMediaFiles(newFiles);
      setMediaSettings(newSettings);
      setMediaDurations(newDurations);
    }
  };

  const getFileType = (file: File): 'video' | 'image' => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    return 'video';
  };

  const updateMediaSetting = (index: number, field: keyof MediaSettings, value: number) => {
    setMediaSettings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUpload = async () => {
    if (mediaFiles.length === 0) {
      setError('Please select at least one video or image file');
      return;
    }

    setUploading(true);
    setError(null);
    setJobStatus(null);

    try {
      const formData = new FormData();
      
      // Add media in order
      mediaFiles.forEach(file => {
        formData.append('media', file);
      });
      
      // Add media settings as JSON
      formData.append('mediaSettings', JSON.stringify(mediaSettings));
      
      // Add audio if provided
      if (audioFile) {
        formData.append('audio', audioFile);
        formData.append('audioSpeed', audioSpeed.toString());
      }

      // Add AI enhancement flag
      formData.append('aiEnhancement', aiEnhancement.toString());

      const response = await axios.post(`${API_URL}/video/process`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const jobId = response.data.jobId;
      
      // Start polling for status
      pollJobStatus(jobId);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setUploading(false);
    }
  };

  const pollJobStatus = async (id: string) => {
    try {
      const response = await axios.get(`${API_URL}/video/status/${id}`);
      setJobStatus(response.data);

      if (response.data.status === 'queued' || response.data.status === 'processing') {
        // Poll again in 2 seconds
        setTimeout(() => pollJobStatus(id), 2000);
      } else {
        setUploading(false);
        if (response.data.status === 'completed') {
          loadProcessedVideos(); // Refresh the list when completed
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get job status');
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (jobStatus?.downloadUrl) {
      // downloadUrl is like "/api/video/download/xxx"
      // We need to use the base URL without /api since downloadUrl already has it
      const baseUrl = API_URL.replace('/api', '');
      const fullUrl = jobStatus.downloadUrl.startsWith('http') 
        ? jobStatus.downloadUrl 
        : `${baseUrl}${jobStatus.downloadUrl}`;
      window.open(fullUrl, '_blank');
    }
  };

  const handleReset = () => {
    setMediaFiles([]);
    setMediaSettings([]);
    setMediaDurations([]);
    setAudioFile(null);
    setAudioSpeed(1.0);
    setAiEnhancement(false);
    setJobStatus(null);
    setError(null);
    setUploading(false);
    loadProcessedVideos(); // Refresh the list
  };

  const handleKeepAndAdjust = () => {
    // Keep all files and settings, just clear the job status
    setJobStatus(null);
    setError(null);
    setUploading(false);
    // Don't clear files, settings, or durations - user can adjust and reprocess
  };

  const loadProcessedVideos = async () => {
    setLoadingVideos(true);
    try {
      const response = await axios.get(`${API_URL}/video/list`);
      setProcessedVideos(response.data.videos);
    } catch (err: any) {
      console.error('Failed to load processed videos:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  // Load processed videos on mount
  useEffect(() => {
    loadProcessedVideos();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleDownloadVideo = (downloadUrl: string) => {
    // downloadUrl is like "/api/video/download/xxx"
    // We need to use the base URL without /api since downloadUrl already has it
    const baseUrl = API_URL.replace('/api', '');
    const fullUrl = downloadUrl.startsWith('http') 
      ? downloadUrl 
      : `${baseUrl}${downloadUrl}`;
    window.open(fullUrl, '_blank');
  };

  const handlePreviewUploadedMedia = (file: File, index?: number) => {
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const settings = index !== undefined ? mediaSettings[index] : undefined;
    const duration = index !== undefined ? mediaDurations[index] : undefined;
    setPreviewMedia({ url, type, name: file.name, settings, duration });
  };

  const handlePreviewAudio = () => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setPreviewMedia({ url, type: 'audio', name: audioFile.name, audioSpeed });
    }
  };

  const handlePreviewProcessedVideo = (streamUrl: string, filename: string) => {
    // streamUrl is like "/api/video/stream/xxx"
    // We need to use the base URL without /api since streamUrl already has it
    const baseUrl = API_URL.replace('/api', '');
    const fullUrl = streamUrl.startsWith('http') 
      ? streamUrl 
      : `${baseUrl}${streamUrl}`;
    console.log('[Preview] Opening video preview:', { streamUrl, fullUrl, filename });
    setPreviewMedia({ url: fullUrl, type: 'video', name: filename });
  };

  const closePreview = () => {
    if (previewMedia && previewMedia.url.startsWith('blob:')) {
      URL.revokeObjectURL(previewMedia.url);
    }
    setPreviewMedia(null);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Video Processor</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Upload video segments and/or images along with an optional audio file to create a video with audio overlay.
      </p>

      {/* Media Upload Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>1. Upload Videos and/or Images</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          Select video files (MP4, MOV) and/or image files (JPG, PNG, WEBP). Images will be displayed for 3 seconds each. They will be processed in the order shown below. You can upload multiple times to add more files.
        </p>
        
        <input
          type="file"
          accept="video/mp4,video/quicktime,image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={handleMediaChange}
          disabled={uploading}
          style={{ marginBottom: '15px' }}
        />

        {mediaFiles.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0 }}>Selected Media ({mediaFiles.length}):</h4>
              <button
                onClick={() => {
                  setMediaFiles([]);
                  setMediaSettings([]);
                  setMediaDurations([]);
                }}
                disabled={uploading}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                Clear All
              </button>
            </div>
            {mediaFiles.map((file, index) => {
              const fileType = getFileType(file);
              const icon = fileType === 'video' ? '🎬' : '🖼️';
              const duration = mediaDurations[index] || 0;
              const settings = mediaSettings[index] || { trimStart: 0, trimEnd: duration, videoSpeed: 1.0 };
              const trimmedDuration = settings.trimEnd - settings.trimStart;
              const finalDuration = trimmedDuration / settings.videoSpeed;
              
              return (
                <div
                  key={index}
                  style={{
                    padding: '15px',
                    marginBottom: '12px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  {/* File info and action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ 
                      flex: '1 1 200px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      wordBreak: 'break-word',
                      minWidth: '0'
                    }}>
                      {index + 1}. {icon} {file.name} ({formatFileSize(file.size)})
                    </span>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handlePreviewUploadedMedia(file, index)}
                        disabled={uploading}
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '12px', 
                          backgroundColor: '#17a2b8', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '3px', 
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => moveMedia(index, 'up')}
                        disabled={index === 0 || uploading}
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '12px', 
                          cursor: (index === 0 || uploading) ? 'not-allowed' : 'pointer',
                          minWidth: '32px'
                        }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveMedia(index, 'down')}
                        disabled={index === mediaFiles.length - 1 || uploading}
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '12px', 
                          cursor: (index === mediaFiles.length - 1 || uploading) ? 'not-allowed' : 'pointer',
                          minWidth: '32px'
                        }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeMedia(index)}
                        disabled={uploading}
                        style={{ 
                          padding: '4px 8px', 
                          fontSize: '12px', 
                          backgroundColor: '#dc3545', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '3px', 
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Trim and speed controls for videos */}
                  {fileType === 'video' && duration > 0 && (
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        Duration: {formatTime(duration)} → After trim & speed: {formatTime(finalDuration)}
                      </div>
                      
                      {/* Trim Start */}
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                          Trim Start: {formatTime(settings.trimStart)}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={settings.trimEnd}
                          step={0.1}
                          value={settings.trimStart}
                          onChange={(e) => updateMediaSetting(index, 'trimStart', parseFloat(e.target.value))}
                          disabled={uploading}
                          style={{ width: '100%' }}
                        />
                      </div>

                      {/* Trim End */}
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                          Trim End: {formatTime(settings.trimEnd)}
                        </label>
                        <input
                          type="range"
                          min={settings.trimStart}
                          max={duration}
                          step={0.1}
                          value={settings.trimEnd}
                          onChange={(e) => updateMediaSetting(index, 'trimEnd', parseFloat(e.target.value))}
                          disabled={uploading}
                          style={{ width: '100%' }}
                        />
                      </div>

                      {/* Video Speed */}
                      <div>
                        <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                          Video Speed: {settings.videoSpeed.toFixed(1)}x
                        </label>
                        <input
                          type="range"
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          value={settings.videoSpeed}
                          onChange={(e) => updateMediaSetting(index, 'videoSpeed', parseFloat(e.target.value))}
                          disabled={uploading}
                          style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
                          <span>0.5x (Slow)</span>
                          <span>1.0x (Normal)</span>
                          <span>2.0x (Fast)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info for images */}
                  {fileType === 'image' && (
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        Image Display Duration
                      </div>
                      
                      {/* Image Duration */}
                      <div>
                        <label style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                          Duration: {(settings.imageDuration || 3).toFixed(1)}s
                        </label>
                        <input
                          type="range"
                          min={0.5}
                          max={10}
                          step={0.5}
                          value={settings.imageDuration || 3}
                          onChange={(e) => {
                            const newDuration = parseFloat(e.target.value);
                            updateMediaSetting(index, 'imageDuration', newDuration);
                            // Also update the duration in mediaDurations for calculation
                            setMediaDurations(prev => {
                              const updated = [...prev];
                              updated[index] = newDuration;
                              return updated;
                            });
                            // Update trimEnd to match duration
                            setMediaSettings(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], trimEnd: newDuration };
                              return updated;
                            });
                          }}
                          disabled={uploading}
                          style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
                          <span>0.5s</span>
                          <span>5s</span>
                          <span>10s</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audio Upload Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>2. Upload Audio File (Optional)</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          Select an audio file (MP3, M4A) to overlay on the video. If no audio is provided, videos will just be concatenated.
        </p>
        
        <input
          type="file"
          accept="audio/mpeg,audio/mp4"
          onChange={handleAudioChange}
          disabled={uploading}
        />

        {audioFile && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong>Selected Audio:</strong> {audioFile.name} ({formatFileSize(audioFile.size)})
              </div>
              <button
                onClick={handlePreviewAudio}
                disabled={uploading}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Preview Audio
              </button>
            </div>
            
            {/* Audio Speed Control */}
            <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
              <label style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                Audio Speed: {audioSpeed.toFixed(1)}x
              </label>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={audioSpeed}
                onChange={(e) => setAudioSpeed(parseFloat(e.target.value))}
                disabled={uploading}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', marginTop: '4px' }}>
                <span>0.5x (Slow)</span>
                <span>1.0x (Normal)</span>
                <span>2.0x (Fast)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Enhancement Section */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>3. AI Post-Processing (Optional)</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          Apply AI enhancement filters to improve video quality: sharpening, subtle noise reduction, and color enhancement.
        </p>
        
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={aiEnhancement}
            onChange={(e) => setAiEnhancement(e.target.checked)}
            disabled={uploading}
            style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span>Enable AI Enhancement (adds sharpening, noise reduction, contrast +5%, saturation +10%)</span>
        </label>
      </div>

      {/* Success message after adjustment */}
      {jobStatus?.status === 'completed' && mediaFiles.length > 0 && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d1ecf1', color: '#0c5460', borderRadius: '4px', border: '1px solid #bee5eb' }}>
          <strong>✓ Video processed successfully!</strong>
          <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
            You can now adjust the settings below (trim, speed, duration, etc.) and click "Process Video" again to create a new version.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Job Status */}
      {jobStatus && (
        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>Processing Status</h3>
          <div style={{ marginTop: '10px' }}>
            <p><strong>Job ID:</strong> {jobStatus.jobId}</p>
            <p>
              <strong>Status:</strong>{' '}
              <span style={{
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                backgroundColor:
                  jobStatus.status === 'completed' ? '#d4edda' :
                  jobStatus.status === 'failed' ? '#f8d7da' :
                  jobStatus.status === 'processing' ? '#fff3cd' :
                  '#d1ecf1',
                color:
                  jobStatus.status === 'completed' ? '#155724' :
                  jobStatus.status === 'failed' ? '#721c24' :
                  jobStatus.status === 'processing' ? '#856404' :
                  '#0c5460'
              }}>
                {jobStatus.status.toUpperCase()}
              </span>
            </p>
            {jobStatus.error && (
              <p style={{ color: '#721c24' }}><strong>Error:</strong> {jobStatus.error}</p>
            )}
            {jobStatus.status === 'processing' && (
              <p style={{ color: '#856404', fontStyle: 'italic' }}>
                Processing your video... This may take 30-90 seconds.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {(!jobStatus || jobStatus.status === 'failed') && (
          <button
            onClick={handleUpload}
            disabled={uploading || mediaFiles.length === 0}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: uploading ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uploading || mediaFiles.length === 0 ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {uploading ? 'Processing...' : (audioFile ? 'Process Video' : 'Concatenate Media')}
          </button>
        )}

        {jobStatus?.status === 'completed' && (
          <>
            <button
              onClick={() => jobStatus.streamUrl && handlePreviewProcessedVideo(jobStatus.streamUrl, `video_${jobStatus.jobId}.mp4`)}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Preview Result
            </button>
            <button
              onClick={handleDownload}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Download
            </button>
            <button
              onClick={handleKeepAndAdjust}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: 'bold'
              }}
            >
              {audioFile ? 'Process Again' : 'Concatenate Again'}
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Clear All
            </button>
          </>
        )}

        {(jobStatus?.status === 'failed' || error) && (
          <button
            onClick={handleReset}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Info Section */}
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h4>How it works:</h4>
        <ul style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          <li>Upload multiple video segments and/or images (they will be processed in order)</li>
          <li>Images are automatically converted to 3-second video clips</li>
          <li>Optionally upload an audio file (MP3 or M4A) to overlay on the video</li>
          <li>If audio is provided, the final video will match the audio length</li>
          <li>If media is longer than audio, it will be trimmed (ensuring final segment is at least 3s)</li>
          <li>If media is shorter than audio, it will be shuffled and repeated</li>
          <li>If the final segment would be less than 3 seconds, the previous video's last frame is extended instead</li>
          <li>If no audio is provided, media will simply be concatenated together</li>
          <li>AI enhancement applies filters: unsharp (sharpening), noise reduction, contrast boost, and saturation boost</li>
          <li>Processing takes 30-90 seconds depending on media length (longer with AI enhancement)</li>
          <li>Only the last 10 processed videos are kept on the server</li>
        </ul>
      </div>

      {/* Processed Videos History */}
      <div style={{ marginTop: '40px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Processed Videos</h3>
          <button
            onClick={loadProcessedVideos}
            disabled={loadingVideos}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loadingVideos ? 'not-allowed' : 'pointer'
            }}
          >
            {loadingVideos ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {processedVideos.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No processed videos yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {processedVideos.map((video) => (
              <div
                key={video.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <div style={{ flex: '1 1 200px', minWidth: '0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', wordBreak: 'break-word' }}>
                    {video.filename}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', wordBreak: 'break-word' }}>
                    Created: {formatDate(video.createdAt)} • Size: {formatFileSize(video.size)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handlePreviewProcessedVideo(video.streamUrl, video.filename)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleDownloadVideo(video.downloadUrl)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewMedia && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={closePreview}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%',
              backgroundColor: '#000'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePreview}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                padding: '8px 16px',
                fontSize: '18px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                zIndex: 10000
              }}
            >
              ✕ Close
            </button>
            
            <div style={{ marginBottom: '10px', color: 'white', textAlign: 'center', position: 'absolute', top: '-40px', left: '0' }}>
              {previewMedia.name}
              {previewMedia.settings && (
                <span style={{ marginLeft: '10px', fontSize: '14px', color: '#aaa' }}>
                  (Trim: {formatTime(previewMedia.settings.trimStart)}-{formatTime(previewMedia.settings.trimEnd)}, Speed: {previewMedia.settings.videoSpeed}x)
                </span>
              )}
              {previewMedia.audioSpeed && previewMedia.audioSpeed !== 1.0 && (
                <span style={{ marginLeft: '10px', fontSize: '14px', color: '#aaa' }}>
                  (Speed: {previewMedia.audioSpeed}x)
                </span>
              )}
            </div>

            {previewMedia.type === 'audio' ? (
              <div style={{ padding: '40px', backgroundColor: '#1a1a1a', borderRadius: '8px', minWidth: '400px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px', color: '#fff', fontSize: '18px' }}>
                  🎵 Audio Preview
                </div>
                <audio
                  src={previewMedia.url}
                  controls
                  autoPlay
                  style={{
                    width: '100%',
                    display: 'block'
                  }}
                  onLoadedMetadata={(e) => {
                    const audio = e.currentTarget;
                    audio.volume = 1.0;
                    if (previewMedia.audioSpeed) {
                      audio.playbackRate = previewMedia.audioSpeed;
                    }
                    audio.play().catch(err => {
                      console.log('Autoplay prevented:', err);
                    });
                  }}
                />
                <div style={{ marginTop: '15px', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
                  Playing at {previewMedia.audioSpeed || 1.0}x speed
                </div>
              </div>
            ) : previewMedia.type === 'video' ? (
              <video
                src={previewMedia.url}
                controls
                autoPlay
                muted={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  display: 'block'
                }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  // Ensure audio is enabled
                  video.muted = false;
                  video.volume = 1.0;
                  
                  // Apply trim and speed settings
                  if (previewMedia.settings) {
                    video.currentTime = previewMedia.settings.trimStart;
                    video.playbackRate = previewMedia.settings.videoSpeed;
                    
                    // Set up event listener to loop within trim range
                    const handleTimeUpdate = () => {
                      if (previewMedia.settings && video.currentTime >= previewMedia.settings.trimEnd) {
                        video.currentTime = previewMedia.settings.trimStart;
                      }
                    };
                    video.addEventListener('timeupdate', handleTimeUpdate);
                    
                    // Cleanup listener when component unmounts or preview closes
                    video.addEventListener('pause', () => {
                      video.removeEventListener('timeupdate', handleTimeUpdate);
                    }, { once: true });
                  }
                  
                  // Try to play with audio (some browsers require user interaction)
                  video.play().catch(err => {
                    console.log('Autoplay prevented, user needs to click play:', err);
                  });
                }}
              />
            ) : (
              <img
                src={previewMedia.url}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  display: 'block'
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
