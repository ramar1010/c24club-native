# Push Notifications Implementation Plan

## 1. Context

C24 Club needs two server-sent push notifications to re-engage users and drive match volume:

1. **Feature 1 — Female Searching Alert** (male recipients only): Fires when a female user joins the matchmaking queue via `videocall-match`. Tells nearby-active male users a girl is searching so they tap into the chat tab.
2. **Feature 2 — General Searching Reminder** (all users, inactive 30+ min): A periodic reminder for users who haven't been active recently that someone is in the queue waiting.

The app already has `expo-notifications` installed (`^55.0.16`), has `notify_enabled` on the `members` table, and has a partially-wired `useNotifyFemaleOnline` hook + `FemaleNotifyCard` UI toggle — but there is no actual token registration or server-push infrastructure yet. `push_token` is not in `MemberProfile` and no token is ever saved to the DB.

Firebase FCM secrets (`FIREBASE_SERVICE_ACCOUNT`, `FCM_SERVER_KEY`) are already configured in the Supabase project's edge function secrets.

---

## 2. Key Findings

| Finding | Detail |
|---|---|
| `expo-notifications` installed | `package.json` has `"expo-notifications": "^55.0.16"` |
| `expo-device` installed | `"expo-device": "~8.0.10"` — needed to gate token registration to real devices |
| No token registration code exists | `grep` across `app/`, `lib/`, `hooks/`, `contexts/` found zero calls to `getExpoPushTokenAsync` / `getDevicePushTokenAsync` |
| `notify_enabled` exists in DB + TypeScript | `MemberProfile.notify_enabled: boolean` (line 23 `AuthContext.tsx`) |
| `push_token` NOT in `MemberProfile` | Must be added to the interface and the `updateProfile` flow |
| `role` column on `members` — not in TypeScript | Noted in task description but not yet in `MemberProfile` interface |
| `useNotifyFemaleOnline` hook | `hooks/useNotifyFemaleOnline.ts` — saves toggle state in AsyncStorage, requests OS permission when enabled. This is local-only; needs to wire up to a server token save |
| App scheme is `c24club` | `app.config.ts` line: `scheme: "c24club"` — used for deep links |
| Deep link path for Chat tab | `/(tabs)/chat` — confirmed from `app/(tabs)/_layout.tsx` routing and `app/(tabs)/index.tsx` line 60: `router.push("/(tabs)/chat")` |
| `videocall-match` edge function | Called via `supabase.functions.invoke('videocall-match', { body: { type: 'join', memberGender, ... } })` in `hooks/useVideoChat.ts` line ~469 |
| `waiting_queue` table columns | `member_id`, `channel_id`, `member_gender`, `gender_preference`, `voice_mode`, `created_at` |
| `rooms` table exists | Used in `lib/chat-utils.ts` — columns include `member1`, `member2`, `status`, `connected_at`, `disconnected_at`. Can be used to check if a user is in an active room |
| Existing edge function: `notify-direct-call` | Used in `CallContext.tsx` line 201 — already deployed on Supabase, proves pattern works |
| No `push_notification_log` table referenced anywhere | Must be created fresh |
| `app.config.ts` — no `expo-notifications` plugin | Must be added for iOS push entitlements |
| EAS project ID | `3f21aa81-c90d-4050-b1a6-80b40a69cf31` — needed for Expo push token project |
| Supabase project ref | `ncpbiymnafxdfsvpxirb` |
| `AuthContext.updateProfile` | Existing method to write fields back to `members` table — reuse to save `push_token` |

---

## 3. Architecture Overview

```
Client (Expo app)
  └── On app launch / auth: request OS permission, get FCM/Expo device token
  └── Save token → members.push_token  (via updateProfile)
  └── Handle foreground notification → navigate to /(tabs)/chat

Supabase Edge Function: send-push-notification
  └── Accepts: { user_id, title, body, data, priority? }
  └── Reads push_token from members table
  └── Calls FCM HTTP v1 API using FIREBASE_SERVICE_ACCOUNT
  └── Returns 200 on success/skipped, 4xx on hard errors

Supabase Edge Function: videocall-match  (MODIFY existing)
  └── On type='join' with memberGender='female' (or 'Female'):
      └── Calls send-push-notification for eligible male users

Supabase Edge Function: notify-searching-users  (NEW, scheduled)
  └── Called by pg_cron every 5 minutes
  └── Checks if anyone is in waiting_queue
  └── Finds users: notify_enabled=true, inactive 30+ min, not in active room
  └── Cooldown check via push_notification_log (max 1 per 2 hours)
  └── Calls send-push-notification for each eligible user

Database table: push_notification_log
  └── user_id, notification_type, last_sent_at
  └── Used for cooldown enforcement by both edge functions
```

