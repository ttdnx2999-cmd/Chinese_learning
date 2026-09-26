import axios from 'axios';

// Determine API URL based on environment and current protocol
const getApiBaseUrl = (): string => {
  // UNIQUE_MARKER_12345_HTTPS_FIX_V2
  // If VITE_API_URL is set, use it (for development)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // For production, detect the current page's protocol and use it for API calls
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol; // 'http:' or 'https:'
    const hostname = window.location.hostname; // e.g., 'localhost', 'localhost'
    const port = window.location.port;
    
    // Log for debugging
    console.log(`[API Config] Protocol: ${protocol}, Hostname: ${hostname}, Port: ${port}`);
    
    // Build full URL with detected protocol
    const hostPart = port ? `${hostname}:${port}` : hostname;
    const url = `${protocol}//${hostPart}/api`;
    
    console.log(`[API Config] Using URL with detected protocol: ${url}`);
    return url;
  }
  
  // Fallback for non-browser environments
  return 'http://localhost:3000/api';
};

const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to log all requests with authorization
apiClient.interceptors.request.use((config) => {
  const authHeader = config.headers.Authorization;
  console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
    hasAuth: !!authHeader,
    data: config.data
  });
  return config;
}, (error) => {
  console.error('[API] Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor to log responses
apiClient.interceptors.response.use((response) => {
  console.log(`[API] Response ${response.status} from ${response.config.url}`);
  return response;
}, (error) => {
  console.error(`[API] Error ${error.response?.status} from ${error.config?.url}:`, error.response?.data);
  return Promise.reject(error);
});

export interface VocabularyEntry {
  id: string;
  username: string;
  chineseCharacter: string;
  pinyin: string;
  hanVietnamese?: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  learningNote?: string;
  isFavorite?: boolean;
  chapter: number;
  chapterLabel?: string;
  createdAt: string;
  updatedAt: string;
  sharedFrom?: string;
}

export interface TranslationPreview {
  pinyin: string;
  modernVietnamese: string;
  englishMeaning: string;
}

export const vocabularyApi = {
  getAll: (username: string, chapterStart?: number, chapterEnd?: number) =>
    apiClient.get<VocabularyEntry[]>(`/${username}/vocabulary`, {
      params: { chapterStart, chapterEnd },
    }),

  getById: (username: string, id: string) =>
    apiClient.get<VocabularyEntry>(`/${username}/vocabulary/${id}`),

  create: (username: string, data: Partial<VocabularyEntry>) =>
    apiClient.post<VocabularyEntry>(`/${username}/vocabulary`, data),

  update: (username: string, id: string, data: Partial<VocabularyEntry>) =>
    apiClient.put<VocabularyEntry>(`/${username}/vocabulary/${id}`, data),

  delete: (username: string, id: string) =>
    apiClient.delete(`/${username}/vocabulary/${id}`),

  previewTranslation: (username: string, chineseCharacter: string, pinyin?: string, modernVietnamese?: string, englishMeaning?: string) =>
    apiClient.post<TranslationPreview>(`/${username}/vocabulary/translate`, {
      chineseCharacter,
      pinyin,
      modernVietnamese,
      englishMeaning,
    }),

  getChapters: (username: string) =>
    apiClient.get<number[]>(`/${username}/vocabulary/chapters`),

  getChapterLabels: (username: string) =>
    apiClient.get<string[]>(`/${username}/vocabulary/chapter-labels`),

  getByChapterLabel: (username: string, chapterLabel: string) =>
    apiClient.get<VocabularyEntry[]>(`/${username}/vocabulary`, {
      params: { chapterLabel }
    }),

  share: (username: string, sourceUsername: string, chapter: number) =>
    apiClient.post(`/${username}/vocabulary/share`, {
      sourceUsername,
      chapter,
    }),

  getSharedSources: (chapter: number) =>
    apiClient.get<string[]>(`/vocabulary/shared`, { params: { chapter } }),

  getAllUsers: () =>
    apiClient.get<string[]>(`/vocabulary/users`),

  createUser: (username: string) =>
    apiClient.post(`/vocabulary/users`, { username }),

  deleteUser: (username: string) =>
    apiClient.delete(`/vocabulary/users/${username}`),

  batchUpload: (username: string, characters: string, chapter: number, chapterLabel?: string) =>
    apiClient.post(`/${username}/vocabulary/batch`, { characters, chapter, chapterLabel }),
};

export const adminApi = {
  authenticate: (password: string, username: string) =>
    apiClient.post<{ success: boolean; token?: string; expiresIn?: number }>('/admin/authenticate', { password, username }),

  backup: (token: string, username?: string) =>
    apiClient.get('/admin/backup', { 
      headers: { Authorization: `Bearer ${token}` },
      params: username ? { username } : undefined
    }),

  restore: (restoreData: { backupFile: any; username?: string }, token: string) =>
    apiClient.post('/admin/restore', restoreData, {
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }),

  exportComplete: (token: string) =>
    apiClient.get('/admin/export-complete', {
      headers: { Authorization: `Bearer ${token}` }
    }),

  importComplete: (backupFile: any, token: string) =>
    apiClient.post('/admin/import-complete', { backupFile }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }),
};

export const ttsApi = {
  pronounce: (text: string) =>
    apiClient.get<{ audioUrl: string; format: string; duration: number }>('/tts/pronounce', {
      params: { text },
    }),
};
