const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function request(path) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      agent: agent,
      headers: { 'apikey': supabaseAnonKey, 'Authorization': 'Bearer ' + supabaseAnonKey }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve([]); }
      });
    });
    req.on('error', e => resolve([]));
    req.end();
  });
}

async function run() {
  const data = await request("members?select=membership&order=membership");
  const unique = [...new Set(data.map(m => m.membership))];
  console.log("Unique values:", unique);
  console.log("Total count:", data.length);
}
run();
