-- Create database
CREATE DATABASE IF NOT EXISTS chinese_learning_app 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE chinese_learning_app;

-- Create vocabulary_entries table
CREATE TABLE IF NOT EXISTS vocabulary_entries (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  chinese_character VARCHAR(10) NOT NULL,
  pinyin VARCHAR(255) NOT NULL,
  han_vietnamese TEXT,
  modern_vietnamese TEXT,
  english_meaning TEXT,
  learning_note TEXT,
  chapter INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  shared_from VARCHAR(255),
  INDEX idx_username_chapter (username, chapter),
  INDEX idx_chapter (chapter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create vocabulary_sharing table
CREATE TABLE IF NOT EXISTS vocabulary_sharing (
  id VARCHAR(36) PRIMARY KEY,
  source_username VARCHAR(255) NOT NULL,
  target_username VARCHAR(255) NOT NULL,
  chapter INTEGER NOT NULL,
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  vocabulary_count INTEGER NOT NULL,
  UNIQUE KEY unique_share (source_username, target_username, chapter),
  INDEX idx_target_chapter (target_username, chapter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
