CREATE OR REPLACE FUNCTION enqueue_email(queue_name text, payload jsonb)
RETURNS void AS $$
BEGIN
    RAISE NOTICE 'Email enqueued to % with payload %', queue_name, payload;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;