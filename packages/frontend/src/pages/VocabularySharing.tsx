import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { vocabularyApi, VocabularyEntry } from '../api/client';

export default function VocabularySharing() {
  const { username } = useParams<{ username: string }>();
  const [sources, setSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [chapters, setChapters] = useState<number[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    // In a real implementation, you'd have an endpoint to list all users
    // For now, this is a placeholder
    setSources(['user1', 'user2', 'user3']);
  };

  const loadChapters = async (sourceUsername: string) => {
    setLoading(true);
    try {
      const response = await vocabularyApi.getChapters(sourceUsername);
      setChapters(response.data);
    } catch (error) {
      console.error('Failed to load chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async (sourceUsername: string, chapter: number) => {
    setLoading(true);
    try {
      const response = await vocabularyApi.getAll(sourceUsername, chapter, chapter);
      setEntries(response.data);
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!username || !selectedSource || selectedChapter === null) return;
    if (!confirm(`Import chapter ${selectedChapter} from ${selectedSource}?`)) return;
    
    setLoading(true);
    try {
      await vocabularyApi.share(username, selectedSource, selectedChapter);
      alert('Vocabulary imported successfully!');
    } catch (error) {
      console.error('Failed to import vocabulary:', error);
      alert('Failed to import vocabulary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vocabulary-sharing">
      <h2>Import Vocabulary - {username}</h2>
      
      <div>
        <label>Select Source User:</label>
        <select
          value={selectedSource}
          onChange={(e) => {
            setSelectedSource(e.target.value);
            loadChapters(e.target.value);
          }}
        >
          <option value="">-- Select User --</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      {chapters.length > 0 && (
        <div>
          <label>Select Chapter:</label>
          <select
            value={selectedChapter || ''}
            onChange={(e) => {
              const chapter = parseInt(e.target.value);
              setSelectedChapter(chapter);
              loadEntries(selectedSource, chapter);
            }}
          >
            <option value="">-- Select Chapter --</option>
            {chapters.map((chapter) => (
              <option key={chapter} value={chapter}>
                Chapter {chapter}
              </option>
            ))}
          </select>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <h3>Preview ({entries.length} entries)</h3>
          <table>
            <thead>
              <tr>
                <th>Chinese</th>
                <th>Pinyin</th>
                <th>Modern Vietnamese</th>
                <th>English</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 10).map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.chineseCharacter}</td>
                  <td>{entry.pinyin}</td>
                  <td>{entry.modernVietnamese}</td>
                  <td>{entry.englishMeaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length > 10 && <p>... and {entries.length - 10} more</p>}
          <button onClick={handleImport} disabled={loading}>
            Import Chapter
          </button>
        </>
      )}
    </div>
  );
}