---

## 4. Implementation Steps

### Step 1: Create `push_notification_log` Table (SQL — run in Supabase dashboard)

```sql
-- Create push notification log table for cooldown tracking
CREATE TABLE IF NOT EXISTS push_notification_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,  -- 'female_searching' | 'user_searching'
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type)
);

-- Index for fast lookup by user + type
CREATE INDEX IF NOT EXISTS idx_push_log_user_type
  ON push_notification_log (user_id, notification_type);

-- RLS: only service_role can read/write (edge functions use service_role)
ALTER TABLE push_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON push_notification_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**Note:** The `UNIQUE` constraint on `(user_id, notification_type)` allows using `ON CONFLICT DO UPDATE` (upsert) to set `last_sent_at`, keeping the table lean — one row per user per notification type.

---

### Step 2: Add `push_token` and `role` to `MemberProfile` TypeScript Interface

**File:** `contexts/AuthContext.tsx`

Add two fields to the `MemberProfile` interface (after `shipping_country`):

```typescript
// In MemberProfile interface, add:
push_token: string | null;
role: string | null;
```

This lets `updateProfile` write `push_token` to the DB and lets the client read the user's `role` field if needed.

---

### Step 3: Add `expo-notifications` Plugin to `app.config.ts`

**File:** `app.config.ts`

Add to the `plugins` array (alongside existing entries):

```typescript
[
  "expo-notifications",
  {
    icon: "./assets/images/icon.png",
    color: "#EF4444",
    sounds: [],
    androidMode: "default",
    androidCollapsedTitle: "C24 Club",
    iosDisplayInForeground: true,
  }
],
```

Also add to `ios.infoPlist`:
```typescript
UIBackgroundModes: ["remote-notification"],
```

And add to `android.permissions`:
```
"android.permission.POST_NOTIFICATIONS",
```

---

### Step 4: Create `lib/notifications.ts` — Token Registration Utility

**File:** `lib/notifications.ts` (NEW)

This module handles all client-side push notification setup. It will be imported and called from `AuthContext`.

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers for push notifications and returns the FCM/APNs device token.
 * Returns null if on simulator, permission denied, or web.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    console.log('[notifications] Push not available on simulator');
    return null;
  }

  // Check/request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Push permission denied');
    return null;
  }

  // Android: create notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'C24 Club',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#EF4444',
    });
  }

  try {
    // Get the native device push token (works with FCM directly)
    const tokenData = await Notifications.getDevicePushTokenAsync();
    // tokenData.data is the FCM registration token on Android, APNs token on iOS
    return tokenData.data ?? null;
  } catch (err) {
    console.warn('[notifications] getDevicePushTokenAsync error:', err);
    return null;
  }
}

/**
 * Sets up listener to handle notification taps (background → foreground navigation).
 * Returns cleanup function.
 */
export function setupNotificationListeners(
  onNotificationResponse: (notification: Notifications.NotificationResponse) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    onNotificationResponse
  );
  return () => subscription.remove();
}
```

