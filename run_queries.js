const API_URL = "https://ncpbiymnafxdfsvpxirb.supabase.co/rest/v1";
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";

async function run() {
  const headers = {
    "apikey": API_KEY,
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  };

  console.log("--- Query 1: Search members by name ---");
  const q1 = await fetch(`${API_URL}/members?or=(name.ilike.*tex*,name.ilike.*aden*)&select=id,name,membership,email`, { headers });
  console.log(JSON.stringify(await q1.json(), null, 2));

  console.log("\n--- Query 2: member_minutes (limit 3) ---");
  const q2 = await fetch(`${API_URL}/member_minutes?limit=3`, { headers });
  console.log(JSON.stringify(await q2.json(), null, 2));

  console.log("\n--- Query 3: Distinct membership ---");
  const q3 = await fetch(`${API_URL}/members?select=membership&order=membership`, { headers });
  console.log(JSON.stringify(await q3.json(), null, 2));
}

run().catch(console.error);
