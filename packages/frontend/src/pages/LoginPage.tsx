/**
 * Login Page
 * 
 * Allows users to authenticate with username and secret phrase.
 * Handles login errors and redirects to main app on success.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [secretPhrase, setSecretPhrase] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!username.trim()) {
        throw new Error('Username is required');
      }

      if (!secretPhrase.trim()) {
        throw new Error('Secret phrase is required');
      }

      await login(username, secretPhrase);

      // Navigate to main app
      navigate('/');
    } catch (err: any) {
      console.error('Login failed:', err);
      
      if (err.response?.status === 401) {
        setError('Invalid username or secret phrase');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🇨🇳 Chinese Learning App</h1>
        <p style={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Username Input */}
          <div style={styles.formGroup}>
            <label htmlFor="username" style={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={isLoading}
              style={styles.input}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSubmit(e as any);
                }
              }}
            />
          </div>

          {/* Secret Phrase Input */}
          <div style={styles.formGroup}>
            <div style={styles.labelRow}>
              <label htmlFor="secretPhrase" style={styles.label}>
                Secret Phrase
              </label>
              <button
                type="button"
                onClick={() => setShowPhrase(!showPhrase)}
                style={styles.toggleButton}
                disabled={isLoading}
              >
                {showPhrase ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="secretPhrase"
              type={showPhrase ? 'text' : 'password'}
              value={secretPhrase}
              onChange={(e) => setSecretPhrase(e.target.value)}
              placeholder="Enter your secret phrase"
              disabled={isLoading}
              style={styles.input}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleSubmit(e as any);
                }
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {})
            }}
          >
            {isLoading ? '🔄 Signing in...' : '✓ Sign In'}
          </button>
        </form>

        {/* Help Text */}
        <div style={styles.helpBox}>
          <p style={styles.helpTitle}>💡 How it works</p>
          <p style={styles.helpText}>
            Enter your username and secret phrase to sign in. Your session will be remembered on this device for 30 days.
          </p>
        </div>
      </div>

      {/* Info Panel */}
      <div style={styles.infoPanel}>
        <h2 style={styles.infoPanelTitle}>About This App</h2>
        <ul style={styles.infoList}>
          <li>📚 Learn Chinese vocabulary through interactive flashcards</li>
          <li>🎯 AI-generated comprehension exercises</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  } as React.CSSProperties,

  card: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  } as React.CSSProperties,

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#333'
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '32px'
  } as React.CSSProperties,

  form: {
    width: '100%',
    maxWidth: '400px'
  } as React.CSSProperties,

  formGroup: {
    marginBottom: '20px'
  } as React.CSSProperties,

  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '6px'
  } as React.CSSProperties,

  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '0',
    fontWeight: '500'
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s'
  } as React.CSSProperties,

  button: {
    width: '100%',
    padding: '12px',
    marginTop: '24px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  } as React.CSSProperties,

  buttonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  } as React.CSSProperties,

  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    marginTop: '16px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    color: '#856404',
    fontSize: '14px'
  } as React.CSSProperties,

  errorIcon: {
    fontSize: '18px'
  } as React.CSSProperties,

  helpBox: {
    marginTop: '32px',
    padding: '16px',
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    borderRadius: '6px',
    maxWidth: '400px'
  } as React.CSSProperties,

  helpTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#004085',
    margin: '0 0 8px 0'
  } as React.CSSProperties,

  helpText: {
    fontSize: '13px',
    color: '#004085',
    margin: '0',
    lineHeight: '1.5'
  } as React.CSSProperties,

  infoPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '40px',
    backgroundColor: '#007bff',
    color: 'white'
  } as React.CSSProperties,

  infoPanelTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '24px',
    marginTop: '0'
  } as React.CSSProperties,

  infoList: {
    fontSize: '16px',
    lineHeight: '1.8',
    listStyle: 'none',
    padding: '0',
    margin: '0'
  } as React.CSSProperties
};
