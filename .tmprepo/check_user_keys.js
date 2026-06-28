const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

const email = 'bewtest@gmail.com';

function query(table, select, filter) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}?select=${select}&${filter}`);
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
          resolve({ error: 'Failed to parse JSON', body });
        }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.end();
  });
}

async function run() {
  const results = await query('members', '*', `email=eq.${encodeURIComponent(email)}`);
  if (results.length > 0) {
    console.log("Keys in members table row:");
    console.log(Object.keys(results[0]).join('\n'));
    console.log("\nValues for shipping columns (if they exist):");
    const shippingCols = ['shipping_name', 'shipping_address', 'shipping_city', 'shipping_state', 'shipping_zip', 'shipping_country'];
    shippingCols.forEach(col => {
      console.log(`${col}: ${results[0][col]}`);
    });
  } else {
    console.log("User not found");
  }
}
run();
