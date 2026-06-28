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
  console.log("QUERY 1 (Profiles):");
  const q1 = await query("profiles?or=(username.ilike.*tex*,username.ilike.*aden*,display_name.ilike.*tex*,display_name.ilike.*aden*)&select=id,username,display_name,is_vip,vip_tier,role");
  console.log(JSON.stringify(q1, null, 2));

  console.log("\nQUERY 2 (Members):");
  const q2 = await query("members?or=(username.ilike.*tex*,username.ilike.*aden*,display_name.ilike.*tex*,display_name.ilike.*aden*)&select=id,user_id,username,display_name,is_vip,vip_tier,role,membership");
  console.log(JSON.stringify(q2, null, 2));

  console.log("\nQUERY 3 (Members Columns):");
  const q3 = await query("members?limit=1");
  console.log(JSON.stringify(q3, null, 2));
}
run();
