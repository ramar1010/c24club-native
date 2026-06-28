const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY || 'http://127.0.0.1:8080');

const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';

const users = [
  { name: 'tex', id: '88b9f606-8dfe-42a1-8704-4328c0f2df0e' },
  { name: 'Aden', id: '2ce63263-30d4-4c14-9dfe-2da2612c3549' }
];

async function request(method, path, body = null) {
  const url = new URL(path, SUPABASE_URL);
  const options = {
    method: method,
    hostname: url.hostname,
    path: url.pathname + url.search,
    agent: agent,
    headers: {
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  for (const user of users) {
    console.log(`Updating ${user.name}...`);
    // Try updating by ID
    const res = await request('PATCH', `/rest/v1/members?id=eq.${user.id}`, { membership: 'premium' });
    console.log(`Update result for ${user.name} (by id):`, JSON.stringify(res, null, 2));
    
    // If it failed to affect any rows, try by name
    if (Array.isArray(res) && res.length === 0) {
      console.log(`Failed to update ${user.name} by ID, trying by name...`);
      const res2 = await request('PATCH', `/rest/v1/members?name=eq.${user.name}`, { membership: 'premium' });
      console.log(`Update result for ${user.name} (by name):`, JSON.stringify(res2, null, 2));
    }
  }

  console.log('\nVerifying updates...');
  for (const user of users) {
    const res = await request('GET', `/rest/v1/members?id=eq.${user.id}&select=id,name,membership`);
    console.log(`Verification for ${user.name}:`, JSON.stringify(res, null, 2));
  }
}
run();
