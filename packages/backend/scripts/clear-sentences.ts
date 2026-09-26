import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function clearSentences() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chinese_learning_app'
  });

  try {
    console.log('Clearing pre-generated sentences...');
    
    const [result] = await connection.query(
      'DELETE FROM pre_generated_sentences'
    ) as any;
    
    console.log(`✓ Deleted ${result.affectedRows} sentences`);
    
  } finally {
    await connection.end();
  }
}

clearSentences()
  .then(() => {
    console.log('\n✓ Sentences cleared successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Failed to clear sentences:', error);
    process.exit(1);
  });
