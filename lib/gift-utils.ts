import { supabase } from "./supabase";
import { invokeIAP } from "./iap-supabase";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  getPendingTransactionsIOS,
  clearTransactionIOS,
  getProducts,
} from "@/lib/iap-import";
import { IAP_PRODUCTS } from "@/lib/iap";

export interface GiftTier {
  id: number;
  minutes: number;
  price: number;
  cashValue: number;
  senderBonus: number;
  sku: string;
}

export const GIFT_TIERS: GiftTier[] = [
  { id: 100, minutes: 100, price: 1.99, cashValue: 1.0, senderBonus: 0, sku: IAP_PRODUCTS.GIFT_100_MINUTES },
  { id: 400, minutes: 400, price: 4.99, cashValue: 4.0, senderBonus: 100, sku: IAP_PRODUCTS.GIFT_400_MINUTES },
  { id: 600, minutes: 600, price: 7.99, cashValue: 6.0, senderBonus: 150, sku: IAP_PRODUCTS.GIFT_600_MINUTES },
  { id: 1000, minutes: 1000, price: 12.99, cashValue: 10.0, senderBonus: 250, sku: IAP_PRODUCTS.GIFT_1000_MINUTES },
];

const PENDING_GIFT_KEY = "pending_gift_recipient";

// ─── Module-level resolver registry ───────────────────────────────────────────
// createGiftCheckout registers a resolve callback here keyed by SKU (lowercase).
// The global useIAPListener calls resolveGiftPurchase() when it finishes the
// transaction — this is the ONLY place finishTransaction is called for gifts,
// eliminating the dual-listener race that caused iOS native crashes.
type GiftResult = { success: boolean; error?: string };
const _giftResolvers = new Map<string, (result: GiftResult) => void>();

export function registerGiftResolver(sku: string, resolve: (r: GiftResult) => void) {
  _giftResolvers.set(sku.toLowerCase(), resolve);
}

export function resolveGiftPurchase(sku: string, result: GiftResult) {
  const resolve = _giftResolvers.get(sku.toLowerCase());
  if (resolve) {
    _giftResolvers.delete(sku.toLowerCase());
    resolve(result);
  }
}

export function hasActiveGiftResolver(sku: string): boolean {
  return _giftResolvers.has(sku.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────

export const checkIsVip = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc("is_user_vip", { _user_id: userId });
    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error("Error checking VIP status:", err);
    return false;
  }
};

/**
 * Returns true if the user is any VIP (is_vip = true OR admin_granted_vip = true).
 */
export const checkIsPremiumVip = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc("is_user_vip", { _user_id: userId });
    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error("Error checking VIP status:", err);
    return false;
  }
};

/**
 * Fires a vip_gift_attempt push notification to the recipient female so she
 * knows a guy tried to gift her and she should upgrade to Premium VIP.
 */
export const notifyGiftAttempt = async (recipientId: string): Promise<void> => {
  try {
    await supabase.functions.invoke("send-push-notification", {
      body: {
        user_id: recipientId,
        title: "\uD83D\uDC9D A guy wanted to send you a gift!",
        body: "Become Premium VIP to start receiving cash gifts from guys. Tap to upgrade!",
        data: {
          screen: "/vip",
          deepLink: "/vip",
          channelId: "promotions",
          type: "vip_gift_attempt",
          highlight: "gifting",
        },
        notification_type: "vip_gift_attempt",
        cooldown_minutes: 10080,
      },
    });
  } catch (err) {
    console.warn("Failed to send gift attempt notification:", err);
  }
};

/**
 * Initiates a native IAP gift purchase.
 *
 * Architecture: NO local purchaseUpdatedListener is registered here.
 * The global useIAPListener (in hooks/useIAPListener.ts) is the sole handler
 * for all IAP events — it calls finishTransaction once and then calls
 * resolveGiftPurchase() to resolve this promise.
 *
 * This eliminates the dual-listener race condition that caused a native iOS
 * crash when finishTransaction was called twice on the same StoreKit 2 transaction.
 */
