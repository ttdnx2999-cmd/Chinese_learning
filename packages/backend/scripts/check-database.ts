import { getPool, initDatabase, closeDatabase } from '../src/config/database';

async function checkDatabase() {
  try {
    await initDatabase();
    const pool = getPool();
    
    console.log('Checking pre_generated_sentences table...\n');
    
    const [rows] = await pool.query(
      'SELECT id, vocab_group_id, chinese_text, used_characters FROM pre_generated_sentences LIMIT 3'
    );
    
    console.log('Sample rows:');
    console.log(JSON.stringify(rows, null, 2));
    
    await closeDatabase();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDatabase();
