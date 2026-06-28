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
  console.log('Checking conversations table...');
  const { data: cData, error: cError } = await supabase.from('conversations').select('*').limit(1);
  console.log('Conversations:', { data: cData ? 'exists' : 'null', error: cError?.message });

  console.log('Checking dm_messages table...');
  const { data: dmData, error: dmError } = await supabase.from('dm_messages').select('*').limit(1);
  console.log('DM Messages:', { data: dmData ? 'exists' : 'null', error: dmError?.message });

  console.log('Checking messages table...');
  const { data: mData, error: mError } = await supabase.from('messages').select('*').limit(1);
  console.log('Messages:', { data: mData ? 'exists' : 'null', error: mError?.message });
}

check();
