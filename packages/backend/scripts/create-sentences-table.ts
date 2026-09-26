import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function createSentencesTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chinese_learning_app'
  });

  try {
    console.log('Connected to database');
    
    // Create pre_generated_sentences table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pre_generated_sentences (
        id VARCHAR(36) PRIMARY KEY,
        vocab_group_id INT NOT NULL,
        chinese_text TEXT NOT NULL,
        pinyin TEXT NOT NULL,
        english_meaning TEXT,
        modern_vietnamese TEXT,
        used_characters JSON NOT NULL,
        generation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_vocab_group (vocab_group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✓ pre_generated_sentences table created successfully');
    
    // Verify table structure
    const [rows] = await connection.query(`
      DESCRIBE pre_generated_sentences;
    `);
    
    console.log('\nTable structure:');
    console.table(rows);
    
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  } finally {
    await connection.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the migration
createSentencesTable()
  .then(() => {
    console.log('\n✓ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
