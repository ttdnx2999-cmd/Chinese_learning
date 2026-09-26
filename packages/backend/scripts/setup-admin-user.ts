/**
 * Setup Admin User Script
 * 
 * Creates the first admin user in the database.
 * Run this once to bootstrap the auth system.
 * 
 * Usage: npx tsx scripts/setup-admin-user.ts
 */

import { initDatabase, getPool } from '../src/config/database';
import { UserDAO } from '../src/models/User';
import * as bcrypt from 'bcryptjs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function setupAdmin() {
  try {
    console.log('\n=== Admin User Setup ===\n');

    // Initialize database
    console.log('Connecting to database...');
    await initDatabase();
    console.log('✓ Database connected\n');

    // Check if admin already exists
    const existingAdmin = await UserDAO.findByUsername('admin');
    if (existingAdmin) {
      console.log('Admin user already exists in database.');
      const changePassword = await prompt('Do you want to reset the admin password? (y/n): ');

      if (changePassword.toLowerCase() !== 'y') {
        console.log('Exiting without changes.');
        rl.close();
        process.exit(0);
      }
    }

    // Get secret phrase
    console.log('Create an admin secret phrase.');
    console.log('This will be used to login as admin and create other users.\n');

    const secretPhrase = await prompt('Enter secret phrase (or press Enter for default): ');
    const finalPhrase = secretPhrase.trim() || 'admin-secret-phrase-change-me';

    console.log(`\nUsing secret phrase: "${finalPhrase}"`);
    const confirm = await prompt('Confirm and create admin user? (y/n): ');

    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      process.exit(0);
    }

    // Create or update admin user
    if (existingAdmin) {
      console.log('\nUpdating admin password...');
      const updated = await UserDAO.update(existingAdmin.id, {
        secretPhrase: finalPhrase
      });

      if (updated) {
        console.log('✓ Admin password updated successfully\n');
        console.log('Test with:');
        console.log(`  curl -X POST http://localhost:3000/api/auth/login \\`);
        console.log(`    -H "Content-Type: application/json" \\`);
        console.log(`    -d '{"username":"admin","secretPhrase":"${finalPhrase}"}'`);
      } else {
        console.log('✗ Failed to update admin user');
      }
    } else {
      console.log('\nCreating admin user...');
      const admin = await UserDAO.create({
        username: 'admin',
        secretPhrase: finalPhrase,
        role: 'admin'
      });

      console.log('✓ Admin user created successfully\n');
      console.log(`ID: ${admin.id}`);
      console.log(`Username: ${admin.username}`);
      console.log(`Role: ${admin.role}`);
      console.log(`Created: ${admin.createdAt}`);

      console.log('\n--- Next Steps ---\n');
      console.log('1. Test login with:');
      console.log(`  curl -X POST http://localhost:3000/api/auth/login \\`);
      console.log(`    -H "Content-Type: application/json" \\`);
      console.log(`    -d '{"username":"admin","secretPhrase":"${finalPhrase}"}'`);

      console.log('\n2. Run auth tests:');
      console.log('  npx tsx scripts/test-auth-stage1.ts');

      console.log('\n3. Use the returned token for admin operations:');
      console.log('  curl -X POST http://localhost:3000/api/auth/register \\');
      console.log('    -H "Content-Type: application/json" \\');
      console.log('    -H "Authorization: Bearer <token>" \\');
      console.log('    -d \'{"username":"parent1","secretPhrase":"...","role":"parent"}\'');
    }

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    rl.close();
    process.exit(1);
  }
}

setupAdmin();
