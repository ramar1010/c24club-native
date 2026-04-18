import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  DollarSign,
  Flag,
  Gift,
  MessageSquare,
  Send,
  ShieldOff,
  Video,
  X,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useCall } from "@/contexts/CallContext";
import { supabase } from "@/lib/supabase";
import {
  useConversationMessages,
  useSendMessage,
  type DmMessage,
} from "@/hooks/useMessages";
import { useFreeMsgLimit } from "@/hooks/useFreeMsgLimit";
import { Alert } from "react-native";
import { GiftModal } from "@/components/modals/GiftModal";
import { CashoutModal } from "@/components/modals/CashoutModal";
import { notifyGiftAttempt } from "@/lib/gift-utils";
import { GiftCelebration } from "@/components/GiftCelebration";
import { MemberProfileModal } from "@/components/MemberProfileModal";
import { DiscoverMember } from "@/types/members";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalGiftMessage {
  id: string;
  type: "gift";
  tierMinutes: number;
  cashValue: number;
  created_at: string;
}

type DisplayMessage = DmMessage | LocalGiftMessage;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isOnline = (lastActive: string | null | undefined): boolean => {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
};

const formatMsgTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// ─── Gift Bubble ──────────────────────────────────────────────────────────────

interface GiftBubbleProps {
  message: LocalGiftMessage;
}

