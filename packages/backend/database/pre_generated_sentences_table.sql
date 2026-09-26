-- Create pre_generated_sentences table
CREATE TABLE IF NOT EXISTS pre_generated_sentences (
  id VARCHAR(36) PRIMARY KEY,
  vocab_group_id INT NOT NULL,
  chinese_text TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  english_meaning TEXT,
  used_characters JSON NOT NULL,
  generation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vocab_group (vocab_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
