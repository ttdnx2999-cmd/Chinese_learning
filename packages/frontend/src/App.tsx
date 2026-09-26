import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserMenu } from './components/UserMenu';
import { apiClient } from './api/client';
import LoginPage from './pages/LoginPage';
import AdminTestPage from './pages/AdminTestPage';
import VocabularyManagement from './pages/VocabularyManagement';
import VocabularyUpload from './pages/VocabularyUpload';
import VocabularySharing from './pages/VocabularySharing';
import DatabaseAdmin from './pages/DatabaseAdmin';
import PhrasesPage from './pages/PhrasesPage';
import VietnamesePhrasesPage from './pages/VietnamesePhrasesPage';
import FlashcardPage from './pages/FlashcardPage';
import ChapterFlashcardPage from './pages/ChapterFlashcardPage';
import ImagenWorkspaceDetailPage from './pages/ImagenWorkspaceDetailPage';
import AdminPanelPage from './pages/AdminPanelPage';

/**
 * Navigation Component
 * Only shown when user is authenticated
 */
function Navigation() {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  if (!user) {
    return null;
  }

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#007bff',
      zIndex: 2000,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 12px'
    }}>
      {/* Hamburger Menu Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        <span style={{ fontSize: '20px' }}>☰</span>
        <span>Menu</span>
      </button>

      {/* User Menu */}
      <UserMenu />

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeMenu}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 2001
            }}
          />
          
          {/* Menu Panel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '280px',
              height: '100vh',
              backgroundColor: 'white',
              boxShadow: '2px 0 8px rgba(0,0,0,0.2)',
              zIndex: 2002,
              overflowY: 'auto'
            }}
          >
            <div style={{
              padding: '20px',
              backgroundColor: '#007bff',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Navigation</h2>
              <button
                onClick={closeMenu}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'white',
                  fontSize: '28px',
                  cursor: 'pointer',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>
            
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              <li>
                <Link
                  to="/"
                  onClick={closeMenu}
                  style={styles.navLink}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🏠 Home
                </Link>
              </li>
              <li>
                <Link
                  to="/vocabulary"
                  onClick={closeMenu}
                  style={styles.navLink}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📚 Vocabulary Management
                </Link>
              </li>
              {user?.role !== 'child' && (
                <li>
                  <Link
                    to="/vocabulary-upload"
                    onClick={closeMenu}
                    style={styles.navLink}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    📤 Upload Vocabulary
                  </Link>
                </li>
              )}
              {user?.role !== 'child' && (
                <li>
                  <Link
                    to="/vocabulary-sharing"
                    onClick={closeMenu}
                    style={styles.navLink}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🔗 Share Vocabulary
                  </Link>
                </li>
              )}
              {(user.role === 'admin' || user.role === 'parent') && (
              <li>
                <Link
                  to="/database-admin"
                  onClick={closeMenu}
                  style={styles.navLink}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🗄️ Database Admin
                </Link>
              </li>
              )}
              <li>
                <Link
                  to="/phrases"
                  onClick={closeMenu}
                  style={styles.navLink}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🇨🇳 Phrases (Chinese)
                </Link>
              </li>
              <li>
                <Link
                  to="/vietnamese-phrases"
                  onClick={closeMenu}
                  style={styles.navLink}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🇻🇳 Vietnamese Phrases
                </Link>
              </li>
              <li>
                <Link
                  to="/flashcards"
                  onClick={closeMenu}
                  style={styles.navLink}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  ⭐ Flashcards (Favorites)
                </Link>
              </li>
              <li>
                <Link
                  to="/chapter-flashcards"
                  onClick={closeMenu}
                  style={styles.navLink}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📖 Flashcards (Chapters)
                </Link>
              </li>
              {user?.role === 'admin' && (
                <li>
                  <Link
                    to="/admin"
                    onClick={closeMenu}
                    style={styles.navLink}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    👑 Admin Panel
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </nav>
  );
}

/**
 * Main App Component
 */
function AppContent() {
  return (
    <>
      <Navigation />
      <main style={{
        paddingTop: '60px',
        paddingBottom: '20px'
      }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin-test" element={<AdminTestPage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vocabulary"
            element={
              <ProtectedRoute>
                <VocabularyWrapper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vocabulary-upload"
            element={
              <ProtectedRoute>
                <VocabularyUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vocabulary-sharing"
            element={
              <ProtectedRoute>
                <VocabularySharing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/database-admin"
            element={
              <ProtectedRoute requiredRoles={['admin', 'parent']}>
                <DatabaseAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phrases"
            element={
              <ProtectedRoute>
                <PhrasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vietnamese-phrases"
            element={
              <ProtectedRoute>
                <VietnamesePhrasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flashcards"
            element={
              <ProtectedRoute>
                <FlashcardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chapter-flashcards"
            element={
              <ProtectedRoute>
                <ChapterFlashcardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AdminPanelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/imagen-workspace/:workspaceId"
            element={
              <ProtectedRoute>
                <ImagenWorkspaceDetailPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </>
  );
}

/**
 * Vocabulary Wrapper Component
 * Determines whether to show the current user's vocabulary or their parent's
 * For children: shows parent's vocabulary (read-only)
 * For parents/admins: shows their own vocabulary
 */
function VocabularyWrapper() {
  const { user } = useAuth();
  const [parentUsername, setParentUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchParentUsername = async () => {
      if (user.role === 'child' && user.parentId) {
        // Child user - need to fetch parent's username
        setIsLoading(true);
        try {
          // We need to get the parent's username from their ID
          // Since we don't have a direct endpoint for this, we'll use the API client
          const response = await apiClient.get(`/admin/users/${user.parentId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
          setParentUsername(response.data.username);
        } catch (error) {
          console.error('Failed to fetch parent username:', error);
          // Fallback: show child's own vocabulary if parent lookup fails
          setParentUsername(user.username);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Parent or admin - show their own vocabulary
        setParentUsername(null);
      }
    };

    fetchParentUsername();
  }, [user]);

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>;
  }

  const usernameToShow = parentUsername || user?.username;

  return (
    <div>
      {user?.role === 'child' && parentUsername && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d9ff',
          borderRadius: '6px',
          color: '#004085'
        }}>
          📖 Viewing parent's vocabulary (read-only)
        </div>
      )}
      <VocabularyManagement username={usernameToShow} />
    </div>
  );
}

/**
 * Home Page
 */
function HomePage() {
  const { user } = useAuth();

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h1 style={{
        fontSize: '32px',
        marginBottom: '20px'
      }}>
        🇨🇳 Welcome to Chinese Learning App
      </h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        <div style={{
          padding: '20px',
          backgroundColor: '#f0f8ff',
          borderRadius: '8px',
          border: '1px solid #007bff'
        }}>
          <h2 style={{ marginTop: '0' }}>👤 Your Profile</h2>
          <p><strong>Username:</strong> {user?.username}</p>
          <p><strong>Role:</strong> {user?.role === 'admin' ? '👑 Admin' : user?.role === 'parent' ? '👨‍👩‍👧 Parent' : 'Child'}</p>
          {user?.parentId && (
            <p><strong>Linked to:</strong> Parent Account (ID: {user.parentId})</p>
          )}
        </div>

        {user?.role !== 'child' && (
          <div style={{
            padding: '20px',
            backgroundColor: '#fff8f0',
            borderRadius: '8px',
            border: '1px solid #ff9800'
          }}>
            <h2 style={{ marginTop: '0' }}>📚 Getting Started</h2>
            <ul>
              <li>📤 Upload your vocabulary list</li>
              <li>⭐ Mark favorite words</li>
              <li>📖 Review flashcards</li>
              <li>🌍 Practice Chinese-Vietnamese translation</li>
            </ul>
          </div>
        )}

        <div style={{
          padding: '20px',
          backgroundColor: '#f0fff4',
          borderRadius: '8px',
          border: '1px solid #4caf50'
        }}>
          <h2 style={{ marginTop: '0' }}>🎯 Features</h2>
          <ul>
            <li>AI-powered text generation</li>
            <li>Persistent progress tracking</li>
            <li>Multi-platform support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Main App with Provider
 */
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

const styles = {
  navLink: {
    display: 'block',
    padding: '15px 20px',
    color: '#333',
    textDecoration: 'none',
    borderBottom: '1px solid #eee',
    transition: 'background-color 0.2s'
  } as React.CSSProperties
};
