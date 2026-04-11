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
  console.log('Querying members table (no filter)...');
  const { data, error } = await supabase.from('members').select('*').limit(1);
  if (error) {
    console.error('Members Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns found in members:', Object.keys(data[0]));
    console.log('Sample data:', data[0]);
  } else {
    console.log('Members table is empty.');
  }

  console.log('\nQuerying member_minutes table (no filter)...');
  const { data: minData, error: minError } = await supabase.from('member_minutes').select('*').limit(1);
  if (minError) {
    console.error('Member Minutes Error:', minError.message);
  } else if (minData && minData.length > 0) {
    console.log('Columns found in member_minutes:', Object.keys(minData[0]));
  } else {
    console.log('Member Minutes table is empty.');
  }
}

check();