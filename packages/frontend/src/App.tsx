import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
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
 * Main App Component
 */
function AppContent() {
  const { user } = useAuth();
  return (
    <>
      <Navigation />
      <main id="main-content" tabIndex={-1} className={user ? "app-main" : "public-main"}>
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
