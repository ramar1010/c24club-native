/**
 * lib/iap-import.ts
 *
 * Minimal, clean wrapper around react-native-iap v14 (Nitro / StoreKit 2).
 * Only exports what's actually used in the app — keeps dead code out of the bundle
 * and makes it easy to see the full IAP surface area at a glance.
 */

import {
  initConnection as _initConnection,
  endConnection as _endConnection,
  fetchProducts as _fetchProducts,
  requestPurchase as _requestPurchase,
  purchaseUpdatedListener as _purchaseUpdatedListener,
  purchaseErrorListener as _purchaseErrorListener,
  finishTransaction as _finishTransaction,
  getAvailablePurchases as _getAvailablePurchases,
  getPendingTransactionsIOS as _getPendingTransactionsIOS,
  clearTransactionIOS as _clearTransactionIOS,
} from 'react-native-iap';
import { Platform } from 'react-native';

// ── Connection ──────────────────────────────────────────────────────────────
// initConnection is idempotent — safe to call multiple times.
// NEVER call endConnection — it tears down the Nitro bridge for the entire app lifetime.
export const initConnection = _initConnection;

// ── Product fetching ────────────────────────────────────────────────────────
// Must be called with type: 'subs' to register subscription products with StoreKit.
export const getSubscriptions = ({ skus }: { skus: string[] }) =>
  _fetchProducts({ skus, type: 'subs' });

// getProducts — for consumable in-app purchases (unban, minute bundles, etc.)
export const getProducts = ({ skus }: { skus: string[] }) =>
  _fetchProducts({ skus, type: 'in-app' });

// ── Purchase initiation ─────────────────────────────────────────────────────
// requestSubscription — wraps requestPurchase with type: 'subs'.
// iOS call shape:    { request: { apple: { sku } } }
// Android call shape: { request: { google: { skus, subscriptionOffers } } }
export const requestSubscription = (args: {
  request: {
    apple?: { sku: string; andDangerouslyFinishTransactionAutomatically?: boolean };
    google?: { skus: string[]; subscriptionOffers: { sku: string; offerToken: string }[] };
  };
}) => {
  if (Platform.OS === 'ios') {
    return _requestPurchase({
      request: { apple: args.request.apple },
      type: 'subs',
    });
  } else {
    return _requestPurchase({
      request: { google: args.request.google },
      type: 'subs',
    });
  }
};

// requestPurchase — for consumable in-app purchases (pass-through, type defaults to 'in-app')
export const requestPurchase = _requestPurchase;

// ── Listeners ───────────────────────────────────────────────────────────────
export const purchaseUpdatedListener = _purchaseUpdatedListener;
export const purchaseErrorListener = _purchaseErrorListener;

// ── Transaction completion ──────────────────────────────────────────────────
export const finishTransaction = _finishTransaction;

export const getAvailablePurchases = _getAvailablePurchases;

// ── iOS-specific: pending/stuck transaction recovery ────────────────────────
// getPendingTransactionsIOS returns unfinished consumable transactions that
// getAvailablePurchases does NOT include. Essential for recovering stuck gifts.
export const getPendingTransactionsIOS = _getPendingTransactionsIOS;

// clearTransactionIOS finishes ALL unfinished transactions — nuclear option
// when getPendingTransactionsIOS can't find the stuck item.
export const clearTransactionIOS = _clearTransactionIOS;