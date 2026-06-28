const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFvA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDede() {
  console.log('Searching for dede@gmail.con...');
  
  const { data, error } = await supabase
    .from('members')
    .select('id, email, gender, notify_female_searching, male_search_notify_mode, push_token')
    .eq('email', 'dede@gmail.con')
    .maybeSingle();

  if (error) {
    console.error('Error fetching member:', error.message);
    return;
  }

  if (!data) {
    console.log('No member found with email dede@gmail.con. Searching with ILIKE...');
    const { data: fuzzyData, error: fuzzyError } = await supabase
      .from('members')
      .select('id, email, gender, notify_female_searching, male_search_notify_mode, push_token')
      .ilike('email', '%dede%')
      .limit(5);
    
    if (fuzzyError) {
      console.error('Fuzzy search error:', fuzzyError.message);
    } else {
      console.log('Fuzzy search results:', JSON.stringify(fuzzyData, null, 2));
    }
    return;
  }

  console.log('Found Member:', JSON.stringify(data, null, 2));
}

checkDede();