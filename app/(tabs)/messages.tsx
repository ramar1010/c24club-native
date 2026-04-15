import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, DollarSign, MessageCircle, RefreshCw, Search } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, type Conversation } from "@/hooks/useMessages";
import { useQueryClient } from "@tanstack/react-query";
import { CashoutModal } from "@/components/modals/CashoutModal";
import { FemaleVipBanner } from "@/components/FemaleVipBanner";
import { MemberProfileModal } from "@/components/MemberProfileModal";
import { supabase } from "@/lib/supabase";
import { DiscoverMember } from "@/types/members";
import { FooterLinks } from "@/components/FooterLinks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTimeAgo = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const isOnline = (lastActive: string | null | undefined): boolean => {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
};

// ─── Conversation Row ─────────────────────────────────────────────────────────

interface ConversationRowProps {
  item: Conversation;
  onPress: () => void;
  onAvatarPress: () => void;
}

const ConversationRow = React.memo(function ConversationRow({
  item,
  onPress,
  onAvatarPress,
}: ConversationRowProps) {
  const online = isOnline(item.other_user?.last_active_at);
  const initial = item.other_user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <View style={styles.row}>
      {/* Avatar — separate touchable, opens profile modal */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={(e) => {
          e.stopPropagation?.();
          onAvatarPress();
        }}
        style={styles.avatarTouchable}
      >
        {item.other_user?.image_url ? (
          <Image
            source={{ uri: item.other_user.image_url }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        {online && <View style={styles.onlineDot} />}
      </TouchableOpacity>

      {/* Info — separate touchable, opens conversation */}
      <TouchableOpacity
        style={styles.rowInfo}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={styles.rowTopRow}>
          <View style={styles.rowNameContainer}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.other_user?.name ?? "Unknown"}
            </Text>
            {item.other_user?.role === "admin" && (
              <View style={[styles.roleBadge, styles.badgeOwner]}>
                <Text style={[styles.badgeText, styles.badgeTextOwner]}>OWNER</Text>
              </View>
            )}
            {item.other_user?.role === "mod" && (
              <View style={[styles.roleBadge, styles.badgeMod]}>
                <Text style={[styles.badgeText, styles.badgeTextMod]}>MOD</Text>
              </View>
            )}
            {item.other_user?.is_vip && (
              <View style={[styles.roleBadge, styles.badgeVip]}>
                <Text style={[styles.badgeText, styles.badgeTextVip]}>VIP</Text>
              </View>
            )}
          </View>
          <Text style={styles.rowTime}>
            {getTimeAgo(item.last_message_at)}
          </Text>
        </View>
        <View style={styles.rowBottomRow}>
          <Text style={styles.rowPreview} numberOfLines={1}>
            {item.last_message ?? "No messages yet"}
          </Text>
          {(item.unread_count ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const router = useRouter();
  const { user, profile, session, minutes, debugLogs } = useAuth();
  const { data: conversations, isLoading, refetch, errorText } = useConversations();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const [isRefetching, setIsRefetching] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showCashoutModal, setShowCashoutModal] = useState(false);

  // ─── Profile modal state ──────────────────────────────────────────────────
  const [selectedMember, setSelectedMember] = useState<{
    member: DiscoverMember;
    isVip: boolean;
    isAdmin: boolean;
    isMod: boolean;
    pinnedSocials?: string[];
  } | null>(null);

  const handleAvatarPress = async (otherUser: Conversation["other_user"]) => {
    if (!otherUser?.id) return;

    // Open immediately with available data
    setSelectedMember({
      member: {
        id: otherUser.id,
        name: otherUser.name,
        bio: null,
        gender: otherUser.gender,
        image_url: otherUser.image_url,
        image_thumb_url: null,
        image_status: null,
        is_discoverable: true,
        last_active_at: otherUser.last_active_at,
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
          .eq("id", otherUser.id)
          .single(),
        supabase
          .from("vip_settings")
          .select("pinned_socials")
          .eq("user_id", otherUser.id)
          .maybeSingle(),
        supabase
          .from("member_minutes")
          .select("is_vip, admin_granted_vip")
          .eq("user_id", otherUser.id)
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

  const addDebugLog = (msg: string) => {
    setDebugLog(prev => [new Date().toLocaleTimeString() + ": " + msg, ...prev].slice(0, 10));
  };

  const handleRefresh = async () => {
    setIsRefetching(true);
    addDebugLog("Starting refresh...");
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    const { data } = await refetch();
    addDebugLog("Refresh done. Count: " + (data?.length ?? 0));
    setIsRefetching(false);
  };

  const gifted = minutes?.gifted_minutes ?? 0;

  const filtered = useMemo(() => {
    if (!conversations) return [];
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      c.other_user?.name?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity 
          style={{ padding: 8 }} 
          onPress={handleRefresh}
          disabled={isLoading || isRefetching}
        >
          <RefreshCw size={20} color="#FFFFFF" style={{ opacity: isRefetching ? 0.5 : 1 }} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.cashOutBtn} 
          activeOpacity={0.8}
          onPress={() => setShowCashoutModal(true)}
        >
          <DollarSign size={14} color="#22C55E" />
          <Text style={styles.cashOutText}>Cash Out</Text>
          {gifted > 0 && (
            <View style={styles.msgBadge}>
              <Text style={styles.msgBadgeText}>{gifted}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <CashoutModal
        isOpen={showCashoutModal}
        onClose={() => setShowCashoutModal(false)}
      />

      {/* Member profile modal */}
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

      {errorText && (
        <View style={{ backgroundColor: '#EF4444', padding: 12 }}>
          <Text style={{ color: 'white', fontSize: 12 }}>Error: {errorText}</Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={16} color="#71717A" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations..."
          placeholderTextColor="#71717A"
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      ) : (
        <>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={<FemaleVipBanner />}
            renderItem={({ item }) => (
              <ConversationRow
                item={item}
                onAvatarPress={() => handleAvatarPress(item.other_user)}
                onPress={() =>
                  router.push({
                    pathname: "/messages/[id]",
                    params: {
                      id: item.id,
                      partnerId: item.other_user?.id ?? "",
                      partnerName: item.other_user?.name ?? "",
                      partnerImage: item.other_user?.image_url ?? "",
                      partnerGender: item.other_user?.gender ?? "",
                    },
                  })
                }
              />
            )}
            ListEmptyComponent={
              <View style={styles.centered}>
                <MessageCircle size={48} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  Message someone from Discover to start chatting
                </Text>
              </View>
            }
            ListFooterComponent={filtered.length > 0 ? <FooterLinks /> : null}
            contentContainerStyle={
              filtered.length === 0 ? styles.emptyContent : undefined
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111111",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    rowGap: 12, columnGap: 12,
    paddingHorizontal: 32,
  },
  emptyContent: {
    flex: 1,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    rowGap: 8, columnGap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cashOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    rowGap: 4, columnGap: 4,
    backgroundColor: "rgba(34,197,94,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    position: "relative",
  },
  cashOutText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "700",
  },
  msgBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#111111",
  },
  msgBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    rowGap: 8, columnGap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    height: 44,
  },

  // ── Conversation Row ───────────────────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    rowGap: 16, columnGap: 16,
  },
  avatarTouchable: {
    position: "relative",
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: "visible",
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
    borderColor: "#111111",
  },
  rowInfo: {
    flex: 1,
  },
  rowTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rowNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 8,
  },
  rowName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  rowTime: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
  },
  rowBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowPreview: {
    flex: 1,
    fontSize: 16,
    color: "#A1A1AA",
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Role Badges ────────────────────────────────────────────────────────────
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
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
    fontSize: 10,
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

  // ── Empty ──────────────────────────────────────────────────────────────────
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#A1A1AA",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#71717A",
    textAlign: "center",
  },
});