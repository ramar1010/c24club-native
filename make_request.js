const https = require('https');

const makeRequest = (hostname, path, method, headers, body) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const run = async () => {
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA';
  const baseUrl = 'ncpbiymnafxdfsvpxirb.supabase.co';
  const commonHeaders = {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  };

  const endpoints = [
    '/rest/v1/match_queue?limit=3',
    '/rest/v1/call_queue?limit=3',
    '/rest/v1/video_queue?limit=3',
    '/rest/v1/room_signals?limit=3'
  ];

  for (const endpoint of endpoints) {
    console.log(`--- Checking ${endpoint} ---`);
    try {
      const response = await makeRequest(baseUrl, endpoint, 'GET', commonHeaders);
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error(`Error checking ${endpoint}:`, error);
    }
  }

  console.log('--- Calling Edge Function videocall-match ---');
  const edgeFunctionUrl = '/functions/v1/videocall-match';
  const edgeFunctionHeaders = {
    ...commonHeaders,
    'Content-Type': 'application/json'
  };
  const payload = {
    "type": "join",
    "memberId": "test-member-123",
    "channelId": "test-channel-456",
    "genderPreference": "Both",
    "memberGender": "Male",
    "voiceMode": false
  };

  try {
    const response = await makeRequest(baseUrl, edgeFunctionUrl, 'POST', edgeFunctionHeaders, payload);
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error calling edge function:', error);
  }
};

run();
