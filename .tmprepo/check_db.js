const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract URL and Key from app.config.ts
const appConfig = fs.readFileSync('app.config.ts', 'utf8');
const supabaseUrlMatch = appConfig.match(/supabaseUrl:\s*"([^"]+)"/);
const supabaseAnonKeyMatch = appConfig.match(/supabaseAnonKey:\s*"([^"]+)"/);

if (!supabaseUrlMatch || !supabaseAnonKeyMatch) {
  console.error("Could not find Supabase credentials in app.config.ts");
  process.exit(1);
}

const supabaseUrl = supabaseUrlMatch[1];
const supabaseAnonKey = supabaseAnonKeyMatch[1];
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  const tables = ['dm_messages', 'conversations', 'members'];
  
  for (const table of tables) {
    console.log(`--- Checking table: ${table} ---`);
    try {
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
        }
      }
    } catch (e) {
      console.log(`❌ Caught exception for ${table}: ${e.message}`);
    }
    console.log('\n');
  }
}

checkDatabase();
