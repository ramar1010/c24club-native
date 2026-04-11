-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Members Table
CREATE TABLE IF NOT EXISTS members (
    id uuid REFERENCES auth.users(id) PRIMARY KEY,
    name text,
    email text,
    image_url text,
    image_thumb_url text,
    image_status text DEFAULT 'pending',
    bio text,
    gender text,
    is_discoverable boolean DEFAULT true,
    notify_enabled boolean DEFAULT true,
    push_token text,
    membership text DEFAULT 'Free',
    title text,
    birthdate date,
    city text,
    country text,
    state text,
    profession text,
    last_active_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    call_slug text,
    zip text,
    phone_number text,
    is_test_account boolean DEFAULT false,
    role text DEFAULT 'user'
);

-- Member Minutes Table
CREATE TABLE IF NOT EXISTS member_minutes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES members(id) ON DELETE CASCADE UNIQUE,
    minutes float8 DEFAULT 0,
    ad_points float8 DEFAULT 0,
    gifted_minutes float8 DEFAULT 0,
    is_vip boolean DEFAULT false,
    vip_tier text,
    admin_granted_vip boolean DEFAULT false,
    chance_enhancer float8 DEFAULT 0,
    ce_minutes_checkpoint float8 DEFAULT 0,
    is_frozen boolean DEFAULT false,
    frozen_at timestamptz,
    freeze_free_until timestamptz,
    vip_unfreezes_used int4 DEFAULT 0,
    vip_unfreezes_reset_at timestamptz,
    frozen_cap_popup_shown boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Gift Transactions Table
CREATE TABLE IF NOT EXISTS gift_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id uuid REFERENCES members(id),
    recipient_id uuid REFERENCES members(id),
    tier_id int4,
    minutes float8,
    cash_value float8,
    status text DEFAULT 'pending',
    stripe_session_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- VIP Settings Table
CREATE TABLE IF NOT EXISTS vip_settings (
    user_id uuid REFERENCES members(id) ON DELETE CASCADE PRIMARY KEY,
    pinned_socials text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Freeze Settings Table
CREATE TABLE IF NOT EXISTS freeze_settings (
    id int4 PRIMARY KEY DEFAULT 1,
    minute_threshold int4 DEFAULT 100,
    frozen_earn_rate float8 DEFAULT 0.5,
    one_time_unfreeze_price float8 DEFAULT 0.99,
    vip_unfreezes_per_month int4 DEFAULT 3,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Cashout Settings Table
CREATE TABLE IF NOT EXISTS cashout_settings (
    id int4 PRIMARY KEY DEFAULT 1,
    min_cashout_minutes int4 DEFAULT 100,
    max_cashout_minutes int4 DEFAULT 5000,
    rate_per_minute float8 DEFAULT 0.02,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Cashout Requests Table
CREATE TABLE IF NOT EXISTS cashout_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES members(id),
    minutes_amount float8,
    cash_amount float8,
    paypal_email text,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- User Bans Table
CREATE TABLE IF NOT EXISTS user_bans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    ban_type text,
    reason text,
    is_active boolean DEFAULT true,
    unban_payment_session text,
    unbanned_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- User Reports Table
CREATE TABLE IF NOT EXISTS user_reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id uuid REFERENCES auth.users(id),
    reported_user_id uuid REFERENCES auth.users(id),
    reason text,
    details text,
    screenshot_url text,
    created_at timestamptz DEFAULT now()
);

-- Email Send Log Table
CREATE TABLE IF NOT EXISTS email_send_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email text,
    template_name text,
    sent_at timestamptz DEFAULT now()
);

-- Add triggers for updated_at
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_member_minutes_updated_at BEFORE UPDATE ON member_minutes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_gift_transactions_updated_at BEFORE UPDATE ON gift_transactions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_vip_settings_updated_at BEFORE UPDATE ON vip_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_freeze_settings_updated_at BEFORE UPDATE ON freeze_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_cashout_settings_updated_at BEFORE UPDATE ON cashout_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_cashout_requests_updated_at BEFORE UPDATE ON cashout_requests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_user_bans_updated_at BEFORE UPDATE ON user_bans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE freeze_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Members: Users can read all, but only update their own
CREATE POLICY "Public profiles are viewable by everyone." ON members FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON members FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON members FOR UPDATE USING (auth.uid() = id);

-- Member Minutes: Users can read their own
CREATE POLICY "Users can view own minutes." ON member_minutes FOR SELECT USING (auth.uid() = user_id);

-- Gift Transactions: Users can view transactions where they are sender or recipient
CREATE POLICY "Users can view own gift transactions." ON gift_transactions FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- VIP Settings: Users can read all (to see partner socials) but only update their own
CREATE POLICY "VIP settings are viewable by everyone." ON vip_settings FOR SELECT USING (true);
CREATE POLICY "Users can update own VIP settings." ON vip_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own VIP settings." ON vip_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Freeze Settings: Publicly readable
CREATE POLICY "Freeze settings are viewable by everyone." ON freeze_settings FOR SELECT USING (true);

-- Cashout Settings: Publicly readable
CREATE POLICY "Cashout settings are viewable by everyone." ON cashout_settings FOR SELECT USING (true);

-- Cashout Requests: Users can view and insert their own
CREATE POLICY "Users can view own cashout requests." ON cashout_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cashout requests." ON cashout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Bans: Users can view their own
CREATE POLICY "Users can view own bans." ON user_bans FOR SELECT USING (auth.uid() = user_id);

-- User Reports: Users can insert
CREATE POLICY "Users can insert reports." ON user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);