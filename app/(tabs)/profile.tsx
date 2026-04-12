import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Modal as RNModal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  TextInput,
  Share,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import {
  LogOut,
  User,
  Gift,
  Star,
  Snowflake,
  TrendingUp,
  DollarSign,
  MapPin,
  CheckCircle,
  Package,
  Truck,
  RefreshCcw,
  CreditCard,
  Mail,
  Save,
  Edit2,
  ChevronRight,
  X,
  Settings,
  Clock,
  Info,
  Bell,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useCETracker } from "@/hooks/useCETracker";
import { useCEProgress } from "@/hooks/useCEProgress";
import { supabase } from "@/lib/supabase";
import { FreezeModal } from "@/components/modals/FreezeModal";
import { CashoutModal } from "@/components/modals/CashoutModal";
import { VipSettingsOverlay } from "@/components/videocall/VipSettingsOverlay";
import { FemaleVipBanner } from "@/components/FemaleVipBanner";
import { FooterLinks } from "@/components/FooterLinks";
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { VStack } from "@/components/ui/vstack";
import { Heading } from "@/components/ui/heading";
import { useToast, Toast, ToastTitle, ToastDescription } from "@/components/ui/toast";

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface MemberRedemption {
  id: string;
  reward_id: string;
  reward_title: string;
  reward_image_url: string | null;
  status: "processing" | "pending_shipping" | "Order placed" | "Order shipped" | string;
  created_at: string;
  cashout_amount: number | null;
  cashout_paypal: string | null;
  cashout_status: string | null;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  shipping_tracking_url: string | null;
}

interface GiftTransaction {
  id: string;
  sender_id: string | null;
  recipient_id: string;
  minutes: number;
  cash_value: number | null;
  created_at: string;
  sender_name?: string | null;
}

interface CashoutRequest {
  id: string;
  user_id: string;
  minutes_amount: number;
  cash_amount: number;
  paypal_email: string | null;
  status: "pending" | "approved" | "rejected" | string;
  created_at: string;
  updated_at: string | null;
  notes: string | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { session, profile, minutes, signOut, loading, refreshProfile, updateProfile } = useAuth();
  useCETracker();
  const { currentCE, progress, threshold, isMaxed, percentage, cap } = useCEProgress();
  const router = useRouter();
  const toast = useToast();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [redemptionCount, setRedemptionCount] = useState<number | null>(null);
  const [redemptions, setRedemptions] = useState<MemberRedemption[]>([]);
  const [liveMinutes, setLiveMinutes] = useState<number | null>(null);

  const displayMinutes = liveMinutes ?? minutes?.minutes ?? 0;

  // ── Force refresh gender if missing on mount ─────────────────────────────
  useEffect(() => {
    if (profile && !profile.gender && session) {
      console.log("[Profile] Gender missing, refreshing profile...");
      refreshProfile();
    }
  }, [profile?.id, profile?.gender]);

  // ── VIP Settings ────────────────────────────────────────────────────────────
  const [showVipSettings, setShowVipSettings] = useState(false);

