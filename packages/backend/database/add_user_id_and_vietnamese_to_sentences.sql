-- Migration: Add user_id and modern_vietnamese columns to pre_generated_sentences table
-- This enables user-specific phrase generation and Vietnamese translation storage

-- Step 1: Add user_id column (required for user isolation)
ALTER TABLE pre_generated_sentences 
ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER vocab_group_id,
ADD INDEX idx_user_id (user_id),
ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE;

-- Step 2: Add modern_vietnamese column (for Vietnamese translations)
ALTER TABLE pre_generated_sentences 
ADD COLUMN modern_vietnamese TEXT AFTER english_meaning;
