/**
 * CatDoes Watch - Error Tracking Configuration
 *
 * This file initializes the CatDoes Watch SDK for error tracking and monitoring.
 * https://catdoes.watch
 *
 * To enable error tracking:
 * 1. Go to your project settings in CatDoes
 * 2. Navigate to the "Watch" section
 * 3. Copy your API key
 * 4. Add it to your environment: EXPO_PUBLIC_CATDOES_WATCH_KEY=cd_watch_xxxxx
 */

import {
  Watch,
  setupGlobalHandlers,
  type WatchClient,
  type WatchConfig,
} from "@catdoes/watch";

// Declare __DEV__ for TypeScript
declare const __DEV__: boolean;

/**
 * Initialize CatDoes Watch SDK
 *
 * Call this function early in your app's lifecycle (e.g., in _layout.tsx).
 * Returns the client instance if initialization was successful.
 */
export function initCatDoesWatch(
  options?: Partial<WatchConfig>,
): WatchClient | null {
  const apiKey = process.env.EXPO_PUBLIC_CATDOES_WATCH_KEY || "";

  // Don't initialize if no API key is provided
  if (!apiKey) {
    if (__DEV__) {
      console.debug(
        "[CatDoes Watch] No API key found. Set EXPO_PUBLIC_CATDOES_WATCH_KEY to enable error tracking.",
      );
    }
    return null;
  }

  const client = Watch.init({
    apiKey,
    debug: __DEV__,
    // You can customize these options:
    // captureConsoleErrors: false,  // Enable to capture console.error calls
    // maxBreadcrumbs: 20,           // Maximum breadcrumbs to keep
    // beforeSend: (event) => event, // Modify or filter events before sending
    ...options,
  });

  // Set up global error handlers (window.onerror, unhandledrejection, ErrorUtils)
  if (client) {
    setupGlobalHandlers(client);
  }

  return client;
}

// Re-export useful utilities for manual error capture
export { Watch } from "@catdoes/watch";
