const https = require('https');

const supabaseUrl = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';

const url = new URL(supabaseUrl + '/rest/v1/dm_messages?select=*&limit=1');

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'apikey': supabaseAnonKey,
    'Authorization': 'Bearer ' + supabaseAnonKey,
    'Range': '0-0'
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body:', body);
  });
});

req.on('error', error => {
  console.error('Request error:', error.message);
});

req.end();
