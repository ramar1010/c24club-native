const https = require('https');

const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';
const HOST = 'ncpbiymnafxdfsvpxirb.supabase.co';

function get(path) {
  return new Promise((res, rej) => {
    const req = https.request(
      { hostname: HOST, path, headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); }
    );
    req.on('error', rej);
    req.end();
  });
}

(async () => {
  // 1. All members
  const all = await get('/rest/v1/members?select=id,name,membership,image_status,is_discoverable&limit=500');
  if (!Array.isArray(all)) { console.log('members error:', all); return; }
  console.log('Total members:', all.length);

  const memberships = [...new Set(all.map(m => m.membership))];
  console.log('Distinct memberships:', memberships);

  const approved = all.filter(m => m.image_status === 'approved');
  console.log('Approved images:', approved.length);

  const discoverable = all.filter(m => m.is_discoverable === true);
  console.log('Discoverable:', discoverable.length);

  const discApproved = all.filter(m => m.is_discoverable === true && m.image_status === 'approved');
  console.log('Discoverable + approved:', discApproved.length);
  if (discApproved.length > 0) console.log('Sample:', discApproved.slice(0,3).map(m => ({name: m.name, membership: m.membership})));

  // 2. VIP check via RPCs
  const adminRpc = await get('/rest/v1/rpc/get_admin_user_ids');
  const vipRpc = await get('/rest/v1/rpc/get_vip_user_ids');
  console.log('\nRPC admin result:', JSON.stringify(adminRpc).slice(0, 200));
  console.log('RPC vip result:', JSON.stringify(vipRpc).slice(0, 200));

  // 3. member_minutes
  const mm = await get('/rest/v1/member_minutes?select=user_id,is_vip&limit=5');
  console.log('\nmember_minutes sample:', JSON.stringify(mm).slice(0, 200));

  // 4. user_roles
  const roles = await get('/rest/v1/user_roles?select=user_id,role&limit=10');
  console.log('\nuser_roles sample:', JSON.stringify(roles).slice(0, 300));
})();