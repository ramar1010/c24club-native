const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const tables = ['user_reports', 'member_reports', 'reports'];
  for (const table of tables) {
    console.log(`Checking table '${table}'...`);
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}' status ${status}: ${error.message} (${error.code})`);
    } else {
      console.log(`Table '${table}' exists! Data: `, data);
    }
  }
}

check();
