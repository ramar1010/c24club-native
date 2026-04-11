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
  const userId = 'aa7b7b9d-7e7f-449d-8ca6-ee9d3d1d96bb';

  console.log(`Deep check for user ${userId}...`);

  // Check all conversations
  console.log('Querying ALL conversations (limit 10)...');
  const { data: allConvos, error: eAll } = await supabase
    .from('conversations')
    .select('*')
    .limit(10);
  
  if (eAll) console.error('All Convos Error:', eAll.message);
  else console.log('All Convos Count:', allConvos?.length ?? 0, 'Data:', JSON.stringify(allConvos));

  // Check all messages
  console.log('Querying ALL messages (limit 10)...');
  const { data: allMsgs, error: eMsgs } = await supabase
    .from('dm_messages')
    .select('*')
    .limit(10);
  
  if (eMsgs) console.error('All Msgs Error:', eMsgs.message);
  else console.log('All Msgs Count:', allMsgs?.length ?? 0, 'Data:', JSON.stringify(allMsgs));

  // Check columns in conversations
  console.log('Querying columns in conversations...');
  const { data: columns, error: eCols } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);
  
  if (eCols) console.error('Columns Error:', eCols.message);
  else console.log('Columns Count:', columns?.length ?? 0, 'Data:', JSON.stringify(columns));

  // Try participant_1
  console.log('Querying participant_1...');
  const { data: p1, error: e1 } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_1', userId);
  
  if (e1) console.error('P1 Error:', e1.message);
  else console.log('P1 Count:', p1?.length ?? 0);

  // Try participant_2
  console.log('Querying participant_2...');
  const { data: p2, error: e2 } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_2', userId);
  
  if (e2) console.error('P2 Error:', e2.message);
  else console.log('P2 Count:', p2?.length ?? 0);

  // Try the OR query
  console.log('Querying OR...');
  const { data: pOr, error: eOr } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
  
  if (eOr) console.error('OR Error:', eOr.message);
  else console.log('OR Count:', pOr?.length ?? 0);
}

check();