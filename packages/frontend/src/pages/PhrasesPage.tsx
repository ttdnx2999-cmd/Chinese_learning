import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { useChildEditProtection } from '../hooks/useChildEditProtection';
import { useAuth } from '../context/AuthContext';

// TypeScript interfaces
interface VocabGroupResponse {
  id: number;
  chapterStart: number;
  chapterEnd: number;
  sentenceCount: number;
}

interface SentenceResponse {
  id: string;
  vocabGroupId: number;
  chineseText: string;
  pinyin: string;
  englishMeaning?: string;
  modernVietnamese?: string;
  usedCharacters: string[];
  generationTimestamp: string;
}

interface CharacterInfo {
  chineseCharacter: string;
  pinyin: string;
  hanVietnamese?: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  isFavorite?: boolean;
  chapter?: number;
}

export default function PhrasesPage() {
  // Component state
  const { user } = useAuth();
  const showEditProtection = useChildEditProtection();
  const [vocabGroups, setVocabGroups] = useState<VocabGroupResponse[]>([]);
  const [sentences, setSentences] = useState<Map<number, SentenceResponse[]>>(new Map());
  const [selectedSentence, setSelectedSentence] = useState<SentenceResponse | null>(null);
  const [selectedSentenceNumber, setSelectedSentenceNumber] = useState<number | null>(null);
  const [characterDetails, setCharacterDetails] = useState<CharacterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [playingCharacter, setPlayingCharacter] = useState<string | null>(null);
  const [loadingSentences, setLoadingSentences] = useState<Set<number>>(new Set());
  const [playingSentence, setPlayingSentence] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(() => {
    const inProgress = localStorage.getItem('phraseGenerationInProgress');
    return inProgress === 'true';
  });
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(() => {
    const startTime = localStorage.getItem('phraseGenerationStartTime');
    return startTime ? parseInt(startTime) : null;
  });
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editedCharacterData, setEditedCharacterData] = useState<CharacterInfo | null>(null);
  const [modelConfig, setModelConfig] = useState<{ preferredModel: string | null; modelHistory: string[] } | null>(null);
  const [editingModel, setEditingModel] = useState(false);
  const [modelInput, setModelInput] = useState('');
  const [modelHistory, setModelHistory] = useState<string[]>([]);

  // Refs for input fields when editing character
  const pinyinInputRef = useRef<HTMLInputElement>(null);
  const hanVietInputRef = useRef<HTMLInputElement>(null);
  const modVietInputRef = useRef<HTMLInputElement>(null);
  const englishInputRef = useRef<HTMLInputElement>(null);

  // Focus first input when entering edit mode (for mobile)
  useEffect(() => {
    if (editingCharacter && pinyinInputRef.current) {
      setTimeout(() => {
        pinyinInputRef.current?.focus();
        pinyinInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    }
  }, [editingCharacter]);

  // Fetch vocab groups on mount
  useEffect(() => {
    fetchVocabGroups();
    fetchModelConfig();
  }, []);

  // Poll for generation completion when refreshing
  useEffect(() => {
    if (!refreshing || !generationStartTime) return;

    const pollInterval = setInterval(async () => {
      try {
        // Try to fetch vocab groups to see if new data is available
        const response = await apiClient.get<VocabGroupResponse[]>('/phrases/vocab-groups');
        const newGroups = response.data;
        
        // Check if the sentence count has changed (indicating new generation)
        const oldTotalCount = vocabGroups.reduce((sum, g) => sum + g.sentenceCount, 0);
        const newTotalCount = newGroups.reduce((sum, g) => sum + g.sentenceCount, 0);
        const elapsed = Date.now() - generationStartTime;

        // Auto-clear after 10 minutes (safety valve)
        if (elapsed > 10 * 60 * 1000) {
          console.log('Generation timeout - auto-clearing status');
          localStorage.removeItem('phraseGenerationInProgress');
          localStorage.removeItem('phraseGenerationStartTime');
          setRefreshing(false);
          setGenerationStartTime(null);
          clearInterval(pollInterval);
          return;
        }
        
        // Detect completion: count changed, OR at least 30s passed and sentences exist
        // (handles re-generation where count stays the same)
        const countChanged = newTotalCount !== oldTotalCount && newTotalCount > 0;
        const regenerationDone = elapsed > 30000 && newTotalCount > 0 && oldTotalCount > 0;
        
        if (countChanged || regenerationDone) {
          // Generation completed - clear the flag
          console.log('Generation detected as complete - clearing status');
          localStorage.removeItem('phraseGenerationInProgress');
          localStorage.removeItem('phraseGenerationStartTime');
          setRefreshing(false);
          setGenerationStartTime(null);
          setVocabGroups(newGroups);
          setSentences(new Map()); // clear cached sentences so fresh ones load
          setExpandedGroup(null);
          clearInterval(pollInterval);
          
          // Show success message
          alert('Phrase generation completed successfully!');
        }
      } catch (error) {
        console.error('Error polling for generation status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [refreshing, generationStartTime, vocabGroups]);

  const fetchModelConfig = async () => {
    try {
      const response = await apiClient.get('/phrases/model-config');
      setModelConfig(response.data);
      setModelInput(response.data.preferredModel || '');
      if (response.data.modelHistory) {
        setModelHistory(response.data.modelHistory);
      }
    } catch (err) {
      console.error('Failed to load model config:', err);
    }
  };

  const saveModelConfig = async () => {
    const trimmed = modelInput.trim();
    try {
      const response = await apiClient.put('/phrases/model-config', { preferredModel: trimmed });
      setModelConfig(response.data);
      setModelHistory(response.data.modelHistory || []);
      setEditingModel(false);
    } catch (err) {
      console.error('Failed to save model config:', err);
      alert('Failed to save model config');
    }
  };

  const addModelToHistory = async () => {
    const name = prompt('Enter model name to add:');
    if (!name || !name.trim()) return;
    try {
      const response = await apiClient.post('/phrases/model-history', { modelName: name.trim() });
      setModelHistory(response.data.modelHistory);
    } catch (err) {
      console.error('Failed to add model:', err);
    }
  };

  const removeModelFromHistory = async (modelName: string) => {
    try {
      const response = await apiClient.delete(`/phrases/model-history/${encodeURIComponent(modelName)}`);
      setModelHistory(response.data.modelHistory);
    } catch (err) {
      console.error('Failed to remove model:', err);
    }
  };

  const fetchVocabGroups = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<VocabGroupResponse[]>('/phrases/vocab-groups');
      setVocabGroups(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load vocabulary groups';
      
      // Retry logic: 2 attempts with 1s delay
      if (retryCount < 2) {
        console.log(`Retrying vocab groups fetch (attempt ${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchVocabGroups(retryCount + 1);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = async (groupId: number) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
      // Fetch sentences if not already loaded
      if (!sentences.has(groupId)) {
        await fetchSentences(groupId);
      }
    }
  };

  const fetchSentences = async (vocabGroupId: number, retryCount = 0) => {
    setLoadingSentences(prev => new Set(prev).add(vocabGroupId));
    setError(null);
    try {
      const response = await apiClient.get<SentenceResponse[]>(`/phrases/sentences/${vocabGroupId}`);
      setSentences(prev => new Map(prev).set(vocabGroupId, response.data));
    } catch (err: any) {
      console.error(`Failed to load sentences for group ${vocabGroupId}:`, err);
      
      // Retry logic: 2 attempts with 1s delay
      if (retryCount < 2) {
        console.log(`Retrying sentences fetch for group ${vocabGroupId} (attempt ${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchSentences(vocabGroupId, retryCount + 1);
      }
      
      setError(`Failed to load sentences for group ${vocabGroupId}`);
    } finally {
      setLoadingSentences(prev => {
        const newSet = new Set(prev);
        newSet.delete(vocabGroupId);
        return newSet;
      });
    }
  };

  const handleSentenceClick = (sentence: SentenceResponse, sentenceNumber: number) => {
    setSelectedSentence(sentence);
    setSelectedSentenceNumber(sentenceNumber);
    setCharacterDetails([]);
    fetchCharacterDetails(sentence.usedCharacters);
    // Lock background scroll (iOS Safari requires position:fixed)
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
  };

  const handleCloseModal = () => {
    setSelectedSentence(null);
    // Restore background scroll and position
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
  };

  const fetchCharacterDetails = async (characters: string[], retryCount = 0) => {
    setLoadingDetails(true);
    try {
      const details = await Promise.all(
        characters.map(async (char) => {
          try {
            const response = await apiClient.get<CharacterInfo>(
              `/phrases/character-info/${char}`
            );
            return response.data;
          } catch (error) {
            console.error(`Failed to fetch details for ${char}:`, error);
            return {
              chineseCharacter: char,
              pinyin: 'N/A',
              hanVietnamese: 'N/A',
              modernVietnamese: 'N/A',
              englishMeaning: 'N/A'
            };
          }
        })
      );
      setCharacterDetails(details);
    } catch (error) {
      console.error('Error fetching character details:', error);
      
      // Retry logic: 2 attempts with 1s delay
      if (retryCount < 2) {
        console.log(`Retrying character details fetch (attempt ${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchCharacterDetails(characters, retryCount + 1);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handlePronounceCharacter = (character: string) => {
    if (!character || character === 'N/A') return;
    
    if ('speechSynthesis' in window) {
      setPlayingCharacter(character);
      const utterance = new SpeechSynthesisUtterance(character);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.5;
      
      utterance.onend = () => setPlayingCharacter(null);
      utterance.onerror = () => {
        setPlayingCharacter(null);
        alert('Failed to play pronunciation');
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in your browser');
    }
  };

  const handlePronounceSentence = () => {
    if (!selectedSentence || !selectedSentence.chineseText) return;
    
    if ('speechSynthesis' in window) {
      setPlayingSentence(true);
      const utterance = new SpeechSynthesisUtterance(selectedSentence.chineseText);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.7;
      
      utterance.onend = () => setPlayingSentence(false);
      utterance.onerror = () => {
        setPlayingSentence(false);
        alert('Failed to play sentence pronunciation');
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in your browser');
    }
  };

  const handleToggleFavorite = async (character: string, currentFavoriteStatus: boolean) => {
    if (showEditProtection('favorite')) return;
    if (!user?.username) {
      alert('Not authenticated');
      return;
    }
    try {
      await apiClient.post(`/${user.username}/vocabulary/toggle-favorite`, {
        chineseCharacter: character
      });

      // Update the character details with the new favorite status
      setCharacterDetails(prevDetails =>
        prevDetails.map(char =>
          char.chineseCharacter === character
            ? { ...char, isFavorite: !currentFavoriteStatus }
            : char
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Failed to update favorite status');
    }
  };

  const handleEditCharacter = (char: CharacterInfo) => {
    if (showEditProtection('edit')) return;
    setEditingCharacter(char.chineseCharacter);
    setEditedCharacterData({ ...char });
  };

  const handleSaveCharacter = async () => {
    if (!editedCharacterData || !editingCharacter) return;
    if (!user?.username) {
      alert('Not authenticated');
      return;
    }

    try {
      // Get the vocabulary entry by character to find the ID
      const entriesResponse = await apiClient.get(`/${user.username}/vocabulary`);
      const entry = entriesResponse.data.find((e: any) => e.chineseCharacter === editingCharacter);
      
      if (!entry) {
        alert('Character not found in vocabulary');
        return;
      }

      // Update using the actual ID
      await apiClient.put(`/${user.username}/vocabulary/${entry.id}`, {
        pinyin: editedCharacterData.pinyin,
        hanVietnamese: editedCharacterData.hanVietnamese,
        modernVietnamese: editedCharacterData.modernVietnamese,
        englishMeaning: editedCharacterData.englishMeaning
      });

      // Update local state
      setCharacterDetails(prevDetails =>
        prevDetails.map(char =>
          char.chineseCharacter === editingCharacter
            ? editedCharacterData
            : char
        )
      );

      setEditingCharacter(null);
      setEditedCharacterData(null);
      alert('Character updated successfully!');
    } catch (error) {
      console.error('Error updating character:', error);
      alert('Failed to update character');
    }
  };

  const handleCancelEdit = () => {
    setEditingCharacter(null);
    setEditedCharacterData(null);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefreshPhrases = async () => {
    if (showEditProtection('regenerate')) return;
    if (refreshing) return;
    
    // Password protection
    const password = window.prompt('Enter password to refresh phrases:');
    if (password !== 'BoyaChineseNgoc') {
      alert('Incorrect password');
      return;
    }
    
    const confirmed = window.confirm(
      'This will generate new phrases for all vocabulary groups. This may take several minutes. Continue?'
    );
    
    if (!confirmed) return;
    
    const startTime = Date.now();
    setRefreshing(true);
    setGenerationStartTime(startTime);
    localStorage.setItem('phraseGenerationInProgress', 'true');
    localStorage.setItem('phraseGenerationStartTime', startTime.toString());
    setError(null);
    
    try {
      await apiClient.post('/phrases/generate', {}, {
        timeout: 30000
      });
      
      // Server accepted the request — generation is running in background.
      // Stay in refreshing=true state; the polling useEffect will detect
      // when new sentences appear and clear the flag automatically.
      console.log('[Phrases] Generation started in background, polling for completion...');
    } catch (err: any) {
      console.error('Error generating phrases:', err);
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to generate phrases';
      setError(errorMessage);
      
      if (err.response?.status === 503) {
        // Generation is already in progress on server - keep polling
        alert('Generation is already in progress. The page will update automatically when complete.');
      } else {
        // Other errors - clear the flag since generation failed
        localStorage.removeItem('phraseGenerationInProgress');
        localStorage.removeItem('phraseGenerationStartTime');
        setRefreshing(false);
        setGenerationStartTime(null);
        alert(`Failed to generate phrases: ${errorMessage}`);
      }
    }
  };

  return (
    <div style={{ padding: '20px', paddingTop: '50px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ margin: 0 }}>Pre-Generated Phrases</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          {refreshing && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel the generation status? This will not stop the actual generation on the server.')) {
                  localStorage.removeItem('phraseGenerationInProgress');
                  localStorage.removeItem('phraseGenerationStartTime');
                  setRefreshing(false);
                  setGenerationStartTime(null);
                }
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Cancel Status
            </button>
          )}
          <button
            onClick={handleRefreshPhrases}
            disabled={refreshing}
            style={{
              padding: '10px 20px',
              backgroundColor: refreshing ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '16px' }}>{refreshing ? '⏳' : '🔄'}</span>
            <span>{refreshing ? 'Generating...' : 'Refresh Phrases'}</span>
          </button>
        </div>
      </div>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Practice Chinese sentences organized by vocabulary groups. Click any sentence to see character details.
      </p>

      {/* AI Model Config - Admin only */}
      {user?.role === 'admin' && (
      <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#666', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🤖 AI Model:</span>
          {editingModel ? (
            <>
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="e.g. gemini-flash-latest"
                style={{ flex: 1, minWidth: '200px', padding: '6px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #007bff' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveModelConfig(); if (e.key === 'Escape') setEditingModel(false); }}
                autoFocus
              />
              <button onClick={saveModelConfig} style={{ padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Save</button>
              <button onClick={() => setEditingModel(false)} style={{ padding: '6px 12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </>
          ) : (
            <>
              <code style={{ fontSize: '13px', backgroundColor: '#e9ecef', padding: '4px 8px', borderRadius: '4px', flex: 1 }}>
                {modelConfig ? (modelConfig.preferredModel || 'not set') : '...'}
              </code>
              <button onClick={() => { setEditingModel(true); setModelInput(modelConfig?.preferredModel || ''); }} style={{ padding: '6px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Edit</button>
            </>
          )}
        </div>
        {/* Model history chips - always visible for management */}
        {modelHistory.length > 0 && (
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#999', alignSelf: 'center' }}>Recent:</span>
            {modelHistory.map(m => (
              <span
                key={m}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  backgroundColor: modelInput === m ? '#007bff' : '#e9ecef',
                  color: modelInput === m ? 'white' : '#333',
                  border: '1px solid #dee2e6',
                  borderRadius: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                <button
                  onClick={() => { setModelInput(m); if (!editingModel) setEditingModel(true); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '12px',
                    color: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  {m}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeModelFromHistory(m); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0 2px',
                    fontSize: '14px',
                    color: modelInput === m ? 'rgba(255,255,255,0.7)' : '#999',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                  title={`Remove "${m}"`}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              onClick={addModelToHistory}
              style={{
                padding: '3px 10px',
                fontSize: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              + Add
            </button>
          </div>
        )}
        {modelHistory.length === 0 && (
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={addModelToHistory}
              style={{
                padding: '3px 10px',
                fontSize: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              + Add Model
            </button>
          </div>
        )}
      </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button
            onClick={() => {
              setError(null);
              fetchVocabGroups();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#721c24',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div>
        {vocabGroups.length === 0 && !loading && !error && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            color: '#666'
          }}>
            No vocabulary groups available. Sentences will be generated automatically.
          </div>
        )}

        {vocabGroups.map(group => (
          <div key={group.id} style={{
            marginBottom: '15px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => toggleGroup(group.id)}
              style={{
                width: '100%',
                padding: '15px 20px',
                backgroundColor: expandedGroup === group.id ? '#007bff' : '#f8f9fa',
                color: expandedGroup === group.id ? 'white' : '#333',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>
                Vocabulary Group {group.id}: Chapters {group.chapterStart} - {group.chapterEnd}
                {' '}({group.sentenceCount} sentences)
              </span>
              <span style={{ fontSize: '20px' }}>
                {expandedGroup === group.id ? '▼' : '▶'}
              </span>
            </button>

            {expandedGroup === group.id && (
              <div style={{ padding: '20px', backgroundColor: 'white' }}>
                {loadingSentences.has(group.id) ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    <div style={{ fontSize: '16px' }}>Loading sentences...</div>
                  </div>
                ) : sentences.get(group.id) && sentences.get(group.id)!.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '15px'
                  }}>
                    {sentences.get(group.id)!.map((sentence, index) => (
                      <div
                        key={sentence.id}
                        onClick={() => handleSentenceClick(sentence, index + 1)}
                        style={{
                          padding: '15px',
                          backgroundColor: '#f8f9fa',
                          border: '2px solid #dee2e6',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontSize: '18px',
                          textAlign: 'center',
                          minHeight: '80px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e9ecef';
                          e.currentTarget.style.borderColor = '#007bff';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                          e.currentTarget.style.borderColor = '#dee2e6';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '5px',
                          left: '8px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#666',
                          backgroundColor: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {index + 1}
                        </div>
                        {sentence.chineseText}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#666',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    No sentences available for this group.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Character Edit Modal (Mobile-friendly) */}
      {editingCharacter && selectedSentence && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={handleCancelEdit}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px 16px 0 0',
              padding: '16px',
              paddingBottom: '32px',
              width: '100%',
              maxWidth: '600px',
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#dee2e6', borderRadius: '2px', margin: '0 auto 12px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(16px, 4vw, 20px)' }}>Edit Character: {editingCharacter}</h2>
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Close
              </button>
            </div>

            {/* Edit Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                  Pinyin
                </label>
                <input
                  ref={pinyinInputRef}
                  autoFocus
                  type="text"
                  value={editedCharacterData?.pinyin || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, pinyin: e.target.value } : null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter pinyin"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                  Han Vietnamese
                </label>
                <input
                  ref={hanVietInputRef}
                  type="text"
                  value={editedCharacterData?.hanVietnamese || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, hanVietnamese: e.target.value } : null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter Han Vietnamese"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                  Modern Vietnamese
                </label>
                <input
                  ref={modVietInputRef}
                  type="text"
                  value={editedCharacterData?.modernVietnamese || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, modernVietnamese: e.target.value } : null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter modern Vietnamese"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                  English Meaning
                </label>
                <input
                  ref={englishInputRef}
                  type="text"
                  value={editedCharacterData?.englishMeaning || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, englishMeaning: e.target.value } : null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter English meaning"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={handleSaveCharacter}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character Detail Modal */}
      {selectedSentence && !editingCharacter && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px 16px 0 0',
              padding: '16px',
              paddingBottom: '32px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '92dvh',
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#dee2e6', borderRadius: '2px', margin: '0 auto 12px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(16px, 4vw, 20px)' }}>Sentence #{selectedSentenceNumber}</h2>
              <button
                onClick={handleCloseModal}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '13px', color: '#666' }}>Chinese Text:</strong>
              <div style={{
                fontSize: 'clamp(18px, 5vw, 24px)',
                padding: '10px 12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                marginTop: '4px',
                lineHeight: '1.6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <span style={{ flex: 1 }}>{selectedSentence.chineseText}</span>
                <button
                  onClick={handlePronounceSentence}
                  disabled={playingSentence}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: playingSentence ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: playingSentence ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>{playingSentence ? '🔊' : '🔉'}</span>
                  <span>{playingSentence ? 'Playing...' : 'Pronounce'}</span>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '13px', color: '#666' }}>Pinyin:</strong>
              <div style={{
                fontSize: 'clamp(14px, 4vw, 18px)',
                padding: '10px 12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                marginTop: '4px',
                color: selectedSentence.pinyin ? '#000' : '#999',
                fontStyle: selectedSentence.pinyin ? 'normal' : 'italic'
              }}>
                {selectedSentence.pinyin || 'Not available'}
              </div>
            </div>

            {selectedSentence.modernVietnamese && (
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '13px', color: '#666' }}>Vietnamese Translation:</strong>
                <div style={{
                  fontSize: 'clamp(14px, 4vw, 18px)',
                  padding: '10px 12px',
                  backgroundColor: '#fff3cd',
                  borderRadius: '4px',
                  marginTop: '4px',
                }}>
                  {selectedSentence.modernVietnamese}
                </div>
              </div>
            )}

            <div>
              <strong style={{ fontSize: '13px', color: '#666' }}>Characters Used:</strong>
              {loadingDetails ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading character details...
                </div>
              ) : characterDetails.length > 0 ? (
                <div style={{ marginTop: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    fontSize: 'clamp(12px, 3vw, 14px)'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', whiteSpace: 'nowrap' }}>Chinese</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', whiteSpace: 'nowrap' }}>Pinyin</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', whiteSpace: 'nowrap' }}>Han Viet</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', whiteSpace: 'nowrap' }}>Mod Viet</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'left', whiteSpace: 'nowrap' }}>English</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>Ch</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>★</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>🔉</th>
                        <th style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>✏️</th>
                      </tr>
                    </thead>
                    <tbody>
                      {characterDetails.map((char, index) => (
                        <tr key={index}>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', fontSize: '18px' }}>
                            {char.chineseCharacter}
                          </td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.pinyin || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.hanVietnamese || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.modernVietnamese || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.englishMeaning || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                            {char.chapter ?? '—'}
                          </td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleFavorite(char.chineseCharacter, char.isFavorite || false)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: 'transparent',
                                color: char.isFavorite ? '#ffc107' : '#ccc',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '18px',
                              }}
                            >
                              {char.isFavorite ? '★' : '☆'}
                            </button>
                          </td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <button
                              onClick={() => handlePronounceCharacter(char.chineseCharacter)}
                              disabled={playingCharacter === char.chineseCharacter}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: playingCharacter === char.chineseCharacter ? '#ccc' : '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: playingCharacter === char.chineseCharacter ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                              }}
                            >
                              {playingCharacter === char.chineseCharacter ? '🔊' : '🔉'}
                            </button>
                          </td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <button onClick={() => handleEditCharacter(char)} style={{ padding: '4px 8px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No character details available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Go to Top Button */}
      <button
        onClick={scrollToTop}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          padding: '12px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '50px',
          height: '50px'
        }}
        title="Go to top"
      >
        ↑
      </button>
    </div>
  );
}
