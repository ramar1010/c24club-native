import React, { useEffect, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import { Crown, Snowflake, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  initConnection,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  endConnection,
} from "@/lib/iap-import";
import { IAP_PRODUCTS } from "@/lib/iap";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface FreezeModalProps {
  visible: boolean;
  onClose: () => void;
  liveMinutes?: number | null;
}

export function FreezeModal({ visible, onClose, liveMinutes }: FreezeModalProps) {
  const { user, session, minutes, freezeSettings, updateMinutes, refreshProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!minutes || !minutes.is_frozen) return null;

  // IAP setup for unfreeze purchase
  useEffect(() => {
    if (!visible || Platform.OS === "web") return;

    let purchaseUpdateSub: any;
    let purchaseErrorSub: any;

    const setup = async () => {
      try {
        await initConnection();

        purchaseUpdateSub = purchaseUpdatedListener(async (purchase: any) => {
          if (purchase.productId !== IAP_PRODUCTS.MINUTE_UNFREEZE) return;
          const token = Platform.OS === "android" ? purchase.purchaseToken : purchase.transactionReceipt;
          if (!token) return;

          try {
            const { data, error } = await supabase.functions.invoke("iap-purchases", {
              body: { action: "verify-unfreeze", purchaseToken: token, platform: Platform.OS },
            });
            if (error) throw error;
            if (data?.success) {
              await finishTransaction({ purchase, isConsumable: true });
              await refreshProfile();
              onClose();
              Alert.alert("✅ Unfrozen!", "Your minutes have been restored.");
            } else {
              throw new Error(data?.error || "Verification failed");
            }
          } catch (err: any) {
            Alert.alert("Error", err.message || "Could not verify purchase.");
          } finally {
            setLoading(false);
          }
        });

        purchaseErrorSub = purchaseErrorListener((error: any) => {
          if (error?.code !== "E_USER_CANCELLED") {
            Alert.alert("Purchase Failed", error?.message || "Something went wrong.");
          }
          setLoading(false);
        });
      } catch (err) {
        console.warn("IAP init error (FreezeModal):", err);
      }
    };

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection();
    };
  }, [visible]);

  const handleUnfreezePurchase = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Mobile Only", "This purchase is only available on the mobile app.");
      return;
    }
    setLoading(true);
    try {
      await requestPurchase({
        type: 'in-app',
        request: {
          apple: { sku: IAP_PRODUCTS.MINUTE_UNFREEZE },
          google: { skus: [IAP_PRODUCTS.MINUTE_UNFREEZE] },
        },
      });
    } catch (err: any) {
      if (err?.code !== "E_USER_CANCELLED") {
        Alert.alert("Error", err?.message || "Could not initiate purchase.");
      }
      setLoading(false);
    }
  };

  const handleVipUpgrade = () => {
    onClose();
    router.push("/vip");
  };

  const handleVipUnfreeze = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("unfreeze-purchase", {
        body: { action: "vip_unfreeze" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.success) {
        await refreshProfile();
        onClose();
      }
    } catch (err) {
      console.error("VIP unfreeze error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss24h = async () => {
    await updateMinutes({ frozen_cap_popup_shown: true });
    onClose();
  };

  const canVipUnfreeze = minutes.is_vip && (minutes.vip_unfreezes_used < (freezeSettings?.vip_unfreezes_per_month ?? 3));
  const remainingUnfreezes = (freezeSettings?.vip_unfreezes_per_month ?? 3) - (minutes.vip_unfreezes_used ?? 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color="#71717A" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Snowflake size={48} color="#3B82F6" strokeWidth={3} />
          </View>

          <Text style={styles.title}>Account Frozen ❄️</Text>
          <Text style={styles.description}>
            You've earned <Text style={styles.highlight}>{liveMinutes ?? minutes.total_minutes ?? minutes.minutes ?? 0}</Text> minutes! 
            To keep earning at the full rate (10min/30 mins a partner), please unfreeze your account.
          </Text>

          {loading ? (
            <ActivityIndicator color="#EF4444" size="large" style={styles.loader} />
          ) : (
            <View style={styles.buttonContainer}>
              {minutes.is_vip ? (
                <TouchableOpacity
                  style={[styles.primaryButton,!canVipUnfreeze ? styles.disabledButton : null]}
                  onPress={handleVipUnfreeze}
                  disabled={!canVipUnfreeze}
                >
                  <Crown size={18} color="#000" style={styles.buttonIcon} />
                  <Text style={styles.primaryButtonText}>
                    {canVipUnfreeze 
                      ? `Use Free Unfreeze (${remainingUnfreezes} left)` 
                      : "No free unfreezes left"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.vipButton} onPress={handleVipUpgrade}>
                    <Crown size={20} color="#000" style={styles.buttonIcon} />
                    <View>
                      <Text style={styles.vipButtonText}>Become VIP — $2.49/week</Text>
                      <Text style={styles.vipButtonSubtext}>Never freeze + Gender filters</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.primaryButton} onPress={handleUnfreezePurchase}>
                    <Text style={styles.primaryButtonText}>Unfreeze Now — $1.99</Text>
                    <Text style={styles.buttonSubtext}>Lasts for 7 days</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.secondaryButton} onPress={handleDismiss24h}>
                <Text style={styles.secondaryButtonText}>Dismiss for 24 hours</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.footerText}>
            Frozen users earn only 2 minutes per conversation.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#1E1E38",
    borderRadius: 28,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 8,
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  highlight: {
    color: "#FACC15",
    fontWeight: "800",
  },
  buttonContainer: {
    width: "100%",
    rowGap: 12, columnGap: 12,
    marginBottom: 16,
  },
  vipButton: {
    backgroundColor: "#FACC15",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  vipButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
  },
  vipButtonSubtext: {
    color: "rgba(0,0,0,0.6)",
    fontSize: 11,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#EF4444",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  buttonSubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
  },
  secondaryButtonText: {
    color: "#71717A",
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#3F3F46",
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 12,
  },
  loader: {
    marginVertical: 40,
  },
  footerText: {
    fontSize: 12,
    color: "#71717A",
    textAlign: "center",
    fontStyle: "italic",
  },
});