const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  try {
    const { data, error } = await supabase
      .from('direct_call_invites')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('direct_call_invites check error:', error.message);
    } else {
      console.log('direct_call_invites table exists');
    }

    const { data: signals, error: signalError } = await supabase
      .from('room_signals')
      .select('id')
      .limit(1);

    if (signalError) {
      console.log('room_signals check error:', signalError.message);
    } else {
      console.log('room_signals table exists');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkTables();