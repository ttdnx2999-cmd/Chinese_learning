-- Add english_meaning column to pre_generated_sentences table
-- This migration adds English translation support for batch-generated sentences
-- Note: The update.sh script checks if the column exists before running this

ALTER TABLE pre_generated_sentences 
ADD COLUMN english_meaning TEXT AFTER pinyin;