  // ── Redemption address editing ──────────────────────────────────────────────
  const [selectedRedemption, setSelectedRedemption] = useState<MemberRedemption | null>(null);
  const [showEditRedemptionAddress, setShowEditRedemptionAddress] = useState(false);
  const [editRedemptionLoading, setEditRedemptionLoading] = useState(false);
  const [redemptionShipping, setRedemptionShipping] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  });

  // ── Modals ──────────────────────────────────────────────────────────────────
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [isRedemptionsLoading, setIsRedemptionsLoading] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);

  // ── Gift History ────────────────────────────────────────────────────────────
  const [giftHistory, setGiftHistory] = useState<GiftTransaction[]>([]);
  const [isGiftHistoryLoading, setIsGiftHistoryLoading] = useState(false);

  // ── Cashout History ─────────────────────────────────────────────────────────
  const [cashoutHistory, setCashoutHistory] = useState<CashoutRequest[]>([]);
  const [isCashoutHistoryLoading, setIsCashoutHistoryLoading] = useState(false);

  // ── CE Info Modal ───────────────────────────────────────────────────────────
  const [showCEInfo, setShowCEInfo] = useState(false);

  // ── Address editing ─────────────────────────────────────────────────────────
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [shippingName, setShippingName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingZip, setShippingZip] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");

  // ── Minute Unfreeze IAP ─────────────────────────────────────────────────────
  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleShareCallLink = async () => {
    if (!profile?.call_slug) return;
    try {
      await Share.share({
        message: `Video chat with me on C24 Club! 📹 https://c24.club/call/${profile.call_slug}`,
        url: `https://c24.club/call/${profile.call_slug}`,
      });
    } catch (_err) {}
  };

  const fetchRedemptions = useCallback(async () => {
    if (!profile?.id) return;
    setIsRedemptionsLoading(true);
    const { data } = await supabase
      .from("member_redemptions")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setRedemptions(data as MemberRedemption[]);
    setIsRedemptionsLoading(false);
  }, [profile?.id]);

  const fetchRedemptionCount = useCallback(async () => {
    if (!profile?.id) return;
    const { count } = await supabase
      .from("member_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id);

    setRedemptionCount(count ?? 0);
  }, [profile?.id]);

  const fetchGiftHistory = useCallback(async () => {
    if (!profile?.id) return;
    setIsGiftHistoryLoading(true);
    const { data } = await supabase
      .from("gift_transactions")
      .select("*")
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      const enriched: GiftTransaction[] = await Promise.all(
        (data as GiftTransaction[]).map(async (gift) => {
          if (!gift.sender_id) return gift;
          const { data: sender } = await supabase
            .from("members")
            .select("name")
            .eq("id", gift.sender_id)
            .maybeSingle();
          return { ...gift, sender_name: sender?.name ?? null };
        })
      );
      setGiftHistory(enriched);
    }
    setIsGiftHistoryLoading(false);
  }, [profile?.id]);

  const fetchCashoutHistory = useCallback(async () => {
    if (!profile?.id) return;
    setIsCashoutHistoryLoading(true);
    const { data } = await supabase
      .from("cashout_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      const enriched: CashoutRequest[] = await Promise.all(
        (data as CashoutRequest[]).map(async (request) => {
          const { data: user } = await supabase
            .from("members")
            .select("name")
            .eq("id", request.user_id)
            .maybeSingle();
          return { ...request, user_name: user?.name ?? null };
        })
      );
      setCashoutHistory(enriched);
    }
    setIsCashoutHistoryLoading(false);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchRedemptions();
      fetchRedemptionCount();
      fetchGiftHistory();
      fetchCashoutHistory();
      // Fetch live balance on focus
      if (profile?.id) {
        supabase.functions
          .invoke("earn-minutes", {
            body: { type: "get_balance", userId: profile.id },
          })
          .then(({ data }) => {
            if (data?.totalMinutes !== undefined) setLiveMinutes(data.totalMinutes);
          })
          .catch(() => {});
      }
    }, [fetchRedemptions, fetchRedemptionCount, fetchGiftHistory, fetchCashoutHistory, profile?.id])
  );

  useEffect(() => {
    if (profile) {
      setShippingName(profile.shipping_name || "");
      setShippingAddress(profile.shipping_address || "");
      setShippingCity(profile.shipping_city || "");
      setShippingState(profile.shipping_state || "");
      setShippingZip(profile.shipping_zip || "");
      setShippingCountry(profile.shipping_country || "");
    }
  }, [profile]);

  const handleEditRedemptionAddress = (redemption: MemberRedemption) => {
    setSelectedRedemption(redemption);
    setRedemptionShipping({
      name: redemption.shipping_name || "",
      address: redemption.shipping_address || "",
      city: redemption.shipping_city || "",
      state: redemption.shipping_state || "",
      zip: redemption.shipping_zip || "",
      country: redemption.shipping_country || "",
    });
    setShowEditRedemptionAddress(true);
  };

  const saveRedemptionAddress = async () => {
    if (!selectedRedemption) return;
    setEditRedemptionLoading(true);
    const { error } = await supabase
      .from("member_redemptions")
      .update({
        shipping_name: redemptionShipping.name,
        shipping_address: redemptionShipping.address,
        shipping_city: redemptionShipping.city,
        shipping_state: redemptionShipping.state,
        shipping_zip: redemptionShipping.zip,
        shipping_country: redemptionShipping.country,
      })
      .eq("id", selectedRedemption.id);

    if (!error) {
      await fetchRedemptions();
      setShowEditRedemptionAddress(false);
      setSelectedRedemption(null);
    }
    setEditRedemptionLoading(false);
  };

  const handleSaveAddress = async () => {
    if (!profile?.id) return;
    setIsSavingAddress(true);
    try {
      await updateProfile({
        shipping_name: shippingName,
        shipping_address: shippingAddress,
        shipping_city: shippingCity,
        shipping_state: shippingState,
        shipping_zip: shippingZip,
        shipping_country: shippingCountry,
      });
      setIsEditingAddress(false);
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} action="success" variant="solid">
            <ToastTitle>Profile Updated</ToastTitle>
            <ToastDescription>Your shipping address has been saved.</ToastDescription>
          </Toast>
        ),
      });
    } catch (err: any) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={"toast-" + id} action="error" variant="solid">
            <ToastTitle>Update Failed</ToastTitle>
            <ToastDescription>{err.message || "Something went wrong. Please try again."}</ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "processing":
        return {
          label: "🔄 Processing your order...",
          color: "#3B82F6",
          icon: <RefreshCcw size={14} color="#3B82F6" />,
        };
      case "pending_shipping":
        return {
          label: "📦 Preparing to ship — please wait!",
          color: "#FACC15",
          icon: <Package size={14} color="#FACC15" />,
        };
      case "Order placed":
        return {
          label: "✅ Order has been placed — please wait!",
          color: "#06B6D4",
          icon: <CheckCircle size={14} color="#06B6D4" />,
        };
      case "Order shipped":
        return {
          label: "🚚 Your order has been shipped!",
          color: "#22C55E",
          icon: <Truck size={14} color="#22C55E" />,
        };
      default:
        return {
          label: status,
          color: "#A1A1AA",
          icon: <ChevronRight size={14} color="#A1A1AA" />,
        };
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };


  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Unauthenticated ───────────────────────────────────────────────────────
  if (!session || !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <User size={64} color="#71717A" />
          <Text style={styles.unauthTitle}>My Profile</Text>
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.signInButton}
              activeOpacity={0.85}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createButton}
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/signup")}
            >
              <Text style={styles.createText}>Create Account</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.linksRow}>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.linkText}>Community Rules</Text>
            </TouchableOpacity>
            <Text style={styles.linkSep}>·</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.linkText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main Authenticated View ───────────────────────────────────────────────
  const isVip = minutes?.is_vip ?? false;
  const isFrozen = minutes?.is_frozen ?? false;
  const giftedMinutes = minutes?.gifted_minutes ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Section ─────────────────────────────────────────────── */}
          <View style={styles.heroSection}>
            {profile.image_url ? (
              <Image
                source={{ uri: profile.image_url }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={48} color="#71717A" />
              </View>
            )}
            <Text style={styles.heroName}>{profile.name || "Member"}</Text>
            <Text style={styles.heroEmail}>{profile.email || ""}</Text>
            <View style={styles.badgesRow}>
              {profile.gender ? (
                <View style={styles.genderBadge}>
                  <Text style={{ color: "#A1A1AA", fontSize: 12, textTransform: "capitalize" }}>
                    {profile.gender}
                  </Text>
                </View>
              ) : null}
              {isVip && (
                <View style={styles.vipBadge}>
                  <Star size={12} color="#FACC15" fill="#FACC15" />
                  <Text style={{ color: "#FACC15", fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
                    VIP
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Female VIP Banner ─────────────────────────────────────────── */}
          <FemaleVipBanner />

          {/* ── Balance Row ──────────────────────────────────────────────── */}
          <View style={styles.balanceRow}>
            <View style={[styles.balanceCard, styles.balanceCardGreen]}>
              <Text style={styles.balanceCardEmoji}>⏱️</Text>
              <Text style={styles.balanceCardTitle}>Earned Chatting</Text>
              <Text style={styles.balanceCardNumber}>{displayMinutes}</Text>
              <Text style={styles.balanceCardSub}>minutes</Text>
            </View>
            <View style={[styles.balanceCard, styles.balanceCardGold]}>
              <Text style={styles.balanceCardEmoji}>🎁</Text>
              <Text style={styles.balanceCardTitle}>Gifted Minutes</Text>
              <Text style={styles.balanceCardNumber}>{giftedMinutes}</Text>
              <Text style={styles.balanceCardSub}>minutes</Text>
            </View>
          </View>

          {/* ── Cashout Button ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.cashoutButton}
            activeOpacity={0.85}
            onPress={() => setShowCashoutModal(true)}
          >
            <Text style={styles.cashoutButtonText}>💰 Cash Out My Minutes</Text>
          </TouchableOpacity>

          {/* Unfreeze (only if frozen) */}
          {isFrozen && (
            <TouchableOpacity
              style={[styles.menuItem, styles.unfreezeMenuItem]}
              activeOpacity={0.8}
              onPress={() => setShowFreezeModal(true)}
            >
              <Snowflake size={18} color="#60A5FA" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.unfreezeMenuItemText}>Account Frozen</Text>
                <View style={styles.frozenBadge}>
                  <Text style={styles.frozenBadgeText}>Tap to unfreeze</Text>
                </View>
              </View>
              <ChevronRight size={16} color="#52525B" />
            </TouchableOpacity>
          )}

          {/* ── Gift History ─────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Clock size={16} color="#FACC15" />
              <Text style={[styles.sectionHeader, { marginLeft: 8 }]}>Gift History</Text>
            </View>
            {isGiftHistoryLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#EF4444" />
              </View>
            ) : giftHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No gifts received yet.</Text>
              </View>
            ) : (
              giftHistory.map((gift, idx) => (
                <View key={gift.id}>
                  <View style={styles.giftHistoryRow}>
                    <View style={styles.giftHistoryIconWrap}>
                      <Text style={styles.giftHistoryEmoji}>🎁</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.giftHistoryMinutes}>
                        +{(gift as any).minutes || (gift as any).minutes_amount || (gift as any).amount || 0} minutes
                      </Text>
                      <Text style={styles.giftHistoryFrom}>
                        {gift.sender_name ? `From: ${gift.sender_name}` : "Anonymous gift"}
                      </Text>
                      {gift.cash_value != null && (
                        <Text style={styles.giftHistoryCashValue}>
                          Cash value: ${gift.cash_value.toFixed(2)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.giftHistoryDate}>
                      {new Date(gift.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {idx < giftHistory.length - 1 && <View style={styles.giftDivider} />}
                </View>
              ))
            )}
          </View>

          {/* ── Cashout History ───────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <DollarSign size={16} color="#10B981" />
              <Text style={[styles.sectionHeader, { marginLeft: 8 }]}>Cashout History</Text>
            </View>
            {isCashoutHistoryLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#10B981" />
              </View>
            ) : cashoutHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No cashout requests yet.</Text>
              </View>
            ) : (
              cashoutHistory.map((req, idx) => {
                const statusColor =
                  req.status === "approved"
                    ? "#22C55E"
                    : req.status === "rejected"
                    ? "#EF4444"
                    : "#FACC15";
                const statusLabel =
                  req.status === "approved"
                    ? "✅ Approved"
                    : req.status === "rejected"
                    ? "❌ Rejected"
                    : "⏳ Pending";
                return (
                  <View key={req.id}>
                    <View style={styles.cashoutHistoryRow}>
                      <View style={styles.cashoutHistoryLeft}>
                        <Text style={styles.cashoutHistoryMinutes}>
                          {req.minutes_amount} min → ${(req.cash_amount ?? 0).toFixed(2)}
                        </Text>
                        {req.paypal_email && (
                          <Text style={styles.cashoutHistoryPaypal}>
                            PayPal: {req.paypal_email}
                          </Text>
                        )}
                        {req.notes ? (
                          <Text style={styles.cashoutHistoryNotes}>Note: {req.notes}</Text>
                        ) : null}
                        <Text style={styles.cashoutHistoryDate}>
                          {new Date(req.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.cashoutStatusBadge, { borderColor: statusColor }]}>
                        <Text style={[styles.cashoutStatusBadgeText, { color: statusColor }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                    {idx < cashoutHistory.length - 1 && <View style={styles.giftDivider} />}
                  </View>
                );
              })
            )}
          </View>

          {/* ── VIP Button ───────────────────────────────────────────────── */}
          {isVip ? (
            <TouchableOpacity
              style={[styles.vipButton, styles.vipButtonActive]}
              activeOpacity={0.85}
              onPress={() => router.push("/vip")}
            >
              <Star size={20} color="#FACC15" fill="#FACC15" />
              <View style={styles.vipButtonTextWrap}>
                <Text style={[styles.vipButtonText, styles.vipButtonTextActive]}>
                  VIP Member
                </Text>
                <Text style={styles.vipButtonSubtitle}>Enjoy your VIP perks</Text>
              </View>
              <ChevronRight size={18} color="#FACC15" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.vipUpgradeBox}
              activeOpacity={0.88}
              onPress={() => router.push("/vip")}
            >
              {/* Crown + Title */}
              <View style={styles.vipUpgradeHeader}>
                <Text style={styles.vipUpgradeCrown}>👑</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.vipUpgradeTitle}>Upgrade to VIP</Text>
                  <Text style={styles.vipUpgradeTagline}>Unlock the full C24 experience</Text>
                </View>
                <View style={styles.vipUpgradeBadge}>
                  <Text style={styles.vipUpgradeBadgeText}>NEW</Text>
                </View>
              </View>

              {/* Perks list */}
              <View style={styles.vipPerksList}>
                {[
                  "😍 Choose Gender",
                  "🎁 Get Gifted by Anyone",
                  "📌 Pin your socials during chats",
                  "🌟 Top of Discover Feed",
                ].map((perk, i) => (
                  <Text key={i} style={styles.vipPerkItem}>{perk}</Text>
                ))}
              </View>

              {/* CTA */}
              <View style={styles.vipUpgradeCTA}>
                <Text style={styles.vipUpgradeCTAText}>Get VIP Access →</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── VIP Settings Menu Item ────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => setShowVipSettings(true)}
          >
            <Settings size={18} color="#A1A1AA" />
            <Text style={[styles.menuItemText, { marginLeft: 10 }]}>VIP Settings</Text>
            <ChevronRight size={16} color="#52525B" style={styles.menuItemArrow} />
          </TouchableOpacity>

          {/* ── Stats Row ────────────────────────────────────────────────── */}
          <View style={styles.statsRow}>
            {/* Redeemed Count */}
            <View style={[styles.statCard, { flex: 1, marginRight: 8 }]}>
              <Gift size={20} color="#EF4444" />
              <Text style={styles.statValue}>
                {redemptionCount != null ? redemptionCount : "—"}
              </Text>
              <Text style={styles.statLabel}>Redeemed</Text>
            </View>

            {/* Chance Enhancer */}
            <View style={[styles.statCard, { flex: 1 }]}>
              <View style={styles.ceStatLabelRow}>
                <Star size={18} color="#FACC15" fill="#FACC15" />
                <TouchableOpacity
                  onPress={() => setShowCEInfo(true)}
                  style={{ marginLeft: 4 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Info size={14} color="#71717A" />
                </TouchableOpacity>
              </View>
              <Text style={styles.statValue}>{currentCE}%</Text>
              <Text style={styles.statLabel}>Chance Enhancer</Text>
              {isMaxed && (
                <View style={styles.nextBoostBadge}>
                  <Text style={styles.nextBoostText}>MAX</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── CE Progress Card ─────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.ceHeaderRow}>
              <Star size={16} color="#FACC15" fill="#FACC15" />
              <Text style={[styles.ceTitleText, { marginLeft: 6 }]}>
                Chance Enhancer Progress
              </Text>
              <TouchableOpacity
                onPress={() => setShowCEInfo(true)}
                style={{ marginLeft: 6 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Info size={14} color="#71717A" />
              </TouchableOpacity>
            </View>

            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, percentage)}%` as any },
                ]}
              />
            </View>

            <Text style={styles.progressLabel}>
              {isMaxed
                ? `Maxed out at ${currentCE}% — keep chatting to maintain it!`
                : `${progress} / ${threshold} minutes → next +${isVip ? "10" : "5"}% boost (currently ${currentCE}%)`}
            </Text>
          </View>

          {/* ── My Rewards Section ───────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Gift size={16} color="#EF4444" />
              <Text style={[styles.sectionHeader, { marginLeft: 8 }]}>My Rewards</Text>
            </View>

            {isRedemptionsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#EF4444" />
              </View>
            ) : redemptions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No redemptions yet.</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push("/(tabs)/rewards" as any)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyButtonText}>Visit the Reward Store →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              redemptions.map((redemption) => {
                const statusInfo = getStatusInfo(redemption.status);
                return (
                  <View key={redemption.id} style={styles.redemptionCard}>
                    <View style={styles.redemptionRow}>
                      {redemption.reward_image_url ? (
                        <Image
                          source={{ uri: redemption.reward_image_url }}
                          style={styles.redemptionImage}
                        />
                      ) : (
                        <View style={styles.placeholderImage}>
                          <Gift size={24} color="#52525B" />
                        </View>
                      )}
                      <View style={styles.redemptionDetails}>
                        <Text style={styles.redemptionTitle}>
                          {redemption.reward_title || "Reward"}
                        </Text>

                        <View style={styles.statusBadgeRow}>
                          {statusInfo.icon}
                          <Text style={[styles.statusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </Text>
                        </View>

                        {/* Cashout info if applicable */}
                        {redemption.cashout_amount != null && (
                          <View style={styles.cashoutInfoBlock}>
                            <View style={styles.cashoutAmtBadge}>
                              <DollarSign size={12} color="#22C55E" />
                              <Text style={styles.cashoutAmtText}>
                                ${redemption.cashout_amount.toFixed(2)}
                              </Text>
                            </View>
                            {redemption.cashout_paypal && (
                              <View style={styles.paypalRow}>
                                <Mail size={12} color="#A1A1AA" />
                                <Text style={styles.paypalText}>
                                  {redemption.cashout_paypal}
                                </Text>
                              </View>
                            )}
                            {redemption.cashout_status && (
                              <Text style={styles.cashoutStatusText}>
                                Status: {redemption.cashout_status}
                              </Text>
                            )}
                          </View>
                        )}

                        <Text style={styles.redemptionDate}>
                          {new Date(redemption.created_at).toLocaleDateString()}
                        </Text>

                        {/* Change address for processing orders */}
                        {(redemption.status === "processing" ||
                          redemption.status === "pending_shipping") && (
                          <TouchableOpacity
                            style={styles.changeAddressBtn}
                            onPress={() => handleEditRedemptionAddress(redemption)}
                          >
                            <MapPin size={12} color="#3B82F6" />
                            <Text style={styles.changeAddressBtnText}>
                              Change Shipping Address
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Tracking link for shipped orders */}
                        {redemption.status === "Order shipped" &&
                          redemption.shipping_tracking_url ? (
                          <TouchableOpacity
                            style={styles.trackingLinkBtn}
                            activeOpacity={0.75}
                            onPress={() =>
                              Linking.openURL(redemption.shipping_tracking_url!)
                            }
                          >
                            <Truck size={13} color="#22C55E" />
                            <Text style={styles.trackingLinkText}>
                              Track My Package →
                            </Text>
                          </TouchableOpacity>
                        ) : null}

                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Shipping Address Section ──────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <MapPin size={16} color="#EF4444" />
              <Text style={[styles.sectionHeader, { marginLeft: 8 }]}>Shipping Address</Text>
            </View>

            {isEditingAddress ? (
              <View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={shippingName}
                    onChangeText={setShippingName}
                    placeholder="Full name"
                    placeholderTextColor="#52525B"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Street Address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={shippingAddress}
                    onChangeText={setShippingAddress}
                    placeholder="123 Main St"
                    placeholderTextColor="#52525B"
                  />
                </View>
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput
                      style={styles.textInput}
                      value={shippingCity}
                      onChangeText={setShippingCity}
                      placeholder="City"
                      placeholderTextColor="#52525B"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>                    <Text style={styles.inputLabel}>State</Text>
                    <TextInput
                      style={styles.textInput}
                      value={shippingState}
                      onChangeText={setShippingState}
                      placeholder="State"
                      placeholderTextColor="#52525B"
                    />
                  </View>
                </View>
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>                    <Text style={styles.inputLabel}>ZIP Code</Text>
                    <TextInput
                      style={styles.textInput}
                      value={shippingZip}
                      onChangeText={setShippingZip}
                      placeholder="ZIP"
                      placeholderTextColor="#52525B"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>                    <Text style={styles.inputLabel}>Country</Text>
                    <TextInput
                      style={styles.textInput}
                      value={shippingCountry}
                      onChangeText={setShippingCountry}
                      placeholder="Country"
                      placeholderTextColor="#52525B"
                    />
                  </View>
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setIsEditingAddress(false)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    activeOpacity={0.85}
                    onPress={handleSaveAddress}
                    disabled={isSavingAddress}
                  >
                    {isSavingAddress ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveText}>Save Address</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                {profile.shipping_name || profile.shipping_address ? (
                  <View>
                    {profile.shipping_name && (
                      <Text style={styles.addressName}>{profile.shipping_name}</Text>
                    )}
                    {profile.shipping_address && (
                      <Text style={styles.addressText}>{profile.shipping_address}</Text>
                    )}
                    {(profile.shipping_city ||
                      profile.shipping_state ||
                      profile.shipping_zip) && (
                      <Text style={styles.addressText}>
                        {[profile.shipping_city, profile.shipping_state, profile.shipping_zip]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    )}
                    {profile.shipping_country && (
                      <Text style={styles.addressText}>{profile.shipping_country}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.noAddressText}>No shipping address saved yet.</Text>
                )}
                <TouchableOpacity
                  style={styles.inlineEditBtn}
                  onPress={() => setIsEditingAddress(true)}
                >
                  <Edit2 size={14} color="#71717A" />
                  <Text style={styles.inlineEditBtnText}>
                    {profile.shipping_address ? "Edit Address" : "Add Address"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Menu Items ───────────────────────────────────────────────── */}

          {/* Reward Store */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/rewards" as any)}
          >
            <Gift size={18} color="#A1A1AA" />
            <Text style={[styles.menuItemText, { marginLeft: 10 }]}>Reward Store</Text>
            <ChevronRight size={16} color="#52525B" style={styles.menuItemArrow} />
          </TouchableOpacity>

          {/* Notification Settings */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => router.push("/notification-settings" as any)}
          >
            <Bell size={18} color="#A1A1AA" />
            <Text style={[styles.menuItemText, { marginLeft: 10 }]}>Notification Settings</Text>
            <ChevronRight size={16} color="#52525B" style={styles.menuItemArrow} />
          </TouchableOpacity>

          {/* ── Sign Out ─────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.signOutButton}
            activeOpacity={0.85}
            onPress={handleSignOut}
          >
            <LogOut size={18} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* ── Links Row ────────────────────────────────────────────────── */}
          <FooterLinks />

          {/* Version label */}
          <Text style={{ color: '#52525B', fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 4 }}>
            v1.5.3 (build 44)
          </Text>
        </ScrollView>

        {/* ── Modals ─────────────────────────────────────────────────────── */}

        {/* Freeze Modal */}
        <FreezeModal
          visible={showFreezeModal}
          onClose={() => setShowFreezeModal(false)}
          liveMinutes={liveMinutes}
        />

        {/* Cashout Modal */}
        <CashoutModal
          isOpen={showCashoutModal}
          onClose={() => setShowCashoutModal(false)}
        />

        {/* VIP Settings Overlay */}
        <VipSettingsOverlay
          isVisible={showVipSettings}
          onClose={() => setShowVipSettings(false)}
          isVip={isVip}
          vipTier={minutes?.vip_tier}
        />

        {/* CE Info Modal (using RNModal) */}
        <RNModal
          visible={showCEInfo}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCEInfo(false)}
        >
          <TouchableOpacity
            style={styles.ceInfoOverlay}
            activeOpacity={1}
            onPress={() => setShowCEInfo(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.ceInfoBox}>
              <View style={styles.ceInfoHeader}>
                <View style={styles.ceInfoTitleRow}>
                  <Star size={18} color="#FACC15" fill="#FACC15" />
                  <Text style={styles.ceInfoTitle}>Chance Enhancer</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCEInfo(false)}>
                  <X size={20} color="#71717A" />
                </TouchableOpacity>
              </View>
              <View style={styles.ceInfoBody}>
                <Text style={[styles.ceInfoText, { marginBottom: 12 }]}>
                  <Text style={styles.ceInfoBold}>Chance Enhancer (CE)</Text> increases the probability
                  that your spin wins a physical reward instead of minutes.
                </Text>

                {/* Growth */}
                <Text style={[styles.ceInfoText, { marginBottom: 4 }]}>
                  <Text style={styles.ceInfoBold}>📈 Growth</Text>
                </Text>
                <Text style={[styles.ceInfoText, { marginBottom: 12 }]}>
                  {isVip
                    ? `Your CE grows by +10% for every 150 minutes of chat time (VIP). Minimum CE: 15%, max: 45%.`
                    : `Your CE grows by +5% for every 200 minutes of chat time. Minimum CE: 5%, max: 25%.`}
                </Text>

                {/* Decay */}
                <Text style={[styles.ceInfoText, { marginBottom: 4 }]}>
                  <Text style={styles.ceInfoBold}>📉 Inactivity Decay</Text>
                </Text>
                <Text style={[styles.ceInfoText, { marginBottom: 12 }]}>
                  {isVip
                    ? `Miss a day and your CE decays by 50% — but never below the 15% VIP floor.`
                    : `Miss a day and your CE decays by 60% — but never below the 5% minimum.`}
                  {" "}Log in daily to protect your boost!
                </Text>

                {/* Where it applies */}
                <Text style={[styles.ceInfoText, { marginBottom: 4 }]}>
                  <Text style={styles.ceInfoBold}>🎰 Where CE Applies</Text>
                </Text>
                <Text style={[styles.ceInfoText, { marginBottom: 12 }]}>
                  CE adds to the base win rate on Rare and Legendary spins:{"\n"}
                  • Rare: 5% base + your CE{"\n"}
                  • Legendary: 2% base + your CE{"\n"}
                  Also applies to Gift Card and VIP spins.
                </Text>

                {/* Current status */}
                <Text style={[styles.ceInfoText, { marginBottom: 12 }]}>
                  Your current CE is{" "}
                  <Text style={styles.ceInfoBold}>{currentCE}%</Text>
                  {isMaxed ? " — maxed out, keep chatting to maintain it!" : ` — ${threshold - progress} more minutes to your next boost.`}
                </Text>

                {isVip && (
                  <View style={styles.ceInfoVipBadge}>
                    <Star size={12} color="#FACC15" fill="#FACC15" />
                    <Text style={styles.ceInfoVipText}>VIP: faster growth (150 min), higher cap (45%), lower decay (50%)</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => setShowCEInfo(false)}
              >
                <Text style={styles.saveText}>Got it!</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </RNModal>

        {/* Shipping Address Edit Modal (gluestack) */}
        <Modal
          isOpen={showEditRedemptionAddress}
          onClose={() => {
            setShowEditRedemptionAddress(false);
            setSelectedRedemption(null);
          }}
        >
          <ModalBackdrop />
          <ModalContent style={styles.modalContent}>
            <ModalHeader style={styles.modalHeader}>
              <Heading style={styles.whiteText} size="md">
                Update Shipping Address
              </Heading>
              <ModalCloseButton>
                <X size={20} color="#A1A1AA" />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBody>
              <VStack space="sm" style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={redemptionShipping.name}
                    onChangeText={(val) =>
                      setRedemptionShipping((prev) => ({ ...prev, name: val }))
                    }
                    placeholder="Full name"
                    placeholderTextColor="#52525B"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Street Address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={redemptionShipping.address}
                    onChangeText={(val) =>
                      setRedemptionShipping((prev) => ({ ...prev, address: val }))
                    }
                    placeholder="123 Main St"
                    placeholderTextColor="#52525B"
                  />
                </View>
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput
                      style={styles.textInput}
                      value={redemptionShipping.city}
                      onChangeText={(val) =>
                        setRedemptionShipping((prev) => ({ ...prev, city: val }))
                      }
                      placeholder="City"
                      placeholderTextColor="#52525B"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>State</Text>
                    <TextInput
                      style={styles.textInput}
                      value={redemptionShipping.state}
                      onChangeText={(val) =>
                        setRedemptionShipping((prev) => ({ ...prev, state: val }))
                      }
                      placeholder="State"
                      placeholderTextColor="#52525B"
                    />
                  </View>
                </View>
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>ZIP</Text>
                    <TextInput
                      style={styles.textInput}
                      value={redemptionShipping.zip}
                      onChangeText={(val) =>
                        setRedemptionShipping((prev) => ({ ...prev, zip: val }))
                      }
                      placeholder="ZIP"
                      placeholderTextColor="#52525B"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Country</Text>
                    <TextInput
                      style={styles.textInput}
                      value={redemptionShipping.country}
                      onChangeText={(val) =>
                        setRedemptionShipping((prev) => ({ ...prev, country: val }))
                      }
                      placeholder="Country"
                      placeholderTextColor="#52525B"
                    />
                  </View>
                </View>
              </VStack>
            </ModalBody>
            <ModalFooter style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEditRedemptionAddress(false);
                  setSelectedRedemption(null);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                activeOpacity={0.85}
                onPress={saveRedemptionAddress}
                disabled={editRedemptionLoading}
              >
                {editRedemptionLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Address</Text>
                )}
              </TouchableOpacity>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: "center",
  },

  // ── Unauthenticated ──────────────────────────────────────────────────────────
  unauthTitle: {
    color: "#F4F4F5",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 24,
  },
  buttonsContainer: {
    width: "100%",
    rowGap: 12, columnGap: 12,
  },
  signInButton: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  createButton: {
    backgroundColor: "#16213E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  createText: {
    color: "#A1A1AA",
    fontSize: 16,
    fontWeight: "600",
  },
  linksRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    rowGap: 8, columnGap: 8,
  },
  linkText: {
    color: "#52525B",
    fontSize: 13,
  },
  linkSep: {
    color: "#52525B",
    fontSize: 13,
  },

  // ── Hero Section ────────────────────────────────────────────────────────────
  heroSection: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#EF4444",
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#16213E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#27272A",
  },
  heroName: {
    color: "#F4F4F5",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 4,
  },
  heroEmail: {
    color: "#71717A",
    fontSize: 14,
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: "row",
    rowGap: 8, columnGap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  genderBadge: {
    backgroundColor: "#16213E",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A1F00",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FACC15",
  },

  // ── Balance Row ─────────────────────────────────────────────────────────────
  balanceRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    rowGap: 12, columnGap: 12,
    marginBottom: 12,
  },
  balanceCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  balanceCardGreen: {
    backgroundColor: "#0A2318",
    borderColor: "#22C55E",
  },
  balanceCardGold: {
    backgroundColor: "#231A00",
    borderColor: "#FACC15",
  },
  balanceCardEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  balanceCardTitle: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  balanceCardNumber: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  balanceCardSub: {
    color: "#71717A",
    fontSize: 12,
    marginTop: 2,
  },

  // ── Cashout Button ──────────────────────────────────────────────────────────
  cashoutButton: {
    backgroundColor: "#22C55E",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  cashoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Generic Card ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#16213E",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  sectionHeader: {
    color: "#F4F4F5",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: {
    color: "#71717A",
    fontSize: 14,
    marginBottom: 12,
  },
  emptyButton: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Gift History ─────────────────────────────────────────────────────────────
  giftHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  giftHistoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#231A00",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  giftHistoryEmoji: {
    fontSize: 16,
  },
  giftHistoryMinutes: {
    color: "#22C55E",
    fontSize: 15,
    fontWeight: "700",
  },
  giftHistoryFrom: {
    color: "#A1A1AA",
    fontSize: 13,
    marginTop: 2,
  },
  giftHistoryCashValue: {
    color: "#FACC15",
    fontSize: 12,
    marginTop: 2,
  },
  giftHistoryDate: {
    color: "#52525B",
    fontSize: 12,
    marginLeft: 8,
  },
  giftDivider: {
    height: 1,
    backgroundColor: "#27272A",
    marginVertical: 2,
  },

  // ── Cashout History ─────────────────────────────────────────────────────────
  cashoutHistoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    rowGap: 12, columnGap: 12,
  },
  cashoutHistoryLeft: {
    flex: 1,
  },
  cashoutHistoryMinutes: {
    color: "#10B981",
    fontSize: 15,
    fontWeight: "800",
  },
  cashoutHistoryPaypal: {
    color: "#71717A",
    fontSize: 12,
    marginTop: 2,
  },
  cashoutHistoryNotes: {
    color: "#A1A1AA",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  cashoutHistoryDate: {
    color: "#52525B",
    fontSize: 11,
    marginTop: 2,
  },
  cashoutStatusBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    minWidth: 84,
    alignItems: "center",
  },
  cashoutStatusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  // ── VIP Button ──────────────────────────────────────────────────────────────
  vipButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213E",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  vipButtonActive: {
    borderColor: "#FACC15",
    backgroundColor: "#1C1500",
  },
  vipButtonTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  vipButtonText: {
    color: "#A1A1AA",
    fontSize: 15,
    fontWeight: "700",
  },
  vipButtonTextActive: {
    color: "#FACC15",
  },
  vipButtonSubtitle: {
    color: "#52525B",
    fontSize: 12,
    marginTop: 2,
  },
  vipUpgradeBox: {
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#1A1400",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: "#FACC15",
    shadowColor: "#FACC15",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  vipUpgradeHeader: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
  },
  vipUpgradeCrown: {
    fontSize: 28,
  },
  vipUpgradeTitle: {
    color: "#FACC15",
    fontSize: 18,
    fontWeight: "800",
  },
  vipUpgradeTagline: {
    color: "#A1A1AA",
    fontSize: 12,
    marginTop: 2,
  },
  vipUpgradeBadge: {
    backgroundColor: "#FACC15",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vipUpgradeBadgeText: {
    color: "#1A1A2E",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  vipPerksList: {
    width: "100%",
    marginBottom: 14,
    backgroundColor: "#0D0A00",
    borderRadius: 10,
    padding: 12,
  },
  vipPerkItem: {
    color: "#E4E4E7",
    fontSize: 13,
    lineHeight: 22,
  },
  vipUpgradeCTA: {
    width: "100%",
    backgroundColor: "#FACC15",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  vipUpgradeCTAText: {
    color: "#1A1A2E",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // ── Menu Items ──────────────────────────────────────────────────────────────
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16213E",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  menuItemText: {
    color: "#A1A1AA",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  menuItemArrow: {
    marginLeft: "auto",
  },
  unfreezeMenuItem: {
    borderColor: "#60A5FA",
    backgroundColor: "#0A1628",
  },
  unfreezeMenuItemText: {
    color: "#60A5FA",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  frozenBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#1E3A5F",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  frozenBadgeText: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "600",
  },

  inlineEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    rowGap: 4, columnGap: 4,
  },
  inlineEditBtnText: {
    color: "#71717A",
    fontSize: 13,
  },
  // ── Stats Row ───────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
  },
  statCard: {
    backgroundColor: "#16213E",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27272A",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    color: "#71717A",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  ceStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextBoostBadge: {
    backgroundColor: "#231A00",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#FACC15",
  },
  nextBoostText: {
    color: "#FACC15",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // ── CE Progress Card ─────────────────────────────────────────────────────────
  ceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  ceTitleText: {
    color: "#F4F4F5",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: "#0F172A",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FACC15",
    borderRadius: 5,
  },
  progressLabel: {
    color: "#71717A",
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Redemptions ──────────────────────────────────────────────────────────────
  redemptionCard: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  redemptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  redemptionImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 12,
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#16213E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  redemptionDetails: {
    flex: 1,
  },
  redemptionTitle: {
    color: "#F4F4F5",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  redemptionDate: {
    color: "#52525B",
    fontSize: 12,
    marginTop: 6,
  },
  statusBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    rowGap: 6, columnGap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  cashoutInfoBlock: {
    marginTop: 8,
    rowGap: 4, columnGap: 4,
  },
  cashoutAmtBadge: {
    flexDirection: "row",
    alignItems: "center",
    rowGap: 4, columnGap: 4,
    backgroundColor: "#0A2318",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  cashoutAmtText: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "700",
  },
  paypalRow: {
    flexDirection: "row",
    alignItems: "center",
    rowGap: 4, columnGap: 4,
  },
  paypalText: {
    color: "#A1A1AA",
    fontSize: 12,
  },
  cashoutStatusText: {
    color: "#71717A",
    fontSize: 12,
  },
  changeAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    rowGap: 4, columnGap: 4,
  },
  changeAddressBtnText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "600",
  },
  trackingLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 5,
  },
  trackingLinkText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Shipping Address ─────────────────────────────────────────────────────────
  addressName: {
    color: "#F4F4F5",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  addressText: {
    color: "#A1A1AA",
    fontSize: 14,
    marginBottom: 2,
  },
  noAddressText: {
    color: "#71717A",
    fontSize: 14,
    marginBottom: 10,
  },

  // ── Forms / Inputs ───────────────────────────────────────────────────────────
  formContainer: {
    rowGap: 10, columnGap: 10,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    color: "#71717A",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#0F172A",
    color: "#F4F4F5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#27272A",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  rowInputs: {
    flexDirection: "row",
  },
  formActions: {
    flexDirection: "row",
    rowGap: 10, columnGap: 10,
    marginTop: 14,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#27272A",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "#A1A1AA",
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Sign Out ─────────────────────────────────────────────────────────────────
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16213E",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 14,
    rowGap: 8, columnGap: 8,
    borderWidth: 1,
    borderColor: "#3F1010",
  },
  signOutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Modal ────────────────────────────────────────────────────────────────────
  modalContent: {
    backgroundColor: "#16213E",
    borderRadius: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  modalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
    paddingBottom: 12,
  },
  modalFooter: {
    flexDirection: "row",
    rowGap: 10, columnGap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#27272A",
  },
  whiteText: {
    color: "#F4F4F5",
  },

  // ── CE Info Modal ────────────────────────────────────────────────────────────
  ceInfoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  ceInfoBox: {
    backgroundColor: "#16213E",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    padding: 20,
    borderWidth: 1,
    borderColor: "#27272A",
  },
  ceInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  ceInfoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    rowGap: 8, columnGap: 8,
  },
  ceInfoTitle: {
    color: "#F4F4F5",
    fontSize: 18,
    fontWeight: "800",
  },
  ceInfoBody: {
    marginBottom: 20,
  },
  ceInfoText: {
    color: "#A1A1AA",
    fontSize: 14,
    lineHeight: 20,
  },
  ceInfoBold: {
    color: "#F4F4F5",
    fontWeight: "700",
  },
  ceInfoVipBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#1C1500",
    borderRadius: 10,
    padding: 10,
    rowGap: 8, columnGap: 8,
    borderWidth: 1,
    borderColor: "#FACC15",
    marginTop: 8,
  },
  ceInfoVipText: {
    color: "#FACC15",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },

  // ── Cashout Amount Badge (in redemptions) ────────────────────────────────────
  // (already covered above in Redemptions section)

  // ── Freeze / Status Badges ───────────────────────────────────────────────────
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  } as any,
});