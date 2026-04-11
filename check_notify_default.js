const https = require("https");
const { HttpsProxyAgent } = require("https-proxy-agent");
const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhc2UtaW5zLmNvbSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || "http://127.0.0.1:8080";
const agent = new HttpsProxyAgent(proxyUrl);

const options = {
  hostname: new URL(supabaseUrl).hostname,
  path: "/rest/v1/?select=*",
  method: "GET",
  agent,
  headers: {
    apikey: supabaseAnonKey,
    Authorization: "Bearer " + supabaseAnonKey
  }
};

https.get(options, res => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    try {
      const schema = JSON.parse(body);
      const members = schema.definitions.members;
      if (members) {
        console.log("notify_enabled definition:");
        console.log(JSON.stringify(members.properties.notify_enabled, null, 2));
      } else {
        console.log("Members table not found in definitions. Available tables:", Object.keys(schema.definitions));
      }
    } catch (e) {
      console.log("Error parsing schema:", e.message);
      console.log("Body starts with:", body.slice(0, 100));
    }
  });
}).on("error", e => {
  console.log("Request error:", e.message);
});
