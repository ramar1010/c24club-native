import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Text,
  Pressable,
} from "react-native";
import { Gift, X, Star, Lock } from "lucide-react-native";
import { GIFT_TIERS, createGiftCheckout, notifyGiftAttempt } from "@/lib/gift-utils";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  recipientIsVip?: boolean;
  onGiftSent?: (info: { tierMinutes: number; cashValue: number }) => void;
}

export const GiftModal = ({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientIsVip = true,
  onGiftSent,
}: GiftModalProps) => {
  const [loading, setLoading] = useState<number | null>(null);
  const [notified, setNotified] = useState(false);
  const toast = useToast();

  const handleLockedTierPress = () => {
    if (!notified) {
      notifyGiftAttempt(recipientId);
      setNotified(true);
    }
    Alert.alert(
      "🔒 VIP Only",
      `Only VIP users can receive gifts. We've nudged ${recipientName} to upgrade!`,
      [{ text: "Got it" }]
    );
  };

  const handleSendGift = async (tierId: number) => {
    setLoading(tierId);
    try {
      const result = await createGiftCheckout(tierId, recipientId);
      if (!result.success && result.error !== 'cancelled') {
        toast.show({
          placement: "top",
          render: ({ id }) => (
            <Toast nativeID={"toast-" + id} action="error" variant="solid">
              <ToastTitle>Purchase Error</ToastTitle>
              <ToastDescription>{result.error || "Failed to send gift"}</ToastDescription>
            </Toast>
          ),
        });
      } else if (result.success) {
        const tier = GIFT_TIERS.find((t) => t.id === tierId);
        if (tier && onGiftSent) {
          onGiftSent({ tierMinutes: tier.minutes, cashValue: tier.cashValue });
        }
        onClose();
      }
    } finally {
      setLoading(null);
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
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={22} color="#A1A1AA" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Gift size={32} color="#EF4444" />
          </View>
          <Text style={styles.title}>Send Cash Gift</Text>
          <Text style={styles.subtitle}>Gift {recipientName} real cash balance!</Text>
        </View>

        {/* Locked banner */}
        {!recipientIsVip && (
          <View style={styles.lockedBanner}>
            <Lock size={15} color="#FACC15" />
            <Text style={styles.lockedBannerText}>
              {recipientName} needs Premium VIP to receive gifts. Tap any tier to nudge them!
            </Text>
          </View>
        )}

        {/* Tier list */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {GIFT_TIERS.map((tier) => (
            <TouchableOpacity
              key={tier.id}
              style={[styles.tierCard, !recipientIsVip && styles.tierCardLocked]}
              onPress={() =>
                recipientIsVip ? handleSendGift(tier.id) : handleLockedTierPress()
              }
              disabled={loading !== null && recipientIsVip}
              activeOpacity={0.75}
            >
              <View style={styles.tierInfo}>
                <Text style={[styles.tierMinutes, !recipientIsVip && styles.tierMinutesLocked]}>
                  {tier.minutes} min
                </Text>
                {tier.senderBonus > 0 && (
                  <View style={styles.bonusBadge}>
                    <Star size={10} color="#1A1A2E" fill="#1A1A2E" />
                    <Text style={styles.bonusText}>+{tier.senderBonus} min back</Text>
                  </View>
                )}
              </View>

              <View style={[styles.priceContainer, !recipientIsVip && styles.priceContainerLocked]}>
                {loading === tier.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : !recipientIsVip ? (
                  <View style={styles.lockedBadge}>
                    <Lock size={13} color="#FACC15" />
                    <Text style={styles.lockedLabel}>VIP ONLY</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.cashLabel}>🎁 SEND ${tier.cashValue.toFixed(2)} CASH</Text>
                    <Text style={styles.priceValue}>FOR ${tier.price}</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Footer */}
        <Text style={styles.footerText}>
          {recipientIsVip
            ? "Processed via Google Play / App Store"
            : "Upgrade prompts sent when you tap a tier 💌"}
        </Text>
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
    maxHeight: "85%",
  },
  closeBtn: {
    alignSelf: "flex-end",
    marginBottom: 4,
    padding: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 14,
    textAlign: "center",
  },
  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.3)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 10,
  },
  lockedBannerText: {
    flex: 1,
    color: "#FACC15",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  tierCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  tierCardLocked: {
    backgroundColor: "#16162A",
    borderColor: "rgba(255,255,255,0.08)",
  },
  tierInfo: {
    gap: 4,
  },
  tierMinutes: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  tierMinutesLocked: {
    color: "#6B6B8A",
  },
  bonusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FACC15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    gap: 4,
  },
  bonusText: {
    color: "#1A1A2E",
    fontSize: 10,
    fontWeight: "800",
  },
  priceContainer: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  priceContainerLocked: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedLabel: {
    color: "#FACC15",
    fontSize: 13,
    fontWeight: "800",
  },
  cashLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  priceValue: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "700",
  },
  footerText: {
    color: "#71717A",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});