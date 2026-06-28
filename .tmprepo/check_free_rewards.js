const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRewards() {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('minutes_cost', 0);

  if (error) {
    console.error('Error fetching rewards:', error);
    return;
  }

  console.log('Free rewards:', data);
}

checkRewards();