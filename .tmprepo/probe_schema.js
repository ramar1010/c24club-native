const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function probe(table) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      agent: agent,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer ' + supabaseAnonKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ table, status: res.statusCode, body });
      });
    });
    // Send an object with a non-existent column to see the error message
    req.write(JSON.stringify({ non_existent_column: 'test' }));
    req.on('error', e => resolve({ table, error: e.message }));
    req.end();
  });
}

async function run() {
  const tables = ['conversations', 'dm_messages'];
  for (const table of tables) {
    console.log(`--- Probing: ${table} ---`);
    const res = await probe(table);
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${res.body}`);
  }
}
run();
