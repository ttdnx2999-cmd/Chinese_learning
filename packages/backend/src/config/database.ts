import mysql from 'mysql2/promise';
import { config } from './env';

let pool: mysql.Pool;

export async function initDatabase() {
  pool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test connection
  const connection = await pool.getConnection();
  console.log('Database connection established');
  connection.release();

  // Create tables if they don't exist
  await createTables();
}

async function createTables() {
  const connection = await pool.getConnection();
  
  try {
    // Create new auth users table (with authentication support)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) UNIQUE NOT NULL,
        secret_phrase_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'parent', 'child') DEFAULT 'parent',
        parent_id INT,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES auth_users(id) ON DELETE SET NULL,
        INDEX idx_username (username),
        INDEX idx_role (role),
        INDEX idx_parent_id (parent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create legacy users table (for backward compatibility with existing vocabulary)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Create vocabulary_entries table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS vocabulary_entries (
        id VARCHAR(36) PRIMARY KEY,
        user_id INT NOT NULL,
        username VARCHAR(255) NOT NULL,
        chinese_character VARCHAR(10) NOT NULL,
        pinyin VARCHAR(255) NOT NULL,
        han_vietnamese TEXT,
        modern_vietnamese TEXT,
        english_meaning TEXT,
        learning_note TEXT,
        is_favorite TINYINT(1) DEFAULT 0,
        chapter INTEGER NOT NULL,
        chapter_label VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        shared_from VARCHAR(255),
        INDEX idx_user_id_chapter (user_id, chapter),
        INDEX idx_username_chapter (username, chapter),
        INDEX idx_chapter (chapter)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Add user_id column if it doesn't exist (migration for existing databases)
    try {
      await connection.query(`
        ALTER TABLE vocabulary_entries 
        ADD COLUMN user_id INT NOT NULL DEFAULT 0 AFTER id;
      `);
      console.log('user_id column added successfully');
      // Populate user_id from auth_users
      await connection.query(`
        UPDATE vocabulary_entries ve 
        JOIN auth_users au ON ve.username = au.username 
        SET ve.user_id = au.id
        WHERE ve.user_id = 0;
      `);
      console.log('user_id column populated from auth_users');
      // Add index
      try {
        await connection.query(`ALTER TABLE vocabulary_entries ADD INDEX idx_user_id_chapter (user_id, chapter);`);
      } catch (e: any) { /* index may already exist */ }
    } catch (error: any) {
      if (error.errno === 1060) {
        console.log('user_id column already exists');
      } else {
        console.error('Error adding user_id column:', error.message);
      }
    }

    // Add chapter_label column if it doesn't exist (for existing databases)
    try {
      await connection.query(`
        ALTER TABLE vocabulary_entries 
        ADD COLUMN chapter_label VARCHAR(255) AFTER chapter;
      `);
      console.log('chapter_label column added successfully');
    } catch (error: any) {
      // Column might already exist (error code 1060), ignore error
      if (error.errno === 1060) {
        console.log('chapter_label column already exists');
      } else {
        console.error('Error adding chapter_label column:', error.message);
      }
    }

    // Add is_favorite column if it doesn't exist (for existing databases)
    try {
      await connection.query(`
        ALTER TABLE vocabulary_entries 
        ADD COLUMN is_favorite TINYINT(1) DEFAULT 0 AFTER learning_note;
      `);
      console.log('is_favorite column added successfully');
    } catch (error: any) {
      // Column might already exist (error code 1060), ignore error
      if (error.errno === 1060) {
        console.log('is_favorite column already exists');
      } else {
        console.error('Error adding is_favorite column:', error.message);
      }
    }

    // Create vocabulary_sharing table
    await connection.query(`
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
    `);

    // Create pre_generated_sentences table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pre_generated_sentences (
        id VARCHAR(36) PRIMARY KEY,
        user_id INT NOT NULL DEFAULT 0,
        vocab_group_id INT NOT NULL,
        chinese_text TEXT NOT NULL,
        pinyin TEXT NOT NULL,
        english_meaning TEXT,
        modern_vietnamese TEXT,
        used_characters JSON NOT NULL,
        generation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_vocab_group (user_id, vocab_group_id),
        INDEX idx_vocab_group (vocab_group_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Add user_id column to pre_generated_sentences if it doesn't exist
    try {
      await connection.query(`
        ALTER TABLE pre_generated_sentences 
        ADD COLUMN user_id INT NOT NULL DEFAULT 0 AFTER id;
      `);
      console.log('pre_generated_sentences user_id column added');
      try {
        await connection.query(`ALTER TABLE pre_generated_sentences ADD INDEX idx_user_vocab_group (user_id, vocab_group_id);`);
      } catch (e: any) { /* index may exist */ }
    } catch (error: any) {
      if (error.errno === 1060) {
        // column already exists
      } else {
        console.error('Error adding user_id to pre_generated_sentences:', error.message);
      }
    }

    // Add modern_vietnamese column if it doesn't exist (for existing databases)
    try {
      await connection.query(`
        ALTER TABLE pre_generated_sentences 
        ADD COLUMN modern_vietnamese TEXT AFTER english_meaning;
      `);
      console.log('modern_vietnamese column added successfully');
    } catch (error: any) {
      // Column might already exist (error code 1060), ignore error
      if (error.errno === 1060) {
        console.log('modern_vietnamese column already exists');
      } else {
        console.error('Error adding modern_vietnamese column:', error.message);
      }
    };

    // Migrate existing users from vocabulary_entries to users table
    await connection.query(`
      INSERT IGNORE INTO users (username)
      SELECT DISTINCT username FROM vocabulary_entries;
    `);

    console.log('Database tables created successfully');
  } finally {
    connection.release();
  }
}

export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.');
  }
  return pool;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('Database connection closed');
  }
}
