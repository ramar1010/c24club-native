SUPABASE_URL="https://ncpbiymnafxdfsvpxirb.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA"

echo "--- 1. INSERT test signal ---"
curl -s -w "\nStatus: %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/room_signals" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"room_id\":\"test-room-rls-check\",\"sender_channel\":\"test-channel-rls-check\",\"signal_type\":\"test\",\"payload\":{}}"

echo "\n--- 2. SELECT test signal ---"
curl -s -w "\nStatus: %{http_code}\n" -X GET "$SUPABASE_URL/rest/v1/room_signals?room_id=eq.test-room-rls-check" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"

echo "\n--- 3. DELETE test signal ---"
curl -s -w "\nStatus: %{http_code}\n" -X DELETE "$SUPABASE_URL/rest/v1/room_signals?room_id=eq.test-room-rls-check" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"

echo "\n--- 4. SELECT anchor_queue schema ---"
curl -s -w "\nStatus: %{http_code}\n" -X GET "$SUPABASE_URL/rest/v1/anchor_queue?limit=1" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"