export const createGiftCheckout = (
  tierId: number,
  recipientId: string
): Promise<GiftResult> => {
  return new Promise(async (resolve) => {
    if (Platform.OS === "web") {
      resolve({ success: false, error: "Purchases are only available on the mobile app." });
      return;
    }

    const tier = GIFT_TIERS.find((t) => t.id === tierId);
    if (!tier) {
      resolve({ success: false, error: "Unknown gift tier." });
      return;
    }

    try {
      // 1. Store recipient for crash recovery (global listener reads this on restart)
      await AsyncStorage.setItem(
        `${PENDING_GIFT_KEY}_${tier.sku.toLowerCase()}`,
        recipientId
      );

      // 2. Register our resolver — global listener will call resolveGiftPurchase()
      //    when the transaction is verified and finished.
      registerGiftResolver(tier.sku, resolve);

      // 3. Prefetch SKU so StoreKit 2 recognizes it before purchase
      console.log(`[createGiftCheckout] Prefetching SKU: ${tier.sku}`);
      await getProducts({ skus: [tier.sku] });

      // 4. Trigger the purchase — all purchase/error events handled by global listener
      console.log(`[createGiftCheckout] Requesting purchase for: ${tier.sku}`);
      await requestPurchase({
        request: {
          apple: { sku: tier.sku, quantity: 1 },
          android: { skus: [tier.sku] },
        },
        type: 'inapp',
      });

    } catch (err: any) {
      // requestPurchase can throw synchronously on some iOS error paths
      const code = err?.code ?? '';
      const message = err?.message ?? '';

      // Clean up resolver since we're resolving here
      _giftResolvers.delete(tier.sku.toLowerCase());

      if (code === "E_USER_CANCELLED" || code === "2") {
        await AsyncStorage.removeItem(`${PENDING_GIFT_KEY}_${tier.sku.toLowerCase()}`);
        resolve({ success: false, error: "cancelled" });
        return;
      }

      if (
        code === "E_ALREADY_OWNED" ||
        message.toLowerCase().includes("already owned") ||
        message.toLowerCase().includes("duplicate")
      ) {
        // Try to recover a stuck transaction via getPendingTransactionsIOS
        console.log(`[createGiftCheckout] Already owned — attempting recovery...`);
        try {
          if (Platform.OS === 'ios') {
            const pendingTxns = await getPendingTransactionsIOS();
            const stuck = pendingTxns?.find(
              (p: any) => p.productId?.toLowerCase() === tier.sku.toLowerCase()
            );
            if (stuck) {
              // Re-register resolver and let global listener handle it via verifyAndFinish
              // Actually, we need to handle this inline since the event already fired
              console.log(`[createGiftCheckout] Found stuck transaction, verifying inline...`);
              const token = stuck.purchaseToken ?? stuck.transactionReceipt;
              if (token) {
                const { data } = await invokeIAP({
                  action: "verify-gift",
                  sku: tier.sku.toLowerCase(),
                  purchaseToken: token,
                  platform: Platform.OS,
                  recipient_id: recipientId,
                });
                if (data?.success) {
                  try { await finishTransaction({ purchase: stuck, isConsumable: true }); } catch (_) {}
                  await AsyncStorage.removeItem(`${PENDING_GIFT_KEY}_${tier.sku.toLowerCase()}`);
                  resolve({ success: true });
                  return;
                }
              }
            }
          }

          // Nuclear: clear stuck queue so next attempt works
          if (Platform.OS === 'ios') {
            try {
              await clearTransactionIOS();
              await AsyncStorage.removeItem(`${PENDING_GIFT_KEY}_${tier.sku.toLowerCase()}`);
              resolve({ success: false, error: "cleared_retry" });
              return;
            } catch (_) {}
          }
        } catch (recoveryErr) {
          console.warn(`[createGiftCheckout] Recovery failed:`, recoveryErr);
        }

        resolve({ success: false, error: "You already own this item. Please restart the app and try again." });
        return;
      }

      resolve({ success: false, error: message || "Purchase failed" });
    }
  });
};

/**
 * Initiates a native IAP purchase to unfreeze the user's minutes.
 */
export const purchaseUnfreeze = (): Promise<{ success: boolean; error?: string }> => {
  return new Promise(async (resolve) => {
    if (Platform.OS === "web") {
      resolve({ success: false, error: "Purchases are only available on the mobile app." });
      return;
    }

    const sku = IAP_PRODUCTS.MINUTE_UNFREEZE;

    let purchaseUpdateSub: any;
    let purchaseErrorSub: any;

    const cleanup = () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
    };

    try {
      const { purchaseUpdatedListener, purchaseErrorListener } = require("@/lib/iap-import");

      console.log(`[purchaseUnfreeze] Registering product SKU with store: ${sku}`);
      await getProducts({ skus: [sku] });

      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: any) => {
        if (purchase.productId?.toLowerCase() !== sku.toLowerCase()) return;

        const token = purchase.purchaseToken ?? purchase.transactionReceipt;
        if (!token) {
          console.warn("[purchaseUnfreeze] No purchase token available");
          return;
        }

        try {
          const { data, error } = await invokeIAP({
            action: "verify-unfreeze",
            sku: sku,
            purchaseToken: token,
            platform: Platform.OS,
          });
          if (error) throw new Error(error.message);
          if (!data?.success) throw new Error(data?.error || "Verification failed");

          await finishTransaction({ purchase, isConsumable: true });
          cleanup();
          resolve({ success: true });
        } catch (err: any) {
          cleanup();
          resolve({ success: false, error: err.message });
        }
      });

      purchaseErrorSub = purchaseErrorListener((error: any) => {
        cleanup();
        if (error?.code === "E_USER_CANCELLED") {
          resolve({ success: false, error: "cancelled" });
        } else {
          resolve({ success: false, error: error?.message || "Purchase failed" });
        }
      });

      await requestPurchase({
        request: {
          apple: { sku, quantity: 1 },
          android: { skus: [sku] },
        },
        type: 'inapp',
      });
    } catch (err: any) {
      resolve({ success: false, error: err.message });
    }
  });
};