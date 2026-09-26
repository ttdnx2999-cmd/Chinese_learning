import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useChildEditProtection } from '../hooks/useChildEditProtection';

interface VocabularyEntry {
  id: string;
  username: string;
  chineseCharacter: string;
  pinyin: string;
  hanVietnamese?: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  learningNote?: string;
  isFavorite: boolean;
  chapter: number;
  chapterLabel?: string;
  sharedFrom?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ChapterFlashcardPage() {
  const { user } = useAuth();
  const showEditProtection = useChildEditProtection();
  const [parentUsername, setParentUsername] = useState<string | null>(null);
  const [chapterStart, setChapterStart] = useState<number>(1);
  const [chapterEnd, setChapterEnd] = useState<number>(1);
  const [availableChapters, setAvailableChapters] = useState<number[]>([]);
  const [availableChapterLabels, setAvailableChapterLabels] = useState<string[]>([]);
  const [selectedChapterLabel, setSelectedChapterLabel] = useState<string | null>(null);
  const [currentWord, setCurrentWord] = useState<VocabularyEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [noWords, setNoWords] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showFavoriteConfirm, setShowFavoriteConfirm] = useState(false);
  const [favoriteAction, setFavoriteAction] = useState<'favorite' | 'unfavorite'>('favorite');
  const [isEditing, setIsEditing] = useState(false);
  const [editedWord, setEditedWord] = useState<VocabularyEntry | null>(null);
  const [algorithm, setAlgorithm] = useState<'random' | 'shuffled'>('random');
  const [shuffledWords, setShuffledWords] = useState<VocabularyEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch parent username for child users
  useEffect(() => {
    if (!user) return;

    const fetchParentUsername = async () => {
      if (user.role === 'child' && user.parentId) {
        try {
          const response = await apiClient.get(`/admin/users/${user.parentId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
          setParentUsername(response.data.username);
        } catch (error) {
          console.error('Failed to fetch parent username:', error);
          setParentUsername(null);
        }
      } else {
        setParentUsername(null);
      }
    };

    fetchParentUsername();
  }, [user]);

  useEffect(() => {
    if (user && (parentUsername !== null || user.role !== 'child')) {
      fetchAvailableChapters();
      fetchAvailableChapterLabels();
    }
  }, [user, parentUsername]);

  // Get the username to use for API calls
  const usernameForAPI = parentUsername || user?.username;

  const fetchAvailableChapters = async () => {
    if (!usernameForAPI) return;
    try {
      const response = await apiClient.get<number[]>(`/${usernameForAPI}/vocabulary/chapters`);
      setAvailableChapters(response.data);
      if (response.data.length > 0) {
        // Set default to latest chapter (highest number)
        const latestChapter = Math.max(...response.data);
        setChapterStart(latestChapter);
        setChapterEnd(latestChapter);
      }
    } catch (error) {
      console.error('Error fetching chapters:', error);
    }
  };

  const fetchAvailableChapterLabels = async () => {
    if (!usernameForAPI) return;
    try {
      const response = await apiClient.get<string[]>(`/${usernameForAPI}/vocabulary/chapter-labels`);
      setAvailableChapterLabels(response.data);
    } catch (error) {
      console.error('Error fetching chapter labels:', error);
    }
  };

  const fetchRandomWord = async () => {
    if (!usernameForAPI) return;
    setLoading(true);
    setError(null);
    setShowDetails(false);
    setNoWords(false);
    
    try {
      if (algorithm === 'shuffled') {
        // Shuffled algorithm: fetch all words once and serve in order
        if (shuffledWords.length === 0 || currentIndex >= shuffledWords.length) {
          // Fetch all words
          let url = `/${usernameForAPI}/vocabulary`;
          const params = new URLSearchParams();
          
          if (selectedChapterLabel) {
            params.append('chapterLabel', selectedChapterLabel);
          } else {
            params.append('chapterStart', chapterStart.toString());
            params.append('chapterEnd', chapterEnd.toString());
          }
          
          if (params.toString()) {
            url += `?${params.toString()}`;
          }
          
          const response = await apiClient.get<VocabularyEntry[]>(url);
          
          if (response.data.length === 0) {
            setNoWords(true);
            if (selectedChapterLabel) {
              setError(`No words found with chapter label "${selectedChapterLabel}". Please select a different label or chapters.`);
            } else {
              setError(`No words found in chapters ${chapterStart}-${chapterEnd}. Please select different chapters.`);
            }
            setLoading(false);
            return;
          }
          
          // Shuffle the array
          const shuffled = [...response.data].sort(() => Math.random() - 0.5);
          setShuffledWords(shuffled);
          setCurrentIndex(0);
          setCurrentWord(shuffled[0]);
          setShowSettings(false);
        } else {
          // Serve next word from shuffled list
          setCurrentWord(shuffledWords[currentIndex]);
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        // Random algorithm: fetch random word each time
        let url = `/${usernameForAPI}/vocabulary/chapters/random`;
        const params = new URLSearchParams();
        
        if (selectedChapterLabel) {
          params.append('chapterLabel', selectedChapterLabel);
        } else {
          params.append('chapterStart', chapterStart.toString());
          params.append('chapterEnd', chapterEnd.toString());
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        const response = await apiClient.get<VocabularyEntry>(url);
        setCurrentWord(response.data);
        setShowSettings(false);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setNoWords(true);
        if (selectedChapterLabel) {
          setError(`No words found with chapter label "${selectedChapterLabel}". Please select a different label or chapters.`);
        } else {
          setError(`No words found in chapters ${chapterStart}-${chapterEnd}. Please select different chapters.`);
        }
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to load word');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (chapterStart > chapterEnd) {
      setError('Start chapter must be less than or equal to end chapter');
      return;
    }
    // Reset shuffled state when starting
    setShuffledWords([]);
    setCurrentIndex(0);
    fetchRandomWord();
  };

  const handleShowDetails = () => {
    setShowDetails(true);
  };

  const handleNext = () => {
    fetchRandomWord();
  };

  const handlePronounce = () => {
    if (!currentWord) return;

    if ('speechSynthesis' in window) {
      setPlaying(true);
      
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Longer delay to ensure cancellation is complete and speech synthesis is ready
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(currentWord.chineseCharacter);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => {
          setPlaying(false);
        };
        
        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', event);
          setPlaying(false);
          
          // More specific error messages
          if (event.error === 'network') {
            alert('Network error. Please check your connection.');
          } else if (event.error === 'synthesis-unavailable') {
            alert('Chinese voice not available on this device.');
          } else if (event.error === 'not-allowed') {
            alert('Speech permission denied. Please enable it in browser settings.');
          } else {
            alert('Failed to play pronunciation. Try again.');
          }
        };

        // For mobile browsers, especially Chrome on Android
        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('Error speaking:', error);
          setPlaying(false);
          alert('Failed to play pronunciation. Your browser may not support Chinese speech.');
        }
      }, 200);
    } else {
      alert('Text-to-speech is not supported in your browser');
    }
  };

  const handleChangeSettings = () => {
    setShowSettings(true);
    setCurrentWord(null);
    setError(null);
    // Reset shuffled state when changing settings
    setShuffledWords([]);
    setCurrentIndex(0);
  };

  const handleToggleFavorite = async () => {
    if (showEditProtection('favorite')) return;
    if (!currentWord) return;

    try {
      await apiClient.post(`/${usernameForAPI}/vocabulary/toggle-favorite`, {
        chineseCharacter: currentWord.chineseCharacter
      });

      // Close confirmation dialog
      setShowFavoriteConfirm(false);

      // Update current word's favorite status
      setCurrentWord({
        ...currentWord,
        isFavorite: !currentWord.isFavorite
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Failed to update favorite status');
    }
  };

  const handleFavoriteClick = () => {
    if (showEditProtection('favorite')) return;
    if (!currentWord) return;
    setFavoriteAction(currentWord.isFavorite ? 'unfavorite' : 'favorite');
    setShowFavoriteConfirm(true);
  };

  const handleEdit = () => {
    if (showEditProtection('edit')) return;
    if (currentWord) {
      setEditedWord({ ...currentWord });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedWord || !currentWord || !usernameForAPI) return;

    try {
      const response = await apiClient.put(`/${usernameForAPI}/vocabulary/${currentWord.id}`, {
        pinyin: editedWord.pinyin,
        hanVietnamese: editedWord.hanVietnamese,
        modernVietnamese: editedWord.modernVietnamese,
        englishMeaning: editedWord.englishMeaning,
        learningNote: editedWord.learningNote,
        chapter: editedWord.chapter,
        chapterLabel: editedWord.chapterLabel
      });

      setCurrentWord(response.data);
      setIsEditing(false);
      setEditedWord(null);
      alert('Word updated successfully!');
    } catch (error) {
      console.error('Error updating word:', error);
      alert('Failed to update word');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedWord(null);
  };

  return (
    <div style={{
      padding: '10px 16px',
      paddingTop: '56px',
      maxWidth: '800px',
      margin: '0 auto',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <h1 style={{ marginBottom: '10px', marginTop: '0', textAlign: 'center', fontSize: 'clamp(16px, 4vw, 20px)' }}>
        Chapter Flashcards
      </h1>

      {showSettings && (
        <div style={{
          width: '100%',
          maxWidth: '500px',
          padding: '30px',
          backgroundColor: 'white',
          border: '2px solid #007bff',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px', textAlign: 'center' }}>Select Chapters</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Chapter Label:
            </label>
            <select
              value={selectedChapterLabel || ''}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedChapterLabel(value || null);
              }}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}
            >
              <option value="">No Label Filter</option>
              {availableChapterLabels.map(label => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
              Filter by chapter label (takes precedence over chapter range)
            </div>
          </div>

          <div style={{ 
            marginBottom: '20px',
            opacity: selectedChapterLabel ? 0.5 : 1,
            pointerEvents: selectedChapterLabel ? 'none' : 'auto'
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Start Chapter:
            </label>
            <select
              value={chapterStart}
              onChange={(e) => setChapterStart(parseInt(e.target.value))}
              disabled={!!selectedChapterLabel}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}
            >
              {availableChapters.map(chapter => (
                <option key={chapter} value={chapter}>Chapter {chapter}</option>
              ))}
            </select>
          </div>

          <div style={{ 
            marginBottom: '25px',
            opacity: selectedChapterLabel ? 0.5 : 1,
            pointerEvents: selectedChapterLabel ? 'none' : 'auto'
          }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              End Chapter:
            </label>
            <select
              value={chapterEnd}
              onChange={(e) => setChapterEnd(parseInt(e.target.value))}
              disabled={!!selectedChapterLabel}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}
            >
              {availableChapters.map(chapter => (
                <option key={chapter} value={chapter}>Chapter {chapter}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Algorithm:
            </label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as 'random' | 'shuffled')}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}
            >
              <option value="random">🎲 Random (may repeat)</option>
              <option value="shuffled">🔀 Shuffled Order (covers all)</option>
            </select>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
              {algorithm === 'random' 
                ? 'Each word is randomly selected - words may repeat before all are seen'
                : 'All words shuffled once - each word shown exactly once per pass'}
            </div>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              border: '1px solid #f5c6cb',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleStart}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
          >
            Start Practice
          </button>
        </div>
      )}

      {loading && !showSettings && (
        <div style={{ textAlign: 'center', padding: '20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
        </div>
      )}

      {error && !showSettings && !noWords && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{ marginBottom: '15px' }}>{error}</div>
          <button
            onClick={handleChangeSettings}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Change Chapters
          </button>
        </div>
      )}

      {!loading && !error && currentWord && !showSettings && (
        <div style={{
          width: '100%',
          maxWidth: '600px',
          textAlign: 'center',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          overflow: 'auto',
          paddingBottom: '10px'
        }}>
          {/* Chapter info banner */}
          <div style={{
            marginBottom: '10px',
            padding: '6px 12px',
            backgroundColor: '#e7f3ff',
            borderRadius: '6px',
            display: 'inline-block',
            fontSize: '13px'
          }}>
            <strong>Chapters {chapterStart}-{chapterEnd}</strong>
            {algorithm === 'shuffled' && shuffledWords.length > 0 && (
              <span style={{ marginLeft: '8px', color: '#666' }}>
                • {currentIndex}/{shuffledWords.length} words
              </span>
            )}
            {' | '}
            <button
              onClick={handleChangeSettings}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '13px'
              }}
            >
              Change
            </button>
          </div>

          {/* Details Section - Now appears ABOVE the flashcard */}
          {showDetails && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'white',
                border: '2px solid #dee2e6',
                borderRadius: '12px',
                marginBottom: '10px',
                textAlign: 'left',
                maxHeight: '40dvh',
                overflow: 'auto',
                fontSize: '14px'
              }}>
                {!isEditing ? (
                  <>
                    <div style={{ marginBottom: '10px' }}>
                      <strong style={{ fontSize: '12px', color: '#666' }}>Pinyin:</strong>
                      <div style={{ fontSize: '16px', marginTop: '3px' }}>{currentWord.pinyin}</div>
                    </div>

                    {currentWord.hanVietnamese && (
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '12px', color: '#666' }}>Han Vietnamese:</strong>
                        <div style={{ fontSize: '14px', marginTop: '3px' }}>{currentWord.hanVietnamese}</div>
                      </div>
                    )}

                    {currentWord.modernVietnamese && (
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '12px', color: '#666' }}>Modern Vietnamese:</strong>
                        <div style={{ fontSize: '14px', marginTop: '3px' }}>{currentWord.modernVietnamese}</div>
                      </div>
                    )}

                    {currentWord.englishMeaning && (
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '12px', color: '#666' }}>English Meaning:</strong>
                        <div style={{ fontSize: '14px', marginTop: '3px' }}>{currentWord.englishMeaning}</div>
                      </div>
                    )}

                    {currentWord.learningNote && (
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '12px', color: '#666' }}>Learning Note:</strong>
                        <div style={{ fontSize: '13px', marginTop: '3px', fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {currentWord.learningNote}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '10px', paddingTop: '8px', borderTop: '1px solid #dee2e6' }}>
                      <strong style={{ fontSize: '12px', color: '#666' }}>Chapter:</strong>
                      <div style={{ fontSize: '14px', marginTop: '3px' }}>
                        {currentWord.chapter}
                        {currentWord.chapterLabel && (
                          <span style={{ fontSize: '12px', color: '#888', marginLeft: '6px' }}>
                            ({currentWord.chapterLabel})
                          </span>
                        )}
                      </div>
                    </div>

                    <div 
                      className="flashcard-buttons"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px',
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid #dee2e6'
                      }}
                    >
                      <button
                        onClick={handlePronounce}
                        disabled={playing}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: playing ? '#6c757d' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: playing ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          flex: 1
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{playing ? '🔊' : '🔉'}</span>
                        <span>{playing ? 'Playing...' : 'Pronounce'}</span>
                      </button>

                      <button
                        onClick={handleEdit}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          flex: 1
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>✏️</span>
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={handleFavoriteClick}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: currentWord.isFavorite ? '#dc3545' : '#ffc107',
                          color: currentWord.isFavorite ? 'white' : '#000',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          flex: 1
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{currentWord.isFavorite ? '★' : '☆'}</span>
                        <span>{currentWord.isFavorite ? 'Un-fav' : 'Favorite'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                        Pinyin:
                      </label>
                      <input
                        type="text"
                        value={editedWord?.pinyin || ''}
                        onChange={(e) => setEditedWord(editedWord ? { ...editedWord, pinyin: e.target.value } : null)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                        Han Vietnamese:
                      </label>
                      <input
                        type="text"
                        value={editedWord?.hanVietnamese || ''}
                        onChange={(e) => setEditedWord(editedWord ? { ...editedWord, hanVietnamese: e.target.value } : null)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                        Modern Vietnamese:
                      </label>
                      <input
                        type="text"
                        value={editedWord?.modernVietnamese || ''}
                        onChange={(e) => setEditedWord(editedWord ? { ...editedWord, modernVietnamese: e.target.value } : null)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                        English Meaning:
                      </label>
                      <input
                        type="text"
                        value={editedWord?.englishMeaning || ''}
                        onChange={(e) => setEditedWord(editedWord ? { ...editedWord, englishMeaning: e.target.value } : null)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                        Learning Note:
                      </label>
                      <textarea
                        value={editedWord?.learningNote || ''}
                        onChange={(e) => setEditedWord(editedWord ? { ...editedWord, learningNote: e.target.value } : null)}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                        Chapter:
                      </label>
                      <input
                        type="number"
                        value={editedWord?.chapter || ''}
                        onChange={(e) => setEditedWord(editedWord ? { ...editedWord, chapter: parseInt(e.target.value) || 0 } : null)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                        Chapter Label:
                      </label>
                      <input
                        type="text"
                        value={editedWord?.chapterLabel || ''}
                        onChange={(e) => setEditedWord(editedWord ? { ...editedWord, chapterLabel: e.target.value } : null)}
                        placeholder="Optional"
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6'
                        }}
                      />
                    </div>

                    <div 
                      className="flashcard-buttons"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px',
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid #dee2e6'
                      }}
                    >
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          flex: 1
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleSaveEdit}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          flex: 1
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </>
                )}

                {/* Mobile responsive styles */}
                <style>{`
                  @media (max-width: 480px) {
                    .flashcard-buttons {
                      flex-direction: column !important;
                    }
                  }
                `}</style>
              </div>
            )}

            {/* Chinese Character Card - Now appears BELOW the details */}
            <div style={{
              padding: 'clamp(14px, 4vw, 20px) clamp(12px, 3vw, 15px)',
              backgroundColor: '#f8f9fa',
              border: '3px solid #007bff',
              borderRadius: '16px',
              marginBottom: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              position: 'relative',
            }}>
              {currentWord.isFavorite && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  fontSize: '24px',
                  color: '#ffc107'
                }}>
                  ★
                </div>
              )}
              
              {/* Pronounce button on card - bottom right */}
              <button
                onClick={handlePronounce}
                disabled={playing}
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  padding: '6px 10px',
                  backgroundColor: playing ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: playing ? 'not-allowed' : 'pointer',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {playing ? '🔊' : '🔉'}
              </button>
              
              <div style={{
                fontSize: 'clamp(48px, 15vw, 80px)',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '10px',
                lineHeight: 1.2
              }}>
                {currentWord.chineseCharacter}
              </div>

              {!showDetails && (
                <button
                  onClick={handleShowDetails}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    marginTop: '5px'
                  }}
                >
                  Show Details
                </button>
              )}
            </div>

          {/* Next Button */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '10px' }}>
            <button
              onClick={handleNext}
              disabled={isEditing}
              style={{
                padding: '10px 30px',
                backgroundColor: isEditing ? '#6c757d' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isEditing ? 'not-allowed' : 'pointer',
                fontSize: 'clamp(14px, 4vw, 16px)',
                fontWeight: 'bold',
                width: '100%',
                maxWidth: '300px',
                opacity: isEditing ? 0.6 : 1
              }}
            >
              {isEditing ? 'Save or Cancel Edit First' : 'Next Word'}
            </button>
          </div>
        </div>
      )}

      {/* Favorite/Un-favorite Confirmation Modal */}
      {showFavoriteConfirm && currentWord && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={() => setShowFavoriteConfirm(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ 
              marginTop: 0, 
              marginBottom: '20px', 
              color: favoriteAction === 'unfavorite' ? '#dc3545' : '#ffc107' 
            }}>
              {favoriteAction === 'unfavorite' ? 'Un-favorite Word?' : 'Favorite Word?'}
            </h2>
            
            <div style={{ marginBottom: '25px' }}>
              <div style={{
                fontSize: '48px',
                textAlign: 'center',
                marginBottom: '15px',
                fontWeight: 'bold'
              }}>
                {currentWord.chineseCharacter}
              </div>
              
              <p style={{ fontSize: '16px', color: '#666', lineHeight: '1.6', marginBottom: '10px' }}>
                {favoriteAction === 'unfavorite' 
                  ? 'Are you sure you want to remove this word from your favorites?'
                  : 'Add this word to your favorites for quick practice?'}
              </p>
              
              <div style={{
                backgroundColor: favoriteAction === 'unfavorite' ? '#fff3cd' : '#d1ecf1',
                border: `1px solid ${favoriteAction === 'unfavorite' ? '#ffc107' : '#bee5eb'}`,
                borderRadius: '6px',
                padding: '12px',
                marginTop: '15px'
              }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  color: favoriteAction === 'unfavorite' ? '#856404' : '#0c5460' 
                }}>
                  {favoriteAction === 'unfavorite' ? (
                    <>
                      <strong>⚠️ Note:</strong> This word will no longer appear in your favorite flashcard practice. 
                      You can re-favorite it later from the Vocabulary Management or Phrases pages.
                    </>
                  ) : (
                    <>
                      <strong>ℹ️ Note:</strong> Favorited words will appear in your favorite flashcard practice 
                      for focused review.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowFavoriteConfirm(false)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleToggleFavorite}
                style={{
                  padding: '10px 24px',
                  backgroundColor: favoriteAction === 'unfavorite' ? '#dc3545' : '#ffc107',
                  color: favoriteAction === 'unfavorite' ? 'white' : '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                {favoriteAction === 'unfavorite' ? 'Yes, Un-favorite' : 'Yes, Favorite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
