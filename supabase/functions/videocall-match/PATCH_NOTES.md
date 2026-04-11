# videocall-match — Push Notification Patch

The `videocall-match` function lives on Supabase but is not stored locally.
This file documents the exact code change you need to apply to that function.

## Where to insert the code

Find the block that handles `type === 'join'`. Inside that block, after the female user
is added to the queue (i.e. after the `upsert` / `insert` into `waiting_queue`), add the
following code **when `memberGender === 'female'` or `memberGender === 'Female'`**:

```typescript
// After female user joins queue, notify eligible male users
if (memberGender?.toLowerCase() === 'female') {
  const { data: maleUsers } = await supabase
    .from('members')
    .select('id')
    .eq('gender', 'male')
    .eq('notify_enabled', true)
    .gt('last_active_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(100);

  if (maleUsers && maleUsers.length > 0) {
    // Fire and forget — don't await to avoid slowing down match
    Promise.all(
      maleUsers.map(user =>
        supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: user.id,
            title: '🔥 A girl is looking for a video chat!',
            body: 'Hurry before she leaves — tap to join now!',
            data: { deepLink: '/(tabs)/chat' },
            notification_type: 'female_searching',
            cooldown_minutes: 60,
          },
        })
      )
    ).catch(console.error);
  }
}
```

## Notes

- The `send-push-notification` function handles cooldown automatically via `push_notification_log`.
  Each male user will receive at most one "female searching" notification per 60 minutes.
- `supabase` in this context refers to the **service-role** Supabase client already instantiated
  at the top of the `videocall-match` function.
- Keep the `Promise.all(...).catch(console.error)` without `await` so it doesn't block the
  match-making response time.