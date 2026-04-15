const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFvA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase
    .from('members')
    .select('id, email, push_token, notify_enabled, gender, membership, updated_at')
    .ilike('email', 'dede@gmail.com%')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  if (!data) {
    console.log('User not found.');
    process.exit(0);
  }

  console.log('--- User Info ---');
  console.log(JSON.stringify(data, null, 2));

  // Check male_search_batch_log for notifications related to "girls searching"
  // This table tracks when males are notified about females joining.
  const { data: logData, error: logError } = await supabase
    .from('male_search_batch_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logError) {
    console.error('Log Error:', logError);
  } else {
    console.log('\n--- Recent Search Notification Logs (Global) ---');
    console.log(JSON.stringify(logData, null, 2));
  }
}

checkUser();