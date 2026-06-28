SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'dm_messages', 'direct_call_invites', 'room_signals');
