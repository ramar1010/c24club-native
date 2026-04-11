const { execSync } = require('child_process');

const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';

function runCurl(method, path, body = null, extraHeaders = {}) {
  let headers = `-H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}" -H "Content-Type: application/json"`;
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers += ` -H "${key}: ${value}"`;
  }
  
  let command = `curl -s -w "\n%{http_code}" -X ${method} "${SUPABASE_URL}${path}" ${headers}`;
  if (body) {
    command += ` -d '${JSON.stringify(body)}'`;
  }
  
  try {
    const output = execSync(command).toString().trim().split('\n');
    const statusCode = output.pop();
    const data = output.join('\n');
    return { statusCode, data };
  } catch (e) {
    return { statusCode: 'ERROR', data: e.message };
  }
}

console.log('--- 1. INSERT test signal ---');
const insertRes = runCurl('POST', '/rest/v1/room_signals', {
  room_id: 'test-room-rls-check',
  sender_channel: 'test-channel-rls-check',
  signal_type: 'test',
  payload: {}
}, { 'Prefer': 'return=representation' });
console.log(`Status: ${insertRes.statusCode}`);
console.log(`Body: ${insertRes.data}`);

console.log('\n--- 2. SELECT test signal ---');
const selectRes = runCurl('GET', '/rest/v1/room_signals?room_id=eq.test-room-rls-check');
console.log(`Status: ${selectRes.statusCode}`);
console.log(`Body: ${selectRes.data}`);

console.log('\n--- 3. DELETE test signal ---');
const deleteRes = runCurl('DELETE', '/rest/v1/room_signals?room_id=eq.test-room-rls-check');
console.log(`Status: ${deleteRes.statusCode}`);
console.log(`Body: ${deleteRes.data}`);

console.log('\n--- 4. SELECT anchor_queue schema ---');
const anchorRes = runCurl('GET', '/rest/v1/anchor_queue?limit=1');
console.log(`Status: ${anchorRes.statusCode}`);
console.log(`Body: ${anchorRes.data}`);
