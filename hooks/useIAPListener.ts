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
  getSubscriptions,
  getAvailablePurchases,
  getPendingTransactionsIOS,
  clearTransactionIOS,
  getProducts,
} from '@/lib/iap-import';
import { supabase } from '@/lib/supabase';
import { invokeIAP, invokeBountyWebhook, getIAPOriginalTransactionId, getIAPSubscriptionEnd } from '@/lib/iap-supabase';
import { IAP_SUBSCRIPTIONS, IAP_PRODUCTS, MINUTE_BUNDLES } from '@/lib/iap';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveGiftPurchase, hasActiveGiftResolver } from '@/lib/gift-utils';
import { useQueryClient } from '@tanstack/react-query';

const ALL_SUBSCRIPTION_SKUS = [
  IAP_SUBSCRIPTIONS.BASIC_VIP,
  IAP_SUBSCRIPTIONS.PREMIUM_VIP,
];

// SKUs that require a recipient_id (Gifts) should NOT be handled by the global listener
// as we don't know who the recipient is here. They are handled by GiftModal/createGiftCheckout.
const GIFT_SKUS = [
  IAP_PRODUCTS.GIFT_100_MINUTES,
  IAP_PRODUCTS.GIFT_400_MINUTES,
  IAP_PRODUCTS.GIFT_600_MINUTES,
  IAP_PRODUCTS.GIFT_1000_MINUTES,
];

// SKUs that are handled by specific local listeners/modals and should be ignored globally
const LOCALLY_HANDLED_SKUS = [
  ...GIFT_SKUS,
  IAP_PRODUCTS.UNBAN,
  IAP_PRODUCTS.MINUTE_UNFREEZE,
];

const PENDING_GIFT_KEY = "pending_gift_recipient";

