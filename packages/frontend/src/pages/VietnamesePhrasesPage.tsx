import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { useChildEditProtection } from '../hooks/useChildEditProtection';
import { useAuth } from '../context/AuthContext';

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

export default function VietnamesePhrasesPage() {
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
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editedCharacterData, setEditedCharacterData] = useState<CharacterInfo | null>(null);

  // Refs for mobile edit modal inputs
  const pinyinInputRef = useRef<HTMLInputElement>(null);
  const hanVietInputRef = useRef<HTMLInputElement>(null);
  const modVietInputRef = useRef<HTMLInputElement>(null);
  const englishInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus first input when edit mode opens
  useEffect(() => {
    if (editingCharacter && pinyinInputRef.current) {
      setTimeout(() => {
        pinyinInputRef.current?.focus();
        pinyinInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    }
  }, [editingCharacter]);

  useEffect(() => {
    fetchVocabGroups();
  }, []);

  const fetchVocabGroups = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<VocabGroupResponse[]>('/phrases/vocab-groups');
      setVocabGroups(response.data);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to load vocabulary groups';
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchVocabGroups(retryCount + 1);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = async (groupId: number) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(groupId);
      if (!sentences.has(groupId)) await fetchSentences(groupId);
    }
  };

  const fetchSentences = async (vocabGroupId: number, retryCount = 0) => {
    setLoadingSentences(prev => new Set(prev).add(vocabGroupId));
    setError(null);
    try {
      const response = await apiClient.get<SentenceResponse[]>(`/phrases/sentences/${vocabGroupId}`);
      setSentences(prev => new Map(prev).set(vocabGroupId, response.data));
    } catch (err: any) {
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchSentences(vocabGroupId, retryCount + 1);
      }
      setError(`Failed to load sentences for group ${vocabGroupId}`);
    } finally {
      setLoadingSentences(prev => { const s = new Set(prev); s.delete(vocabGroupId); return s; });
    }
  };

  const handleSentenceClick = (sentence: SentenceResponse, sentenceNumber: number) => {
    setSelectedSentence(sentence);
    setSelectedSentenceNumber(sentenceNumber);
    setCharacterDetails([]);
    fetchCharacterDetails(sentence.usedCharacters);
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
  };

  const handleCloseModal = () => {
    setSelectedSentence(null);
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
            const response = await apiClient.get<CharacterInfo>(`/phrases/character-info/${char}`);
            return response.data;
          } catch {
            return { chineseCharacter: char, pinyin: 'N/A', hanVietnamese: 'N/A', modernVietnamese: 'N/A', englishMeaning: 'N/A' };
          }
        })
      );
      setCharacterDetails(details);
    } catch {
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 1000));
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
      const u = new SpeechSynthesisUtterance(character);
      u.lang = 'zh-CN'; u.rate = 0.5;
      u.onend = () => setPlayingCharacter(null);
      u.onerror = () => { setPlayingCharacter(null); alert('Failed to play pronunciation'); };
      window.speechSynthesis.speak(u);
    } else { alert('Text-to-speech is not supported in your browser'); }
  };

  const handlePronounceSentence = () => {
    if (!selectedSentence?.chineseText) return;
    if ('speechSynthesis' in window) {
      setPlayingSentence(true);
      const u = new SpeechSynthesisUtterance(selectedSentence.chineseText);
      u.lang = 'zh-CN'; u.rate = 0.7;
      u.onend = () => setPlayingSentence(false);
      u.onerror = () => { setPlayingSentence(false); alert('Failed to play sentence pronunciation'); };
      window.speechSynthesis.speak(u);
    } else { alert('Text-to-speech is not supported in your browser'); }
  };

  const handleToggleFavorite = async (character: string, currentFavoriteStatus: boolean) => {
    if (showEditProtection('favorite')) return;
    if (!user?.username) { alert('Not authenticated'); return; }
    try {
      await apiClient.post(`/${user.username}/vocabulary/toggle-favorite`, { chineseCharacter: character });
      setCharacterDetails(prev => prev.map(c => c.chineseCharacter === character ? { ...c, isFavorite: !currentFavoriteStatus } : c));
    } catch { alert('Failed to update favorite status'); }
  };

  const handleEditCharacter = (char: CharacterInfo) => {
    if (showEditProtection('edit')) return;
    setEditingCharacter(char.chineseCharacter);
    setEditedCharacterData({ ...char });
  };

  const handleSaveCharacter = async () => {
    if (!editedCharacterData || !editingCharacter || !user?.username) { alert('Not authenticated'); return; }
    try {
      const entriesResponse = await apiClient.get(`/${user.username}/vocabulary`);
      const entry = entriesResponse.data.find((e: any) => e.chineseCharacter === editingCharacter);
      if (!entry) { alert('Character not found in vocabulary'); return; }
      await apiClient.put(`/${user.username}/vocabulary/${entry.id}`, {
        pinyin: editedCharacterData.pinyin,
        hanVietnamese: editedCharacterData.hanVietnamese,
        modernVietnamese: editedCharacterData.modernVietnamese,
        englishMeaning: editedCharacterData.englishMeaning,
      });
      setCharacterDetails(prev => prev.map(c => c.chineseCharacter === editingCharacter ? editedCharacterData : c));
      setEditingCharacter(null);
      setEditedCharacterData(null);
      alert('Character updated successfully!');
    } catch { alert('Failed to update character'); }
  };

  const handleCancelEdit = () => { setEditingCharacter(null); setEditedCharacterData(null); };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div style={{ padding: '20px', paddingTop: '50px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h1 style={{ margin: 0 }}>🇻🇳 Vietnamese Phrases</h1>
      </div>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Practice Chinese sentences by reading Vietnamese translations. Click any sentence to see the Chinese text and character details.
      </p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '15px', backgroundColor: '#f8d7da', color: '#721c24',
          border: '1px solid #f5c6cb', borderRadius: '4px', marginBottom: '20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div><strong>Error:</strong> {error}</div>
          <button onClick={() => { setError(null); fetchVocabGroups(); }} style={{
            padding: '8px 16px', backgroundColor: '#721c24', color: 'white',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
          }}>Retry</button>
        </div>
      )}

      <div>
        {vocabGroups.length === 0 && !loading && !error && (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px', color: '#666' }}>
            No vocabulary groups available. Sentences will be generated automatically.
          </div>
        )}

        {vocabGroups.map(group => (
          <div key={group.id} style={{ marginBottom: '15px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => toggleGroup(group.id)}
              style={{
                width: '100%', padding: '15px 20px',
                backgroundColor: expandedGroup === group.id ? '#007bff' : '#f8f9fa',
                color: expandedGroup === group.id ? 'white' : '#333',
                border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
                textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <span>
                Vocabulary Group {group.id}: Chapters {group.chapterStart} - {group.chapterEnd}
                {' '}({group.sentenceCount} sentences)
              </span>
              <span style={{ fontSize: '20px' }}>{expandedGroup === group.id ? '▼' : '▶'}</span>
            </button>

            {expandedGroup === group.id && (
              <div style={{ padding: '20px', backgroundColor: 'white' }}>
                {loadingSentences.has(group.id) ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                    <div style={{ fontSize: '16px' }}>Loading sentences...</div>
                  </div>
                ) : sentences.get(group.id) && sentences.get(group.id)!.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                    {sentences.get(group.id)!.map((sentence, index) => (
                      <div
                        key={sentence.id}
                        onClick={() => handleSentenceClick(sentence, index + 1)}
                        style={{
                          padding: '15px', backgroundColor: '#f8f9fa', border: '2px solid #dee2e6',
                          borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                          fontSize: '18px', textAlign: 'center', minHeight: '80px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          justifyContent: 'center', position: 'relative'
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
                          position: 'absolute', top: '5px', left: '8px', fontSize: '12px',
                          fontWeight: 'bold', color: '#666', backgroundColor: 'white',
                          padding: '2px 6px', borderRadius: '4px'
                        }}>
                          {index + 1}
                        </div>
                        {sentence.modernVietnamese || 'No translation available'}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                    No sentences available for this group.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Character Edit Modal (Mobile bottom-sheet) */}
      {editingCharacter && selectedSentence && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', zIndex: 1001,
          }}
          onClick={handleCancelEdit}
        >
          <div
            style={{
              backgroundColor: 'white', borderRadius: '16px 16px 0 0',
              padding: '16px', paddingBottom: '32px', width: '100%',
              maxWidth: '600px', overflow: 'auto', WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', backgroundColor: '#dee2e6', borderRadius: '2px', margin: '0 auto 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(16px, 4vw, 20px)' }}>Edit Character: {editingCharacter}</h2>
              <button onClick={handleCancelEdit} style={{ padding: '6px 14px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Close</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>Pinyin</label>
                <input ref={pinyinInputRef} autoFocus type="text"
                  value={editedCharacterData?.pinyin || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, pinyin: e.target.value } : null)}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '4px', boxSizing: 'border-box' }}
                  placeholder="Enter pinyin" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>Han Vietnamese</label>
                <input ref={hanVietInputRef} type="text"
                  value={editedCharacterData?.hanVietnamese || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, hanVietnamese: e.target.value } : null)}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '4px', boxSizing: 'border-box' }}
                  placeholder="Enter Han Vietnamese" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>Modern Vietnamese</label>
                <input ref={modVietInputRef} type="text"
                  value={editedCharacterData?.modernVietnamese || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, modernVietnamese: e.target.value } : null)}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '4px', boxSizing: 'border-box' }}
                  placeholder="Enter modern Vietnamese" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>English Meaning</label>
                <input ref={englishInputRef} type="text"
                  value={editedCharacterData?.englishMeaning || ''}
                  onChange={(e) => setEditedCharacterData(editedCharacterData ? { ...editedCharacterData, englishMeaning: e.target.value } : null)}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '4px', boxSizing: 'border-box' }}
                  placeholder="Enter English meaning" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleSaveCharacter} style={{ flex: 1, padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>Save</button>
              <button onClick={handleCancelEdit} style={{ flex: 1, padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Sentence Detail Modal (Mobile bottom-sheet) */}
      {selectedSentence && !editingCharacter && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: 'white', borderRadius: '16px 16px 0 0',
              padding: '16px', paddingBottom: '32px', width: '100%',
              maxWidth: '900px', maxHeight: '92dvh',
              overflow: 'auto', WebkitOverflowScrolling: 'touch',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#dee2e6', borderRadius: '2px', margin: '0 auto 12px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(16px, 4vw, 20px)' }}>Sentence #{selectedSentenceNumber}</h2>
              <button onClick={handleCloseModal} style={{ padding: '6px 14px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Close</button>
            </div>

            {/* Vietnamese meaning (the primary display for this page) */}
            {selectedSentence.modernVietnamese && (
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '13px', color: '#666' }}>Vietnamese Translation:</strong>
                <div style={{ fontSize: 'clamp(14px, 4vw, 18px)', padding: '10px 12px', backgroundColor: '#fff3cd', borderRadius: '4px', marginTop: '4px' }}>
                  {selectedSentence.modernVietnamese}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '13px', color: '#666' }}>Chinese Text:</strong>
              <div style={{
                fontSize: 'clamp(18px, 5vw, 24px)', padding: '10px 12px',
                backgroundColor: '#f8f9fa', borderRadius: '4px', marginTop: '4px',
                lineHeight: '1.6', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', gap: '8px', flexWrap: 'wrap',
              }}>
                <span style={{ flex: 1 }}>{selectedSentence.chineseText}</span>
                <button
                  onClick={handlePronounceSentence}
                  disabled={playingSentence}
                  style={{
                    padding: '6px 12px', backgroundColor: playingSentence ? '#6c757d' : '#28a745',
                    color: 'white', border: 'none', borderRadius: '4px',
                    cursor: playingSentence ? 'not-allowed' : 'pointer', fontSize: '14px',
                    display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
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
                fontSize: 'clamp(14px, 4vw, 18px)', padding: '10px 12px',
                backgroundColor: '#f8f9fa', borderRadius: '4px', marginTop: '4px',
                color: selectedSentence.pinyin ? '#000' : '#999',
                fontStyle: selectedSentence.pinyin ? 'normal' : 'italic',
              }}>
                {selectedSentence.pinyin || 'Not available'}
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '13px', color: '#666' }}>Characters Used:</strong>
              {loadingDetails ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading character details...</div>
              ) : characterDetails.length > 0 ? (
                <div style={{ marginTop: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden', fontSize: 'clamp(12px, 3vw, 14px)' }}>
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
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', fontSize: '18px' }}>{char.chineseCharacter}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.pinyin || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.hanVietnamese || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.modernVietnamese || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6' }}>{char.englishMeaning || 'N/A'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center', fontSize: '12px', color: '#666' }}>{char.chapter ?? '—'}</td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleFavorite(char.chineseCharacter, char.isFavorite || false)}
                              style={{ padding: '4px 8px', backgroundColor: 'transparent', color: char.isFavorite ? '#ffc107' : '#ccc', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                            >
                              {char.isFavorite ? '★' : '☆'}
                            </button>
                          </td>
                          <td style={{ padding: '8px 6px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                            <button
                              onClick={() => handlePronounceCharacter(char.chineseCharacter)}
                              disabled={playingCharacter === char.chineseCharacter}
                              style={{ padding: '4px 8px', backgroundColor: playingCharacter === char.chineseCharacter ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: playingCharacter === char.chineseCharacter ? 'not-allowed' : 'pointer', fontSize: '14px' }}
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
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No character details available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Go to Top Button */}
      <button
        onClick={scrollToTop}
        style={{
          position: 'fixed', bottom: '30px', right: '30px', padding: '12px 16px',
          backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '50%',
          cursor: 'pointer', fontSize: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '50px', height: '50px',
        }}
        title="Go to top"
      >
        ↑
      </button>
    </div>
  );
}
