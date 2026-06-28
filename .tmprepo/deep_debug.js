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

  // Check columns in conversations
  console.log('Fetching columns for conversations...');
  const { data: cols, error: colError } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);
  
  if (colError) {
    console.error('Col Error:', colError.message);
  } else if (cols && cols.length > 0) {
    console.log('Sample row columns:', Object.keys(cols[0]));
  } else {
    console.log('Conversations table appears to be empty or inaccessible.');
  }

  // Check dm_messages
  console.log('Fetching columns for dm_messages...');
  const { data: mCols, error: mColError } = await supabase
    .from('dm_messages')
    .select('*')
    .limit(1);
  
  if (mColError) {
    console.error('M Col Error:', mColError.message);
  } else if (mCols && mCols.length > 0) {
    console.log('Sample message columns:', Object.keys(mCols[0]));
  } else {
    console.log('dm_messages table appears to be empty or inaccessible.');
  }

  // Check if member exists
  console.log('Checking member record...');
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  
  if (memberError) console.error('Member Error:', memberError.message);
  else if (member) console.log('Member found:', member.name);
  else console.log('Member NOT found for ID:', userId);
}

check();