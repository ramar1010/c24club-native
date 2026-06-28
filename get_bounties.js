const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

function query(path) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      agent: agent,
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': 'Bearer ' + supabaseServiceKey
      }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    req.end();
  });
}

async function run() {
  console.log('--- Bounty Debug Console ---');
  
  // 1. Check bounty_earnings
  const earnings = await query('bounty_earnings?select=*,male:male_id(name)&order=created_at.desc&limit=10');
  console.log('\n[Bounty Earnings]');
  console.log(JSON.stringify(earnings, null, 2));

  // 2. Check bounty_attributions
  const attributions = await query('bounty_attributions?select=*&order=last_interaction_at.desc&limit=5');
  console.log('\n[Bounty Attributions]');
  console.log(JSON.stringify(attributions, null, 2));

  // 3. Check iap_purchases
  const purchases = await query('iap_purchases?select=*&order=created_at.desc&limit=5');
  console.log('\n[IAP Purchases]');
  console.log(JSON.stringify(purchases, null, 2));
}

run();