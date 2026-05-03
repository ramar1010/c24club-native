/**
 * Native stub for useFrameModeration.
 * Frame moderation via canvas capture is web-only.
 * On mobile, this hook is a no-op.
 */
export function useFrameModeration(_options: {
  enabled: boolean;
  reportedUserId: string | null;
  onFlagged: (reason: string) => void;
}) {
  return { reset: () => {} };
}