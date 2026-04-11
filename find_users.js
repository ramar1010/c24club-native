const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function query(urlPath) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${urlPath}`);
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
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.end();
  });
}

async function run() {
  console.log("Searching for Tex/Aden in members...");
  const users = await query("members?or=(name.ilike.*tex*,name.ilike.*aden*)&select=id,name,email,membership");
  console.log("Users found:", JSON.stringify(users, null, 2));

  if (Array.isArray(users) && users.length > 0) {
    for (const user of users) {
      console.log(`\nChecking member_minutes for user ${user.id} (${user.name}):`);
      const minutes = await query(`member_minutes?user_id=eq.${user.id}&select=*`);
      console.log(JSON.stringify(minutes, null, 2));
    }
  }
}
run();
