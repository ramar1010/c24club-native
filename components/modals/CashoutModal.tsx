import React, { useState, useEffect } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Pressable,
} from "react-native";
import { DollarSign, X, Info } from "lucide-react-native";
import {
  fetchCashoutSettings,
  fetchLuckySpinEarnings,
  checkPendingCashout,
  requestCashout,
  DEFAULT_SETTINGS,
} from "@/lib/cashout-utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";

interface CashoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashoutModal = ({ isOpen, onClose }: CashoutModalProps) => {
  const { user, profile, minutes, refreshProfile } = useAuth();
  const toast = useToast();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [spinEarnings, setSpinEarnings] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState(0);
  const [paypalEmail, setPaypalEmail] = useState("");

  const giftedMinutes = minutes?.gifted_minutes ?? 0;

  useEffect(() => {
    if (isOpen && user) {
      loadData();
    }
  }, [isOpen, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, e, p] = await Promise.all([
        fetchCashoutSettings(),
        fetchLuckySpinEarnings(user!.id),
        checkPendingCashout(user!.id),
      ]);
      setSettings(s);
      setSpinEarnings(e);
      setIsPending(p);
      setAmount(Math.max(s.min_cashout_minutes, 100));
      setPaypalEmail(profile?.email || "");
    } finally {
      setLoading(false);
    }
  };

  const totalValue = amount * settings.rate_per_minute + spinEarnings;
  const isEligible = giftedMinutes >= settings.min_cashout_minutes;

  const handleSubmit = async () => {
    if (!paypalEmail || !paypalEmail.includes("@")) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} action="error" variant="solid">
            <ToastTitle>Invalid Email</ToastTitle>
            <ToastDescription>Please enter a valid PayPal email address.</ToastDescription>
          </Toast>
        ),
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestCashout(amount, paypalEmail);
      if (result.success) {
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast nativeID={"toast-" + id} action="success" variant="solid">
              <ToastTitle>Success!</ToastTitle>
              <ToastDescription>Cashout request submitted. Admin will review shortly.</ToastDescription>
            </Toast>
          ),
        });
        await refreshProfile();
        onClose();
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} action="error" variant="solid">
            <ToastTitle>Request Failed</ToastTitle>
            <ToastDescription>{err.message || "Something went wrong"}</ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={22} color="#A1A1AA" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <DollarSign size={32} color="#10B981" />
          </View>
          <Text style={styles.title}>Cash Out Minutes</Text>
          <Text style={styles.subtitle}>
            Convert your gifted minutes into real cash via PayPal
          </Text>
        </View>

        {/* Body */}
        {loading ? (
          <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 40 }} />
        ) : isPending ? (
          <View style={styles.stateContainer}>
            <Info size={40} color="#FACC15" />
            <Text style={styles.stateTitle}>Request Pending</Text>
            <Text style={styles.stateText}>
              You already have a pending cashout request. Please wait for it to be processed.
            </Text>
          </View>
        ) : !isEligible ? (
          <View style={styles.stateContainer}>
            <Info size={40} color="#EF4444" />
            <Text style={styles.stateTitle}>Not Enough Minutes</Text>
            <Text style={styles.stateText}>
              You need at least {settings.min_cashout_minutes} gifted minutes to cash out.
            </Text>
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current: {giftedMinutes} min</Text>
            </View>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {/* Balance box */}
            <View style={styles.balanceBox}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>🎁 Gifted Minutes</Text>
                <Text style={styles.balanceValue}>{giftedMinutes} min</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>💵 Rate per Minute</Text>
                <Text style={styles.balanceValue}>${settings.rate_per_minute.toFixed(2)}</Text>
              </View>
              {spinEarnings > 0 && (
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>🎰 Lucky Spin Earnings</Text>
                  <Text style={styles.balanceValue}>${spinEarnings.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.balanceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>💰 Full Balance Value</Text>
                <Text style={styles.totalValue}>
                  ${(giftedMinutes * settings.rate_per_minute + spinEarnings).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderTitle}>Select Minutes to Cash Out</Text>
                <Text style={styles.sliderValue}>{amount} min</Text>
              </View>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={settings.min_cashout_minutes}
                maximumValue={Math.min(giftedMinutes, settings.max_cashout_minutes)}
                step={10}
                value={amount}
                onValueChange={setAmount}
                minimumTrackTintColor="#10B981"
                maximumTrackTintColor="#2A2A4A"
                thumbTintColor="#10B981"
              />
            </View>

            {/* PayPal email */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>PayPal Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#555"
                value={paypalEmail}
                onChangeText={setPaypalEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#10B981", "#059669"]}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Cash Out ${totalValue.toFixed(2)}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.footerNote}>Paid via PayPal • Admin approval required</Text>
            <Text style={styles.disclaimer}>
              Only gifted minutes can be cashed out — spin wins, chat earnings & rewards are store-only.
            </Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1A1A2E",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 20,
    maxHeight: "90%",
  },
  closeBtn: {
    alignSelf: "flex-end",
    marginBottom: 4,
    padding: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    textAlign: "center",
  },
  scroll: {
    flexGrow: 0,
  },
  // ── State screens (not eligible / pending) ────────────────────────────────
  stateContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  stateTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  stateText: {
    color: "#A1A1AA",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  currentBadge: {
    backgroundColor: "#1E1E38",
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  currentBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  // ── Balance box ───────────────────────────────────────────────────────────
  balanceBox: {
    backgroundColor: "#1E1E38",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 8,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  balanceLabel: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  balanceValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  totalRow: {
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  totalLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  totalValue: {
    color: "#10B981",
    fontSize: 16,
    fontWeight: "800",
  },
  // ── Slider ────────────────────────────────────────────────────────────────
  sliderContainer: {
    marginBottom: 20,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sliderTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  sliderValue: {
    color: "#10B981",
    fontSize: 16,
    fontWeight: "800",
  },
  // ── Input ─────────────────────────────────────────────────────────────────
  inputContainer: {
    marginBottom: 20,
    gap: 8,
  },
  inputLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#1E1E38",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 15,
  },
  // ── Submit ────────────────────────────────────────────────────────────────
  submitButton: {
    borderRadius: 100,
    overflow: "hidden",
    marginBottom: 14,
  },
  gradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  footerNote: {
    color: "#A1A1AA",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 4,
  },
  disclaimer: {
    color: "#71717A",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});