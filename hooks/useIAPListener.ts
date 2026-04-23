/**
 * useIAPListener
 *
 * Global IAP purchase listener — must be mounted at app root so it can:
 *   1. Catch any unfinished/pending transactions from a previous session
 *      (the store re-delivers them on every app open until acknowledged)
 *   2. Handle subscription verifications without depending on the VIP screen
 *      being mounted
 *
 * The VIP screen's own listener is kept as a fallback, but this one runs
 * first and covers the "close app before finishTransaction" race condition.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import {
  initConnection,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  endConnection,
  getSubscriptions,
} from '@/lib/iap-import';
import { supabase } from '@/lib/supabase';
import { IAP_SUBSCRIPTIONS, IAP_PRODUCTS, MINUTE_BUNDLES } from '@/lib/iap';
import { useAuth } from '@/contexts/AuthContext';

const ALL_SUBSCRIPTION_SKUS = [
  IAP_SUBSCRIPTIONS.BASIC_VIP,
  IAP_SUBSCRIPTIONS.PREMIUM_VIP,
];

export function useIAPListener() {
  const { user, refreshProfile } = useAuth();
  const offerTokensRef = useRef<Record<string, string>>({});
  // Track processed transaction IDs to avoid double-processing
  const processedRef = useRef<Set<string>>(new Set());

  const verifyAndFinish = useCallback(async (purchase: any) => {
    const { productId, transactionId, transactionReceipt, purchaseToken } = purchase as any;

    // Deduplicate — the store can re-deliver the same transaction multiple times
    const txKey = transactionId || purchaseToken || productId;
    if (processedRef.current.has(txKey)) {
      console.log('[IAP] Already processed, skipping:', txKey);
      return;
    }
    processedRef.current.add(txKey);

    const token = Platform.OS === 'android' ? purchaseToken : transactionReceipt;
    if (!token) {
      console.warn('[IAP] No token for purchase, skipping:', productId);
      return;
    }

    try {
      // ── Subscription (VIP) ──────────────────────────────────────────────
      if (ALL_SUBSCRIPTION_SKUS.includes(productId)) {
        const { data, error } = await supabase.functions.invoke('iap-purchases', {
          body: {
            action: 'verify-subscription',
            sku: productId,
            purchaseToken: token,
            platform: Platform.OS,
          },
        });
        if (error) throw error;
        if (data?.success) {
          await finishTransaction({ purchase, isConsumable: false });
          await refreshProfile();
          console.log('[IAP] VIP subscription verified and finished:', productId);
          Alert.alert('🎉 Welcome to VIP!', 'Your subscription is now active.');
        } else {
          throw new Error(data?.error || 'Subscription verification failed');
        }
        return;
      }

      // ── Minute bundles ──────────────────────────────────────────────────
      const minuteSku = MINUTE_BUNDLES.find((b) => b.sku === productId);
      if (minuteSku) {
        const { data, error } = await supabase.functions.invoke('iap-purchases', {
          body: {
            action: 'verify-minutes',
            sku: productId,
            purchaseToken: token,
            platform: Platform.OS,
          },
        });
        if (error) throw error;
        if (data?.success) {
          await finishTransaction({ purchase, isConsumable: true });
          await refreshProfile();
          console.log('[IAP] Minutes purchase verified and finished:', productId);
        } else {
          throw new Error(data?.error || 'Minutes verification failed');
        }
        return;
      }

      console.warn('[IAP] Unknown productId, finishing without verification:', productId);
      await finishTransaction({ purchase, isConsumable: false });
    } catch (err: any) {
      // Remove from processed so it can be retried on next open
      processedRef.current.delete(txKey);
      console.error('[IAP] verifyAndFinish error:', err?.message);
    }
  }, [refreshProfile]);

  useEffect(() => {
    // Only run on native — web has no IAP
    if (Platform.OS === 'web') return;
    // Only run when authenticated
    if (!user?.id) return;

    let purchaseUpdateSub: any;
    let purchaseErrorSub: any;
    let alive = true;

    const setup = async () => {
      try {
        await initConnection();

        // Prefetch offer tokens for Android subscriptions
        if (Platform.OS === 'android') {
          try {
            const subs = await getSubscriptions({ skus: ALL_SUBSCRIPTION_SKUS });
            if (Array.isArray(subs)) {
              subs.forEach((sub: any) => {
                const offerDetails = sub.subscriptionOfferDetailsAndroid;
                if (Array.isArray(offerDetails) && offerDetails.length > 0) {
                  offerTokensRef.current[sub.productId ?? sub.id] = offerDetails[0].offerToken;
                }
              });
            }
          } catch (e) {
            console.warn('[IAP] Could not fetch offer tokens on startup:', e);
          }
        }

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: any) => {
          if (!alive) return;
          console.log('[IAP] purchaseUpdatedListener fired (global):', purchase?.productId);
          await verifyAndFinish(purchase);
        });

        purchaseErrorSub = purchaseErrorListener((error: any) => {
          if (error?.code !== 'E_USER_CANCELLED') {
            console.warn('[IAP] purchaseErrorListener (global):', error?.message);
          }
        });

        console.log('[IAP] Global listener initialized for user:', user.id);
      } catch (err) {
        console.warn('[IAP] Global init error:', err);
      }
    };

    setup();

    return () => {
      alive = false;
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };
  }, [user?.id]);
}