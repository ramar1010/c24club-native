const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const tables = ['cashout_settings', 'member_minutes', 'gift_transactions', 'cashout_requests'];
  
  for (const table of tables) {
    console.log(`--- Checking table: ${table} ---`);
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.log(`❌ Error/Missing ${table}: ${error.message} (Status: ${status})`);
    } else {
      console.log(`✅ Table ${table} exists!`);
      if (data && data.length > 0) {
        console.log(`Columns for ${table}: ${Object.keys(data[0]).join(', ')}`);
      } else {
        console.log(`No records found in ${table}, but it exists.`);
      }
    }
    console.log('');
  }

  console.log('--- Checking RPC: is_user_vip ---');
  try {
    // We try to call it with a random UUID to see if it exists and what error it gives (if any)
    const { data, error } = await supabase.rpc('is_user_vip', { user_id: '00000000-0000-0000-0000-000000000000' });
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('❌ RPC is_user_vip does not exist');
      } else {
        console.log(`✅ RPC is_user_vip seems to exist (Error: ${error.message})`);
      }
    } else {
      console.log('✅ RPC is_user_vip exists and returned successfully');
    }
  } catch (e) {
    console.log(`❌ Error checking RPC: ${e.message}`);
  }
}

checkSchema();
