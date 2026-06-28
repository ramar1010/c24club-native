# Implementation Plan: Bounty System (C24 Club)

## 1. Context
The Bounty System enables verified female users on C24 Club to earn gifted minutes (revenue share) when male users they have recently interacted with (via DMs or Direct Calls) upgrade to or renew a VIP membership (Weekly or Monthly) via Apple IAP or Google Play. 

All verification must be performed securely server-side to prevent client-side spoofing. The platform converts revenue share to minutes at the standard rate ($0.02 per minute).

---

## 2. Key Findings & Existing Patterns
- **Database Architecture**: 
  - `members` table stores user profiles (including case-insensitive `gender`).
  - `member_minutes` table stores user balances (including `gifted_minutes` and `is_vip`).
  - Direct calls are recorded in the `direct_call_invites` table.
  - DM messages are recorded in the `dm_messages` table.
- **IAP Handling**: 
  - `iap-purchases` Supabase Edge Function handles on-device purchase token verification.
  - Global `useIAPListener.ts` handles StoreKit 2 and Google Play transaction verification.
- **Style Constraints**: 
  - Consistent hex-based styling matching the dark theme (#1A1A2E background, Primary Red `#EF4444`, Success Green `#22C55E`, Gold Accent `#FACC15`, and custom pink gradients for female earnings).
  - Use of `SafeAreaView` with `edges={["top"]}` or `edges={["top", "bottom"]}` in modals.

---

## 3. Implementation Steps

### Step 1: Backend Verification & Migration
Create and run a migration script in Supabase to deploy the tables, functions, and database triggers.

#### A. Database Tables
- **`bounty_attributions`**: Tracks interaction links.
  - Columns: `id` (UUID, primary key), `male_id` (UUID, references `auth.users`), `female_id` (UUID, references `auth.users`), `interaction_type` (VARCHAR, 'dm' or 'call'), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
  - Unique Constraint: `UNIQUE(male_id, female_id)`.
- **`bounty_earnings`**: Auditable logs of bounty rewards.
  - Columns: `id` (UUID, primary key), `female_id` (UUID, references `auth.users`), `male_id` (UUID, references `auth.users`), `amount_paid_usd` (NUMERIC), `minutes_awarded` (INT), `transaction_id_ref` (VARCHAR), `created_at` (TIMESTAMPTZ).

#### B. Database Functions & RPCs
- **`record_bounty_interaction(p_male_id UUID, p_female_id UUID, p_interaction_type VARCHAR)`**:
  - Validates that `p_male_id` has gender = 'male' and `p_female_id` has gender = 'female' (case-insensitive checks, using `.toLowerCase()`).
  - Upserts into `bounty_attributions`, updating `updated_at` to refresh the 30-day window.
- **`award_bounty_for_subscription(p_male_user_id UUID, p_amount_paid_usd NUMERIC, p_is_iap BOOLEAN, p_transaction_id_ref VARCHAR)`**:
  - Searches for the most recent attribution where `male_id = p_male_user_id` and `updated_at >= now() - INTERVAL '30 days'`.
  - Ensures `p_transaction_id_ref` hasn't already been credited in `bounty_earnings` (idempotency).
  - Calculates minutes: `v_minutes := floor((p_amount_paid_usd * 0.12) / 0.02)` (12% rev share). For a $9.99 subscription, this yields 60 minutes.
  - Inserts into `bounty_earnings` and increments `gifted_minutes` in `member_minutes` for the female user.
- **`get_bounty_summary(p_user_id UUID)`**:
  - Returns `total_minutes_earned`, `total_usd_earned`, `active_links_count`, and last 5 logs.

#### C. Automatic Triggers
- **`auto_record_bounty_from_dm`**: Triggers `AFTER INSERT` on `dm_messages`. Resolves sender/receiver genders and calls `record_bounty_interaction`.
- **`auto_record_bounty_from_room`**: Triggers `AFTER INSERT OR UPDATE` on `direct_call_invites` when `status = 'accepted'`. Resolves genders and calls `record_bounty_interaction`.

---

### Step 2: Server-Side Webhooks & Notifications (Edge Functions)

Create four dedicated server-side endpoints in Supabase to handle payments and renewals securely.

#### A. `apple-bounty-webhook`
- Handles iOS first-time purchases by accepting `purchaseToken` (JWS).
- Validates the JWS, upgrades the male user to VIP in `member_minutes`.
- Invokes `award_bounty_for_subscription` for any attributed female partner.

#### B. `apple-store-notifications`
- App Store Server Notifications V2 listener configured in App Store Connect.
- Handles `SUBSCRIBED` and `DID_RENEW` events. Decodes JWS, maps transaction to the subscriber's user ID, and awards the recurring bounty.

#### C. `google-bounty-webhook`
- Handles Android first-time purchases. Uses Google Play Developer API (with service account credentials) to verify `purchaseToken`.
- Upgrades the subscriber to VIP and awards the bounty via `award_bounty_for_subscription`.

#### D. `google-rtdn-handler`
- Real-Time Developer Notifications listener via Google Pub/Sub webhooks.
- Decodes Pub/Sub messages, verifies renewal state via the Google API, and awards the recurring bounty.

---

### Step 3: Mobile UI Components (Expo & React Native)

#### A. HomePage "Earn Money" CTA Banner
- **File**: `app/(tabs)/index.tsx`
- **Render Rule**: Render only if `profile?.gender?.toLowerCase() === 'female'`.
- **UI Design**: A gorgeous card with a pink/gold gradient (`LinearGradient` with colors `#FB7185` & `#FBBF24`). Include a coin/money emoji, a prominent heading `"💰 Earn Cash from Chats & Calls"`, and a subtitle `"When guys you talk to go VIP, you get paid instantly!"`.
- **Action**: Opens `BountyGuideModal`.

#### B. BountyGuideModal
- **File**: `components/modals/BountyGuideModal.tsx` (New component)
- **Features**: A 4-step stepper tutorial:
  - **Step 1: Connect & Chat 🎥**: Interact with male users in DMs or Video Calls.
  - **Step 2: Get Linked 🔗**: Our system automatically links you for 30 days after any chat.
  - **Step 3: They Go VIP 👑**: When they subscribe to Weekly or Monthly VIP, you earn.
  - **Step 4: Cash Out 💸**: Receive gifted minutes instantly. Convert them to cash via PayPal in your profile!
- **UI Elements**: Progress bar, navigation controls ("Back", "Next", "Done"), modern high-contrast typography, and safety disclaimers using `c24club.com` for references.

#### C. MessagesPage Bounty Header
- **File**: `app/messages/[id].tsx`
- **Render Rule**: Render at the top of the conversation list/thread if the current user is female and the chat partner is male.
- **UI Design**: A thin, clean header banner: `"💡 Earn up to 300 minutes when they go VIP. See how →"`.
- **Action**: Opens `BountyGuideModal`.

#### D. Profile Page Breakdown
- **File**: `app/(tabs)/profile.tsx`
- **Render Rule**: Render within the "My Rewards" section for female users.
- **UI Design**: A stats row showing:
  - `"Linked Partners: X"`
  - `"Bounty Earned: Y min ($Z.ZZ)"`
  - A small text action `"Learn how to earn more →"` that opens `BountyGuideModal`.

---

### Step 4: Mobile Logic & Integration

#### A. IAP Verification Update
- Modify `iap-purchases` Edge Function's `verify-subscription` handler to run `award_bounty_for_subscription` immediately after updating a male user's VIP status.
- This ensures any first-time subscription completed inside the app triggers immediate real-time attribution credit.

---

## 4. Files to Modify/Create

### New Files
1. `components/modals/BountyGuideModal.tsx`
2. `supabase/functions/apple-bounty-webhook/index.ts`
3. `supabase/functions/apple-store-notifications/index.ts`
4. `supabase/functions/google-bounty-webhook/index.ts`
5. `supabase/functions/google-rtdn-handler/index.ts`

### Files to Modify
1. `app/(tabs)/index.tsx` (Add HomePage CTA and trigger)
2. `app/(tabs)/profile.tsx` (Add Bounty earnings stats and guide trigger)
3. `app/messages/[id].tsx` (Add DM thread banner)
4. `supabase/functions/iap-purchases/index.ts` (Call bounty award on subscription verification)

---

## 5. Verification & Testing

1. **Database Logic Verification**:
   - Insert dummy male and female members with appropriate case-insensitive genders.
   - Insert a dummy message into `dm_messages`. Verify that a row is automatically inserted into `bounty_attributions` with a 30-day expiration window.
   - Run `award_bounty_for_subscription` manually with the male user's ID. Verify that the female's `gifted_minutes` balance increases and a row is logged in `bounty_earnings`.

2. **Edge Function Verification**:
   - Run local/test HTTP POST requests to `apple-bounty-webhook` and `google-bounty-webhook` with dummy tokens. Ensure validation failure is handled cleanly and authentic requests trigger the RPC.

3. **UI/UX End-to-End Verification**:
   - Log in as a female user:
     - Verify the HomePage "Earn Money" CTA banner displays.
     - Click the banner and verify that the `BountyGuideModal` opens with a functioning 4-step stepper.
     - Go to direct DMs with a male user and verify that the DM thread banner displays.
     - Go to the Profile tab and check that active links and bounty earnings appear under My Rewards.
   - Log in as a male user:
     - Verify that none of the female-only bounty banners, guides, or CTA options are visible.