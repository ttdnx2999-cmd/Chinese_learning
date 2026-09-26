require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');

const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
if (!key) { console.error('No API key found'); process.exit(1); }
console.log('Using key:', key.slice(0, 12) + '...');

const models = ['gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
let pending = models.length;

models.forEach(model => {
  const body = JSON.stringify({ contents: [{ parts: [{ text: 'Say hello in one word.' }] }] });
  const req = https.request({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:generateContent?key=${key}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const preview = data.slice(0, 150).replace(/\n/g, ' ');
      console.log(`\n${model}: HTTP ${res.statusCode}`);
      console.log(`  => ${preview}`);
      if (--pending === 0) process.exit(0);
    });
  });
  req.on('error', e => { console.log(`${model}: ERROR — ${e.message}`); if (--pending === 0) process.exit(0); });
  req.write(body);
  req.end();
});
