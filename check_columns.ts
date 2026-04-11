import { supabase } from "./lib/supabase";

async function checkColumns() {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Error fetching members:", error);
  } else if (data && data.length > 0) {
    console.log("Columns in members table:", Object.keys(data[0]));
  } else {
    console.log("No data in members table or table empty.");
  }
}

checkColumns();