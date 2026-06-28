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
  const authUserId = 'aa7b7b9d-7e7f-449d-8ca6-ee9d3d1d96bb';

  console.log(`Checking members table for user_id = ${authUserId}...`);
  const { data: byUserId, error: err1 } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', authUserId)
    .maybeSingle();
  
  if (err1) console.error('Error (user_id):', err1.message);
  else if (byUserId) console.log('Found by user_id! member.id =', byUserId.id);
  else console.log('NOT found by user_id.');

  console.log(`Checking members table for id = ${authUserId}...`);
  const { data: byId, error: err2 } = await supabase
    .from('members')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();
  
  if (err2) console.error('Error (id):', err2.message);
  else if (byId) console.log('Found by id! member.id =', byId.id);
  else console.log('NOT found by id.');
}

check();