export function useIAPListener() {
  const { user, refreshProfile, syncVipStatus, updateMinutesFromRow, minutes, updateProfile } = useAuth();
  const offerTokensRef = useRef<Record<string, string>>({});
  // Track processed transaction IDs to avoid double-processing
  const processedRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const verifyAndFinish = useCallback(async (purchase: any) => {
    const { productId, transactionId, transactionReceipt, purchaseToken } = purchase as any;

    // Deduplicate — the store can re-deliver the same transaction multiple times
    const txKey = transactionId || purchaseToken || productId;
    if (processedRef.current.has(txKey)) {
      console.log('[IAP] Already processed, skipping:', txKey);
      return;
    }
    processedRef.current.add(txKey);

    // In react-native-iap v14 (StoreKit 2), purchaseToken is the unified field for the receipt JWS.
    const token = purchaseToken ?? transactionReceipt;
    if (!token) {
      console.warn('[IAP] No token for purchase, skipping:', productId);
      return;
    }

    const productIdLower = productId?.toLowerCase();

    try {
      // ── GIFT SKUs — always handled here (sole finishTransaction caller) ──
      // createGiftCheckout no longer registers its own purchaseUpdatedListener.
      // It registers a resolve callback via registerGiftResolver() instead.
      // We call resolveGiftPurchase() here to complete that promise.
      const isGiftSku = GIFT_SKUS.some(sku => sku.toLowerCase() === productIdLower);

      if (isGiftSku) {
        console.log('[IAP] Gift SKU — processing in global listener (sole handler):', productId);
        const pendingRecipientId = await AsyncStorage.getItem(`${PENDING_GIFT_KEY}_${productIdLower}`);

        if (!pendingRecipientId) {
          console.warn('[IAP] Gift SKU but no pending recipient found — skipping:', productId);
          // No resolver to call, nothing to finish
          return;
        }

        console.log('[IAP] Verifying gift for recipient:', pendingRecipientId);
        const { data, error } = await invokeIAP({
          action: 'verify-gift',
          sku: productId,
          purchaseToken: token,
          platform: Platform.OS,
          recipient_id: pendingRecipientId,
        });

        if (data?.success) {
          try {
            await finishTransaction({ purchase, isConsumable: true });
          } catch (finishErr: any) {
            // Safe to swallow — gift was credited; transaction may have been finished already
            console.warn('[IAP] finishTransaction swallowed for gift:', finishErr?.message);
          }
          await AsyncStorage.removeItem(`${PENDING_GIFT_KEY}_${productIdLower}`);
          console.log('[IAP] Gift verified and finished successfully!');
          resolveGiftPurchase(productId, { success: true });
        } else {
          console.warn('[IAP] Gift verification failed:', data?.error || error);
          resolveGiftPurchase(productId, { success: false, error: data?.error || 'Verification failed' });
          // Don't mark as processed so it can be retried on next app open
          processedRef.current.delete(txKey);
        }
        return;
      }

      // ── Other locally-handled SKUs (unban, unfreeze) — skip here ────────
      const isLocallyHandled = LOCALLY_HANDLED_SKUS.some(sku => sku.toLowerCase() === productIdLower);
      if (isLocallyHandled) {
        console.log('[IAP] SKU handled locally, skipping global listener:', productId);
        processedRef.current.delete(txKey);
        return;
      }

      // ── Subscription (VIP) ──────────────────────────────────────────────
      const isSubscription = ALL_SUBSCRIPTION_SKUS.some(sku => sku.toLowerCase() === productIdLower);
      if (isSubscription) {
        console.log('[IAP] Verifying VIP subscription:', productId);
        
        // 1. Primary VIP activation via verify-subscription
        const { data: verifyData, error: verifyError } = await invokeIAP({
          action: 'verify-subscription',
          sku: productId,
          purchaseToken: token,
          platform: Platform.OS,
          transactionId,
        });

        if (verifyError) {
          console.error('[IAP] verify-subscription error:', verifyError);
          // We continue to bounty webhook even if this fails, as bounty might succeed 
          // and it also updates VIP status.
        }

        // After IAP success, POST the receipt to the corresponding Bounty webhook
        // (apple-bounty-webhook on iOS, google-bounty-webhook on Android). These
        // bounty-aware endpoints verify the receipt, upgrade VIP status, and award
        // referral bounties for male subscribers. `token` is the JWS receipt on iOS
        // and the purchase token on Android.
        console.log('[IAP] Verifying subscription with bounty webhook:', productId);
        const originalTransactionId = getIAPOriginalTransactionId(purchase as Record<string, unknown>);
        const subscriptionEnd = getIAPSubscriptionEnd(purchase as Record<string, unknown>);
        const { data, error } = await invokeBountyWebhook(Platform.OS, {
          sku: productId,
          purchaseToken: token,
          platform: Platform.OS,
          transactionId,
          original_transaction_id: originalTransactionId,
          subscription_end: subscriptionEnd,
        });
        if (error) {
          console.error('[IAP] Edge function error:', error);
          throw error;
        }
        
        console.log('[IAP] Backend verification response:', data);
        
        // If either the primary verify or the bounty webhook succeeded, we're good
        if (verifyData?.success || data?.success) {
          await finishTransaction({ purchase, isConsumable: false });
          
          // 1. Clear any local VIP caches (AsyncStorage + React Query)
          if (user?.id) {
            try {
              await AsyncStorage.removeItem(`vip_status_${user.id}`);
              console.log('[IAP] Local VIP cache cleared for:', user.id);
              
              // Invalidate discover_members cache to show VIP badge immediately
              queryClient.invalidateQueries({ queryKey: ["discover_members", user.id] });
              console.log('[IAP] React Query cache invalidated for discover_members');
            } catch (e) {
              console.warn('[IAP] Failed to clear VIP cache:', e);
            }
          }

          // 2. Update local state immediately from response (FAST SYNC)
          const resultData = verifyData?.success ? verifyData : data;
          if (resultData.member_minutes) {
            console.log('[IAP] Updating minutes immediately from backend response row');
            updateMinutesFromRow(resultData.member_minutes);
            
            // 1.5 Update profile membership locally and in DB
            if (resultData.member_minutes.is_vip && resultData.member_minutes.vip_tier) {
              const tier = resultData.member_minutes.vip_tier;
              const newMembership = tier.charAt(0).toUpperCase() + tier.slice(1);
              console.log('[IAP] Updating profile membership to:', newMembership);
              updateProfile({ membership: newMembership }, true);
            }

            // Proactively trigger a full sync to update profile membership too
            syncVipStatus();
          } else {
            // Fallback: trigger a manual check-subscription if the row is missing
            console.log('[IAP] No member_minutes in response, calling check-subscription as fallback...');
            invokeIAP({ action: 'check-subscription' }).then(({ data: syncData }) => {
              if (syncData?.member_minutes) {
                updateMinutesFromRow(syncData.member_minutes);
              } else {
                syncVipStatus();
              }
            }).catch(() => syncVipStatus());
          }

          // 3. Immediate and follow-up refreshes
          await refreshProfile();
          
          // Second safety refresh after a short delay to catch everything
          setTimeout(() => refreshProfile(), 2000);

          console.log('[IAP] VIP subscription verified and finished:', productId);
          
          // Only show alert if user isn't already VIP (avoid duplicate alerts)
          if (!minutes?.is_vip) {
            Alert.alert('🎉 Welcome to VIP!', 'Your subscription is now active. Enjoy your VIP perks!');
          }
        } else {
          console.error('[IAP] Backend verification failed:', verifyData?.error || data?.error);
          const errorMsg = verifyData?.error || data?.error || 'Subscription verification failed';
          const debugMsg = (verifyData?.debugInfo || data?.debugInfo) ? `\n\nDebug: ${verifyData?.debugInfo || data?.debugInfo}` : '';
          throw new Error(`${errorMsg}${debugMsg}`);
        }
        return;
      }

      // ── Minute bundles ──────────────────────────────────────────────────
      // Note: In this app, minute bundles are primarily used for gifting.
      // If there are ever "buy minutes for self" SKUs, they would be handled here.
      const minuteSku = MINUTE_BUNDLES.find((b) => b.sku.toLowerCase() === productIdLower);
      const isGift = GIFT_SKUS.some(sku => sku.toLowerCase() === productIdLower);
      
      if (minuteSku && !isGift) {
        const { data, error } = await invokeIAP({
          action: 'verify-minutes',
          sku: productId,
          purchaseToken: token,
          platform: Platform.OS,
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

        // Prefetch ALL consumable product SKUs so StoreKit 2 recognizes them.
        // Without this, requestPurchase() throws "unknown product" on iOS.
        try {
          const allConsumableSkus = [
            ...GIFT_SKUS,
            IAP_PRODUCTS.UNBAN,
            IAP_PRODUCTS.MINUTE_UNFREEZE,
          ];
          console.log('[IAP] Prefetching consumable product SKUs:', allConsumableSkus);
          await getProducts({ skus: allConsumableSkus });
          console.log('[IAP] Consumable products registered with StoreKit');
        } catch (e) {
          console.warn('[IAP] Could not prefetch consumable products:', e);
        }

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

        // iOS: Proactively check for stuck gift transactions via getPendingTransactionsIOS
        if (Platform.OS === 'ios') {
          try {
            const pendingTxns = await getPendingTransactionsIOS();
            if (pendingTxns && pendingTxns.length > 0) {
              console.log('[IAP] Found pending iOS transactions on startup:', pendingTxns.map((p: any) => p.productId));
              for (const txn of pendingTxns) {
                const pid = txn.productId?.toLowerCase();
                const isGift = GIFT_SKUS.some(sku => sku.toLowerCase() === pid);
                if (isGift) {
                  const pendingRecipientId = await AsyncStorage.getItem(`${PENDING_GIFT_KEY}_${pid}`);
                  const token = (txn as any).purchaseToken ?? (txn as any).transactionReceipt;
                  if (pendingRecipientId && token) {
                    console.log('[IAP] Recovering stuck gift on startup for recipient:', pendingRecipientId);
                    try {
                      const { data } = await invokeIAP({
                        action: 'verify-gift',
                        sku: txn.productId,
                        purchaseToken: token,
                        platform: Platform.OS,
                        recipient_id: pendingRecipientId,
                      });
                      if (data?.success) {
                        await finishTransaction({ purchase: txn, isConsumable: true });
                        await AsyncStorage.removeItem(`${PENDING_GIFT_KEY}_${pid}`);
                        console.log('[IAP] Startup: stuck gift recovered and finished!');
                      }
                    } catch (e) {
                      console.warn('[IAP] Startup: gift recovery failed:', e);
                    }
                  } else if (!pendingRecipientId && token) {
                    // No recipient saved — old stuck transaction from before recovery system
                    // Just finish it to unblock future purchases
                    console.log('[IAP] Startup: finishing orphaned gift transaction (no recipient):', txn.productId);
                    try {
                      await finishTransaction({ purchase: txn, isConsumable: true });
                      console.log('[IAP] Startup: orphaned gift transaction finished.');
                    } catch (e) {
                      console.warn('[IAP] Startup: failed to finish orphaned gift:', e);
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[IAP] Could not check pending iOS transactions:', e);
          }
        }

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: any) => {
          if (!alive) return;
          console.log('[IAP] purchaseUpdatedListener fired (global):', purchase?.productId);
          await verifyAndFinish(purchase);
        });

        purchaseErrorSub = purchaseErrorListener(async (error: any) => {
          const code = error?.code ?? '';
          const message = error?.message ?? '';
          const errProductId = error?.productId ?? '';
          const errProductIdLower = errProductId.toLowerCase();

          // If it's a gift SKU error, resolve the waiting createGiftCheckout promise
          const isGiftError = GIFT_SKUS.some(sku => sku.toLowerCase() === errProductIdLower);
          if (isGiftError) {
            if (code === 'E_USER_CANCELLED' || code === '2') {
              await AsyncStorage.removeItem(`${PENDING_GIFT_KEY}_${errProductIdLower}`);
              resolveGiftPurchase(errProductId, { success: false, error: 'cancelled' });
            } else {
              resolveGiftPurchase(errProductId, { success: false, error: message || 'Purchase failed' });
            }
            return;
          }

          if (code !== 'E_USER_CANCELLED') {
            console.warn('[IAP] purchaseErrorListener (global):', message);
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
      // NOTE: do NOT call endConnection() here — it tears down the entire Nitro
      // bridge for react-native-iap, breaking IAP on any screen that's used after
      // this hook unmounts. The connection persists for the app lifetime.
    };
  }, [user?.id]);
}