const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function getCount(filter) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/members?${filter}&select=id`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      agent: agent,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer ' + supabaseAnonKey,
        'Range-Unit': 'items',
        'Prefer': 'count=exact'
      }
    };
    const req = https.request(options, res => {
      const countHeader = res.headers['content-range'];
      const count = countHeader ? countHeader.split('/')[1] : '0';
      resolve(parseInt(count));
    });
    req.on('error', e => resolve(0));
    req.end();
  });
}

async function run() {
  const enabled = await getCount('notify_enabled=eq.true');
  const disabled = await getCount('notify_enabled=eq.false');
  const null_count = await getCount('notify_enabled=is.null');
  console.log(JSON.stringify({ enabled, disabled, null_count }, null, 2));
}
run();