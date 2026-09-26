-- Create users table
CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert existing user from vocabulary_entries
INSERT IGNORE INTO users (username)
SELECT DISTINCT username FROM vocabulary_entries;
