const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("Checking conversations...");
  const { data: convos, error: convoError } = await supabase
    .from('conversations')
    .select('*')
    .limit(5);

  if (convoError) {
    console.error("Convo Error:", convoError);
  } else {
    console.log("Conversations found:", convos.length);
    if (convos.length > 0) {
      console.log("Sample convo p1:", convos[0].participant_1);
      console.log("Sample convo p2:", convos[0].participant_2);
      
      const p1 = convos[0].participant_1;
      console.log("Checking member for p1:", p1);
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id, name')
        .eq('id', p1)
        .maybeSingle();
      
      if (memberError) console.error("Member Error:", memberError);
      else console.log("Member Result:", member);
    }
  }
}

inspect();