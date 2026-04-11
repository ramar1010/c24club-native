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
  console.log('Fetching list of all accessible tables...');
  // PostgREST doesn't have a direct "list tables" endpoint via the client,
  // but we can check common ones.
  const tables = ['profiles', 'members', 'users', 'user_profiles', 'accounts'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log(`Table '${table}': DOES NOT EXIST`);
      } else {
        console.log(`Table '${table}': ERROR - ${error.message} (${error.code})`);
      }
    } else {
      console.log(`Table '${table}': EXISTS (Accessible)`);
    }
  }
}

check();