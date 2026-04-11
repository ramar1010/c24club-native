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
  const tableCandidates = ['conversations', 'dm_messages', 'messages', 'direct_messages', 'chats', 'member_messages', 'members', 'member_minutes'];
  
  for (const table of tableCandidates) {
    try {
      console.log(`Checking table: ${table}...`);
      const { data, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
      if (error) {
        console.log(`Table ${table} error: ${error.message}`);
      } else {
        console.log(`Table ${table} exists! Count: ${data ? 'ok' : 'null'}`);
      }
    } catch (err) {
      console.log(`Table ${table} crash: ${err.message}`);
    }
  }
}

check();
