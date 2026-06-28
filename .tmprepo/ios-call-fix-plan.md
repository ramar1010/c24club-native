# Plan - Stabilize iOS Direct Call Flow

## Context
Users report an iOS crash when picking up or accepting a direct call. This is likely due to the combination of React Native New Architecture, `react-native-webrtc` v124, and a race condition during media acquisition when transitioning from the random match screen to a direct call.

## Key Findings
- `video-call.tsx` calls `.toURL()` on streams without checking for existence, which can crash on New Architecture.
- `MediaStream` is used but not imported in `video-call.tsx`.
- Overlapping camera access between `ChatScreen` and `VideoCallScreen` causes native crashes on iOS.
- `iceCandidatePoolSize: 10` is used in `video-call.tsx`, which is known to be problematic on some mobile devices.

## Implementation Steps

### 1. Update `app/video-call.tsx`
- **Fix Imports**: Add `MediaStream` to the imports from `@/lib/webrtc`.
- **Stabilize Configuration**: Remove `iceCandidatePoolSize: 10` from the `configuration` object to match the more stable config in `useVideoChat.ts`.
- **Media Acquisition Guard**: Add a 500ms delay at the start of `setupCall` to allow any previous media session (e.g., from the Chat tab) to fully release the camera and microphone.
- **Modern RTCView Usage**: 
    - Use the `stream` prop (v124+) in addition to a safe `streamURL` fallback.
    - Implement the same safety check for `toURL()` used in `chat.tsx`.
    - Add `zOrder` props for consistent rendering.
- **Safe MediaStream Creation**: Ensure `new MediaStream([event.track])` has access to the imported `MediaStream` class.

### 2. Update `contexts/CallContext.tsx`
- **Navigation Delay**: Add a 300ms delay in `acceptInvite` after emitting the `prepare-direct-call` event and before navigating to `/video-call`. This gives the `ChatScreen` hook time to stop its tracks before the new screen attempts to acquire them.

## Files to Modify/Create
- `app/video-call.tsx`
- `contexts/CallContext.tsx`

## Verification
- **Test Flow**: 
    1. Open the app and go to the Chat tab (start a random match search).
    2. Receive a direct call from another user.
    3. Tap "Accept".
- **Success Criteria**:
    - The app should transition to `VideoCallScreen` without crashing.
    - Local and remote video should render correctly.
    - Voice and camera toggles should work.
    - Hanging up and returning to the previous screen should work.