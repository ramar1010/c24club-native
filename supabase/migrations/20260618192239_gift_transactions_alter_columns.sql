DO $$
BEGIN
    -- Rename column minutes to minutes_amount if minutes exists and minutes_amount doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='gift_transactions' AND column_name='minutes'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='gift_transactions' AND column_name='minutes_amount'
    ) THEN
        ALTER TABLE public.gift_transactions RENAME COLUMN minutes TO minutes_amount;
    END IF;

    -- Add column price_cents if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='gift_transactions' AND column_name='price_cents'
    ) THEN
        ALTER TABLE public.gift_transactions ADD COLUMN price_cents int4;
    END IF;
END $$;

-- Data API privileges visibility
grant select, insert, update, delete on public.gift_transactions to authenticated;
grant select, insert, update, delete on public.gift_transactions to service_role;