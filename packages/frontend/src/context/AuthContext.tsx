/**
 * Authentication Context
 * 
 * Provides global authentication state and methods across the app.
 * - Manages user login/logout
 * - Persists token in localStorage
 * - Auto-loads token on app startup
 * - Provides token to API requests
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { apiClient } from '../api/client';

/**
 * User role types
 */
export type UserRole = 'admin' | 'parent' | 'child';

/**
 * User info from JWT payload
 */
export interface User {
  temporaryAdmin?: boolean;
  userId: number;
  username: string;
  role: UserRole;
  parentId: number | null;
}

/**
 * Auth context type
 */
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, secretPhrase: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'auth_token';
const TOKEN_CHECK_INTERVAL = 60000; // Check token validity every minute

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Decode JWT and extract user info
   */
  const decodeToken = (jwtToken: string): User | null => {
    try {
      const decoded = jwtDecode<User>(jwtToken);
      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        parentId: decoded.parentId,
        temporaryAdmin: decoded.temporaryAdmin
      };
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  };

  /**
   * Initialize auth from localStorage on app startup
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem(STORAGE_KEY);

        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        // Verify token is still valid
        try {
          const response = await apiClient.get('/auth/verify', {
            params: { token: storedToken }
          });

          if (response.data.valid && response.data.user) {
            const decodedUser = decodeToken(storedToken);
            if (decodedUser) {
              setToken(storedToken);
              setUser(decodedUser);

              // Set token in axios default headers
              apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            }
          } else {
            // Token invalid, clear storage
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Periodic token validity check
   */
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      try {
        const response = await apiClient.get('/auth/verify', {
          params: { token }
        });

        if (!response.data.valid) {
          console.warn('Token expired, logging out');
          logout();
        }
      } catch (error) {
        console.error('Token verification error:', error);
      }
    }, TOKEN_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [token]);

  /**
   * Login with username and secret phrase
   */
  const login = async (username: string, secretPhrase: string) => {
    try {
      const response = await apiClient.post('/auth/login', {
        username,
        secretPhrase
      });

      const { token: newToken } = response.data;

      if (!newToken) {
        throw new Error('No token returned from server');
      }

      // Store token
      localStorage.setItem(STORAGE_KEY, newToken);

      // Decode and set user
      const decodedUser = decodeToken(newToken);
      if (!decodedUser) {
        throw new Error('Failed to decode token');
      }

      setToken(newToken);
      setUser(decodedUser);

      // Set token in axios default headers for future requests
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      console.log('[Auth] Token set in axios headers:', `Bearer ${newToken.substring(0, 20)}...`);
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  /**
   * Logout user
   */
  const logout = () => {
    // Clear storage
    localStorage.removeItem(STORAGE_KEY);

    // Clear state
    setToken(null);
    setUser(null);

    // Remove token from axios headers
    delete apiClient.defaults.headers.common['Authorization'];

    console.log('User logged out');
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    setUser,
    setToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}


