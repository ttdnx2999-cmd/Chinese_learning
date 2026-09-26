/**
 * Hook to handle keyboard language switching based on input field language requirements
 * 
 * On iOS/Android, sets appropriate inputMode and data attributes
 * to help browsers/IME suggest the correct keyboard
 * 
 * Supported languages:
 * - 'zh': Chinese (Pinyin/Zhuyin)
 * - 'vi': Vietnamese
 * - 'en': English
 */

export type KeyboardLanguage = 'zh' | 'vi' | 'en';

interface KeyboardConfig {
  language: KeyboardLanguage;
  inputMode: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | 'none';
  pattern?: string;
  autoCapitalize?: 'off' | 'on' | 'sentences' | 'words' | 'characters';
  autoCorrect?: 'off' | 'on';
  spellCheck?: boolean;
}

const KEYBOARD_CONFIGS: Record<KeyboardLanguage, KeyboardConfig> = {
  zh: {
    language: 'zh',
    inputMode: 'text',
    autoCapitalize: 'off',
    autoCorrect: 'off',
    spellCheck: false,
  },
  vi: {
    language: 'vi',
    inputMode: 'text',
    autoCapitalize: 'sentences',
    autoCorrect: 'on',
    spellCheck: true,
  },
  en: {
    language: 'en',
    inputMode: 'text',
    autoCapitalize: 'sentences',
    autoCorrect: 'on',
    spellCheck: true,
  },
};

/**
 * Get keyboard configuration for a specific language
 */
export function getKeyboardConfig(language: KeyboardLanguage): KeyboardConfig {
  return KEYBOARD_CONFIGS[language];
}

/**
 * Get input attributes for a specific language
 * Returns object that can be spread onto input/textarea elements
 */
export function getInputProps(language: KeyboardLanguage) {
  const config = getKeyboardConfig(language);
  return {
    inputMode: config.inputMode,
    lang: language === 'zh' ? 'zh-CN' : language === 'vi' ? 'vi-VN' : 'en-US',
    // Note: autoCapitalize, autoCorrect, spellCheck are only hints - not all are standard HTML attributes
    // Keep only the widely supported ones
  };
}

/**
 * Map field names to keyboard languages for vocabulary entries
 */
export function getFieldKeyboardLanguage(fieldName: string): KeyboardLanguage {
  switch (fieldName) {
    case 'chineseCharacter':
    case 'pinyin':
      return 'zh';
    case 'hanVietnamese':
    case 'modernVietnamese':
    case 'learningNote':
      return 'vi';
    case 'englishMeaning':
    case 'chapter':
    case 'chapterLabel':
    default:
      return 'en';
  }
}
