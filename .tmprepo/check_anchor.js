const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

const candidates = [
  'anchor_payouts', 'anchor_orders', 'anchor_users', 'anchor_transactions',
  'anchor_payout_logs', 'anchor_settings', 'anchor_products'
];

function check(table) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      agent: agent,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer ' + supabaseAnonKey,
        'Range': '0-0'
      }
    };
    const req = https.request(options, res => {
      resolve(res.statusCode);
    });
    req.on('error', e => resolve(500));
    req.end();
  });
}

async function run() {
  for (const table of candidates) {
    const code = await check(table);
    if (code === 200 || code === 206) {
      console.log(`✅ ${table}`);
    }
  }
}
run();
