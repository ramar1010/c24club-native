/**
 * stream-handoff.ts
 *
 * A module-level store for transferring a live MediaStream from the chat
 * screen to video-call.tsx on iOS without stopping/reacquiring the camera.
 *
 * Why: iOS does not allow re-acquiring the camera immediately after stopping
 * it. The only reliable way to hand off a call is to keep the stream alive
 * and pass it directly to the next screen.
 *
 * Usage:
 *   // Before navigating (chat screen):
 *   handoffStream(localStream);
 *
 *   // After mounting (video-call screen):
 *   const stream = consumeHandoffStream();  // returns stream and clears store
 */

let _stream: any | null = null;

/** Deposit a stream for the next screen to pick up. */
export function handoffStream(stream: any) {
  _stream = stream;
}

/**
 * Consume and return the deposited stream, clearing the store.
 * Returns null if no stream was deposited.
 */
export function consumeHandoffStream(): any | null {
  const s = _stream;
  _stream = null;
  return s;
}

/** Peek without consuming — useful for checking if a stream is waiting. */
export function peekHandoffStream(): any | null {
  return _stream;
}