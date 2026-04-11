const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function getHint(table) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
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
          const json = JSON.parse(body);
          if (json.hint) {
            resolve(json.hint);
          } else if (res.statusCode === 200 || res.statusCode === 206) {
            resolve('exists');
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', e => resolve(null));
    req.end();
  });
}

async function run() {
  const words = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const tableSet = new Set();
  for (const word of words) {
    const hint = await getHint(word);
    if (hint && hint.startsWith("Perhaps you meant the table 'public.")) {
      const table = hint.match(/'public\.([^']+)'/)[1];
      tableSet.add(table);
    } else if (hint === 'exists') {
      tableSet.add(word);
    }
  }
  console.log("FOUND TABLES:");
  console.log(Array.from(tableSet).sort().join('\n'));
}
run();
