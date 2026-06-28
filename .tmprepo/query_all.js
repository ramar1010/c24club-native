const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function check(path) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${path}`);
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
      res.on('end', () => resolve(body));
    });
    req.on('error', e => resolve(`Error: ${e.message}`));
    req.end();
  });
}

async function run() {
  console.log("Q1:");
  console.log(await check("members?or=(name.ilike.*tex*,name.ilike.*aden*)&select=id,name,membership,email"));
  console.log("Q2:");
  console.log(await check("member_minutes?limit=3"));
  console.log("Q3:");
  console.log(await check("members?select=membership&order=membership"));
}
run();
