const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const content = fs.readFileSync(envPath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

const env = loadEnv();
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  console.log('Querying direct_call_invites with join...');
  const { data, error } = await supabase
    .from('direct_call_invites')
    .select('*, inviter:inviter_id(*), invitee:invitee_id(*)')
    .limit(1);
  
  if (error) {
    console.error('❌ Join Error:', error.message, error.code);
  } else {
    console.log('✅ Join Success!');
    if (data && data.length > 0) {
      console.log('Sample record:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('No records found in direct_call_invites.');
    }
  }
  
  console.log('\nQuerying direct_call_invites WITHOUT join...');
  const { data: dataNoJoin, error: errorNoJoin } = await supabase
    .from('direct_call_invites')
    .select('*')
    .limit(1);
    
  if (errorNoJoin) {
    console.error('❌ No Join Error:', errorNoJoin.message);
  } else {
    console.log('✅ No Join Success!');
    if (dataNoJoin && dataNoJoin.length > 0) {
      console.log('Columns:', Object.keys(dataNoJoin[0]));
    }
  }
}

check();
