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
  const partnerId = '5d97d420-901a-494a-b955-442eed5a465f'; // Luna

  console.log(`Checking for existing conversation between ${userId} and ${partnerId}...`);
  const { data: convos, error: fetchError } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
  
  if (fetchError) {
    console.error(`Fetch error: ${fetchError.message} (Code: ${fetchError.code})`);
  } else {
    console.log(`Found ${convos?.length ?? 0} conversations.`);
    if (convos && convos.length > 0) {
      console.log('Conversations data:', JSON.stringify(convos, null, 2));
    }
  }

  console.log('Trying to insert a test conversation...');
  const { data: newConvo, error: insertError } = await supabase
    .from('conversations')
    .insert({
      participant_1: userId,
      participant_2: partnerId,
      last_message_at: new Date().toISOString()
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    console.error(`Insert error: ${insertError.message} (Code: ${insertError.code})`);
  } else {
    console.log(`Insert SUCCESS! New ID: ${newConvo?.id}`);
  }
}

check();