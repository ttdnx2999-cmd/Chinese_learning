import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { vocabularyApi, VocabularyEntry } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useChildEditProtection } from '../hooks/useChildEditProtection';
import { getInputProps } from '../hooks/useKeyboardLanguage';

interface VocabularyManagementProps {
  username?: string;
}

export default function VocabularyManagement({ username: propUsername }: VocabularyManagementProps) {
  const { username: paramUsername } = useParams<{ username: string }>();
  const { user } = useAuth();
  const showEditProtection = useChildEditProtection();
  
  // Use prop username if provided, otherwise try params, otherwise use current user's username
  const username = propUsername || paramUsername || user?.username;
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<VocabularyEntry>>({});
  const [loading, setLoading] = useState(false);
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchChapter, setBatchChapter] = useState<string>('1');
  const [batchChapterLabel, setBatchChapterLabel] = useState<string>('');
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchResult, setBatchResult] = useState<{ success: number; failed: number; total: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [availableChapters, setAvailableChapters] = useState<number[]>([]);
  const [availableChapterLabels, setAvailableChapterLabels] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedChapterLabel, setSelectedChapterLabel] = useState<string | null>(null);
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [batchEditForms, setBatchEditForms] = useState<Map<string, Partial<VocabularyEntry>>>(new Map());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1200);
  const [columnFilters, setColumnFilters] = useState({
    favorite: 'all', // 'all', 'favorites', 'non-favorites'
    chinese: '',
    pinyin: '',
    hanVietnamese: '',
    modernVietnamese: '',
    english: '',
    note: ''
  });

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      // Throttle scroll events to improve performance
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setShowScrollTop(window.scrollY > 300);
      }, 100);
    };
    
    const handleResize = () => {
      // Handle window resize - could be used for responsive adjustments
      // Currently just ensuring scroll button visibility is updated
      setShowScrollTop(window.scrollY > 300);
      setIsSmallScreen(window.innerWidth < 1200);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    loadChapters();
    loadChapterLabels();
  }, [username]);

  useEffect(() => {
    loadEntries();
  }, [username, selectedChapter, selectedChapterLabel]);

  const loadChapters = async () => {
    if (!username) return;
    try {
      const response = await vocabularyApi.getChapters(username);
      setAvailableChapters(response.data);
      
      // Set default batch chapter to latest chapter
      if (response.data.length > 0) {
        const latestChapter = Math.max(...response.data);
        setBatchChapter(latestChapter.toString());
      }
    } catch (error) {
      console.error('Failed to load chapters:', error);
    }
  };

  const loadChapterLabels = async () => {
    if (!username) return;
    try {
      const response = await vocabularyApi.getChapterLabels(username);
      setAvailableChapterLabels(response.data);
    } catch (error) {
      console.error('Failed to load chapter labels:', error);
    }
  };

  const loadEntries = async () => {
    if (!username) return;
    setLoading(true);
    try {
      let response;
      if (selectedChapterLabel) {
        // Filter by chapter label (takes precedence)
        response = await vocabularyApi.getByChapterLabel(username, selectedChapterLabel);
      } else if (selectedChapter) {
        // Filter by chapter number
        response = await vocabularyApi.getAll(username, selectedChapter, selectedChapter);
      } else {
        // No filter
        response = await vocabularyApi.getAll(username);
      }
      setEntries(response.data);
    } catch (error) {
      console.error('Failed to load vocabulary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: VocabularyEntry) => {
    if (showEditProtection('edit')) return;
    setEditingId(entry.id);
    setEditForm(entry);
  };

  const handleSave = async () => {
    if (!username || !editingId) return;
    try {
      await vocabularyApi.update(username, editingId, editForm);
      
      // Update the local state with the saved changes
      setEntries(prevEntries =>
        prevEntries.map(e =>
          e.id === editingId
            ? { ...e, ...editForm }
            : e
        )
      );
      
      // Reload chapter labels in case a new label was added
      loadChapterLabels();
      
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update entry:', error);
      alert('Failed to update entry');
    }
  };

  const handleDelete = async (id: string) => {
    if (showEditProtection('delete')) return;
    if (!username || !confirm('Delete this entry?')) return;
    try {
      await vocabularyApi.delete(username, id);
      loadEntries();
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  };

  const handleBatchUpload = async () => {
    if (!username || !batchText.trim()) return;
    
    // Validate chapter input
    const chapterNum = parseInt(batchChapter);
    if (!batchChapter.trim() || isNaN(chapterNum)) {
      alert('Please enter a valid chapter number');
      return;
    }
    
    setBatchUploading(true);
    setBatchResult(null);
    try {
      console.log('Sending batch upload request:', { username, batchText, batchChapter: chapterNum, batchChapterLabel });
      const response = await vocabularyApi.batchUpload(username, batchText, chapterNum, batchChapterLabel || undefined);
      console.log('Batch upload response:', response.data);
      setBatchResult({
        success: response.data.success,
        failed: response.data.failed,
        total: response.data.total,
      });
      setBatchText('');
      setBatchChapterLabel(''); // Clear chapter label after upload
      loadChapters(); // Reload chapters in case new chapter was added
      loadChapterLabels(); // Reload chapter labels in case new label was added
      loadEntries();
    } catch (error: any) {
      console.error('Failed to batch upload:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Batch upload failed: ${errorMsg}`);
    } finally {
      setBatchUploading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map(e => e.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (!username || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected entries?`)) return;
    
    try {
      const deletePromises = Array.from(selectedIds).map(id => 
        vocabularyApi.delete(username, id)
      );
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      loadEntries();
    } catch (error) {
      console.error('Failed to batch delete:', error);
      alert('Some entries failed to delete');
      loadEntries();
    }
  };

  const handleBatchEditStart = () => {
    if (selectedIds.size === 0) {
      alert('Please select entries to edit');
      return;
    }
    
    // Initialize edit forms for selected entries
    const forms = new Map<string, Partial<VocabularyEntry>>();
    entries.filter(e => selectedIds.has(e.id)).forEach(entry => {
      forms.set(entry.id, { ...entry });
    });
    setBatchEditForms(forms);
    setBatchEditMode(true);
  };

  const handleBatchEditCancel = () => {
    setBatchEditMode(false);
    setBatchEditForms(new Map());
  };

  const handleBatchEditSave = async () => {
    if (!username) return;
    
    try {
      const updatePromises = Array.from(batchEditForms.entries()).map(([id, form]) =>
        vocabularyApi.update(username, id, form)
      );
      await Promise.all(updatePromises);
      
      // Update the local state with the saved changes
      setEntries(prevEntries =>
        prevEntries.map(entry => {
          const updatedForm = batchEditForms.get(entry.id);
          return updatedForm ? { ...entry, ...updatedForm } : entry;
        })
      );
      
      // Reload chapter labels in case new labels were added
      loadChapterLabels();
      
      setBatchEditMode(false);
      setBatchEditForms(new Map());
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to batch update:', error);
      alert('Some entries failed to update');
      loadEntries();
    }
  };

  const updateBatchEditForm = (id: string, field: keyof VocabularyEntry, value: any) => {
    const newForms = new Map(batchEditForms);
    const form = newForms.get(id) || {};
    newForms.set(id, { ...form, [field]: value });
    setBatchEditForms(newForms);
  };

  const toggleBatchEditFavorite = (id: string) => {
    const newForms = new Map(batchEditForms);
    const form = newForms.get(id) || {};
    const currentFavorite = form.isFavorite !== undefined ? form.isFavorite : false;
    newForms.set(id, { ...form, isFavorite: !currentFavorite });
    setBatchEditForms(newForms);
  };

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    // Don't toggle if clicking on a button or input
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') {
      return;
    }
    
    toggleSelection(id);
  };

  const handleCheckboxChange = (id: string) => {
    toggleSelection(id);
  };

  const handleToggleFavorite = async (id: string) => {
    if (showEditProtection('favorite')) return;
    if (!username) return;
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    try {
      await vocabularyApi.update(username, id, { isFavorite: !entry.isFavorite });
      setEntries(prevEntries =>
        prevEntries.map(e =>
          e.id === id ? { ...e, isFavorite: !e.isFavorite } : e
        )
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  // Filter entries based on batch edit mode and favorites filter
  let displayedEntries = batchEditMode 
    ? entries.filter(e => selectedIds.has(e.id))
    : entries;
  
  // Apply favorites filter (from button - kept for backward compatibility)
  if (showFavoritesOnly) {
    displayedEntries = displayedEntries.filter(e => e.isFavorite);
  }

  // Apply column filters
  if (columnFilters.favorite === 'favorites') {
    displayedEntries = displayedEntries.filter(e => e.isFavorite);
  } else if (columnFilters.favorite === 'non-favorites') {
    displayedEntries = displayedEntries.filter(e => !e.isFavorite);
  }
  
  if (columnFilters.chinese) {
    displayedEntries = displayedEntries.filter(e => 
      e.chineseCharacter.toLowerCase().includes(columnFilters.chinese.toLowerCase())
    );
  }
  if (columnFilters.pinyin) {
    displayedEntries = displayedEntries.filter(e => 
      e.pinyin.toLowerCase().includes(columnFilters.pinyin.toLowerCase())
    );
  }
  if (columnFilters.hanVietnamese) {
    displayedEntries = displayedEntries.filter(e => 
      e.hanVietnamese?.toLowerCase().includes(columnFilters.hanVietnamese.toLowerCase())
    );
  }
  if (columnFilters.modernVietnamese) {
    displayedEntries = displayedEntries.filter(e => 
      e.modernVietnamese?.toLowerCase().includes(columnFilters.modernVietnamese.toLowerCase())
    );
  }
  if (columnFilters.english) {
    displayedEntries = displayedEntries.filter(e => 
      e.englishMeaning?.toLowerCase().includes(columnFilters.english.toLowerCase())
    );
  }
  if (columnFilters.note) {
    displayedEntries = displayedEntries.filter(e => 
      e.learningNote?.toLowerCase().includes(columnFilters.note.toLowerCase())
    );
  }

  // Sort entries by chapter first, then alphabetically by Pinyin within each chapter
  displayedEntries = displayedEntries.sort((a, b) => {
    // First sort by chapter
    if (a.chapter !== b.chapter) {
      return a.chapter - b.chapter;
    }
    // Then sort alphabetically by Pinyin within the same chapter
    return a.pinyin.localeCompare(b.pinyin, 'zh-CN');
  });

  return (
    <div className="vocabulary-management">
      <h2>Vocabulary Management - {username}</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '15px' }}>
          Filter by Chapter: 
          <select 
            value={selectedChapter || ''} 
            onChange={(e) => setSelectedChapter(e.target.value ? parseInt(e.target.value) : null)}
            disabled={!!selectedChapterLabel}
            style={{ marginLeft: '10px' }}
          >
            <option value="">All Chapters</option>
            {availableChapters.map(chapter => (
              <option key={chapter} value={chapter}>Chapter {chapter}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '15px', opacity: selectedChapterLabel ? 1 : 0.7 }}>
          Filter by Chapter Label: 
          <select 
            value={selectedChapterLabel || ''} 
            onChange={(e) => {
              const value = e.target.value;
              setSelectedChapterLabel(value || null);
              // Clear chapter filter when label is selected
              if (value) {
                setSelectedChapter(null);
              }
            }}
            style={{ marginLeft: '10px' }}
          >
            <option value="">No Label Filter</option>
            {availableChapterLabels.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          style={{
            marginRight: '15px',
            backgroundColor: showFavoritesOnly ? '#ffc107' : '#f8f9fa',
            color: showFavoritesOnly ? 'white' : '#333',
            border: '1px solid #dee2e6',
            padding: '5px 15px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showFavoritesOnly ? '★ Favorites Only' : '☆ Show All'}
        </button>
        <button
          onClick={() => {
            // Clear all filters
            setSelectedChapter(null);
            setSelectedChapterLabel(null);
            setShowFavoritesOnly(false);
            setColumnFilters({
              favorite: 'all',
              chinese: '',
              pinyin: '',
              hanVietnamese: '',
              modernVietnamese: '',
              english: '',
              note: ''
            });
          }}
          style={{
            marginLeft: '15px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: '1px solid #dc3545',
            padding: '5px 15px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          title="Clear all filters (chapter, favorites, and column filters)"
        >
          🗑️ Clear All Filters
        </button>
        <span style={{ color: '#666', fontSize: '14px', marginLeft: '15px' }}>
          ({displayedEntries.length} {showFavoritesOnly ? 'favorites' : 'entries'})
        </span>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setShowBatchUpload(!showBatchUpload)}>
          {showBatchUpload ? 'Hide Batch Upload' : 'Batch Upload'}
        </button>
        {selectedIds.size > 0 && !batchEditMode && (
          <>
            <button 
              onClick={handleBatchEditStart}
              style={{ marginLeft: '10px', backgroundColor: '#007bff', color: 'white' }}
            >
              Batch Edit ({selectedIds.size})
            </button>
            <button 
              onClick={handleBatchDelete}
              style={{ marginLeft: '10px', backgroundColor: '#dc3545', color: 'white' }}
            >
              Delete Selected ({selectedIds.size})
            </button>
          </>
        )}
        {batchEditMode && (
          <>
            <button 
              onClick={handleBatchEditSave}
              style={{ marginLeft: '10px', backgroundColor: '#28a745', color: 'white' }}
            >
              Save All Changes
            </button>
            <button 
              onClick={handleBatchEditCancel}
              style={{ marginLeft: '10px', backgroundColor: '#6c757d', color: 'white' }}
            >
              Cancel Batch Edit
            </button>
          </>
        )}
      </div>

      {showBatchUpload && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
          <h3>Batch Upload Chinese Characters</h3>
          <p>Enter Chinese characters separated by comma (,), semicolon (;), or newline (Enter)</p>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder="例如: 你,好,世,界 or 你;好;世;界 or one per line"
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}
            disabled={batchUploading}
            {...getInputProps('zh')}
          />
          <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            <label style={{ flex: '0 1 auto' }}>
              Chapter: 
              <input
                type="number"
                value={batchChapter}
                onChange={(e) => setBatchChapter(e.target.value)}
                style={{ marginLeft: '10px', width: 'clamp(60px, 100%, 100px)', boxSizing: 'border-box' }}
                disabled={batchUploading}
                placeholder="Chapter"
              />
            </label>
            <label style={{ flex: '0 1 auto' }}>
              Chapter Label (optional): 
              <input
                type="text"
                value={batchChapterLabel}
                onChange={(e) => setBatchChapterLabel(e.target.value)}
                style={{ marginLeft: '10px', width: 'clamp(150px, 100%, 250px)', boxSizing: 'border-box' }}
                disabled={batchUploading}
                placeholder="e.g., Introduction, Review"
                {...getInputProps('en')}
              />
            </label>
          </div>
          <button 
            onClick={handleBatchUpload} 
            disabled={batchUploading || !batchText.trim()}
          >
            {batchUploading ? 'Uploading...' : 'Upload'}
          </button>
          {batchResult && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '3px' }}>
              <strong>Upload Complete:</strong> {batchResult.success} succeeded, {batchResult.failed} failed out of {batchResult.total} total
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '12px',
        tableLayout: 'fixed'
      }}>
        <colgroup>
          <col style={{ width: '30px' }} />
          <col style={{ width: '30px' }} />
          <col style={{ width: '30px' }} />
          <col style={{ width: '60px' }} />
          <col style={{ width: '70px' }} />
          <col style={{ width: '80px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '50px' }} />
          <col style={{ width: '80px' }} />
          <col style={{ width: '120px' }} />
          <col style={{ width: '80px' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ padding: '4px 2px', textAlign: 'center' }}>#</th>
            <th style={{ padding: '4px 2px', textAlign: 'center' }}>
              <input 
                type="checkbox" 
                checked={selectedIds.size === entries.length && entries.length > 0}
                onChange={toggleSelectAll}
              />
            </th>
            <th style={{ padding: '4px 2px', textAlign: 'center' }}>★</th>
            <th style={{ padding: '4px 2px' }}>Chinese</th>
            <th style={{ padding: '4px 2px' }}>Pinyin</th>
            <th style={{ padding: '4px 2px' }}>Han Viet</th>
            <th style={{ padding: '4px 2px' }}>Mod Viet</th>
            <th style={{ padding: '4px 2px' }}>English</th>
            <th style={{ padding: '4px 2px', textAlign: 'center', display: isSmallScreen ? 'none' : 'table-cell' }}>Ch</th>
            <th style={{ padding: '4px 2px', display: isSmallScreen ? 'none' : 'table-cell' }}>Label</th>
            <th style={{ padding: '4px 2px', display: isSmallScreen ? 'none' : 'table-cell' }}>Note</th>
            <th style={{ padding: '4px 2px' }}>Actions</th>
          </tr>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <th style={{ padding: '2px' }}></th>
            <th style={{ padding: '2px' }}></th>
            <th style={{ padding: '2px' }}>
              <select
                value={columnFilters.favorite}
                onChange={(e) => setColumnFilters({ ...columnFilters, favorite: e.target.value })}
                style={{
                  width: '100%',
                  padding: '2px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="all">All</option>
                <option value="favorites">★</option>
                <option value="non-favorites">☆</option>
              </select>
            </th>
            <th style={{ padding: '2px' }}>
              <input
                type="text"
                placeholder="..."
                value={columnFilters.chinese}
                onChange={(e) => setColumnFilters({ ...columnFilters, chinese: e.target.value })}
                style={{
                  width: '100%',
                  padding: '2px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  boxSizing: 'border-box'
                }}
                {...getInputProps('zh')}
              />
            </th>
            <th style={{ padding: '2px' }}>
              <input
                type="text"
                placeholder="..."
                value={columnFilters.pinyin}
                onChange={(e) => setColumnFilters({ ...columnFilters, pinyin: e.target.value })}
                style={{
                  width: '100%',
                  padding: '2px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  boxSizing: 'border-box'
                }}
                {...getInputProps('zh')}
              />
            </th>
            <th style={{ padding: '2px' }}>
              <input
                type="text"
                placeholder="..."
                value={columnFilters.hanVietnamese}
                onChange={(e) => setColumnFilters({ ...columnFilters, hanVietnamese: e.target.value })}
                style={{
                  width: '100%',
                  padding: '2px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  boxSizing: 'border-box'
                }}
                {...getInputProps('vi')}
              />
            </th>
            <th style={{ padding: '2px' }}>
              <input
                type="text"
                placeholder="..."
                value={columnFilters.modernVietnamese}
                onChange={(e) => setColumnFilters({ ...columnFilters, modernVietnamese: e.target.value })}
                style={{
                  width: '100%',
                  padding: '2px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  boxSizing: 'border-box'
                }}
                {...getInputProps('vi')}
              />
            </th>
            <th style={{ padding: '2px' }}>
              <input
                type="text"
                placeholder="..."
                value={columnFilters.english}
                onChange={(e) => setColumnFilters({ ...columnFilters, english: e.target.value })}
                style={{
                  width: '100%',
                  padding: '2px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  boxSizing: 'border-box'
                }}
                {...getInputProps('en')}
              />
            </th>
            <th style={{ padding: '2px' }}></th>
            <th style={{ padding: '2px', display: isSmallScreen ? 'none' : 'table-cell' }}></th>
            <th style={{ padding: '2px', display: isSmallScreen ? 'none' : 'table-cell' }}>
              <input
                type="text"
                placeholder="..."
                value={columnFilters.note}
                onChange={(e) => setColumnFilters({ ...columnFilters, note: e.target.value })}
                style={{
                  width: '100%',
                  padding: '2px',
                  fontSize: '11px',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  boxSizing: 'border-box'
                }}
                {...getInputProps('vi')}
              />
            </th>
            <th style={{ padding: '2px' }}></th>
          </tr>
        </thead>
        <tbody>
          {displayedEntries.map((entry, index) => (
            <>
            <tr 
              key={entry.id}
              onClick={(e) => !batchEditMode && editingId !== entry.id && handleRowClick(entry.id, e)}
              style={{ 
                cursor: batchEditMode || editingId === entry.id ? 'default' : 'pointer',
                backgroundColor: selectedIds.has(entry.id) ? '#e3f2fd' : 'transparent'
              }}
            >
              <td style={{ textAlign: 'center', color: '#999', fontSize: '11px', padding: '4px 2px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {index + 1}
              </td>
              {batchEditMode ? (
                // Batch edit mode - all fields editable
                <>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={true}
                      disabled
                    />
                  </td>
                  <td 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBatchEditFavorite(entry.id);
                    }}
                    style={{ 
                      textAlign: 'center', 
                      fontSize: '20px', 
                      color: (batchEditForms.get(entry.id)?.isFavorite !== undefined 
                        ? batchEditForms.get(entry.id)?.isFavorite 
                        : entry.isFavorite) ? '#ffc107' : '#ccc',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title={(batchEditForms.get(entry.id)?.isFavorite !== undefined 
                      ? batchEditForms.get(entry.id)?.isFavorite 
                      : entry.isFavorite) ? 'Click to remove from favorites' : 'Click to add to favorites'}
                  >
                    {(batchEditForms.get(entry.id)?.isFavorite !== undefined 
                      ? batchEditForms.get(entry.id)?.isFavorite 
                      : entry.isFavorite) ? '★' : '☆'}
                  </td>
                  <td>
                    <input
                      value={batchEditForms.get(entry.id)?.chineseCharacter || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'chineseCharacter', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('zh')}
                    />
                  </td>
                  <td>
                    <input
                      value={batchEditForms.get(entry.id)?.pinyin || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'pinyin', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('zh')}
                    />
                  </td>
                  <td>
                    <input
                      value={batchEditForms.get(entry.id)?.hanVietnamese || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'hanVietnamese', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('vi')}
                    />
                  </td>
                  <td>
                    <input
                      value={batchEditForms.get(entry.id)?.modernVietnamese || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'modernVietnamese', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('vi')}
                    />
                  </td>
                  <td>
                    <input
                      value={batchEditForms.get(entry.id)?.englishMeaning || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'englishMeaning', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('en')}
                    />
                  </td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>
                    <input
                      type="number"
                      value={batchEditForms.get(entry.id)?.chapter || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'chapter', parseInt(e.target.value))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                    />
                  </td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>
                    <input
                      value={batchEditForms.get(entry.id)?.chapterLabel || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'chapterLabel', e.target.value)}
                      placeholder="Optional"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('en')}
                    />
                  </td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>
                    <input
                      value={batchEditForms.get(entry.id)?.learningNote || ''}
                      onChange={(e) => updateBatchEditForm(entry.id, 'learningNote', e.target.value)}
                      placeholder="Note"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('vi')}
                    />
                  </td>
                  <td>
                    {/* No actions in batch edit mode */}
                  </td>
                </>
              ) : editingId === entry.id ? (
                <>
                  <td>
                    <input 
                      type="checkbox" 
                      disabled
                    />
                  </td>
                  <td 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditForm({ ...editForm, isFavorite: !editForm.isFavorite });
                    }}
                    style={{ 
                      textAlign: 'center', 
                      fontSize: '20px', 
                      color: editForm.isFavorite ? '#ffc107' : '#ccc',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title={editForm.isFavorite ? 'Click to remove from favorites' : 'Click to add to favorites'}
                  >
                    {editForm.isFavorite ? '★' : '☆'}
                  </td>
                  <td>
                    <input
                      value={editForm.chineseCharacter || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, chineseCharacter: e.target.value })
                      }
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('zh')}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.pinyin || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, pinyin: e.target.value })
                      }
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('zh')}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.hanVietnamese || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, hanVietnamese: e.target.value })
                      }
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('vi')}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.modernVietnamese || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, modernVietnamese: e.target.value })
                      }
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('vi')}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.englishMeaning || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, englishMeaning: e.target.value })
                      }
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('en')}
                    />
                  </td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>
                    <input
                      type="number"
                      value={editForm.chapter || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, chapter: parseInt(e.target.value) })
                      }
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                    />
                  </td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>
                    <input
                      value={editForm.chapterLabel || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, chapterLabel: e.target.value })
                      }
                      placeholder="Optional"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('en')}
                    />
                  </td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>
                    <input
                      value={editForm.learningNote || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, learningNote: e.target.value })
                      }
                      placeholder="Note"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '2px', fontSize: '12px' }}
                      {...getInputProps('vi')}
                    />
                  </td>
                  <td>
                    <button onClick={handleSave} style={{ marginRight: '3px', backgroundColor: '#28a745', color: 'white', padding: '2px 6px', fontSize: '11px' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ backgroundColor: '#6c757d', color: 'white', padding: '2px 6px', fontSize: '11px' }}>Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(entry.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCheckboxChange(entry.id);
                      }}
                    />
                  </td>
                  <td 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(entry.id);
                    }}
                    style={{ 
                      textAlign: 'center', 
                      fontSize: '20px', 
                      color: entry.isFavorite ? '#ffc107' : '#ccc',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    title={entry.isFavorite ? 'Click to remove from favorites' : 'Click to add to favorites'}
                  >
                    {entry.isFavorite ? '★' : '☆'}
                  </td>
                  <td>{entry.chineseCharacter}</td>
                  <td>{entry.pinyin}</td>
                  <td>{entry.hanVietnamese || '-'}</td>
                  <td>{entry.modernVietnamese || '-'}</td>
                  <td>{entry.englishMeaning || '-'}</td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>{entry.chapter}</td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell' }}>{entry.chapterLabel || '-'}</td>
                  <td style={{ display: isSmallScreen ? 'none' : 'table-cell', fontSize: '11px', color: '#666', maxHeight: '80px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '8px 4px' }}>{entry.learningNote || '-'}</td>
                  <td>
                    <button onClick={() => handleEdit(entry)} style={{ marginRight: '3px', padding: '2px 6px', fontSize: '11px' }}>Edit</button>
                    <button onClick={() => handleDelete(entry.id)} style={{ backgroundColor: '#dc3545', color: 'white', padding: '2px 6px', fontSize: '11px' }}>Del</button>
                  </td>
                </>
              )}
            </tr>
            {isSmallScreen && editingId !== entry.id && !batchEditMode && (
              <tr style={{ backgroundColor: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
                <td colSpan={9} style={{ padding: '8px 12px', fontSize: '11px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <strong>Ch:</strong> {entry.chapter}
                    </div>
                    <div>
                      <strong>Label:</strong> {entry.chapterLabel || '-'}
                    </div>
                    <div>
                      <strong>Note:</strong> <span style={{ color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block', marginTop: '4px' }}>{entry.learningNote || '-'}</span>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {(editingId === entry.id || batchEditMode) && (
              <tr style={{ backgroundColor: '#f8f9fa', borderTop: '2px solid #dee2e6' }}>
                <td colSpan={12} style={{ padding: '12px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                      Learning Note:
                    </label>
                    <textarea
                      value={batchEditMode ? (batchEditForms.get(entry.id)?.learningNote || '') : (editForm.learningNote || '')}
                      onChange={(e) => {
                        if (batchEditMode) {
                          updateBatchEditForm(entry.id, 'learningNote', e.target.value);
                        } else {
                          setEditForm({ ...editForm, learningNote: e.target.value });
                        }
                      }}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                      }}
                      placeholder="Add learning notes here..."
                      {...getInputProps('vi')}
                    />
                  </div>
                </td>
              </tr>
            )}
            </>
          ))}
        </tbody>
      </table>
      </div>

      {/* Mobile Edit Modal - shows a fixed overlay on small screens */}
      {editingId && isSmallScreen && (
        <>
          <div
            onClick={() => setEditingId(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 2000
            }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'white',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
              zIndex: 2001,
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '20px 16px',
              paddingBottom: '40px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Edit: {editForm.chineseCharacter}</h3>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
                Chinese Character
                <input
                  value={editForm.chineseCharacter || ''}
                  onChange={(e) => setEditForm({ ...editForm, chineseCharacter: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box', marginTop: '4px' }}
                  {...getInputProps('zh')}
                />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
                Pinyin
                <input
                  value={editForm.pinyin || ''}
                  onChange={(e) => setEditForm({ ...editForm, pinyin: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box', marginTop: '4px' }}
                  {...getInputProps('zh')}
                />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
                Hán Việt
                <input
                  value={editForm.hanVietnamese || ''}
                  onChange={(e) => setEditForm({ ...editForm, hanVietnamese: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box', marginTop: '4px' }}
                  {...getInputProps('vi')}
                />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
                Modern Vietnamese
                <input
                  value={editForm.modernVietnamese || ''}
                  onChange={(e) => setEditForm({ ...editForm, modernVietnamese: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box', marginTop: '4px' }}
                  {...getInputProps('vi')}
                />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
                English Meaning
                <input
                  value={editForm.englishMeaning || ''}
                  onChange={(e) => setEditForm({ ...editForm, englishMeaning: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box', marginTop: '4px' }}
                  {...getInputProps('en')}
                />
              </label>

              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
                Learning Note
                <textarea
                  value={editForm.learningNote || ''}
                  onChange={(e) => setEditForm({ ...editForm, learningNote: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box', marginTop: '4px', fontFamily: 'inherit', resize: 'vertical' }}
                  {...getInputProps('vi')}
                />
              </label>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleSave}
                  style={{ flex: 1, padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{ flex: 1, padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Scroll to top"
        >
          ↑
        </button>
      )}
    </div>
  );
}
