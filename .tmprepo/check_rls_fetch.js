const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';

async function run() {
  const commonHeaders = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  console.log('--- 1. INSERT test signal ---');
  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/room_signals`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        room_id: 'test-room-rls-check',
        sender_channel: 'test-channel-rls-check',
        signal_type: 'test',
        payload: {}
      })
    });
    console.log(`Status: ${insertRes.status}`);
    console.log(`Body: ${await insertRes.text()}`);
  } catch (e) {
    console.error('Insert failed:', e.message);
  }

  console.log('\n--- 2. SELECT test signal ---');
  try {
    const selectRes = await fetch(`${SUPABASE_URL}/rest/v1/room_signals?room_id=eq.test-room-rls-check`, {
      method: 'GET',
      headers: commonHeaders
    });
    console.log(`Status: ${selectRes.status}`);
    console.log(`Body: ${await selectRes.text()}`);
  } catch (e) {
    console.error('Select failed:', e.message);
  }

  console.log('\n--- 3. DELETE test signal ---');
  try {
    const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/room_signals?room_id=eq.test-room-rls-check`, {
      method: 'DELETE',
      headers: commonHeaders
    });
    console.log(`Status: ${deleteRes.status}`);
    console.log(`Body: ${await deleteRes.text()}`);
  } catch (e) {
    console.error('Delete failed:', e.message);
  }

  console.log('\n--- 4. SELECT anchor_queue schema ---');
  try {
    const anchorRes = await fetch(`${SUPABASE_URL}/rest/v1/anchor_queue?limit=1`, {
      method: 'GET',
      headers: commonHeaders
    });
    console.log(`Status: ${anchorRes.status}`);
    console.log(`Body: ${await anchorRes.text()}`);
  } catch (e) {
    console.error('Anchor Select failed:', e.message);
  }
}

run();
