const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract Supabase credentials from app.config.ts or .env if it exists
// Looking at AGENTS.md, it says lib/supabase.ts is the central client.
// I'll try to find the credentials in the project.

function getEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
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
  return process.env;
}

const env = getEnv();
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  console.log('Checking gift_transactions table columns...');
  const { data: giftData, error: giftError } = await supabase
    .from('gift_transactions')
    .select('*')
    .limit(1);

  if (giftError) {
    console.error('Error fetching gift_transactions:', giftError.message);
  } else if (giftData && giftData.length > 0) {
    console.log('gift_transactions columns:', Object.keys(giftData[0]));
    console.log('Sample row:', giftData[0]);
  } else {
    console.log('gift_transactions table is empty.');
    // Try to get schema via an intentional error if possible, but limit(0) might not return column names in some clients
  }

  console.log('\nChecking members table columns...');
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('*')
    .limit(1);

  if (memberError) {
    console.error('Error fetching members:', memberError.message);
  } else if (memberData && memberData.length > 0) {
    console.log('members columns:', Object.keys(memberData[0]));
    console.log('Sample row (subset):', {
        id: memberData[0].id,
        name: memberData[0].name,
        email: memberData[0].email ? 'EXISTS' : 'MISSING'
    });
  } else {
    console.log('members table is empty.');
  }
}

checkColumns();
