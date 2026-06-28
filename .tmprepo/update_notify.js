const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function patch() {
  return new Promise((resolve) => {
    // We want to update all rows where notify_enabled is false or NULL
    // PostgREST: PATCH /members?notify_enabled=is.null,notify_enabled=eq.false
    const url = new URL(`${supabaseUrl}/rest/v1/members?or=(notify_enabled.eq.false,notify_enabled.is.null)`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PATCH',
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
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(JSON.stringify({ notify_enabled: true }));
    req.end();
  });
}

async function run() {
  const result = await patch();
  console.log(JSON.stringify(result, null, 2));
}
run();