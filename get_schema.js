const fs = require('fs');
const path = require('path');
const https = require('https');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const content = fs.readFileSync(envPath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

const env = loadEnv();
const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL + '/rest/v1/');

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'GET',
  headers: {
    'apikey': env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    'Accept': 'application/openapi+json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const spec = JSON.parse(data);
      console.log('TABLES FOUND:');
      const paths = Object.keys(spec.paths || {});
      const tables = new Set();
      paths.forEach(p => {
        const parts = p.split('/').filter(Boolean);
        if (parts.length > 0 && !parts[0].startsWith('rpc')) {
          tables.add(parts[0]);
        }
      });
      console.log(Array.from(tables).sort().join('\n'));
    } catch (e) {
      console.error('Error parsing JSON:', e.message);
      console.error('Data received:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();