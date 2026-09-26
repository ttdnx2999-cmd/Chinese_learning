/**
 * Migration script to increase chinese_character column size
 * From VARCHAR(10) to TEXT to support full sentences
 */

import { initDatabase, getPool } from '../src/config/database';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

async function migrate() {
  try {
    console.log('Initializing database connection...');
    await initDatabase();
    console.log('Database initialized successfully\n');
    
    const pool = getPool();
    
    console.log('Migrating chinese_character column from VARCHAR(10) to TEXT...');
    
    await pool.query(`
      ALTER TABLE vocabulary_entries 
      MODIFY COLUMN chinese_character TEXT NOT NULL;
    `);
    
    console.log('✓ Migration completed successfully!');
    console.log('The chinese_character column can now store full sentences.');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
