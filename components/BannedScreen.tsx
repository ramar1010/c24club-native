import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from '@/lib/iap-import';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { UNBAN_PRODUCT_ID } from "@/lib/iap";
import type { BanRecord } from "@/hooks/useBanCheck";

interface BannedScreenProps {
  ban: BanRecord;
  onUnbanned: () => void;
}

function formatBanDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function BannedScreen({ ban, onUnbanned }: BannedScreenProps) {
  const { user, signOut } = useAuth();

  // Contact support form state
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);

  // IAP state
  const [iapReady, setIapReady] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const isUnderage = ban.ban_type === "underage";
  const isWeb = Platform.OS === "web";

  // ── IAP Setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb || isUnderage) return;

    let purchaseUpdateSub: ReturnType<typeof purchaseUpdatedListener> | null = null;
    let purchaseErrorSub: ReturnType<typeof purchaseErrorListener> | null = null;

    const setup = async () => {
      try {
        await initConnection();
        setIapReady(true);

        // Prefetch product so it's cached
        await getProducts({ skus: [UNBAN_PRODUCT_ID], type: "in-app" });
      } catch (err) {
        console.warn("[BannedScreen] IAP init error:", err);
      }

      // Listen for purchase updates
      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
        try {
          // Extract the purchase token — same field name on both platforms
          const purchaseToken = purchase.purchaseToken ?? null;

          if (!purchaseToken) {
            Alert.alert("Error", "Purchase token not available. Please contact support.");
            return;
          }

          // Verify with backend
          const { data, error } = await supabase.functions.invoke("unban-payment", {
            body: {
              action: "verify-iap",
              purchaseToken,
              platform: Platform.OS,
            },
          });

          if (error) throw new Error(error.message ?? "Verification failed.");

          if (data?.success === true && data?.unbanned === true) {
            // Consume/finish the transaction
            try {
              await finishTransaction({ purchase, isConsumable: true });
            } catch (finishErr) {
              console.warn("[BannedScreen] finishTransaction error:", finishErr);
            }

            Alert.alert(
              "Ban Lifted!",
              "Your ban has been lifted! Welcome back.",
              [{ text: "Continue", onPress: onUnbanned }]
            );
          } else {
            Alert.alert(
              "Payment Not Confirmed",
              data?.message ?? "Payment verification failed. Please contact support."
            );
          }
        } catch (err: any) {
          Alert.alert("Verification Error", err.message ?? "Could not verify purchase. Please contact support.");
        } finally {
          setPaymentLoading(false);
        }
      });

      // Listen for purchase errors
      purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
        setPaymentLoading(false);
        // Code 2 = user cancelled — don't show an error for that
        if ((error.code as unknown as number) !== 2) {
          Alert.alert("Purchase Error", error.message ?? "Purchase failed. Please try again.");
        }
      });
    };

    setup();

    return () => {
      purchaseUpdateSub?.remove();
      purchaseErrorSub?.remove();
      endConnection().catch(() => {});
    };
  }, [isWeb, isUnderage, onUnbanned]);

  // ── Contact Support ──────────────────────────────────────────────────────────
  const handleSubmitSupport = useCallback(async () => {
    if (!user?.id || !supportMessage.trim()) return;

    setSubmittingSupport(true);
    try {
      const { error } = await supabase.from("user_reports").insert({
        reporter_id: user.id,
        reported_user_id: user.id,
        reason: `[BAN APPEAL] ${supportMessage.trim()}`,
        details: `Ban reason: ${ban.reason ?? "N/A"} | Ban type: ${ban.ban_type} | Banned on: ${ban.created_at}`,
      });

      if (error) throw error;

      Alert.alert(
        "Message Sent",
        "Your support message has been submitted. Our team will review it shortly.",
        [{ text: "OK", onPress: () => { setShowSupportForm(false); setSupportMessage(""); } }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to send message. Please try again.");
    } finally {
      setSubmittingSupport(false);
    }
  }, [user?.id, supportMessage, ban]);

  // ── Pay to Appeal (IAP) ──────────────────────────────────────────────────────
  const handlePayToAppeal = useCallback(async () => {
    if (isWeb) {
      Alert.alert("Not Available", "Payment is only available on the mobile app.");
      return;
    }

    if (!iapReady) {
      Alert.alert("Not Ready", "Payment system is initializing. Please try again in a moment.");
      return;
    }

    setPaymentLoading(true);
    try {
      // Use correct v14 requestPurchase format with request wrapper + type
      await requestPurchase({
        request: {
          ios: { sku: UNBAN_PRODUCT_ID, quantity: 1 },
          android: { skus: [UNBAN_PRODUCT_ID] },
        },
        type: 'inapp',
      });
      // Purchase result is handled by purchaseUpdatedListener
    } catch (err: any) {
      setPaymentLoading(false);
      // Don't show error for user cancellation
      const code = err?.code ?? err?.responseCode;
      if (code !== 2 && code !== "2") {
        Alert.alert("Error", err.message ?? "Could not initiate payment. Please try again.");
      }
    }
  }, [isWeb, iapReady]);

  // ── Sign Out ─────────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={styles.iconWrapper}>
            <Ionicons name="shield-checkmark" size={64} color="#EF4444" />
          </View>

          <Text style={styles.title}>Account Banned</Text>

          <Text style={styles.banDate}>
            Banned on {formatBanDate(ban.created_at)}
          </Text>

          {/* ── Reason Box ── */}
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{ban.reason ?? "No reason provided."}</Text>
          </View>

          {/* ── Underage notice OR appeal section ── */}
          {isUnderage ? (
            <View style={styles.permanentBox}>
              <Ionicons name="warning" size={18} color="#FACC15" style={{ marginRight: 8 }} />
              <Text style={styles.permanentText}>
                This ban is permanent and cannot be appealed.
              </Text>
            </View>
          ) : (
            <View style={styles.appealSection}>
              <Text style={styles.appealTitle}>Appeal Your Ban</Text>
              <Text style={styles.appealSubtitle}>
                Pay a $10 processing fee to submit a ban appeal for admin review. Payment does not guarantee removal.
              </Text>

              {isWeb ? (
                <View style={styles.webNotice}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#A0A0B8" style={{ marginRight: 8 }} />
                  <Text style={styles.webNoticeText}>
                    Payment is only available on the mobile app (iOS or Android).
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.payButton, paymentLoading ? styles.buttonDisabled : undefined]}
                  onPress={handlePayToAppeal}
                  disabled={paymentLoading}
                  activeOpacity={0.8}
                >
                  {paymentLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.payButtonText}>Pay $10 to Appeal Ban</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Contact Support ── */}
          <View style={styles.divider} />

          {!showSupportForm ? (
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => setShowSupportForm(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#A0A0B8" style={{ marginRight: 8 }} />
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.supportForm}>
              <Text style={styles.supportFormTitle}>Send us a message</Text>
              <TextInput
                style={styles.textInput}
                value={supportMessage}
                onChangeText={(v) => setSupportMessage(v.slice(0, 500))}
                placeholder="Describe your situation…"
                placeholderTextColor="#555577"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{supportMessage.length}/500</Text>

              <View style={styles.supportActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowSupportForm(false); setSupportMessage(""); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, (!supportMessage.trim() || submittingSupport) ? styles.buttonDisabled : undefined]}
                  onPress={handleSubmitSupport}
                  disabled={!supportMessage.trim() || submittingSupport}
                >
                  {submittingSupport ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Sign Out ── */}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: "#0F0F1E",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },

  // Icon & Header
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "center",
  },
  banDate: {
    fontSize: 14,
    color: "#A0A0B8",
    marginBottom: 24,
    textAlign: "center",
  },

  // Reason box
  reasonBox: {
    width: "100%",
    backgroundColor: "#1E1E3A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 14,
    color: "#C0C0D8",
    lineHeight: 20,
  },

  // Permanent ban notice
  permanentBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.1)",
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    width: "100%",
  },
  permanentText: {
    flex: 1,
    color: "#FACC15",
    fontSize: 14,
    lineHeight: 20,
  },

  // Appeal section
  appealSection: {
    width: "100%",
    backgroundColor: "#1A1A35",
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  appealTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  appealSubtitle: {
    fontSize: 13,
    color: "#A0A0B8",
    lineHeight: 18,
    marginBottom: 20,
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // Web notice (IAP not available on web)
  webNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(160,160,184,0.1)",
    borderRadius: 10,
    padding: 14,
  },
  webNoticeText: {
    flex: 1,
    color: "#A0A0B8",
    fontSize: 13,
    lineHeight: 18,
  },

  // Divider
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#2A2A4A",
    marginBottom: 20,
  },

  // Contact Support
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E3A",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: "100%",
    marginBottom: 16,
    justifyContent: "center",
  },
  supportButtonText: {
    color: "#A0A0B8",
    fontSize: 15,
    fontWeight: "600",
  },

  // Support form
  supportForm: {
    width: "100%",
    backgroundColor: "#1E1E3A",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  supportFormTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: "#0F0F1E",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    color: "#FFFFFF",
    fontSize: 14,
    padding: 12,
    minHeight: 110,
    marginBottom: 6,
  },
  charCount: {
    color: "#555577",
    fontSize: 12,
    textAlign: "right",
    marginBottom: 12,
  },
  supportActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#A0A0B8",
    fontWeight: "600",
    fontSize: 14,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  // Sign out
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    width: "100%",
    marginTop: 8,
  },
  signOutText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "600",
  },

  // Shared
  buttonDisabled: {
    opacity: 0.5,
  },
});