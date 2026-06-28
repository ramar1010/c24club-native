import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import {
  X,
  MessageCircle,
  Crown,
  Star,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
} from "lucide-react-native";
import { flattenStyle } from "@/utils/flatten-style";
import { useRouter } from "expo-router";

interface BountyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Step {
  icon: any;
  color: string;
  tint: string;
  title: string;
  desc: string;
  bullets?: string[];
}

const STEPS: Step[] = [
  {
    icon: MessageCircle,
    color: "#EC4899",
    tint: "rgba(236, 72, 153, 0.12)",
    title: "Chat with guys",
    desc: "Be engaging in DMs and on video calls. Real, fun conversations are what keep guys coming back.",
  },
  {
    icon: Crown,
    color: "#F59E0B",
    tint: "rgba(245, 158, 11, 0.12)",
    title: "Convince them to subscribe",
    desc: "Encourage the guys you talk to to upgrade to Basic or Premium VIP membership.",
  },
  {
    icon: Star,
    color: "#10B981",
    tint: "rgba(16, 185, 129, 0.12)",
    title: "You automatically earn minutes",
    desc: "When a guy you've chatted with goes VIP, gifted minutes land in your balance instantly — no action needed.",
    bullets: [
      "125 minutes when they subscribe to Basic VIP",
      "500 minutes when they subscribe to Premium VIP",
      "200 minutes when they renew their VIP subscription",
      "Bonus: +500 streak bonus for 3 subscriptions in 7 days",
    ],
  },
  {
    icon: DollarSign,
    color: "#3B82F6",
    tint: "rgba(59, 130, 246, 0.12)",
    title: "Cash out to PayPal",
    desc: "Head to My Profile → Redeem My Minutes and turn your gifted minutes into real cash.",
    bullets: [
      "Redeem minutes at $0.01 per minute",
      "Payments sent directly to your PayPal",
      "Go above & beyond: Get gifted 100, 400, 600, or 1000 minutes by members to earn even faster!",
    ],
  },
];

const PRO_TIPS = [
  "Be genuine and engaging — authentic conversations convert the best.",
  "The more guys you talk to, the more chances they go VIP and pay you.",
  "Keep a streak going: 3 subscriptions within 7 days unlocks a +500 minute bonus.",
  "Renewals also award a bounty: You earn 200 minutes when they renew their VIP subscription.",
  "Go above and beyond: You can also get gifted directly by members (100, 400, 600, or 1000 minutes) to boost your earnings!",
];

export const BountyGuideModal: React.FC<BountyGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex];
  const StepIcon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;

  const handleClose = () => {
    setStepIndex(0);
    onClose();
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
      router.push("/profile");
    } else {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={styles.sheet}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={22} color="#A1A1AA" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeEmoji}>💰</Text>
          </View>
          <Text style={styles.title}>Earn Money DMing Guys</Text>
          <Text style={styles.subtitle}>
            Get paid in cash when the guys you chat with go VIP.
          </Text>
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={flattenStyle([
                styles.progressDot,
                i === stepIndex && styles.progressDotActive,
                i < stepIndex && styles.progressDotDone,
              ])}
            />
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Step card */}
          <View style={styles.stepCard}>
            <View style={styles.stepTopRow}>
              <View
                style={flattenStyle([styles.iconCircle, { backgroundColor: step.tint }])}
              >
                <StepIcon size={28} color={step.color} />
              </View>
              <View
                style={flattenStyle([styles.stepNumberBadge, { borderColor: step.color }])}
              >
                <Text style={flattenStyle([styles.stepNumberText, { color: step.color }])}>
                  Step {stepIndex + 1}
                </Text>
              </View>
            </View>

            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.desc}</Text>

            {step.bullets && (
              <View style={styles.bulletList}>
                {step.bullets.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View
                      style={flattenStyle([
                        styles.bulletDot,
                        { backgroundColor: step.color },
                      ])}
                    >
                      <Check size={11} color="#FFFFFF" />
                    </View>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Pro Tips */}
          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Sparkles size={16} color="#FACC15" />
              <Text style={styles.tipsTitle}>Pro Tips</Text>
            </View>
            {PRO_TIPS.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.disclaimer}>
            Earnings are paid in gifted minutes redeemable for cash via PayPal.
            Learn more at c24club.com.
          </Text>
        </ScrollView>

        {/* Navigation */}
        <View style={styles.navRow}>
          {stepIndex > 0 ? (
            <TouchableOpacity
              style={styles.backNavBtn}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <ChevronLeft size={18} color="#A1A1AA" />
              <Text style={styles.backNavText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.navSpacer} />
          )}

          <TouchableOpacity
            style={styles.nextNavBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextNavText}>{isLast ? "Head to My Profile" : "Next"}</Text>
            {!isLast && <ChevronRight size={18} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
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
    paddingBottom: 28,
    paddingTop: 20,
    maxHeight: "90%",
  },
  closeBtn: {
    alignSelf: "flex-end",
    marginBottom: 2,
    padding: 4,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  headerBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(236, 72, 153, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeEmoji: {
    fontSize: 30,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2A2A4A",
  },
  progressDotActive: {
    width: 24,
    backgroundColor: "#EC4899",
  },
  progressDotDone: {
    backgroundColor: "#EC4899",
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  stepCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 14,
  },
  stepTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberBadge: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  stepTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 6,
  },
  stepDesc: {
    color: "#A1A1AA",
    fontSize: 14,
    paddingVertical: 2,
  },
  bulletList: {
    marginTop: 14,
    gap: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletText: {
    color: "#E4E4E7",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  tipsCard: {
    backgroundColor: "rgba(250, 204, 21, 0.06)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.2)",
    gap: 8,
    marginBottom: 14,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  tipsTitle: {
    color: "#FACC15",
    fontSize: 15,
    fontWeight: "800",
  },
  tipRow: {
    flexDirection: "row",
    gap: 8,
  },
  tipBullet: {
    color: "#FACC15",
    fontSize: 14,
    fontWeight: "800",
  },
  tipText: {
    color: "#D4D4D8",
    fontSize: 13,
    flex: 1,
  },
  disclaimer: {
    color: "#71717A",
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 12,
  },
  navSpacer: {
    flex: 1,
  },
  backNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 100,
    backgroundColor: "#1E1E38",
  },
  backNavText: {
    color: "#A1A1AA",
    fontSize: 15,
    fontWeight: "700",
  },
  nextNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 16,
    borderRadius: 100,
    backgroundColor: "#EC4899",
  },
  nextNavText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});