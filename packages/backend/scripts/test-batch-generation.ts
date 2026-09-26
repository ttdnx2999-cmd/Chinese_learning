import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test script to trigger batch generation and check parsing logs
 * 
 * Steps:
 * 1. Clear existing sentences
 * 2. Trigger batch generation via API
 * 3. Display parsing log results
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function clearSentences() {
  console.log('Step 1: Clearing existing sentences...');
  const { execSync } = require('child_process');
  execSync('tsx scripts/clear-sentences.ts', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit' 
  });
  console.log('✓ Sentences cleared\n');
}

async function triggerGeneration() {
  console.log('Step 2: Triggering batch generation...');
  console.log(`Calling POST ${API_BASE_URL}/api/phrases/generate`);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/phrases/generate`, {}, {
      timeout: 300000 // 5 minute timeout
    });
    
    console.log('✓ Generation completed successfully');
    console.log('Response:', response.data);
    return true;
  } catch (error: any) {
    if (error.response) {
      console.error('✗ API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('✗ No response from server. Is the backend running?');
    } else {
      console.error('✗ Error:', error.message);
    }
    return false;
  }
}

async function displayParsingLog() {
  console.log('\nStep 3: Checking parsing log...');
  const logPath = path.join(__dirname, '../temp/parsing-log.txt');
  
  if (!fs.existsSync(logPath)) {
    console.log('⚠️  Parsing log not found at:', logPath);
    console.log('The log file should be created during generation.');
    return;
  }
  
  const logContent = fs.readFileSync(logPath, 'utf-8');
  console.log('\n===== PARSING LOG CONTENT =====');
  console.log(logContent);
  console.log('===== END PARSING LOG =====\n');
  
  // Parse key metrics
  const totalMatch = logContent.match(/Total sentence matches found: (\d+)/);
  const expectedMatch = logContent.match(/Expected.*?: (\d+)/);
  const targetMatch = logContent.match(/Target after rejection.*?: (\d+)/);
  
  if (totalMatch && expectedMatch && targetMatch) {
    const total = parseInt(totalMatch[1]);
    const expected = parseInt(expectedMatch[1]);
    const target = parseInt(targetMatch[1]);
    
    console.log('📊 SUMMARY:');
    console.log(`  - AI returned: ${total} sentences`);
    console.log(`  - Expected (45 per batch): ${expected} sentences`);
    console.log(`  - Target (30 per batch after rejection): ${target} sentences`);
    console.log(`  - Match rate: ${((total / expected) * 100).toFixed(1)}%`);
    
    if (total === expected) {
      console.log('  ✓ AI returned exactly 75 sentences per batch as requested!');
    } else if (total < expected) {
      console.log(`  ⚠️  AI returned fewer sentences than expected (${expected - total} missing)`);
    } else {
      console.log(`  ⚠️  AI returned more sentences than expected (${total - expected} extra)`);
    }
  }
}

async function main() {
  console.log('===== BATCH GENERATION TEST =====\n');
  
  // Step 1: Clear sentences
  await clearSentences();
  
  // Step 2: Trigger generation
  const success = await triggerGeneration();
  
  if (!success) {
    console.log('\n✗ Generation failed. Please check the backend logs.');
    process.exit(1);
  }
  
  // Step 3: Display parsing log
  await displayParsingLog();
  
  console.log('\n✓ Test completed successfully');
  process.exit(0);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
