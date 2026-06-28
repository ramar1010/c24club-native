const https = require('https');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Extract URL and Key from app.config.ts
const appConfig = fs.readFileSync('app.config.ts', 'utf8');
const supabaseUrlMatch = appConfig.match(/supabaseUrl:\s*"([^"]+)"/);
const supabaseAnonKeyMatch = appConfig.match(/supabaseAnonKey:\s*"([^"]+)"/);

if (!supabaseUrlMatch || !supabaseAnonKeyMatch) {
  console.error("Could not find Supabase credentials in app.config.ts");
  process.exit(1);
}

const supabaseUrl = supabaseUrlMatch[1];
const supabaseAnonKey = supabaseAnonKeyMatch[1];
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

async function checkTable(tableName) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${tableName}?select=*&limit=1`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(body);
            resolve({ exists: true, data: data });
          } catch (e) {
            resolve({ exists: true, data: [], error: 'JSON parse error' });
          }
        } else {
          resolve({ exists: false, error: `Status ${res.statusCode}: ${body}` });
        }
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
}

async function run() {
  const tables = ["messages", "chats", "direct_messages", "member_messages", "dm_messages", "conversations"];
  for (const table of tables) {
    console.log(`--- Table: ${table} ---`);
    try {
      const result = await checkTable(table);
      if (result.exists) {
        console.log(`✅ Exists!`);
        if (result.data && result.data.length > 0) {
          console.log(`Columns: ${Object.keys(result.data[0]).join(', ')}`);
          // Mask IDs and content to be safe if they look like credentials (though they shouldn't)
          const sample = result.data[0];
          console.log(`Sample record keys: ${Object.keys(sample).join(', ')}`);
          // Log a safe version of the record
          const safeSample = {};
          for (const key in sample) {
            if (typeof sample[key] === 'string' && sample[key].length > 50) {
              safeSample[key] = sample[key].substring(0, 10) + '...';
            } else {
              safeSample[key] = sample[key];
            }
          }
          console.log(`Safe Sample:`, JSON.stringify(safeSample, null, 2));
        } else {
          console.log(`No records found.`);
        }
      } else {
        console.log(`❌ Does not exist or error: ${result.error}`);
      }
    } catch (e) {
      console.log(`❌ Exception: ${e.message}`);
    }
    console.log('');
  }
}

run();
