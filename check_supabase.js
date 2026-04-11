import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const tables = [
    'members', 'rewards', 'reward_categories', 'member_minutes', 'promos', 'rooms', 'member_redemptions'
  ];

  console.log("Checking Supabase connection and tables...");

  for (const table of tables) {
    const { data, count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ Table '${table}': ${error.message}`);
    } else {
      console.log(`✅ Table '${table}': Found ${count} records`);
    }
  }

  // Check categories specifically to see columns
  const { data: cats, error: catError } = await supabase.from('reward_categories').select('*').limit(1);
  if (cats && cats.length > 0) {
     console.log("reward_categories columns:", Object.keys(cats[0]));
  }

  // Check rewards specifically
  const { data: rwds, error: rwdError } = await supabase.from('rewards').select('*').limit(1);
  if (rwds && rwds.length > 0) {
     console.log("rewards columns:", Object.keys(rwds[0]));
  }
}

checkTables();