import { Platform } from 'react-native';

export const getTimeAgo = (dateStr: string | null): string => {
  if (!dateStr) return 'Offline';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
};

export const isEffectivelyOnline = (
  id: string,
  gender: string | null,
  lastActiveAt: string | null
): boolean => {
  if (!lastActiveAt) return false;

  // Manual override for owner/test accounts if needed
  // ...

  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMins = (now.getTime() - lastActive.getTime()) / 60000;

  // Females stay "online" longer to encourage engagement
  const threshold = gender?.toLowerCase() === 'female' ? 15 : 8;
  return diffMins < threshold;
};