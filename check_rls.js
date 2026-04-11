const https = require('https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';

function req(method, path, body) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'ncpbiymnafxdfsvpxirb.supabase.co',
      path, method,
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const r = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    r.on('error', e => resolve({status:0,body:e.message}));
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function main() {
  let r;
  r = await req('POST', '/rest/v1/room_signals', {room_id:'test-rls-123',sender_channel:'test-ch-123',signal_type:'test',payload:{}});
  console.log('INSERT:', r.status, r.body);

  r = await req('GET', '/rest/v1/room_signals?room_id=eq.test-rls-123');
  console.log('SELECT:', r.status, r.body);

  r = await req('DELETE', '/rest/v1/room_signals?room_id=eq.test-rls-123');
  console.log('DELETE:', r.status, r.body);

  r = await req('GET', '/rest/v1/anchor_queue?limit=1');
  console.log('anchor_queue:', r.status, r.body);
}
main();
