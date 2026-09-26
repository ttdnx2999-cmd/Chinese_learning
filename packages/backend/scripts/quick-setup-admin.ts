if (!process.env.ADMIN_SECRET_PHRASE) throw new Error('Set ADMIN_SECRET_PHRASE before running this script');
/**
 * Quick Admin Setup Script
 * 
 * Creates an admin user with a default secret phrase.
 * No interactive input required.
 */

import { initDatabase, getPool } from '../src/config/database';
import { UserDAO } from '../src/models/User';

async function quickSetup() {
  try {
    console.log('\n=== Quick Admin Setup ===\n');

    // Initialize database
    console.log('Connecting to database...');
    await initDatabase();
    console.log('✓ Database connected\n');

    // Check if admin already exists
    const existingAdmin = await UserDAO.findByUsername('admin');
    if (existingAdmin) {
      console.log('✓ Admin user already exists');
      console.log(`  ID: ${existingAdmin.id}`);
      console.log(`  Username: ${existingAdmin.username}`);
      console.log(`  Role: ${existingAdmin.role}`);
      console.log(`  Active: ${existingAdmin.isActive}`);
      
      // Show the default secret phrase for reference
      const defaultPhrase = process.env.ADMIN_SECRET_PHRASE!;
      console.log(`\nDefault secret phrase: ${defaultPhrase}`);
      console.log('\nTo test login, use:');
      console.log(`  curl -X POST http://localhost:3000/api/auth/login-by-phrase \\`);
      console.log(`    -H "Content-Type: application/json" \\`);
      console.log(`    -d '{"secretPhrase":"${defaultPhrase}"}'`);
    } else {
      // Create admin user with default secret phrase
      const secretPhrase = process.env.ADMIN_SECRET_PHRASE!;
      
      console.log('Creating admin user...');
      console.log(`Secret phrase: ${secretPhrase}\n`);
      
      const admin = await UserDAO.create({
        username: 'admin',
        secretPhrase: secretPhrase,
        role: 'admin'
      });

      console.log('✓ Admin user created successfully\n');
      console.log(`ID: ${admin.id}`);
      console.log(`Username: ${admin.username}`);
      console.log(`Role: ${admin.role}`);
      console.log(`Created: ${admin.createdAt}`);

      console.log('\n--- Next Steps ---\n');
      console.log('1. Test login with:');
      console.log(`  curl -X POST http://localhost:3000/api/auth/login-by-phrase \\`);
      console.log(`    -H "Content-Type: application/json" \\`);
      console.log(`    -d '{"secretPhrase":"${secretPhrase}"}'`);

      console.log('\n2. Or visit the login page at:');
      console.log('   http://localhost:5173/login');
      console.log(`   And enter secret phrase: ${secretPhrase}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

quickSetup();
