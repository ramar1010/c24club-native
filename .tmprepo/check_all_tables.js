const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

const supabaseUrl = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";
const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:8080';
const agent = new HttpsProxyAgent(proxyUrl);

const candidates = [
  'members', 'member_minutes', 'member_interests', 'member_redemptions', 'room_signals', 'waiting_queue',
  'conversations', 'dm_messages', 'dm_threads', 'dm_list', 'messages', 'direct_messages', 'chats', 'threads', 'notifications',
  'payouts', 'subscriptions', 'vip_settings', 'discover_profile_views', 'direct_call_invites',
  'promos', 'rewards', 'orders', 'transactions', 'logs', 'events', 'profiles', 'users',
  'reward_items', 'member_stats', 'member_rewards', 'member_logs', 'member_payouts',
  'member_sessions', 'member_reports', 'member_blocks', 'member_friends', 'member_followers',
  'messages_private', 'private_messages', 'user_conversations', 'user_messages',
  'conversation_participants', 'convo_messages', 'chat_messages', 'thread_messages'
];

function check(table) {
  return new Promise((resolve) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      agent: agent,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer ' + supabaseAnonKey,
        'Range': '0-0'
      }
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ table, status: res.statusCode, body });
      });
    });
    req.on('error', e => resolve({ table, error: e.message }));
    req.end();
  });
}

async function run() {
  const results = [];
  for (const table of candidates) {
    const res = await check(table);
    if (res.status === 200 || res.status === 206) {
      results.push(table);
    }
  }
  console.log("EXISTING TABLES:");
  console.log(results.join('\n'));
}
run();
