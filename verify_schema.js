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
// Note: We use the anon key, so we won't see anything unless RLS is bypassable or we have a session.
// But we can check for table existence and column errors.
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const userId = 'aa7b7b9d-7e7f-449d-8ca6-ee9d3d1d96bb';
  const lunaId = '5d97d420-901a-494a-b955-442eed5a465f';

  console.log('--- Testing Conversations Table ---');
  // Try to find a convo between them
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`and(participant_1.eq.${userId},participant_2.eq.${lunaId}),and(participant_1.eq.${lunaId},participant_2.eq.${userId})`);
  
  if (error) {
    console.log('Error querying conversations:', error.message, error.code);
  } else {
    console.log('Found conversations:', data.length);
    if (data.length > 0) console.log(JSON.stringify(data, null, 2));
  }

  console.log('--- Testing dm_messages Table ---');
  // Try to find any message from this user
  const { data: msgs, error: msgsError } = await supabase
    .from('dm_messages')
    .select('*')
    .eq('sender_id', userId);
  
  if (msgsError) {
    console.log('Error querying dm_messages:', msgsError.message, msgsError.code);
  } else {
    console.log('Found messages:', msgs.length);
    if (msgs.length > 0) console.log(JSON.stringify(msgs, null, 2));
  }

  console.log('--- Testing alternative table names ---');
  const alternatives = ['messages', 'chats', 'threads', 'dm_threads', 'private_messages'];
  for (const table of alternatives) {
    const { error: tableError } = await supabase.from(table).select('*').limit(1);
    if (tableError && tableError.code === 'PGRST116') {
       // Table exists but empty? No, PGRST116 is no rows returned for maybeSingle
    } else if (tableError && tableError.message.includes('does not exist')) {
       // Table doesn't exist
    } else if (!tableError) {
       console.log(`Table '${table}' EXISTS!`);
    } else {
       console.log(`Table '${table}' result:`, tableError.message, tableError.code);
    }
  }
}

check();