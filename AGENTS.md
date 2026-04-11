# AGENTS.md

This file provides guidance to CatDoes (catdoes.com) when working with code in this repository.

## Project Overview

Expo (SDK 54) + React Native mobile app template using file-based routing (expo-router), NativeWind v4 for styling, and gluestack-ui v3 for the component library. Targets iOS, Android, and web. React Native New Architecture is enabled.

**App:** C24 Club — an Omegle-style video chat app where users earn reward minutes by chatting and can redeem them in a reward store. Connected to an existing Supabase backend from the lovable web app.

## Commands

- **Start dev server:** `npm start` (or `expo start`)
- **Platform-specific:** `npm run ios`, `npm run android`, `npm run web` (sets `DARK_MODE=media`)
- **Lint:** `npm run lint` (uses eslint-config-expo flat config)
- **Type check:** `npm run typecheck` (`tsc --noEmit`)
- **EAS build:** `eas build --profile development|preview|production`
- **Install packages:** `npm install --legacy-peer-deps` (enforced via `.npmrc`)

## Architecture

### Routing

File-based routing via expo-router. All routes live in `app/`.

**App Screens:**
- `app/(tabs)/_layout.tsx` — Bottom tab navigator: Home, Chat, Discover, Messages, Profile
- `app/(tabs)/index.tsx` — Home screen (Hero, How It Works, Comparison, CTA)
- `app/(tabs)/chat.tsx` — Random match video chat (uses useWebRTC and room_signals)
- `app/(tabs)/rewards.tsx` — Reward store (pulls from Supabase rewards table)
- `app/(tabs)/discover.tsx` — Real-time member list (direct calls, DMs, interests, selfie capture)
- `app/(tabs)/messages.tsx` — Conversation list (DMs)
- `app/(tabs)/profile.tsx` — User profile (VIP status, minutes, redemptions, stats)
- `app/(auth)/` — Login, Signup, Forgot Password
- `app/messages/[id].tsx` — Direct messaging thread
- `app/video-call.tsx` — Direct video call session (handshake via room_signals)
- `app/vip.tsx` — VIP membership upgrade screen (Weekly/Monthly/Lifetime passes)
- `app/rules.tsx` — App rules and guidelines screen
- `app/banned.tsx` — Full-screen ban overlay (not a route, rendered directly in _layout.tsx)

### Ban Enforcement System

- `hooks/useBanCheck.ts` — Hook that queries `user_bans` with a fresh DB call (never cached) on every mount/auth change. Returns `{ isBanned, banData, banLoading, recheckBan, clearBan }`.
- `components/BannedScreen.tsx` — Full-screen blocking component rendered in `_layout.tsx` when `isBanned` is true. Bypasses all navigation. Includes:
  - Ban reason & date display
  - **Underage ban**: permanent notice, no appeal option
  - **Other bans**: Pay $10 via Stripe (calls `unban-payment` Edge Function with `action: "create-checkout"`)
  - Verify payment button (calls `unban-payment` with `action: "verify-payment"`)
  - Contact Support form (inserts into `user_reports` with `[BAN APPEAL]` prefix)
  - Sign Out button
- Deep link handler in `_layout.tsx` listens for `?unban=success` / `?unban=canceled` query params returned from Stripe checkout. On success it calls verify-payment and clears the ban if confirmed.
- Ban data model (`user_bans`): `id, user_id, ban_type, reason, is_active, unban_payment_session, unbanned_at, created_at, updated_at`
- Reports model (`user_reports`): `id, reporter_id, reported_user_id, reason, details, screenshot_url, created_at`

### Notifications

- `lib/usePushNotifications.ts` — Custom hook for registering push tokens and handling foreground/tapped events.
- Tokens are saved to `members.push_token`.
- Foreground notifications show banners; background taps navigate to `data.screen` or `data.deepLink`.
- Android channel ID is `"default"`.

### Backend: Supabase

The app connects to the same Supabase instance as the web app.
- `lib/supabase.ts` — Central client with AsyncStorage persistence
- `contexts/AuthContext.tsx` — Central state for session, profile (members), and minutes (member_minutes)

### Data Models (Lovable Schema)

- `members` — User profiles (name, gender, image_url, is_discoverable, etc.)
- `member_minutes` — User balances (reward minutes, ad points, total earned)
- `rewards` — Items in store
- `member_redemptions` — Purchase history
- `promos` — User promotions
- `direct_call_invites` — Handshake for direct calls (pending, accepted, declined, hangup)
- `room_signals` — Real-time signaling for WebRTC (offer/answer/candidates)
- `conversations` — DM conversation metadata
- `dm_messages` — DM text content
- `member_interests` — User interest/match system (for Discover tab)
- `vip_settings` — VIP-only settings (like pinned socials)
- `discover_profile_views` — Tracks profile views between users
- `male_search_batch_log` — Tracks male joins for female batch notifications.
- `user_bans` — Active/inactive ban records; read-only from app (admins write via web panel)
- `user_reports` — Support/appeal messages; app inserts for ban appeals

### Signaling Logic

The app uses `room_signals` table for WebRTC signaling.
Both Random Match (`useWebRTC`) and Direct Calls (`video-call.tsx`) are consistent.
`sender_channel` is used to filter signals from self vs partner.

### WebRTC Shims

- `lib/webrtc.ts` — Handles platform-specific WebRTC logic (native via react-native-webrtc shims, web via browser API)
- `app/video-call.tsx` and `app/(tabs)/chat.tsx` are compatible with web preview

### Style Guidelines

- Dark-themed (#1A1A2E background)
- Use `StyleSheet.create` for precise styling with hex colors matching the C24 Club brand
- Use `SafeAreaView` with `edges={["top"]}`
- Primary Red (#EF4444), Success Green (#22C55E), Gold Accent (#FACC15)

## Important Technical Notes

- `expo-router` is used for navigation. Always use `router.push()` or `<Link />`.
- `useAuth()` provides the user profile and minute balance throughout the app.
- `useCall()` in `CallContext` manages direct call states (invites) and VIP gating.
- Direct calling features outgoing and incoming call modals via `CallInviteListener`.
- Direct calls require VIP status for male users when calling female users.
- Ban check runs on every auth state change — never cached. Banned users see `BannedScreen` and cannot access any app route.
- The `unban-payment` Edge Function at `https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/unban-payment` handles all Stripe logic. App only sends `action: "create-checkout"` or `action: "verify-payment"`.
- **VIP Pinned Socials** (`hooks/usePinnedSocials.ts` + `components/videocall/PinnedSocialsDisplay.tsx`): When a random match connects, the current user's partner's VIP status is checked via `member_minutes` (`is_vip` OR `admin_granted_vip`). If VIP, `vip_settings.pinned_socials` (text array of `"platform:username"` strings) is fetched and rendered as tappable overlay badges below the report button in `chat.tsx`. Supported platforms: cashapp, tiktok, instagram, snapchat, discord (no link), venmo, paypal. Usernames are sanitized (leading `@`, `$`, `/` stripped). Socials clear automatically on disconnect/next.