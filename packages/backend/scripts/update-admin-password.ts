/**
 * Update Admin Password Script
 * 
 * Updates the admin user's secret phrase
 * 
 * Usage: npx ts-node scripts/update-admin-password.ts <new-phrase>
 */

import { initDatabase, getPool } from '../src/config/database';
import * as bcrypt from 'bcryptjs';

const newPhrase = process.argv[2];

if (!newPhrase) {
  console.error('Error: Please provide a new secret phrase');
  console.error('Usage: npx ts-node scripts/update-admin-password.ts <new-phrase>');
  process.exit(1);
}

async function updateAdminPassword() {
  try {
    // Initialize database connection
    await initDatabase();
    const pool = getPool();
    
    // Hash the new phrase
    const hash = await bcrypt.hash(newPhrase, 10);
    
    // Update the admin user
    const [result] = await pool.query(
      `UPDATE auth_users SET secret_phrase_hash = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE username = 'admin' AND role = 'admin'`,
      [hash]
    );
    
    console.log(`✓ Admin password updated successfully`);
    console.log(`  New phrase: ${newPhrase}`);
    console.log(`  Hash: ${hash.substring(0, 20)}...`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating admin password:', error);
    process.exit(1);
  }
}

updateAdminPassword();
