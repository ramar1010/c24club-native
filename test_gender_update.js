const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY || 'http://127.0.0.1:8080');
const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';

const id = '88b9f606-8dfe-42a1-8704-4328c0f2df0e'; // tex

async function request(method, path, body = null) {
  const url = new URL(path, SUPABASE_URL);
  const options = {
    method: method,
    hostname: url.hostname,
    path: url.pathname + url.search,
    agent: agent,
    headers: {
      'apikey': API_KEY,
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const res = await request('PATCH', `/rest/v1/members?id=eq.${id}`, { gender: 'Male' });
  console.log('Result:', JSON.stringify(res, null, 2));
}
run();
