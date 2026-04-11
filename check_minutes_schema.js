const https = require('https');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
        env[parts[0].trim()] = parts[1].trim();
    }
});

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.log('No env vars');
    process.exit(1);
}

const url = new URL(supabaseUrl + '/rest/v1/member_minutes?select=*&user_id=eq.e193c118-3abc-4f40-a759-5f58cf6d5429');

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'apikey': supabaseAnonKey,
    'Authorization': 'Bearer ' + supabaseAnonKey,
    'Range': '0-0'
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
        const json = JSON.parse(body);
        if (json[0]) {
            console.log('Columns for member_minutes:', Object.keys(json[0]));
        } else {
            console.log('No rows found in member_minutes or empty response');
            console.log('Body:', body);
        }
    } catch (e) {
        console.log('Error parsing JSON:', e.message);
        console.log('Body:', body);
    }
  });
});

req.on('error', error => {
  console.error('Request error:', error.message);
});

req.end();