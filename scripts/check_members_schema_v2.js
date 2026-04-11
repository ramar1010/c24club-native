const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  try {
    const { data: record, error: fetchError } = await supabase.from('members').select('*').limit(1).single();
    if (fetchError) {
      console.error('Error fetching record:', fetchError.message);
    } else {
      console.log('Columns in members table:', Object.keys(record));
    }
  } catch (err) {
    console.error('Script error:', err.message);
  }
}

checkSchema();