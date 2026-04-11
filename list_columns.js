const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

function getOptions() {
  const url = new URL(`${supabaseUrl}/rest/v1/`);
  return {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    agent: agent,
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': 'Bearer ' + supabaseAnonKey
    }
  };
}

const req = https.request(getOptions(), res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      // This might not work as it returns OpenAPI spec sometimes but usually requires /rest/v1/ 
      // with no table name to return the spec.
      console.log(body);
    } catch (e) {
      console.log('Error parsing');
    }
  });
});
req.on('error', e => console.log(e.message));
req.end();
