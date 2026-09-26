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

export default function FlashcardPage() {
  const { user } = useAuth();
  const showEditProtection = useChildEditProtection();
  const [parentUsername, setParentUsername] = useState<string | null>(null);
  const [currentWord, setCurrentWord] = useState<VocabularyEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [noFavorites, setNoFavorites] = useState(false);
  const [showUnfavoriteConfirm, setShowUnfavoriteConfirm] = useState(false);
  const [showChapterFilter, setShowChapterFilter] = useState(false);
  const [chapterStart, setChapterStart] = useState<number | null>(null);
  const [chapterEnd, setChapterEnd] = useState<number | null>(null);
  const [chapterLabel, setChapterLabel] = useState<string | null>(null);
  const [availableChapters, setAvailableChapters] = useState<number[]>([]);
  const [availableChapterLabels, setAvailableChapterLabels] = useState<string[]>([]);
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
      fetchRandomFavorite();
    }
  }, [user, parentUsername]);

  // Get the username to use for API calls
  const usernameForAPI = parentUsername || user?.username;

  const fetchAvailableChapters = async () => {
    if (!usernameForAPI) return;
    try {
      const response = await apiClient.get<number[]>(`/${usernameForAPI}/vocabulary/chapters`);
      setAvailableChapters(response.data);
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

  const fetchRandomFavorite = async () => {
    if (!usernameForAPI) return;
    setLoading(true);
    setError(null);
    setShowDetails(false);
    setNoFavorites(false);
    
    try {
      if (algorithm === 'shuffled') {
        // Shuffled algorithm: fetch all words once and serve in order
        if (shuffledWords.length === 0 || currentIndex >= shuffledWords.length) {
          // Fetch all favorites
          let url = `/${usernameForAPI}/vocabulary/favorites`;
          const params = new URLSearchParams();
          
          if (chapterLabel) {
            params.append('chapterLabel', chapterLabel);
          } else if (chapterStart !== null && chapterEnd !== null) {
            params.append('chapterStart', chapterStart.toString());
            params.append('chapterEnd', chapterEnd.toString());
          }
          
          if (params.toString()) {
            url += `?${params.toString()}`;
          }
          
          const response = await apiClient.get<VocabularyEntry[]>(url);
          
          if (response.data.length === 0) {
            setNoFavorites(true);
            if (chapterLabel) {
              setError(`No favorite words found with chapter label "${chapterLabel}". Try a different label or remove the filter.`);
            } else if (chapterStart !== null && chapterEnd !== null) {
              setError(`No favorite words found in chapters ${chapterStart}-${chapterEnd}. Try different chapters or remove the filter.`);
            } else {
              setError('No favorite words found. Please mark some words as favorites first.');
            }
            setLoading(false);
            return;
          }
          
          // Shuffle the array
          const shuffled = [...response.data].sort(() => Math.random() - 0.5);
          setShuffledWords(shuffled);
          setCurrentIndex(0);
          setCurrentWord(shuffled[0]);
        } else {
          // Serve next word from shuffled list
          setCurrentWord(shuffledWords[currentIndex]);
          setCurrentIndex(currentIndex + 1);
        }
      } else {
        // Random algorithm: fetch random word each time
        let url = `/${usernameForAPI}/vocabulary/favorites/random`;
        const params = new URLSearchParams();
        
        if (chapterLabel) {
          params.append('chapterLabel', chapterLabel);
        } else if (chapterStart !== null && chapterEnd !== null) {
          params.append('chapterStart', chapterStart.toString());
          params.append('chapterEnd', chapterEnd.toString());
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        const response = await apiClient.get<VocabularyEntry>(url);
        setCurrentWord(response.data);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setNoFavorites(true);
        if (chapterLabel) {
          setError(`No favorite words found with chapter label "${chapterLabel}". Try a different label or remove the filter.`);
        } else if (chapterStart !== null && chapterEnd !== null) {
          setError(`No favorite words found in chapters ${chapterStart}-${chapterEnd}. Try different chapters or remove the filter.`);
        } else {
          setError('No favorite words found. Please mark some words as favorites first.');
        }
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to load favorite word');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = () => {
    setShowDetails(true);
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

  const handleNext = () => {
    fetchRandomFavorite();
  };

  const handleApplyFilter = () => {
    if (chapterStart !== null && chapterEnd !== null && chapterStart > chapterEnd) {
      alert('Start chapter must be less than or equal to end chapter');
      return;
    }
    setShowChapterFilter(false);
    // Reset shuffled list when filter changes
    setShuffledWords([]);
    setCurrentIndex(0);
    fetchRandomFavorite();
  };

  const handleClearFilter = () => {
    setChapterStart(null);
    setChapterEnd(null);
    setChapterLabel(null);
    setShowChapterFilter(false);
    // Reset shuffled list when filter changes
    setShuffledWords([]);
    setCurrentIndex(0);
    // Trigger fetch after state updates
    setTimeout(() => fetchRandomFavorite(), 0);
  };

  const handleUnfavorite = async () => {
    if (showEditProtection('unfavorite')) return;
    if (!currentWord || !usernameForAPI) return;

    try {
      await apiClient.post(`/${usernameForAPI}/vocabulary/toggle-favorite`, {
        chineseCharacter: currentWord.chineseCharacter
      });

      // Close confirmation dialog
      setShowUnfavoriteConfirm(false);

      // Fetch next word after unfavoriting
      fetchRandomFavorite();
    } catch (error) {
      console.error('Error unfavoriting word:', error);
      alert('Failed to unfavorite word');
    }
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
      <h1 style={{ marginBottom: '10px', marginTop: '0', textAlign: 'center', fontSize: 'clamp(16px, 4vw, 24px)' }}>
        Flashcard Practice
        {chapterLabel && (
          <div style={{ fontSize: 'clamp(11px, 3vw, 14px)', color: '#666', marginTop: '5px' }}>
            Chapter Label: "{chapterLabel}"
          </div>
        )}
        {!chapterLabel && chapterStart !== null && chapterEnd !== null && (
          <div style={{ fontSize: 'clamp(11px, 3vw, 14px)', color: '#666', marginTop: '5px' }}>
            Chapters {chapterStart}-{chapterEnd}
          </div>
        )}
      </h1>

      {/* Chapter Filter Button */}
      {!loading && !error && (
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => setShowChapterFilter(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: (chapterStart !== null || chapterLabel !== null) ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {(chapterStart !== null || chapterLabel !== null) ? '📚 Filter Active' : '📚 Filter by Chapter'}
          </button>
          
          <select
            value={algorithm}
            onChange={(e) => {
              const newAlgorithm = e.target.value as 'random' | 'shuffled';
              setAlgorithm(newAlgorithm);
              setShuffledWords([]);
              setCurrentIndex(0);
              if (newAlgorithm === 'shuffled') {
                fetchRandomFavorite();
              }
            }}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="random">🎲 Random</option>
            <option value="shuffled">🔀 Shuffled Order</option>
          </select>
          
          {algorithm === 'shuffled' && shuffledWords.length > 0 && (
            <span style={{ fontSize: '13px', color: '#666' }}>
              {currentIndex}/{shuffledWords.length}
            </span>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
        </div>
      )}

      {error && (
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
          {noFavorites && (
            <a
              href="/vocabulary"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            >
              Go to Vocabulary Management
            </a>
          )}
        </div>
      )}

      {!loading && !error && currentWord && (
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
          {/* Details Section - Now appears ABOVE the flashcard */}
          {showDetails && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'white',
              border: '2px solid #dee2e6',
              borderRadius: '12px',
              marginBottom: '12px',
              textAlign: 'left',
              maxHeight: '40dvh',
              overflow: 'auto'
            }}>
              {!isEditing ? (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ fontSize: '14px', color: '#666' }}>Pinyin:</strong>
                    <div style={{ fontSize: '20px', marginTop: '5px' }}>{currentWord.pinyin}</div>
                  </div>

                  {currentWord.hanVietnamese && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', color: '#666' }}>Han Vietnamese:</strong>
                      <div style={{ fontSize: '18px', marginTop: '5px' }}>{currentWord.hanVietnamese}</div>
                    </div>
                  )}

                  {currentWord.modernVietnamese && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', color: '#666' }}>Modern Vietnamese:</strong>
                      <div style={{ fontSize: '18px', marginTop: '5px' }}>{currentWord.modernVietnamese}</div>
                    </div>
                  )}

                  {currentWord.englishMeaning && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', color: '#666' }}>English Meaning:</strong>
                      <div style={{ fontSize: '18px', marginTop: '5px' }}>{currentWord.englishMeaning}</div>
                    </div>
                  )}

                  {currentWord.learningNote && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong style={{ fontSize: '14px', color: '#666' }}>Learning Note:</strong>
                      <div style={{ fontSize: '16px', marginTop: '5px', fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}>
                        {currentWord.learningNote}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '15px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
                    <strong style={{ fontSize: '14px', color: '#666' }}>Chapter:</strong>
                    <div style={{ fontSize: '16px', marginTop: '5px' }}>
                      {currentWord.chapter}
                      {currentWord.chapterLabel && (
                        <span style={{ fontSize: '14px', color: '#888', marginLeft: '8px' }}>
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
                      gap: '10px',
                      marginTop: '15px',
                      paddingTop: '15px',
                      borderTop: '1px solid #dee2e6'
                    }}
                  >
                    <button
                      onClick={handlePronounce}
                      disabled={playing}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: playing ? '#6c757d' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: playing ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        flex: 1
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>{playing ? '🔊' : '🔉'}</span>
                      <span>{playing ? 'Playing...' : 'Pronounce'}</span>
                    </button>

                    <button
                      onClick={handleEdit}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        flex: 1
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>✏️</span>
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setShowUnfavoriteConfirm(true)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        flex: 1
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>★</span>
                      <span>Un-favorite</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                      Pinyin:
                    </label>
                    <input
                      type="text"
                      value={editedWord?.pinyin || ''}
                      onChange={(e) => setEditedWord(editedWord ? { ...editedWord, pinyin: e.target.value } : null)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                      Han Vietnamese:
                    </label>
                    <input
                      type="text"
                      value={editedWord?.hanVietnamese || ''}
                      onChange={(e) => setEditedWord(editedWord ? { ...editedWord, hanVietnamese: e.target.value } : null)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                      Modern Vietnamese:
                    </label>
                    <input
                      type="text"
                      value={editedWord?.modernVietnamese || ''}
                      onChange={(e) => setEditedWord(editedWord ? { ...editedWord, modernVietnamese: e.target.value } : null)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                      English Meaning:
                    </label>
                    <input
                      type="text"
                      value={editedWord?.englishMeaning || ''}
                      onChange={(e) => setEditedWord(editedWord ? { ...editedWord, englishMeaning: e.target.value } : null)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                      Learning Note:
                    </label>
                    <textarea
                      value={editedWord?.learningNote || ''}
                      onChange={(e) => setEditedWord(editedWord ? { ...editedWord, learningNote: e.target.value } : null)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                      Chapter:
                    </label>
                    <input
                      type="number"
                      value={editedWord?.chapter || ''}
                      onChange={(e) => setEditedWord(editedWord ? { ...editedWord, chapter: parseInt(e.target.value) || 0 } : null)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '14px', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                      Chapter Label:
                    </label>
                    <input
                      type="text"
                      value={editedWord?.chapterLabel || ''}
                      onChange={(e) => setEditedWord(editedWord ? { ...editedWord, chapterLabel: e.target.value } : null)}
                      placeholder="Optional"
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '16px',
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
                      gap: '10px',
                      marginTop: '15px',
                      paddingTop: '15px',
                      borderTop: '1px solid #dee2e6'
                    }}
                  >
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        flex: 1
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleSaveEdit}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
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
            padding: 'clamp(16px, 4vw, 30px) clamp(12px, 3vw, 20px)',
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
                top: '15px',
                right: '15px',
                fontSize: '32px',
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
                bottom: '15px',
                right: '15px',
                padding: '8px 12px',
                backgroundColor: playing ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: playing ? 'not-allowed' : 'pointer',
                fontSize: '20px',
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
                  padding: '12px 30px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginTop: '10px'
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
                padding: '12px 40px',
                backgroundColor: isEditing ? '#6c757d' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isEditing ? 'not-allowed' : 'pointer',
                fontSize: 'clamp(15px, 4vw, 18px)',
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

      {/* Un-favorite Confirmation Modal */}
      {showUnfavoriteConfirm && currentWord && (
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
          onClick={() => setShowUnfavoriteConfirm(false)}
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
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#dc3545' }}>
              Un-favorite Word?
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
                Are you sure you want to remove this word from your favorites?
              </p>
              
              <div style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '6px',
                padding: '12px',
                marginTop: '15px'
              }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
                  <strong>⚠️ Note:</strong> This word will no longer appear in your flashcard practice. 
                  You can re-favorite it later from the Vocabulary Management or Phrases pages.
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowUnfavoriteConfirm(false)}
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
                onClick={handleUnfavorite}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Yes, Un-favorite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Filter Modal */}
      {showChapterFilter && (
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
          onClick={() => setShowChapterFilter(false)}
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
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#007bff' }}>
              Filter by Chapter
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Chapter Label:
              </label>
              <select
                value={chapterLabel ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setChapterLabel(value || null);
                  // Clear chapter range when label is selected
                  if (value) {
                    setChapterStart(null);
                    setChapterEnd(null);
                  }
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
              opacity: chapterLabel ? 0.5 : 1,
              pointerEvents: chapterLabel ? 'none' : 'auto'
            }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Start Chapter:
              </label>
              <select
                value={chapterStart ?? ''}
                onChange={(e) => setChapterStart(e.target.value ? parseInt(e.target.value) : null)}
                disabled={!!chapterLabel}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}
              >
                <option value="">All Chapters</option>
                {availableChapters.map(chapter => (
                  <option key={chapter} value={chapter}>Chapter {chapter}</option>
                ))}
              </select>
            </div>

            <div style={{ 
              marginBottom: '25px',
              opacity: chapterLabel ? 0.5 : 1,
              pointerEvents: chapterLabel ? 'none' : 'auto'
            }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                End Chapter:
              </label>
              <select
                value={chapterEnd ?? ''}
                onChange={(e) => setChapterEnd(e.target.value ? parseInt(e.target.value) : null)}
                disabled={!!chapterLabel}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}
              >
                <option value="">All Chapters</option>
                {availableChapters.map(chapter => (
                  <option key={chapter} value={chapter}>Chapter {chapter}</option>
                ))}
              </select>
            </div>

            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }}>
              {(chapterStart !== null || chapterLabel !== null) && (
                <button
                  onClick={handleClearFilter}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '500'
                  }}
                >
                  Clear Filter
                </button>
              )}
              
              <button
                onClick={() => setShowChapterFilter(false)}
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
                onClick={handleApplyFilter}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