**Why `getDevicePushTokenAsync` instead of `getExpoPushTokenAsync`?**  
The server uses FCM HTTP v1 directly (not Expo's push service). `getDevicePushTokenAsync` returns the raw FCM registration token on Android and the APNs token on iOS — exactly what FCM v1 needs.

---

### Step 5: Wire Token Registration into `contexts/AuthContext.tsx`

**File:** `contexts/AuthContext.tsx`

**Changes:**

1. Import the new utility at the top:
```typescript
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/notifications';
```

2. Inside `fetchUserData`, after a profile is confirmed (both found and newly created), call `registerForPushNotifications()` and save the token if it changed. Add this block after `setProfile(profileData as MemberProfile)`:

```typescript
// Register push token and save to DB if changed
try {
  const token = await registerForPushNotifications();
  if (token && token !== profileData.push_token) {
    await supabase
      .from('members')
      .update({ push_token: token })
      .eq('id', userId);
    // Update local state
    setProfile(prev => prev ? { ...prev, push_token: token } : null);
  }
} catch (_) {
  // Non-fatal — app works fine without push token
}
```

3. In the `AuthProvider` component body (inside the `useEffect` for auth), add notification response listener setup after `initializeAuth()`:

```typescript
useEffect(() => {
  // ... existing auth init ...

  // Handle notification taps → navigate to deep link
  const cleanup = setupNotificationListeners((response) => {
    const data = response.notification.request.content.data;
    if (data?.deepLink) {
      // Navigation must happen after auth is ready — defer slightly
      setTimeout(() => {
        try {
          const { router } = require('expo-router');
          router.push(data.deepLink as string);
        } catch (_) {}
      }, 500);
    }
  });

  return () => {
    cleanup();
    // ... existing subscription.unsubscribe() ...
  };
}, []);
```

**Important:** The notification listener effect should be a separate `useEffect` from the auth state subscription, or cleanly integrated alongside it. The `require('expo-router')` inside the callback avoids circular import issues since `AuthContext` is imported by `_layout.tsx` which provides the router.

---

### Step 6: Create `send-push-notification` Edge Function

**File:** `supabase/functions/send-push-notification/index.ts` (NEW — deploy to Supabase)

This is the shared notification dispatch function. All other edge functions call this one.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── FCM HTTP v1: get OAuth2 access token from service account ──────────────
async function getFCMAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Base64url encode
  const encode = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import the RSA private key from service account
  const privateKey = serviceAccount.private_key
    .replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const keyData = Uint8Array.from(atob(privateKey), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ── Send one FCM message ────────────────────────────────────────────────────
async function sendFCMMessage(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
  projectId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  const message: any = {
    token,
    notification: { title, body },
    data,
    android: {
      priority: "high",
      notification: {
        channel_id: "default",
        sound: "default",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: "default",
          badge: 1,
          "content-available": 1,
        },
      },
      headers: { "apns-priority": "10" },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    // UNREGISTERED = stale token, remove it
    if (errText.includes("UNREGISTERED") || errText.includes("NOT_FOUND")) {
      return { success: false, error: "UNREGISTERED" };
    }
    return { success: false, error: errText };
  }

  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { user_id, title, body, data = {}, priority = "high" } =
      await req.json();

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch user's push token
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .select("push_token, notify_enabled")
      .eq("id", user_id)
      .maybeSingle();

    if (memberErr || !member) {
      return new Response(JSON.stringify({ skipped: true, reason: "user_not_found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!member.notify_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "notify_disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!member.push_token) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_push_token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse service account
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const projectId = serviceAccount.project_id;

    // Get FCM access token
    const accessToken = await getFCMAccessToken(serviceAccount);

    // Ensure all data values are strings (FCM requirement)
    const stringData: Record<string, string> = {
      deepLink: "/(tabs)/chat",
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    };

    const result = await sendFCMMessage(
      member.push_token,
      title,
      body,
      stringData,
      projectId,
      accessToken
    );

    // If token is stale, clear it from DB
    if (!result.success && result.error === "UNREGISTERED") {
      await supabase
        .from("members")
        .update({ push_token: null })
        .eq("id", user_id);
    }

    return new Response(JSON.stringify({ success: result.success, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

### Step 7: Modify `videocall-match` Edge Function — Feature 1

**File:** Existing `videocall-match` edge function deployed on Supabase (modify in Supabase dashboard or via `supabase functions deploy`)

The `videocall-match` function handles `type: 'join'` calls from the client. When a female user joins the queue (determined by `memberGender === 'female'` or `'Female'`), it should trigger notifications to eligible male users.

**Add this block inside the `type === 'join'` handler, after the user is added to the queue:**

```typescript
// ── Feature 1: Notify males when a female joins queue ─────────────────────
const memberGenderLower = (memberGender || '').toLowerCase();
if (memberGenderLower === 'female') {
  // Run async — don't block the join response
  notifyMalesAsync(memberId).catch(console.error);
}

async function notifyMalesAsync(femaleMemberId: string) {
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const cooldownCutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour

  // 1. Find eligible male users:
  //    - gender = 'male' (case-insensitive)
  //    - last_active_at within 24h
  //    - notify_enabled = true
  //    - push_token NOT null
  //    - NOT the female user herself
  const { data: eligibleMales } = await supabase
    .from('members')
    .select('id')
    .ilike('gender', 'male')
    .eq('notify_enabled', true)
    .not('push_token', 'is', null)
    .gte('last_active_at', cutoff24h)
    .neq('id', femaleMemberId);

  if (!eligibleMales || eligibleMales.length === 0) return;

  for (const male of eligibleMales) {
    // 2. Check cooldown: max 1 female_searching notification per hour
    const { data: logEntry } = await supabase
      .from('push_notification_log')
      .select('last_sent_at')
      .eq('user_id', male.id)
      .eq('notification_type', 'female_searching')
      .maybeSingle();

    if (logEntry && logEntry.last_sent_at > cooldownCutoff) {
      continue; // Still in cooldown
    }

    // 3. Check if user is in an active room (skip if already chatting)
    const { data: activeRoom } = await supabase
      .from('rooms')
      .select('id')
      .or(`member1.eq.${male.id},member2.eq.${male.id}`)
      .eq('status', 'connected')
      .maybeSingle();

    if (activeRoom) continue; // Already in a call

    // 4. Send notification via send-push-notification function
    await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: male.id,
        title: '🔥 A girl is looking for a video chat!',
        body: 'Hurry before she leaves — tap to join now!',
        data: { deepLink: '/(tabs)/chat', type: 'female_searching' },
      },
    });

    // 5. Upsert cooldown log
    await supabase
      .from('push_notification_log')
      .upsert(
        { user_id: male.id, notification_type: 'female_searching', last_sent_at: now.toISOString() },
        { onConflict: 'user_id,notification_type' }
      );
  }
}
```

**Note:** The `supabase` client in this context must be initialized with `SUPABASE_SERVICE_ROLE_KEY` so it can call other edge functions and write to `push_notification_log`.

---

### Step 8: Create `notify-searching-users` Edge Function — Feature 2

**File:** `supabase/functions/notify-searching-users/index.ts` (NEW — deploy to Supabase)

This function is called by pg_cron every 5 minutes.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // Allow cron invocations (no auth header)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const now = new Date();

    // 1. Check if anyone is currently in the waiting_queue
    const { data: queueEntries, error: queueError } = await supabase
      .from('waiting_queue')
      .select('member_id')
      .limit(1);

    if (queueError) throw queueError;

    if (!queueEntries || queueEntries.length === 0) {
      // Nobody searching — don't send notifications
      return new Response(
        JSON.stringify({ skipped: true, reason: 'queue_empty' }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Find eligible users to notify:
    //    - notify_enabled = true
    //    - push_token NOT null
    //    - last_active_at is NULL or more than 30 minutes ago (inactive)
    const inactiveCutoff = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const cooldownCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    const { data: eligibleUsers, error: usersError } = await supabase
      .from('members')
      .select('id, last_active_at')
      .eq('notify_enabled', true)
      .not('push_token', 'is', null)
      .or(`last_active_at.is.null,last_active_at.lte.${inactiveCutoff}`);

    if (usersError) throw usersError;
    if (!eligibleUsers || eligibleUsers.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no_eligible_users' }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let notified = 0;
    let skipped = 0;

    for (const user of eligibleUsers) {
      // 3. Check cooldown: max 1 user_searching notification per 2 hours
      const { data: logEntry } = await supabase
        .from('push_notification_log')
        .select('last_sent_at')
        .eq('user_id', user.id)
        .eq('notification_type', 'user_searching')
        .maybeSingle();

      if (logEntry && logEntry.last_sent_at > cooldownCutoff) {
        skipped++;
        continue;
      }

      // 4. Skip if user is in an active room
      const { data: activeRoom } = await supabase
        .from('rooms')
        .select('id')
        .or(`member1.eq.${user.id},member2.eq.${user.id}`)
        .eq('status', 'connected')
        .maybeSingle();

      if (activeRoom) {
        skipped++;
        continue;
      }

      // 5. Skip if user is already in the waiting_queue themselves
      const { data: inQueue } = await supabase
        .from('waiting_queue')
        .select('member_id')
        .eq('member_id', user.id)
        .maybeSingle();

      if (inQueue) {
        skipped++;
        continue;
      }

      // 6. Send notification
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user.id,
          title: '💬 Someone is waiting to chat!',
          body: 'A user is searching for a video chat — jump back in!',
          data: { deepLink: '/(tabs)/chat', type: 'user_searching' },
        },
      });

      // 7. Upsert cooldown log
      await supabase
        .from('push_notification_log')
        .upsert(
          { user_id: user.id, notification_type: 'user_searching', last_sent_at: now.toISOString() },
          { onConflict: 'user_id,notification_type' }
        );

      notified++;
    }

    return new Response(
      JSON.stringify({ success: true, notified, skipped }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error('[notify-searching-users]', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

---

### Step 9: Set Up pg_cron for Feature 2

**Run in Supabase SQL editor:**

```sql
-- Enable pg_cron extension (if not already enabled)
-- Do this in the Supabase dashboard: Database → Extensions → pg_cron

-- Schedule notify-searching-users every 5 minutes
SELECT cron.schedule(
  'notify-searching-users',              -- job name
  '*/5 * * * *',                         -- every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/notify-searching-users',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb
    )
  $$
);
```

**Alternative (simpler) cron approach using the Supabase dashboard:**
Go to: Database → Cron Jobs → Create new job with the above schedule and HTTP POST to the edge function URL using the service role key as Bearer token.

---

### Step 10: Update `useNotifyFemaleOnline` Hook

**File:** `hooks/useNotifyFemaleOnline.ts`

The current hook saves the toggle state locally and requests OS permission. It needs to also sync the `notify_enabled` field to the database when the value changes, so the server-side logic can filter on it.

```typescript
// Add to imports:
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Inside useNotifyFemaleOnline():
const { user } = useAuth();

// Modify setEnabled to also sync to DB:
const setEnabled = useCallback(async (value: boolean) => {
  setEnabledState(value);
  await AsyncStorage.setItem(STORAGE_KEY, String(value));

  // Sync to members.notify_enabled
  if (user?.id) {
    await supabase
      .from('members')
      .update({ notify_enabled: value })
      .eq('id', user.id);
  }

  if (value) {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    } catch (_) {}
  }
}, [user?.id]);
```

**Note:** This hook is used by `FemaleNotifyCard` (shown to male users) and `notification-settings.tsx`. Both show the "Female is searching" toggle, which maps directly to `notify_enabled` in the DB.

---

### Step 11: Handle Deep Link Navigation on Notification Tap

**File:** `app/_layout.tsx`

The `setupNotificationListeners` call in `AuthContext` (Step 5) handles routing via `router.push()`. However, the router may not be available at the time the `AuthContext` effect runs. A cleaner approach is to handle it in `_layout.tsx` where the router is available.

**Add to `RootLayoutInner` component in `app/_layout.tsx`:**

```typescript
import { setupNotificationListeners } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';

// Inside RootLayoutInner, after existing useEffect hooks:
useEffect(() => {
  // Handle notification tap → deep link navigation
  const cleanup = setupNotificationListeners((response) => {
    const deepLink = response.notification.request.content.data?.deepLink as string | undefined;
    if (deepLink && session) {
      router.push(deepLink as any);
    }
  });

  // Handle notification that launched the app (was tapped while app was killed)
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      const deepLink = response.notification.request.content.data?.deepLink as string | undefined;
      if (deepLink && session) {
        setTimeout(() => router.push(deepLink as any), 1000);
      }
    }
  });

  return cleanup;
}, [session]);
```

**Remove** the `setupNotificationListeners` call from `AuthContext` (Step 5 note above) — keep the registration-only logic there, and handle routing here in `_layout.tsx` where the router is unambiguously available.

---

## 5. Files to Modify / Create

| File | Action | Purpose |
|---|---|---|
| `contexts/AuthContext.tsx` | **Modify** | Add `push_token` + `role` to `MemberProfile` interface; call `registerForPushNotifications()` after profile load; save token to DB if changed |
| `app/_layout.tsx` | **Modify** | Add notification response listener for deep link routing; import `setupNotificationListeners` + `expo-notifications` |
| `app.config.ts` | **Modify** | Add `expo-notifications` plugin config; add `UIBackgroundModes` for iOS; add `POST_NOTIFICATIONS` permission for Android |
| `hooks/useNotifyFemaleOnline.ts` | **Modify** | Sync `notify_enabled` to Supabase DB when toggle changes |
| `lib/notifications.ts` | **Create** | Token registration, foreground handler config, notification listener setup |
| `supabase/functions/send-push-notification/index.ts` | **Create** | FCM HTTP v1 dispatch function — shared by all notification triggers |
| `supabase/functions/notify-searching-users/index.ts` | **Create** | Periodic function for Feature 2; called by pg_cron every 5 min |
| **Supabase Dashboard (SQL)** | **Run SQL** | Create `push_notification_log` table + RLS policy + index |
| **Supabase Dashboard (SQL)** | **Run SQL** | Set up pg_cron job for `notify-searching-users` |
| **Supabase Dashboard (Edge Function)** | **Modify** | Add Feature 1 notification block to existing `videocall-match` function |

---

## 6. Verification

### 6.1 Database Verification
```sql
-- Confirm table was created
SELECT * FROM push_notification_log LIMIT 5;

-- Confirm members has push_token column
SELECT id, push_token, notify_enabled, gender, last_active_at
FROM members
WHERE push_token IS NOT NULL
LIMIT 5;
```

### 6.2 Token Registration
1. Build a development client (`eas build --profile development`) or run on a real device via `expo start`
2. Log in to the app
3. Accept push notification permission prompt
4. In Supabase dashboard: `SELECT push_token FROM members WHERE id = '<your_user_id>'` — should show a non-null FCM token string

### 6.3 Feature 1 (Female Searching Alert)
1. Have a male test account with `notify_enabled=true`, `push_token` set, and `last_active_at` within 24h
2. Open the app on a second device (or use Supabase SQL editor to directly insert a `waiting_queue` row with `member_gender='female'`) 
3. Have a female test account join the chat queue
4. Within seconds, the male device should receive a push notification: "🔥 A girl is looking for a video chat!"
5. Tapping the notification should open the app to the Chat tab (`/(tabs)/chat`)
6. Run again within 1 hour — the male user should NOT receive a second notification (cooldown check)
7. Verify in DB: `SELECT * FROM push_notification_log WHERE notification_type = 'female_searching'`

### 6.4 Feature 2 (General Searching Reminder)
1. Have a test account with `notify_enabled=true`, `push_token` set, `last_active_at` > 30 min ago
2. Have a second account join the chat queue
3. Wait up to 5 minutes for the cron job, or manually invoke:
   ```bash
   curl -X POST https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/notify-searching-users \
     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
   ```
4. The inactive test account should receive: "💬 Someone is waiting to chat!"
5. Invoke again immediately — no second notification (2-hour cooldown)
6. Verify cron is scheduled: `SELECT * FROM cron.job;`

### 6.5 Edge Cases to Verify
- User already in active room → no notification sent (check `rooms.status='connected'`)
- User already in queue themselves → no Feature 2 notification (they're already searching)
- `notify_enabled=false` → no notification (checked in `send-push-notification`)
- Stale/expired push token → token cleared from `members.push_token`, no crash
- App in foreground when notification arrives → notification shown as alert (configured in `setNotificationHandler`)
- App killed, user taps notification → `getLastNotificationResponseAsync` handles navigation

---

## 7. Important Notes & Potential Pitfalls

### iOS APNs Token Handling
`getDevicePushTokenAsync()` on iOS returns the raw APNs binary token (hex string). For FCM HTTP v1 to work on iOS, you must also configure APNs in the Firebase Console (upload the APNs Auth Key or certificate). The app's bundle ID is `com.c24club.app`.

### `videocall-match` Modification Risk
The `videocall-match` function is the core matching function — any errors in the notification block must NOT fail the join response. The `notifyMalesAsync()` call must be fire-and-forget (`.catch()` swallowed) so notification failures don't block matchmaking.

### pg_cron Requires `pg_net`
The cron job uses `net.http_post` which requires the `pg_net` extension. Enable both `pg_cron` and `pg_net` in Supabase dashboard → Database → Extensions before running the cron SQL.

### `push_token` Column May Not Exist Yet
The task description states `members` has `push_token` column. Verify this with:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'push_token';
```
If missing, add it:
```sql
ALTER TABLE members ADD COLUMN IF NOT EXISTS push_token TEXT;
```

### Expo SDK 54 / expo-notifications v55
`expo-notifications` v55 changed some APIs. Specifically, `getExpoPushTokenAsync` now requires a `projectId` param. We use `getDevicePushTokenAsync` instead (bypasses Expo's push relay), so this is not an issue. However, the plugin registration in `app.config.ts` is required for iOS to set up push entitlements automatically in EAS builds.

### `last_active_at` Update
The notification rules depend on `last_active_at` being updated when users interact with the app. Confirm the `session-init` edge function (called in `chat.tsx` line ~140) updates this field, or add an update in `fetchUserData` in `AuthContext`:
```typescript
// After confirming profile exists, update last_active_at:
await supabase
  .from('members')
  .update({ last_active_at: new Date().toISOString() })
  .eq('id', userId);
```