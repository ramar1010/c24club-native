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
  console.log('Querying dm_messages columns...');
  const { data, error } = await supabase
    .from('dm_messages')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error.message, error.code);
  } else if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    // If table is empty, we can try to find a row in another table or use a query that forces a column list
    console.log('dm_messages table is empty.');
    
    // Try to get columns from conversations too
    const { data: cData, error: cError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);
    
    if (cError) console.error('Convo Error:', cError.message);
    else if (cData && cData.length > 0) console.log('Convo Columns:', Object.keys(cData[0]));
    else console.log('Conversations table is also empty.');
  }
}

check();