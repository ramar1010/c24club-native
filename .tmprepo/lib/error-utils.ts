/**
 * Utility to map technical error messages to user-friendly ones.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return 'Something went wrong. Please try again.';

  const message = typeof error === 'string' ? error : error?.message || 'Something went wrong.';

  // Map "A network error occurred" (Deno/Fetch default)
  if (message.includes('A network error occurred') || message.includes('Network request failed')) {
    return 'Connection timed out. Please check your internet and try again.';
  }

  // Map typical IAP errors
  if (message.includes('E_USER_CANCELLED')) {
    return 'Purchase cancelled.';
  }

  if (message.includes('E_ALREADY_OWNED')) {
    return 'You already own this item. Try restoring your purchases.';
  }

  // Map generic server errors
  if (message.includes('Internal Server Error') || message.includes('500')) {
    return 'Our server is having a moment. Please try again in a few minutes.';
  }

  return message;
}