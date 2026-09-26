import { useState } from 'react';
import { apiClient } from '../api/client';

interface GeneratedSentence {
  chineseText: string;
  pinyin: string;
  englishMeaning?: string;
  usedCharacters: string[];
}

interface CharacterInfo {
  chineseCharacter: string;
  pinyin: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  isFavorite?: boolean;
}

export default function AITestPage() {
  const username = 'user1'; // Always use user1
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(3);
  const [loading, setLoading] = useState(false);
  const [sentences, setSentences] = useState<GeneratedSentence[]>([]);
  const [selectedSentence, setSelectedSentence] = useState<GeneratedSentence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [characterDetails, setCharacterDetails] = useState<CharacterInfo[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [playingCharacter, setPlayingCharacter] = useState<string | null>(null);
  const [playingSentence, setPlayingSentence] = useState<boolean>(false);
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editedCharacterData, setEditedCharacterData] = useState<CharacterInfo | null>(null);

  const handleGenerate = async () => {
    // Password protection
    const password = window.prompt('Enter password to generate sentences:');
    if (password !== 'BoyaChineseNgoc') {
      alert('Incorrect password');
      return;
    }

    setLoading(true);
    setError(null);
    setSentences([]);
    setSelectedSentence(null);
    setCharacterDetails([]);

    try {
      console.log('Sending batch request to:', `/${username}/comprehension/generate-batch`);
      console.log('Params:', { chapterStart, chapterEnd, count: 30 });
      
      const response = await apiClient.get<GeneratedSentence[]>(
        `/${username}/comprehension/generate-batch`,
        {
          params: {
            chapterStart,
            chapterEnd,
            count: 30
          }
        }
      );

      console.log('Response:', response.data);
      setSentences(response.data);
    } catch (err: any) {
      console.error('Error:', err);
      const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to generate sentences';
      console.error('Error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharacterDetails = async (characters: string[]) => {
    setLoadingDetails(true);
    try {
      const details = await Promise.all(
        characters.map(async (char) => {
          try {
            const response = await apiClient.get<CharacterInfo>(
              `/${username}/comprehension/character-info`,
              { params: { character: char } }
            );
            return response.data;
          } catch (error) {
            console.error(`Failed to fetch details for ${char}:`, error);
            return {
              chineseCharacter: char,
              pinyin: 'N/A',
              modernVietnamese: 'N/A',
              englishMeaning: 'N/A'
            };
          }
        })
      );
      setCharacterDetails(details);
    } catch (error) {
      console.error('Error fetching character details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSentenceClick = (sentence: GeneratedSentence) => {
    setSelectedSentence(sentence);
    setCharacterDetails([]);
    fetchCharacterDetails(sentence.usedCharacters);
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

  const handlePronounceCharacter = (character: string) => {
    if (!character) return;
    
    // Use browser's Web Speech API for pronunciation
    if ('speechSynthesis' in window) {
      setPlayingCharacter(character);
      const utterance = new SpeechSynthesisUtterance(character);
      utterance.lang = 'zh-CN'; // Chinese (Simplified)
      utterance.rate = 0.5; // Slower speed for learning
      
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

  const handleToggleFavorite = async (character: string, currentFavoriteStatus: boolean) => {
    try {
      await apiClient.post(`/user1/vocabulary/toggle-favorite`, {
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
    setEditingCharacter(char.chineseCharacter);
    setEditedCharacterData({ ...char });
  };

  const handleSaveCharacter = async () => {
    if (!editedCharacterData || !editingCharacter) return;

    try {
      // Get the vocabulary entry by character to find the ID
      const entriesResponse = await apiClient.get(`/user1/vocabulary`);
      const entry = entriesResponse.data.find((e: any) => e.chineseCharacter === editingCharacter);
      
      if (!entry) {
        alert('Character not found in vocabulary');
        return;
      }

      // Update using the actual ID
      await apiClient.put(`/user1/vocabulary/${entry.id}`, {
        pinyin: editedCharacterData.pinyin,
        modernVietnamese: editedCharacterData.modernVietnamese,
        englishMeaning: editedCharacterData.englishMeaning
      });

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

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Google AI Studio API Test Page</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Test the Google AI Studio API to generate random Chinese sentences based on your vocabulary.
      </p>

      <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Configuration</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Chapter Start:
          </label>
          <input
            type="number"
            value={chapterStart}
            onChange={(e) => setChapterStart(parseInt(e.target.value))}
            min="1"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Chapter End:
          </label>
          <input
            type="number"
            value={chapterEnd}
            onChange={(e) => setChapterEnd(parseInt(e.target.value))}
            min="1"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            width: '100%'
          }}
        >
          {loading ? 'Generating...' : 'Generate 30 Sentences'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {sentences.length > 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px'
        }}>
          <h2 style={{ marginTop: 0, color: '#155724' }}>Generated Sentences ({sentences.length})</h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            {sentences.map((sentence, index) => (
              <div
                key={index}
                onClick={() => handleSentenceClick(sentence)}
                style={{
                  padding: '15px',
                  backgroundColor: 'white',
                  border: '2px solid #c3e6cb',
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
                  e.currentTarget.style.backgroundColor = '#f0f8f0';
                  e.currentTarget.style.borderColor = '#28a745';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#c3e6cb';
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
                  backgroundColor: '#f8f9fa',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {index + 1}
                </div>
                {sentence.chineseText}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Character Detail Modal */}
      {selectedSentence && (
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
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedSentence(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflow: 'auto',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Sentence Details</h2>
              <button
                onClick={() => setSelectedSentence(null)}
                style={{
                  padding: '8px 16px',
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

            <div style={{ marginBottom: '20px' }}>
              <strong>Chinese Text:</strong>
              <div style={{
                fontSize: '24px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                marginTop: '5px',
                lineHeight: '1.6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{selectedSentence.chineseText}</span>
                <button
                  onClick={handlePronounceSentence}
                  disabled={playingSentence}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: playingSentence ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: playingSentence ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{playingSentence ? '🔊' : '🔉'}</span>
                  <span>{playingSentence ? 'Playing...' : 'Pronounce'}</span>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong>Pinyin:</strong>
              <div style={{
                fontSize: '18px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                marginTop: '5px',
                color: selectedSentence.pinyin ? '#000' : '#999',
                fontStyle: selectedSentence.pinyin ? 'normal' : 'italic'
              }}>
                {selectedSentence.pinyin || 'Not available'}
              </div>
            </div>

            {selectedSentence.englishMeaning && (
              <div style={{ marginBottom: '20px' }}>
                <strong>English Translation:</strong>
                <div style={{
                  fontSize: '18px',
                  padding: '15px',
                  backgroundColor: '#e7f3ff',
                  borderRadius: '4px',
                  marginTop: '5px',
                  color: '#000'
                }}>
                  {selectedSentence.englishMeaning}
                </div>
              </div>
            )}

            <div>
              <strong>Characters Used:</strong>
              {loadingDetails ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading character details...
                </div>
              ) : characterDetails.length > 0 ? (
                <div style={{ marginTop: '10px', overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'left' }}>Chinese</th>
                        <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'left' }}>Pinyin</th>
                        <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'left' }}>English</th>
                        <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'left' }}>Vietnamese</th>
                        <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>Favorite</th>
                        <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>Pronounce</th>
                        <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {characterDetails.map((char, index) => (
                        <tr key={index}>
                          <td style={{ padding: '10px', border: '1px solid #dee2e6', fontSize: '20px' }}>
                            {char.chineseCharacter}
                          </td>
                          {editingCharacter === char.chineseCharacter ? (
                            <>
                              <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                                <input
                                  type="text"
                                  value={editedCharacterData?.pinyin || ''}
                                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, pinyin: e.target.value } : null)}
                                  style={{ width: '100%', padding: '4px', fontSize: '14px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                                <input
                                  type="text"
                                  value={editedCharacterData?.englishMeaning || ''}
                                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, englishMeaning: e.target.value } : null)}
                                  style={{ width: '100%', padding: '4px', fontSize: '14px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                                <input
                                  type="text"
                                  value={editedCharacterData?.modernVietnamese || ''}
                                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, modernVietnamese: e.target.value } : null)}
                                  style={{ width: '100%', padding: '4px', fontSize: '14px', border: '1px solid #dee2e6', borderRadius: '4px' }}
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                                {char.pinyin}
                              </td>
                              <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                                {char.englishMeaning || 'N/A'}
                              </td>
                              <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                                {char.modernVietnamese || 'N/A'}
                              </td>
                            </>
                          )}
                          <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleFavorite(char.chineseCharacter, char.isFavorite || false)}
                              disabled={editingCharacter === char.chineseCharacter}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: 'transparent',
                                color: char.isFavorite ? '#ffc107' : '#ccc',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: editingCharacter === char.chineseCharacter ? 'not-allowed' : 'pointer',
                                fontSize: '20px',
                                transition: 'color 0.2s',
                                opacity: editingCharacter === char.chineseCharacter ? 0.5 : 1
                              }}
                              title={char.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {char.isFavorite ? '★' : '☆'}
                            </button>
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <button
                              onClick={() => handlePronounceCharacter(char.chineseCharacter)}
                              disabled={playingCharacter === char.chineseCharacter || editingCharacter === char.chineseCharacter}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: playingCharacter === char.chineseCharacter ? '#ccc' : '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: (playingCharacter === char.chineseCharacter || editingCharacter === char.chineseCharacter) ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                opacity: editingCharacter === char.chineseCharacter ? 0.5 : 1
                              }}
                            >
                              {playingCharacter === char.chineseCharacter ? '🔊' : '🔉'}
                            </button>
                          </td>
                          <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            {editingCharacter === char.chineseCharacter ? (
                              <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                <button
                                  onClick={handleSaveCharacter}
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  style={{
                                    padding: '5px 10px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEditCharacter(char)}
                                style={{
                                  padding: '5px 10px',
                                  backgroundColor: '#007bff',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                ✏️
                              </button>
                            )}
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

      <div style={{
        marginTop: '30px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px'
      }}>
        <h3 style={{ marginTop: 0 }}>How it works:</h3>
        <ol style={{ marginBottom: 0 }}>
          <li>Select chapter range (default: 1-3)</li>
          <li>Click "Generate 30 Sentences"</li>
          <li>The API will fetch vocabulary from the specified chapters</li>
          <li>Google AI Studio will generate 30 sentences using those characters</li>
          <li>Click any sentence to see details, pinyin, and character information</li>
        </ol>
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px'
      }}>
        <h3 style={{ marginTop: 0 }}>⚠️ Requirements:</h3>
        <ul style={{ marginBottom: 0 }}>
          <li>Backend server must be running on port 3000</li>
          <li>Google AI Studio API key must be configured in backend .env file</li>
          <li>User must have vocabulary entries in the database</li>
        </ul>
      </div>
    </div>
  );
}
