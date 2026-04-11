const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function checkColumn(table, column) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}?select=${column}&limit=1`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      agent: agent,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer ' + supabaseAnonKey
      }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ table, column, status: res.statusCode, body });
      });
    });
    req.on('error', e => resolve({ table, column, error: e.message }));
    req.end();
  });
}

async function run() {
  const tests = [
    { table: 'conversations', columns: ['id', 'participant_1', 'participant_2', 'last_message_at', 'created_at', 'updated_at', 'type'] },
    { table: 'dm_messages', columns: ['id', 'conversation_id', 'sender_id', 'receiver_id', 'content', 'read_at', 'created_at'] }
  ];
  for (const test of tests) {
    console.log(`--- Table: ${test.table} ---`);
    for (const col of test.columns) {
      const res = await checkColumn(test.table, col);
      if (res.status === 200 || res.status === 206) {
        console.log(`✅ ${col}`);
      } else {
        console.log(`❌ ${col} (${res.status})`);
      }
    }
  }
}
run();
