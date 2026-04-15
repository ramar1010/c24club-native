import { supabase } from "./supabase";
import { Platform } from "react-native";
import {
  initConnection,
  getProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  endConnection,
} from "@/lib/iap-import";

export interface GiftTier {
  id: number;
  minutes: number;
  price: number;
  cashValue: number;
  senderBonus: number;
  sku: string;
}

export const GIFT_TIERS: GiftTier[] = [
  { id: 100, minutes: 100, price: 1.99, cashValue: 1.0, senderBonus: 0, sku: "c24_gift_100_minutes" },
  { id: 400, minutes: 400, price: 4.99, cashValue: 4.0, senderBonus: 100, sku: "c24_gift_400_minutes" },
  { id: 600, minutes: 600, price: 7.99, cashValue: 6.0, senderBonus: 150, sku: "c24_gift_600_minutes" },
  { id: 1000, minutes: 1000, price: 12.99, cashValue: 10.0, senderBonus: 250, sku: "c24_gift_1000_minutes" },
];

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
 * Initiates a native IAP purchase to gift minutes to a recipient.
 * Sets up listeners, triggers the purchase, then calls the iap-purchases
 * Edge Function to verify and credit the recipient.
 *
 * Returns a promise that resolves when the purchase flow completes.
 */
export const createGiftCheckout = (
  tierId: number,
  recipientId: string
): Promise<{ success: boolean; error?: string }> => {
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

    let purchaseUpdateSub: any;
    let purchaseErrorSub: any;

    const cleanup = () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };

    try {
      await initConnection();
      await getProducts({ skus: GIFT_TIERS.map((t) => t.sku) });

      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: any) => {
        if (purchase.productId !== tier.sku) {
          return;
        }
        const token = Platform.OS === "android" ? purchase.purchaseToken : purchase.transactionReceipt;
        if (!token) return;

        try {
          const { data, error } = await supabase.functions.invoke("iap-purchases", {
            body: {
              action: "verify-gift",
              sku: tier.sku,
              purchaseToken: token,
              platform: Platform.OS,
              recipient_id: recipientId,
            },
          });
          if (error) {
            throw new Error(error.message);
          }
          if (!data?.success) {
            throw new Error(data?.error || "Verification failed");
          }

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

      // Use standard v14+ requestPurchase format
      if (Platform.OS === 'android') {
        await requestPurchase({
          skus: [tier.sku],
        });
      } else {
        await requestPurchase({
          sku: tier.sku,
          andDangerouslyFinishTransactionAutomatically: false,
        });
      }
    } catch (err: any) {
      cleanup();
      resolve({ success: false, error: err.message });
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

    const sku = "c24_minute_unfreeze";
    let purchaseUpdateSub: any;
    let purchaseErrorSub: any;

    const cleanup = () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };

    try {
      await initConnection();
      await getProducts({ skus: [sku] });

      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: any) => {
        if (purchase.productId !== sku) {
          return;
        }
        const token = Platform.OS === "android" ? purchase.purchaseToken : purchase.transactionReceipt;
        if (!token) return;

        try {
          const { data, error } = await supabase.functions.invoke("iap-purchases", {
            body: {
              action: "verify-unfreeze",
              sku: sku,
              purchaseToken: token,
              platform: Platform.OS,
            },
          });
          if (error) {
            throw new Error(error.message);
          }
          if (!data?.success) {
            throw new Error(data?.error || "Verification failed");
          }

          // Removed invalid auth refresh call here

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

      // Use standard v14+ requestPurchase format
      if (Platform.OS === 'android') {
        await requestPurchase({
          skus: [sku],
        });
      } else {
        await requestPurchase({
          sku,
          andDangerouslyFinishTransactionAutomatically: false,
        });
      }
    } catch (err: any) {
      cleanup();
      resolve({ success: false, error: err.message });
    }
  });
};