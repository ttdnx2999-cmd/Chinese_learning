import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chinese_learning_app'
  });

  try {
    // Check if table exists
    const [tables] = await connection.query(
      'SHOW TABLES LIKE "pre_generated_sentences"'
    );
    console.log('✓ Table exists:', tables.length > 0);
    
    // Show indexes
    const [indexes] = await connection.query(
      'SHOW INDEX FROM pre_generated_sentences'
    ) as any;
    
    console.log('\nIndexes:');
    indexes.forEach((idx: any) => {
      console.log(`  - ${idx.Key_name} on ${idx.Column_name}`);
    });
    
    // Show charset and collation
    const [status] = await connection.query(
      `SELECT TABLE_COLLATION 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [process.env.DB_NAME || 'chinese_learning_app', 'pre_generated_sentences']
    ) as any;
    
    console.log('\nCharset/Collation:');
    console.log(`  - ${status[0].TABLE_COLLATION}`);
    
  } finally {
    await connection.end();
  }
}

verifyTable()
  .then(() => {
    console.log('\n✓ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Verification failed:', error);
    process.exit(1);
  });