const GiftBubble = React.memo(function GiftBubble({ message }: GiftBubbleProps) {
  return (
    <View style={styles.giftBubbleWrapper}>
      <View style={styles.giftBubble}>
        <View style={styles.giftBubbleRow}>
          <Text style={styles.giftBubbleEmoji}>🎁</Text>
          <Text style={styles.giftBubbleTitle}>Cash Gift Sent</Text>
        </View>
        <Text style={styles.giftBubbleSubtext}>You sent a cash gift!</Text>
      </View>
    </View>
  );
});

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  message: DmMessage;
  isMine: boolean;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  isMine,
}: BubbleProps) {
  return (
    <View
      style={[
        styles.bubbleWrapper,
        isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.bubbleTime,
            isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs,
          ]}
        >
          {formatMsgTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatThreadScreen() {
  const router = useRouter();
  const { user, profile, minutes } = useAuth();
  const { startCall } = useCall();
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebugLog = (msg: string) => {
    setDebugLog(prev => [new Date().toLocaleTimeString() + ": " + msg, ...prev].slice(0, 10));
  };

  const params = useLocalSearchParams<{
    id: string;
    partnerId: string;
    partnerName: string;
    partnerImage?: string;
    partnerGender?: string;
  }>();

  const conversationId = params.id === "new" ? null : params.id;
  const [resolvedPartnerId, setResolvedPartnerId] = useState<string>(params.partnerId ?? "");
  const partnerId = resolvedPartnerId;
  
  // Track the actual conversation id (may be set after first send or resolved on mount)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversationId
  );
  const [partnerProfile, setPartnerProfile] = useState<{ id?: string; name?: string | null; gender?: string | null; role?: string | null; image_url?: string | null } | null>(null);
  const [partnerIsVip, setPartnerIsVip] = useState(false);
  const [partnerVipLoaded, setPartnerVipLoaded] = useState(false);

  // Use fetched profile data as primary source of truth, then fall back to params
  const partnerName = partnerProfile?.name ?? params.partnerName ?? "User";
  const partnerImage = partnerProfile?.image_url ?? params.partnerImage ?? null;

  const { hasReachedLimit, usedCount, isLoading: limitLoading, isVip, remaining, FREE_MSG_LIMIT } = useFreeMsgLimit(partnerId);

  // Gift celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [localGiftMessages, setLocalGiftMessages] = useState<LocalGiftMessage[]>([]);

  // ─── Profile modal ────────────────────────────────────────────────────────
  const [selectedMember, setSelectedMember] = useState<{
    member: DiscoverMember;
    isVip: boolean;
    isAdmin: boolean;
    isMod: boolean;
    pinnedSocials?: string[];
  } | null>(null);

  const handlePartnerAvatarPress = async () => {
    if (!partnerId) return;

    // Open immediately with available data
    setSelectedMember({
      member: {
        id: partnerId,
        name: partnerName,
        bio: null,
        gender: params.partnerGender ?? null,
        image_url: partnerImage,
        image_thumb_url: null,
        image_status: null,
        is_discoverable: true,
        last_active_at: null,
        country: null,
        created_at: new Date().toISOString(),
        membership: null,
        is_test_account: false,
        role: null,
      },
      isVip: false,
      isAdmin: false,
      isMod: false,
      pinnedSocials: undefined,
    });

    // Enrich in background
    try {
      const [memberRes, vipRes, minutesRes] = await Promise.all([
        supabase
          .from("members")
          .select("*")
          .eq("id", partnerId)
          .single(),
        supabase
          .from("vip_settings")
          .select("pinned_socials")
          .eq("user_id", partnerId)
          .maybeSingle(),
        supabase
          .from("member_minutes")
          .select("is_vip, admin_granted_vip")
          .eq("user_id", partnerId)
          .maybeSingle(),
      ]);

      if (!memberRes.data) return;
      const m = memberRes.data;
      const isVip = !!(minutesRes.data?.is_vip || minutesRes.data?.admin_granted_vip);
      const isAdmin = m.role === "admin";
      const isMod = m.role === "mod";
      const rawSocials = vipRes.data?.pinned_socials as string[] | null;
      const pinnedSocials = rawSocials && rawSocials.length > 0 ? rawSocials : undefined;

      setSelectedMember({ member: m as DiscoverMember, isVip, isAdmin, isMod, pinnedSocials });
    } catch (_) {}
  };

  // Resolve conversation ID if "new" and fetch partner profile
  useEffect(() => {
    async function resolveData() {
      if (!user) return;

      let effectivePartnerId = resolvedPartnerId;

      // ── If partnerId is missing, resolve it from the conversation ──────────
      if (!effectivePartnerId && conversationId) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("participant_1, participant_2")
          .eq("id", conversationId)
          .maybeSingle();

        if (conv) {
          const pid = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
          if (pid) {
            setResolvedPartnerId(pid);
            effectivePartnerId = pid;
          }
        }
      }

      if (!effectivePartnerId) return;

      // 1. Resolve conversation ID if "new"
      if (params.id === "new") {
        const { data: existing1 } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_1", user.id)
          .eq("participant_2", effectivePartnerId)
          .maybeSingle();
        
        const { data: existing2 } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_1", effectivePartnerId)
          .eq("participant_2", user.id)
          .maybeSingle();

        const existing = existing1 || existing2;
        if (existing) {
          setActiveConversationId(existing.id);
        }
      }

      // 2. Fetch partner profile
      const { data: fetchedProfile, error: profileError } = await supabase
        .from("members")
        .select("id, name, gender, role, image_url")
        .eq("id", effectivePartnerId)
        .maybeSingle();
      
      if (profileError) {
        // Retry without role
        const { data: retryProfile } = await supabase
          .from("members")
          .select("id, name, gender, image_url")
          .eq("id", effectivePartnerId)
          .maybeSingle();
        if (retryProfile) {
          setPartnerProfile(retryProfile);
        }
      } else if (fetchedProfile) {
        setPartnerProfile(fetchedProfile);
      }

      // 3. Fetch partner VIP status for gift modal gating — use RPC to bypass RLS
      const { data: isVipData } = await supabase.rpc('is_user_vip', { _user_id: effectivePartnerId });
      const vipResult = !!isVipData;
      console.log("[GiftModal] partnerVip check via RPC:", { effectivePartnerId, result: vipResult });
      setPartnerIsVip(vipResult);
      setPartnerVipLoaded(true);
    }
    resolveData();
  }, [params.id, user, resolvedPartnerId, conversationId]);

  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList<DisplayMessage>>(null);

  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByPartner, setIsBlockedByPartner] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const gifted = minutes?.gifted_minutes ?? 0;

  const isMale = profile?.gender?.toLowerCase() === "male";
  const genderStr = partnerProfile?.gender || params.partnerGender || "";
  const isPartnerFemale = genderStr.toLowerCase() === "female";

  const { data: messages, isLoading } = useConversationMessages(
    activeConversationId
  );
  const sendMessage = useSendMessage();
  const { lastError: sendError } = sendMessage;

  useEffect(() => {
    if (sendError) {
      addDebugLog("SEND ERROR: " + sendError);
    }
  }, [sendError]);

  // Check if already blocked
  useEffect(() => {
    if (!user || !partnerId) return;
    supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', partnerId)
      .maybeSingle()
      .then(({ data }) => setIsBlocked(!!data));

    // Check if partner has blocked us
    supabase.rpc('is_blocked_by', { partner_id: partnerId })
      .then(({ data: rpcData }) => setIsBlockedByPartner(!!rpcData));
  }, [user, partnerId]);

  const handleBlock = async () => {
    if (!user) return;
    setBlockLoading(true);
    if (isBlocked) {
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', partnerId);
      setIsBlocked(false);
    } else {
      await supabase
        .from('blocked_users')
        .insert({ blocker_id: user.id, blocked_id: partnerId });
      setIsBlocked(true);
    }
    setBlockLoading(false);
    setShowBlockModal(false);
  };

  // Merge real messages with local gift messages for display
  const displayMessages: DisplayMessage[] = React.useMemo(() => {
    const base: DisplayMessage[] = messages ?? [];
    if (localGiftMessages.length === 0) return base;
    return [...base, ...localGiftMessages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, localGiftMessages]);

  const handleGiftSent = useCallback(
    (info: { tierMinutes: number; cashValue: number }) => {
      // Append local gift bubble
      const giftMsg: LocalGiftMessage = {
        id: `gift-local-${Date.now()}`,
        type: "gift",
        tierMinutes: info.tierMinutes,
        cashValue: info.cashValue,
        created_at: new Date().toISOString(),
      };
      setLocalGiftMessages((prev) => [...prev, giftMsg]);
      // Show celebration overlay
      setShowCelebration(true);
    },
    []
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (displayMessages && displayMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [displayMessages]);

  // Determine if partner is online (we don't have their profile here, just use name for now)
  const partnerOnline = false; // We'd need to fetch partner's last_active_at separately

  const submitReport = useCallback(async () => {
    if (!reportReason || !profile?.id) return;
    setReportSubmitting(true);
    const { error } = await supabase.from('user_reports').insert({
      reporter_id: profile.id,
      reported_user_id: partnerId,
      reason: reportReason,
      details: reportDetails || null,
    });
    setReportSubmitting(false);
    if (!error) {
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
        setReportReason('');
        setReportDetails('');
      }, 2000);
    }
  }, [reportReason, reportDetails, profile?.id, partnerId]);

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !user) return;

    // Block check — don't let blocked users send messages
    if (isBlocked) {
      Alert.alert(
        'User Blocked',
        `You've blocked ${partnerName}. Unblock them to send messages.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unblock', onPress: () => setShowBlockModal(true) },
        ]
      );
      return;
    }

    if (isBlockedByPartner) {
      Alert.alert('Cannot Send Message', 'You cannot send messages to this user.');
      return;
    }

    // Enforcement: Check limit for non-VIP males
    // If limit check is still loading, wait or proceed? Let's proceed but block if it's already reached.
    if (!isVip && isMale && isPartnerFemale && hasReachedLimit) {
      const msg = `You've used all ${FREE_MSG_LIMIT} free messages to female members. Upgrade to VIP to keep chatting with no limits!`;
      if (Platform.OS === 'web') alert(msg);
      else {
        Alert.alert(
          "Free Messages Used Up 💬",
          msg,
          [
            { text: "Not Now", style: "cancel" },
            { text: "Upgrade to VIP 🔥", onPress: () => router.push("/vip") },
          ]
        );
      }
      return;
    }

    setInputText("");

    try {
      addDebugLog("Sending message...");
      const result = await sendMessage.mutateAsync({
        conversationId: activeConversationId ?? "new",
        partnerId,
        content,
      });

      addDebugLog("SUCCESS! ConvoID: " + result.conversationId);

      // Update active conversation id if it was new
      if (!activeConversationId) {
        setActiveConversationId(result.conversationId);
      }
    } catch (err: any) {
      console.error("Failed to send message:", err);
      addDebugLog("FAILED: " + (err.message || "Unknown error"));
    }
  };

  const handleGiftClick = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }

    // If VIP status not yet loaded, do a quick re-check before opening modal
    if (!partnerVipLoaded) {
      const { data: isVipData } = await supabase.rpc('is_user_vip', { _user_id: partnerId });
      const isVip = !!isVipData;
      setPartnerIsVip(isVip);
      setPartnerVipLoaded(true);
      // Only nudge non-VIP recipients
      if (!isVip) {
        notifyGiftAttempt(partnerId);
      }
    } else if (!partnerIsVip) {
      // Only nudge non-VIP recipients; VIP users can already receive gifts
      notifyGiftAttempt(partnerId);
    }
    setShowGiftModal(true);
  };

  const handleVideoCall = () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    startCall(partnerId, genderStr || undefined);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Partner avatar — tap to open profile */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={(e) => {
              e.stopPropagation?.();
              handlePartnerAvatarPress();
            }}
            style={styles.partnerAvatarTouchable}
          >
            {partnerImage ? (
              <Image
                source={{ uri: partnerImage }}
                style={styles.partnerAvatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.partnerAvatarPlaceholder}>
                <Text style={styles.partnerAvatarInitial}>
                  {partnerName[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            {partnerOnline && <View style={styles.partnerOnlineDot} />}
          </TouchableOpacity>

          <View style={styles.partnerNameContainer}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName}
            </Text>
            {partnerProfile?.role === "admin" && (
              <View style={[styles.roleBadge, styles.badgeOwner]}>
                <Text style={[styles.badgeText, styles.badgeTextOwner]}>OWNER</Text>
              </View>
            )}
            {partnerProfile?.role === "mod" && (
              <View style={[styles.roleBadge, styles.badgeMod]}>
                <Text style={[styles.badgeText, styles.badgeTextMod]}>MOD</Text>
              </View>
            )}
            {partnerIsVip && (
              <View style={[styles.roleBadge, styles.badgeVip]}>
                <Text style={[styles.badgeText, styles.badgeTextVip]}>VIP</Text>
              </View>
            )}
          </View>

          <View style={styles.headerActions}>
            {gifted > 0 && (
              <TouchableOpacity 
                style={styles.headerBtnGreen} 
                activeOpacity={0.8}
                onPress={() => setShowCashoutModal(true)}
              >
                <DollarSign size={18} color="#22C55E" />
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{gifted}</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.headerBtnAmber} 
              activeOpacity={0.8}
              onPress={handleGiftClick}
            >
              <Gift size={18} color="#FACC15" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtnRed}
              activeOpacity={0.8}
              onPress={() => setShowReportModal(true)}
            >
              <Flag size={18} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtnGray, isBlocked ? styles.headerBtnGrayActive : undefined]}
              activeOpacity={0.8}
              onPress={() => setShowBlockModal(true)}
            >
              <ShieldOff size={18} color={isBlocked ? "#EF4444" : "#A1A1AA"} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerBtnGreen} 
              activeOpacity={0.8}
              onPress={handleVideoCall}
            >
              <Video size={18} color="#22C55E" />
            </TouchableOpacity>
          </View>
        </View>

        <GiftModal
          isOpen={showGiftModal}
          onClose={() => setShowGiftModal(false)}
          recipientId={partnerId}
          recipientName={partnerName}
          recipientIsVip={partnerIsVip}
          onGiftSent={handleGiftSent}
        />

        <CashoutModal
          isOpen={showCashoutModal}
          onClose={() => setShowCashoutModal(false)}
        />

        {/* Report Modal */}
        <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
          <View style={styles.reportOverlay}>
            <View style={styles.reportSheet}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>Report User</Text>
                <TouchableOpacity onPress={() => setShowReportModal(false)}>
                  <X size={22} color="#A1A1AA" />
                </TouchableOpacity>
              </View>
              {reportSubmitted ? (
                <View style={styles.reportSuccess}>
                  <Text style={styles.reportSuccessText}>✅ Report submitted. Thank you!</Text>
                </View>
              ) : (
                <>
                  <View style={styles.reportGrid}>
                    {[
                      'Underage User',
                      'Inappropriate Behavior',
                      'Nudity / Sexual Content',
                      'Harassment / Bullying',
                      'Hate Speech / Discrimination',
                      'Spam / Scam',
                      'Violence / Threats',
                      'Other',
                    ].map((reason) => (
                      <TouchableOpacity
                        key={reason}
                        style={[styles.reportReasonBtn, reportReason === reason ? styles.reportReasonBtnActive : undefined]}
                        onPress={() => setReportReason(reason)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.reportReasonText, reportReason === reason ? styles.reportReasonTextActive : undefined]}>
                          {reason}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={styles.reportInput}
                    placeholder="Additional details..."
                    placeholderTextColor="#555"
                    multiline
                    maxLength={500}
                    value={reportDetails}
                    onChangeText={setReportDetails}
                  />
                  <TouchableOpacity
                    style={[styles.reportSubmitBtn, !reportReason ? styles.reportSubmitBtnDisabled : undefined]}
                    onPress={submitReport}
                    activeOpacity={0.85}
                    disabled={!reportReason || reportSubmitting}
                  >
                    {reportSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.reportSubmitBtnText}>Submit Report</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Block Modal */}
        <Modal visible={showBlockModal} transparent animationType="fade" onRequestClose={() => setShowBlockModal(false)}>
          <View style={styles.reportOverlay}>
            <View style={styles.blockSheet}>
              <ShieldOff size={36} color="#EF4444" style={{ marginBottom: 12 }} />
              <Text style={styles.blockTitle}>
                {isBlocked ? `Unblock ${partnerName}?` : `Block ${partnerName}?`}
              </Text>
              <Text style={styles.blockSubtitle}>
                {isBlocked
                  ? `${partnerName} will be able to send you messages again.`
                  : `${partnerName} won't be able to send you messages anymore. You can unblock them anytime.`}
              </Text>
              <TouchableOpacity
                style={styles.blockConfirmBtn}
                onPress={handleBlock}
                activeOpacity={0.85}
                disabled={blockLoading}
              >
                {blockLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.blockConfirmBtnText}>
                    {isBlocked ? 'Unblock' : 'Block'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.blockCancelBtn}
                onPress={() => setShowBlockModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.blockCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Info Banners */}
        {!isVip && isMale && isPartnerFemale && (
          <View style={[styles.bannerLimit, { backgroundColor: "#1E1E38", borderColor: "#EF4444", borderWidth: 1, padding: 12, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, gap: 10 }]}>
            <MessageSquare size={20} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}>
                Free Message Limit 💬
              </Text>
              <Text style={{ color: "#A1A1AA", fontSize: 12, marginTop: 2 }}>
                You have {remaining} free messages left to {partnerName}.
              </Text>
              <Text style={{ fontSize: 10, color: "rgba(239, 68, 68, 0.6)", marginTop: 4, fontStyle: 'italic' }}>
                Admin Debug: used={usedCount} male={String(isMale)} female={String(isPartnerFemale)} vip={String(isVip)}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push("/vip")}
              style={{ backgroundColor: "#EF4444", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 11 }}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bannerGift}>
          <Gift size={14} color="#D97706" />
          <Text style={styles.bannerGiftText}>
            Did you know? Users can send you cash gifts in DMs! Earned gifts can be cashed out via PayPal.
          </Text>
        </View>

        <View style={styles.bannerPrivacy}>
          <Text style={styles.bannerPrivacyText}>
            All video chats are encrypted and private — not even C24Club can see them. DM text messages are monitored. No solicitation for gifts.{" "}
            <Text style={styles.bannerPrivacyLink}>Rules</Text>
          </Text>
        </View>

        {/* Messages */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#EF4444" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if ("type" in item && item.type === "gift") {
                return <GiftBubble message={item as LocalGiftMessage} />;
              }
              const msg = item as DmMessage;
              return (
                <MessageBubble
                  message={msg}
                  isMine={msg.sender_id === user?.id}
                />
              );
            }}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={[styles.input, (isBlocked || isBlockedByPartner) && { opacity: 0.5 }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isBlockedByPartner ? "You cannot message this user" : isBlocked ? "Unblock to message" : "Type a message..."}
            placeholderTextColor="#71717A"
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!isBlocked && !isBlockedByPartner}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() || isBlocked || isBlockedByPartner) ? styles.sendBtnDisabled : null,
            ]}
            activeOpacity={0.8}
            onPress={handleSend}
            disabled={!inputText.trim() || sendMessage.isPending || isBlocked || isBlockedByPartner}
          >
            <Send size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Gift Celebration Overlay — outside KeyboardAvoidingView for full-screen coverage */}
      <GiftCelebration
        visible={showCelebration}
        recipientName={partnerName}
        onDismiss={() => setShowCelebration(false)}
      />

      {/* Member profile modal — outside KeyboardAvoidingView for full-screen coverage */}
      <MemberProfileModal
        member={selectedMember?.member ?? null}
        visible={!!selectedMember}
        isAdmin={selectedMember?.isAdmin ?? false}
        isVip={selectedMember?.isVip ?? false}
        isMod={selectedMember?.isMod ?? false}
        isInterested={false}
        isMutualInterest={false}
        pinnedSocials={selectedMember?.pinnedSocials}
        callingId={null}
        onClose={() => setSelectedMember(null)}
        onInterest={() => {}}
        onDirectCall={() => { setSelectedMember(null); }}
        onMessage={() => { setSelectedMember(null); }}
        onGift={() => { setSelectedMember(null); }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111111",
  },
  flex: {
    flex: 1,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 8,
    minHeight: 70,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  partnerAvatarContainer: {
    position: "relative",
  },
  partnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  partnerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  partnerAvatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
  },
  partnerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#111111",
  },
  partnerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 4,
  },
  partnerNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingLeft: 42,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtnGreen: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(34,197,94,0.2)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnAmber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(250,204,21,0.2)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnRed: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnGray: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(161,161,170,0.15)",
    borderWidth: 1,
    borderColor: "rgba(161,161,170,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnGrayActive: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.3)",
  },

  // ── Role Badges ────────────────────────────────────────────────────────────
  roleBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 4,
  },
  badgeOwner: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.3)",
  },
  badgeMod: {
    backgroundColor: "rgba(59,130,246,0.1)",
    borderColor: "rgba(59,130,246,0.3)",
  },
  badgeVip: {
    backgroundColor: "rgba(250,204,21,0.1)",
    borderColor: "rgba(250,204,21,0.3)",
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "900",
  },
  badgeTextOwner: {
    color: "#EF4444",
  },
  badgeTextMod: {
    color: "#3B82F6",
  },
  badgeTextVip: {
    color: "#FACC15",
  },

  headerBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: "#111111",
  },
  headerBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },
  partnerAvatarTouchable: {
    position: "relative",
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "visible",
  },

  // ── Banners ────────────────────────────────────────────────────────────────
  bannerLimit: {
    // defined inline above for visibility
  },
  bannerGift: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    margin: 12,
    marginBottom: 6,
    backgroundColor: "rgba(234,179,8,0.1)",
    borderWidth: 1,
    borderColor: "rgba(234,179,8,0.15)",
    borderRadius: 10,
    padding: 10,
  },
  bannerGiftText: {
    flex: 1,
    fontSize: 14,
    color: "rgba(250,204,21,0.8)",
    lineHeight: 20,
  },
  bannerPrivacy: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 12,
  },
  bannerPrivacyText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
  },
  bannerPrivacyLink: {
    color: "#3B82F6",
    textDecorationLine: "underline",
  },

  // ── Messages ───────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleWrapper: {
    marginVertical: 3,
  },
  bubbleWrapperRight: {
    alignItems: "flex-end",
  },
  bubbleWrapperLeft: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMine: {
    backgroundColor: "#2563EB",
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  bubbleTextMine: {
    color: "#FFFFFF",
  },
  bubbleTextTheirs: {
    color: "rgba(255,255,255,0.9)",
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 3,
  },
  bubbleTimeMine: {
    color: "rgba(191,219,254,0.6)",
    textAlign: "right",
  },
  bubbleTimeTheirs: {
    color: "rgba(255,255,255,0.25)",
  },

  // ── Gift Bubble ────────────────────────────────────────────────────────────
  giftBubbleWrapper: {
    marginVertical: 6,
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  giftBubble: {
    backgroundColor: "rgba(250,204,21,0.12)",
    borderWidth: 1.5,
    borderColor: "#FACC15",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: "75%",
  },
  giftBubbleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  giftBubbleEmoji: {
    fontSize: 20,
  },
  giftBubbleTitle: {
    color: "#FACC15",
    fontWeight: "800",
    fontSize: 15,
  },
  giftBubbleSubtext: {
    color: "#A1A1AA",
    fontSize: 12,
    marginTop: 2,
  },

  // ── Input Bar ─────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 14 : 12,
    backgroundColor: "#1A1A1A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 25,
    paddingHorizontal: 20,
    color: "#FFFFFF",
    fontSize: 16,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  reportReasonBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reportReasonBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderColor: '#EF4444',
  },
  reportReasonText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  reportReasonTextActive: {
    color: '#FFFFFF',
  },
  reportInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    minHeight: 70,
    marginBottom: 14,
  },
  reportSubmitBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reportSubmitBtnDisabled: {
    opacity: 0.4,
  },
  reportSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  reportSuccess: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  reportSuccessText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '700',
  },
  blockSheet: {
    backgroundColor: '#1E1E38',
    borderRadius: 24,
    padding: 28,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  blockTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  blockSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  blockConfirmBtn: {
    backgroundColor: '#EF4444',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    marginBottom: 10,
  },
  blockConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  blockCancelBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  blockCancelBtnText: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '600',
  },
});