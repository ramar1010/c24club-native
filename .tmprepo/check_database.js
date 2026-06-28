const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  const tables = ['dm_messages', 'conversations', 'members'];
  
  for (const table of tables) {
    console.log(`--- Checking table: ${table} ---`);
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.log(`❌ Error fetching from ${table}: ${error.message} (Status: ${status})`);
    } else {
      console.log(`✅ Table ${table} exists!`);
      if (data && data.length > 0) {
        console.log(`Columns for ${table}: ${Object.keys(data[0]).join(', ')}`);
        console.log(`Sample record: `, JSON.stringify(data[0], null, 2));
      } else {
        console.log(`No records found in ${table}, but it exists.`);
        // If it's empty, we might not get columns. We can try to get columns from information_schema if we had direct SQL access, 
        // but anon key usually doesn't have access to that.
      }
    }
    console.log('\n');
  }
}

checkDatabase();
