const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';
const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY || 'http://127.0.0.1:8080');

const url = new URL('/rest/v1/members?select=*&limit=1', SUPABASE_URL);
const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  agent: agent,
  headers: { 'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}` }
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json && json.length > 0) {
        console.log(Object.keys(json[0]));
      } else {
        console.log("No data found");
      }
    } catch (e) { console.log("Error parsing:", data); }
  });
});
req.on('error', e => console.log("Request error:", e));
req.end();
