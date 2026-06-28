const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'members' });
  
  if (error) {
    // If RPC fails, try a direct query to information_schema if allowed, 
    // but usually anon keys can't do that. 
    // Let's try to just fetch one record and see the keys.
    const { data: record, error: fetchError } = await supabase.from('members').select('*').limit(1).single();
    if (fetchError) {
      console.error('Error fetching record:', fetchError.message);
    } else {
      console.log('Columns in members table:', Object.keys(record));
    }
  } else {
    console.log('Columns from RPC:', data);
  }
}

checkSchema();