import axios from 'axios';
import { Platform } from 'react-native';

// API Configuration for different environments:
// - Android Emulator: Use 10.0.2.2 (special IP that maps to host's localhost)
// - iOS Simulator: Use localhost
// - Physical Device: Use your computer's IP address (find with ipconfig on Windows)

const getApiBaseUrl = () => {
  if (__DEV__) {
    // Development mode
    if (Platform.OS === 'android') {
      // Android emulator uses special IP to access host machine
      return 'http://10.0.2.2:3000/api';
    }
    // iOS simulator can use localhost
    return 'http://localhost:3000/api';
  }
  
  // Production mode - update this with your production API URL
  return 'https://your-production-api.com/api';
};

const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Flashcard {
  id: string;
  mode: 'ChineseToMeanings' | 'EnglishToChinese' | 'VietnameseToChinese';
  question: {
    displayText: string;
    fieldType: 'chinese' | 'english' | 'vietnamese';
  };
}

export interface FlashcardAnswer {
  chinese?: string;
  pinyin?: string;
  hanVietnamese?: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  learningNote?: string;
}

export interface GeneratedText {
  chineseText: string;
  pinyin: string;
  wordCount: number;
}

export interface CharacterInfo {
  chineseCharacter: string;
  pinyin: string;
  hanVietnamese?: string;
  modernVietnamese?: string;
  englishMeaning?: string;
  learningNote?: string;
}

export const flashcardApi = {
  getNext: (username: string, mode: string, chapterStart: number, chapterEnd: number) =>
    apiClient.get<Flashcard>(`/${username}/flashcard/next`, {
      params: { mode, chapterStart, chapterEnd },
    }),

  getAnswer: (username: string, flashcardId: string) =>
    apiClient.get<FlashcardAnswer>(`/${username}/flashcard/${flashcardId}/answer`),
};

export const comprehensionApi = {
  generate: (username: string, chapterStart: number, chapterEnd: number) =>
    apiClient.get<GeneratedText>(`/${username}/comprehension/generate`, {
      params: { chapterStart, chapterEnd },
    }),

  getCharacterInfo: (username: string, character: string) =>
    apiClient.get<CharacterInfo>(`/${username}/comprehension/character-info`, {
      params: { character },
    }),
};

export const ttsApi = {
  pronounce: (text: string) =>
    apiClient.get(`/tts/pronounce`, {
      params: { text },
      responseType: 'blob',
    }),
};
