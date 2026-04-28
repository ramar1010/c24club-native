import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  DollarSign,
  ExternalLink,
  Gift,
  Heart,
  Instagram,
  Link2,
  Lock,
  MessageCircle,
  MessageSquare,
  Music,
  Pencil,
  Shield,
  Shuffle,
  Sparkles,
  Trash2,
  User,
  Video,
  Wifi,
  X,
} from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useCall } from "@/contexts/CallContext";
import { supabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";
import { flattenStyle } from "@/utils/flatten-style";
import { useFreeMsgLimit, FREE_MSG_LIMIT } from "@/hooks/useFreeMsgLimit";
import SelfieCaptureModal from "@/components/SelfieCaptureModal";
import { GiftModal } from "@/components/modals/GiftModal";
import { CashoutModal } from "@/components/modals/CashoutModal";
import { FemaleVipBanner } from "@/components/FemaleVipBanner";
import { notifyGiftAttempt } from "@/lib/gift-utils";
import { GiftCelebration } from "@/components/GiftCelebration";
import { DiscoverMember } from "@/types/members";
import { Text } from "@/components/ui/text";
import { getTimeAgo, isEffectivelyOnline } from "@/utils/member-utils";
import { UserCard } from "@/components/UserCard";
import { MemberProfileModal } from "@/components/MemberProfileModal";
import { FooterLinks } from "@/components/FooterLinks";
import { LinearGradient } from "expo-linear-gradient";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;
const CARD_HEIGHT = CARD_WIDTH * (4 / 3);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isFakeOnline = (memberId: string, gender: string | null): boolean => {
  if (!gender || gender.toLowerCase() !== "female") return false;
  const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
  let hash = 0;
  const str = memberId + String(hourSeed);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100 < 35;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterestedMember {
  user_id: string;
  icebreaker_message: string | null;
  created_at: string;
  member?: {
    id: string;
    name: string;
    image_thumb_url: string | null;
  };
}

type FilterType = "All" | "Male" | "Female" | "Online Now";

// ─── Social config (platform → icon, color, url builder) ─────────────────────
const SOCIAL_CONFIG: Record<string, { label: string; color: string; icon: any; url: ((h: string) => string) | null }> = {
  instagram: { label: 'Instagram', color: '#E4405F', icon: Instagram, url: (h) => `https://instagram.com/${h}` },
  tiktok:    { label: 'TikTok',    color: '#010101', icon: Music,     url: (h) => `https://tiktok.com/@${h}` },
  snapchat:  { label: 'Snapchat',  color: '#FFFC00', icon: MessageSquare, url: (h) => `https://snapchat.com/add/${h}` },
  discord:   { label: 'Discord',   color: '#5865F2', icon: MessageSquare, url: null },
  cashapp:   { label: 'Cash App',  color: '#00D632', icon: DollarSign, url: (h) => `https://cash.app/$${h}` },
  venmo:     { label: 'Venmo',     color: '#3D95CE', icon: DollarSign, url: (h) => `https://venmo.com/${h}` },
  paypal:    { label: 'PayPal',    color: '#003087', icon: DollarSign, url: (h) => `https://paypal.me/${h}` },
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const { user, profile, minutes, loading: authLoading, refreshProfile } = useAuth();
  const { startCall, activeInvite } = useCall();
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { isVip, isLoading: limitLoading } = useFreeMsgLimit();

  // UI state
  const [filter, setFilter] = useState<FilterType>("All");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleOpacity = useRef(new Animated.Value(1)).current;
  const shuffleRotation = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const [editExpanded, setEditExpanded] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [bioText, setBioText] = useState(profile?.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);
  // ── My socials (vip_settings) ──
  const [myPinnedSocials, setMyPinnedSocials] = useState<Record<string, string>>({});
  const [savingSocials, setSavingSocials] = useState(false);
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<{id: string, name: string} | null>(null);
  const [showGiftCelebration, setShowGiftCelebration] = useState(false);
  const [socialsSheet, setSocialsSheet] = useState<{ name: string; socials: string[] } | null>(null);
  const [lastViewedInterests, setLastViewedInterests] = useState<number>(0);
  const [selectedMember, setSelectedMember] = useState<{
    member: DiscoverMember;
    isAdmin: boolean;
    isVip: boolean;
    isMod: boolean;
    isInterested: boolean;
    isMutualInterest: boolean;
    pinnedSocials?: string[];
  } | null>(null);

  // Profile status state (local overrides)
  const [isDiscoverable, setIsDiscoverable] = useState(profile?.is_discoverable ?? false);
  const [myImageUrl, setMyImageUrl] = useState(profile?.image_url ?? null);
  const [myImageStatus, setMyImageStatus] = useState<string | null>(profile?.image_status ?? null);

  const gifted = minutes?.gifted_minutes ?? 0;

  // ─── Data Fetching with React Query ─────────────────────────────────────

  const { data, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ["discover_members", user?.id],
    enabled: !!user,
    staleTime: 30000,
    queryFn: async () => {
      // Step 1: Get privileged user IDs first via RPCs
      const [adminRpc, modRpc, vipRpc] = await Promise.all([
        supabase.rpc('get_admin_user_ids'),
        supabase.rpc('get_moderator_user_ids'),
        supabase.rpc('get_vip_user_ids'),
      ]);
      console.log('[Discover] RPC admin:', adminRpc.error?.message ?? `${(adminRpc.data ?? []).length} ids`);
      console.log('[Discover] RPC mod:', modRpc.error?.message ?? `${(modRpc.data ?? []).length} ids`);
      console.log('[Discover] RPC vip:', vipRpc.error?.message ?? `${(vipRpc.data ?? []).length} ids`);

      const privilegedUserIds = Array.from(new Set([
        ...(adminRpc.data ?? []),
        ...(modRpc.data ?? []),
        ...(vipRpc.data ?? []),
      ]));

      // Step 2: Fetch regular members + privileged members in parallel
      const [membersRes, privilegedRes, myInterestsRes, interestedRes, userRolesRes] = await Promise.all([
        supabase
          .from("members")
          .select("*")
          .eq("is_discoverable", true)
          .eq("image_status", "approved")
          .order("last_active_at", { ascending: false })
          .limit(500),
        // Fetch privileged members by id regardless of is_discoverable but still must be approved
        privilegedUserIds.length > 0
          ? supabase.from("members").select("*").in("id", privilegedUserIds).eq("image_status", "approved")
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("member_interests")
          .select("interested_in_user_id")
          .eq("user_id", user!.id),
        supabase
          .from("member_interests")
          .select("user_id, icebreaker_message, created_at")
          .eq("interested_in_user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("user_roles")
          .select("user_id, role"),
      ]);

      if (membersRes.error) {
        console.error('[Discover] Members query error:', membersRes.error);
        throw membersRes.error;
      }
      if (userRolesRes.error) {
        console.warn('[Discover] user_roles query error (non-fatal):', userRolesRes.error.message);
      }

      // Merge: privileged members first, then regular — deduplicate by id
      const seenIds = new Set<string>();
      const mergedRaw: any[] = [];
      for (const m of [...(privilegedRes.data ?? []), ...(membersRes.data ?? [])]) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          mergedRaw.push(m);
        }
      }

      const raw = mergedRaw.map(m => ({
        ...m,
        image_url: m.image_url || m.avatar_url || null,
        bio: m.bio || m.about || "",
      }));

      console.log('[Discover] Fetched members (regular):', (membersRes.data ?? []).length, '+ privileged:', (privilegedRes.data ?? []).length, '= total unique:', raw.length);

      // Build role sets — members table only has `id`, no `user_id` column
      const adminIds = new Set<string>();
      const vipIds = new Set<string>();
      const modIds = new Set<string>();

      // From user_roles table (user_id here is the auth UID, same as member.id in this schema)
      (userRolesRes.data ?? []).forEach((r: any) => {
        if (r.role === 'admin') adminIds.add(r.user_id);
        if (r.role === 'moderator') modIds.add(r.user_id);
      });

      // VIP/admin/mod from member fields directly
      raw.forEach(m => {
        if (m.is_vip || m.membership === 'premium' || m.membership === 'vip' || m.vip_tier) vipIds.add(m.id);
        if (m.role === 'admin' || m.membership === 'admin') adminIds.add(m.id);
        if (m.role === 'moderator' || m.membership === 'moderator') modIds.add(m.id);
      });

      // From RPC results — these return IDs that match member.id
      (adminRpc.data ?? []).forEach((id: string) => adminIds.add(id));
      (modRpc.data ?? []).forEach((id: string) => modIds.add(id));
      (vipRpc.data ?? []).forEach((id: string) => vipIds.add(id));

      // Also try member_minutes directly (may work if RLS allows it)
      const premiumVipIds = new Set<string>();
      try {
        const { data: mmVip, error: mmErr } = await supabase
          .from('member_minutes')
          .select('user_id, is_vip, vip_tier, admin_granted_vip');
        console.log('[Discover] member_minutes VIP query:', mmErr?.message ?? `${(mmVip ?? []).length} rows`);
        (mmVip ?? []).forEach((r: any) => {
          if (r.is_vip) vipIds.add(r.user_id);
          if (r.admin_granted_vip || (r.is_vip && r.vip_tier === 'premium')) {
            premiumVipIds.add(r.user_id);
          }
        });
      } catch (_) {}

      console.log('[Discover] Final counts — admins:', adminIds.size, 'mods:', modIds.size, 'vips:', vipIds.size, 'premiumVips:', premiumVipIds.size);

      // Interests mapping
      const myInterests = new Set<string>(
        (myInterestsRes.data ?? []).map((i: any) => i.interested_in_user_id)
      );

      // Fetch socials for ALL displayed members
      const allMemberIds = raw.map((m: any) => m.id).filter(Boolean);
      let vipSettingsMap = new Map<string, string[]>();
      if (allMemberIds.length > 0) {
        const { data: socialsData } = await supabase
          .from("vip_settings")
          .select("user_id, pinned_socials")
          .in("user_id", allMemberIds);
        (socialsData ?? []).forEach((v: any) => {
          if (v.pinned_socials?.length > 0) vipSettingsMap.set(v.user_id, v.pinned_socials);
        });
      }

      // Join interested-in-me with profiles
      const membersMap = new Map();
      raw.forEach(m => membersMap.set(m.id, m));

      const missingIds = (interestedRes.data ?? [])
        .map((i: any) => i.user_id)
        .filter((id: string) => !membersMap.has(id));

      if (missingIds.length > 0) {
        const { data: missingMembers } = await supabase
          .from("members")
          .select("*")
          .in("id", missingIds);
        (missingMembers ?? []).forEach(m => membersMap.set(m.id, m));
      }

      const interestedInMe = (interestedRes.data ?? []).map((item: any) => ({
        ...item,
        member: membersMap.get(item.user_id)
      }));

      const IS_NEW_MS = 48 * 60 * 60 * 1000;

      const getPriority = (m: any) => {
        if (adminIds.has(m.id)) return 0;
        if (modIds.has(m.id)) return 1;
        if (vipIds.has(m.id)) return 2;
        if (Date.now() - new Date(m.created_at).getTime() < IS_NEW_MS) return 3;
        return 4;
      };

      // Sort: Admin(0) → Mod(1) → VIP(2) → New(3) → Regular(4)
      // Within each tier, sort by last_active_at descending
      const sorted = [...raw].sort((a, b) => {
        const pa = getPriority(a);
        const pb = getPriority(b);
        if (pa !== pb) return pa - pb;
        return (
          new Date(b.last_active_at || 0).getTime() -
          new Date(a.last_active_at || 0).getTime()
        );
      });

      return {
        members: sorted,
        adminIds,
        vipIds,
        premiumVipIds,
        modIds,
        myInterests,
        interestedInMe,
        vipSettings: vipSettingsMap
      };
    }
  });

  const loading = queryLoading || authLoading;

  // Sync profile overrides
  useEffect(() => {
    if (profile) {
      setIsDiscoverable(!!profile.is_discoverable);
      setMyImageUrl(profile.image_url);
      setBioText(profile.bio ?? "");
      setMyImageStatus(profile.image_status ?? null);
    }
  }, [profile]);

  // combined data
  const members = data?.members ?? [];
  const adminIds = data?.adminIds ?? new Set();
  const vipIds = data?.vipIds ?? new Set();
  const premiumVipIds = data?.premiumVipIds ?? new Set<string>();
  const modIds = data?.modIds ?? new Set();
  const myInterests = data?.myInterests ?? new Set();
  const interestedInMe = data?.interestedInMe ?? [];
  const vipSettings = data?.vipSettings ?? new Map();

  // Load last viewed interests timestamp
  useEffect(() => {
    storage.getItem("last_viewed_interests").then((val) => {
      if (val) setLastViewedInterests(parseInt(val, 10));
    });
  }, []);

  const unreadInterestsCount = interestedInMe.filter(
    (i) => new Date(i.created_at).getTime() > lastViewedInterests
  ).length;

  const toggleInterests = useCallback(() => {
    const nextValue = !interestsExpanded;
    setInterestsExpanded(nextValue);
    if (nextValue) {
      const now = Date.now();
      setLastViewedInterests(now);
      storage.setItem("last_viewed_interests", now.toString());
    }
  }, [interestsExpanded]);

  // Handle deep link for interests tab
  useEffect(() => {
    if (params.tab === "interests") {
      setInterestsExpanded(true);
      const now = Date.now();
      setLastViewedInterests(now);
      storage.setItem("last_viewed_interests", now.toString());
      // Small delay to ensure the list is rendered if it was collapsed
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 500);
    }
  }, [params.tab]);

  // ─── Filter logic ────────────────────────────────────────────────────────

  const filteredMembers = members.filter((m) => {
    if (filter === "Male") return m.gender?.toLowerCase() === "male";
    if (filter === "Female") return m.gender?.toLowerCase() === "female";
    if (filter === "Online Now")
      return isEffectivelyOnline(m.id, m.gender, m.last_active_at);
    return true;
  });

  // ─── Seeded Fisher-Yates shuffle ─────────────────────────────────────────

  const seededShuffle = useCallback(<T,>(arr: T[], seed: number): T[] => {
    if (seed === 0) return arr;
    const result = [...arr];
    let s = seed;
    for (let i = result.length - 1; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }, []);

  const displayedMembers = seededShuffle(filteredMembers, shuffleSeed);

  // ─── Shuffle handler ──────────────────────────────────────────────────────

  const handleShuffle = useCallback(() => {
    if (isShuffling) return;
    setIsShuffling(true);

    // Spin the icon
    shuffleRotation.setValue(0);
    Animated.timing(shuffleRotation, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Fade out → reshuffle → fade in
    Animated.timing(shuffleOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShuffleSeed(Date.now());
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      Animated.timing(shuffleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsShuffling(false));
    });
  }, [isShuffling, shuffleOpacity, shuffleRotation]);

  // ─── Interest handling ───────────────────────────────────────────────────

  const handleInterest = useCallback(
    async (memberId: string) => {
      if (!user) return;
      if (myInterests.has(memberId)) return;
      try {
        // Step 1: Insert interest row
        const { error: insertError } = await supabase.from("member_interests").insert({
          user_id: user.id,
          interested_in_user_id: memberId,
          notified: false,
        });

        if (insertError) throw insertError;

        // Step 2: Invoke notify-interest edge function
        // We don't await this to keep the UI snappy (fire and forget)
        supabase.functions.invoke("notify-interest", {
          body: {
            recipient_id: memberId,
            sender_id: user.id,
            sender_name: profile?.name || "Someone",
          },
        }).catch(err => console.warn('[Discover] notify-interest error:', err));

        queryClient.invalidateQueries({ queryKey: ["discover_members", user.id] });
        Alert.alert("Interest sent! 💚");
      } catch (err) {
        console.error("Error sending interest:", err);
        Alert.alert("Couldn't send interest, try again.");
      }
    },
    [user, profile?.name, myInterests, queryClient]
  );

  const handleDirectCall = useCallback(
    async (member: DiscoverMember) => {
      if (!user) {
        router.push("/(auth)/login");
        return;
      }

      await startCall(member.id, member.gender || undefined);
    },
    [user, startCall, router]
  );

  const handleMessage = useCallback(
    (member: DiscoverMember) => {
      console.log("[handleMessage] Opening chat for:", member.name);

      if (!user) {
        router.push("/(auth)/login");
        return;
      }

      // We handle the message limit enforcement inside the chat thread screen (app/messages/[id].tsx)
      // so that users can still view their existing conversations even if they hit the limit.
      
      router.push({
        pathname: "/messages/[id]",
        params: {
          id: "new",
          partnerId: member.id,
          partnerName: member.name,
          partnerImage: member.image_url ?? "",
          partnerGender: member.gender ?? "",
        },
      });
    },
    [user, router]
  );

  const handleGift = useCallback(
    async (member: DiscoverMember) => {
      if (!user) {
        router.push("/(auth)/login");
        return;
      }

      // Open the gift modal — server-side (gift-minutes edge function) enforces eligibility.
      // Fire a background notification to nudge non-premium recipients to upgrade (cooldown prevents spam).
      notifyGiftAttempt(member.id);
      setSelectedRecipient({ id: member.id, name: member.name });
      setShowGiftModal(true);
    },
    [user]
  );

  const trackView = useCallback(
    (memberId: string) => {
      if (!user) return;
      supabase
        .from("discover_profile_views")
        .insert({ viewer_id: user.id, viewed_member_id: memberId })
        .then(() => {});
    },
    [user]
  );

  // ─── Remove listing ──────────────────────────────────────────────────────

  const handleRemoveListing = useCallback(async () => {
    if (!user) return;
    Alert.alert(
      "⚠️ Remove Listing",
      "This will remove your profile from Discover and permanently delete your profile photo.\n\nYou can re-add yourself anytime by tapping \"Get Listed\" — but you'll need to upload a new photo.\n\nAre you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Remove Me",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase
                .from("members")
                .update({
                  is_discoverable: false,
                  image_url: null,
                  image_thumb_url: null,
                })
                .eq("id", user.id);
              setIsDiscoverable(false);
              setMyImageUrl(null);
              Alert.alert("Listing removed");
              queryClient.invalidateQueries({ queryKey: ["discover_members", user.id] });
              await refreshProfile();
            } catch (err) {
              console.error("Error removing listing:", err);
            }
          },
        },
      ]
    );
  }, [user, refreshProfile, queryClient]);

  // ─── Save bio ────────────────────────────────────────────────────────────

  const handleSaveBio = useCallback(async () => {
    if (!user) return;
    setSavingBio(true);
    try {
      await supabase
        .from("members")
        .update({ bio: bioText.trim() })
        .eq("id", user.id);
      Alert.alert("Bio saved!");
      setEditExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["discover_members", user.id] });
      await refreshProfile();
    } catch (err) {
      console.error("Error saving bio:", err);
    } finally {
      setSavingBio(false);
    }
  }, [user, bioText, queryClient, refreshProfile]);

  // ─── Load & save my socials ──────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    supabase
      .from("vip_settings")
      .select("pinned_socials")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.pinned_socials?.length) {
          const map: Record<string, string> = {};
          (data.pinned_socials as string[]).forEach((s) => {
            const idx = s.indexOf(":");
            if (idx > -1) map[s.slice(0, idx)] = s.slice(idx + 1);
          });
          setMyPinnedSocials(map);
        }
      });
  }, [user]);

  const handleSaveSocials = useCallback(async () => {
    if (!user) return;
    setSavingSocials(true);
    try {
      const pinnedSocials = Object.entries(myPinnedSocials)
        .filter(([, v]) => v.trim() !== "")
        .map(([k, v]) => `${k}:${v.trim()}`);
      await supabase
        .from("vip_settings")
        .upsert({ user_id: user.id, pinned_socials: pinnedSocials }, { onConflict: "user_id" });
      Alert.alert("Socials saved!");
    } catch (err) {
      console.error("Error saving socials:", err);
    } finally {
      setSavingSocials(false);
    }
  }, [user, myPinnedSocials]);

  // ─── Not logged in ───────────────────────────────────────────────────────

  if (!authLoading && !user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <Lock size={64} color="#71717A" />
          <Text style={styles.emptyTitle}>Sign in to Discover</Text>
          <Text style={styles.emptySubtitle}>
            Find and connect with other C24 Club members
          </Text>
          <TouchableOpacity
            style={styles.redFullButton}
            activeOpacity={0.8}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.redFullButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  const renderHeader = () => (
    <View>
      <FemaleVipBanner />
      {/* Selfie Card */}
      {isDiscoverable && (
        <View style={styles.selfieCard}>
          <View style={styles.selfieRow}>
            {/* Image */}
            {myImageUrl ? (
              <Image
                source={{ uri: myImageUrl }}
                style={styles.selfieImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.selfieImagePlaceholder}>
                <User size={28} color="#71717A" />
              </View>
            )}

            {/* Info */}
            <View style={styles.selfieInfo}>
              <Text style={styles.selfieName}>Your Discover Selfie</Text>
              {myImageStatus === "approved" && (
                <View style={styles.statusBadge}>
                  <CheckCircle size={12} color="#22C55E" />
                  <Text style={[styles.statusText, { color: "#22C55E" }]}>
                    Approved
                  </Text>
                </View>
              )}
              {myImageStatus === "denied" && (
                <View style={styles.statusBadge}>
                  <AlertCircle size={12} color="#EF4444" />
                  <Text style={[styles.statusText, { color: "#EF4444" }]}>
                    Denied
                  </Text>
                </View>
              )}
              {myImageStatus === "pending" && (
                <View style={styles.statusBadge}>
                  <Clock size={12} color="#FACC15" />
                  <Text style={[styles.statusText, { color: "#FACC15" }]}>
                    Pending
                  </Text>
                </View>
              )}
            </View>

            {/* Retake */}
            <TouchableOpacity style={styles.retakeButton} activeOpacity={0.8} onPress={() => setSelfieModalVisible(true)}>
              <Camera size={14} color="#EC4899" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit My Profile Accordion */}
      {isDiscoverable && (
        <View style={styles.accordion}>
          <TouchableOpacity
            style={styles.accordionHeader}
            activeOpacity={0.8}
            onPress={() => setEditExpanded((v) => !v)}
          >
            <Pencil size={16} color="#EC4899" />
            <Text style={styles.accordionTitle}>Edit My Profile</Text>
            <Text style={styles.accordionSub}>
              Bio · {Object.values(myPinnedSocials).filter(v => v.trim() !== "").length} socials
            </Text>
            <View style={{ flex: 1 }} />
            {editExpanded ? (
              <ChevronUp size={18} color="#71717A" />
            ) : (
              <ChevronDown size={18} color="#71717A" />
            )}
          </TouchableOpacity>
          {editExpanded && (
            <View style={styles.accordionBody}>
              <TextInput
                style={styles.bioInput}
                value={bioText}
                onChangeText={setBioText}
                placeholder="Tell people about yourself..."
                placeholderTextColor="#71717A"
                multiline
                maxLength={120}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={styles.saveButton}
                activeOpacity={0.8}
                onPress={handleSaveBio}
                disabled={savingBio}
              >
                <Text style={styles.saveButtonText}>
                  {savingBio ? "Saving..." : "Save Bio"}
                </Text>
              </TouchableOpacity>

              {/* ── Socials ── */}
              <View style={styles.socialsDivider} />
              <Text style={styles.socialsEditLabel}>My Socials</Text>
              {Object.keys(SOCIAL_CONFIG).map((platform) => {
                const cfg = SOCIAL_CONFIG[platform];
                const IconComp = cfg.icon;
                return (
                  <View key={platform} style={styles.socialEditRow}>
                    <View style={[styles.socialIconCircle, { backgroundColor: cfg.color, width: 30, height: 30, borderRadius: 15 }]}>
                      <IconComp size={14} color="#FFFFFF" />
                    </View>
                    <Text style={styles.socialsEditPlatform}>{cfg.label}</Text>
                    <TextInput
                      style={styles.socialEditInput}
                      value={myPinnedSocials[platform] ?? ""}
                      onChangeText={(val) =>
                        setMyPinnedSocials((prev) => ({ ...prev, [platform]: val }))
                      }
                      placeholder={`username`}
                      placeholderTextColor="#52525B"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                );
              })}
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: "#EC4899" }]}
                activeOpacity={0.8}
                onPress={handleSaveSocials}
                disabled={savingSocials}
              >
                <Text style={styles.saveButtonText}>
                  {savingSocials ? "Saving..." : "Save Socials"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Interested in You */}
      <View style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          activeOpacity={0.8}
          onPress={toggleInterests}
        >
          <Heart size={16} color="#EC4899" fill="#EC4899" />
          <Text style={styles.accordionTitle}>Interested in You</Text>
          {unreadInterestsCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{unreadInterestsCount}</Text>
            </View>
          )}
          <Text style={styles.accordionSub}>{interestedInMe.length} total</Text>
          <View style={{ flex: 1 }} />
          {interestsExpanded ? (
            <ChevronUp size={18} color="#71717A" />
          ) : (
            <ChevronDown size={18} color="#71717A" />
          )}
        </TouchableOpacity>
        {interestsExpanded && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.interestedScroll}
            contentContainerStyle={styles.interestedScrollContent}
          >
            {interestedInMe.length === 0 ? (
              <Text style={styles.noInterestsText}>No interests yet</Text>
            ) : (
              interestedInMe.map((item) => (
                <View key={item.user_id} style={styles.interestedCard}>
                  {item.member?.image_thumb_url ? (
                    <Image
                      source={{ uri: item.member.image_thumb_url }}
                      style={styles.interestedAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.interestedAvatarPlaceholder}>
                      <Text style={styles.interestedInitial}>
                        {item.member?.name?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                  )}
                  
                  {/* Action buttons overlay for interested people */}
                  <View style={styles.interestedActions}>
                    {myInterests.has(item.user_id) ? (
                      <>
                        <TouchableOpacity 
                          style={styles.interestedActionBtn}
                          onPress={() => handleDirectCall(item.member as any)}
                        >
                          <Video size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.interestedActionBtn, { backgroundColor: '#3B82F6' }]}
                          onPress={() => handleMessage(item.member as any)}
                        >
                          <MessageCircle size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.interestedActionBtn, { backgroundColor: '#EC4899', width: '80%', height: 24, borderRadius: 12 }]}
                        onPress={() => handleInterest(item.user_id)}
                      >
                        <Heart size={12} color="#FFFFFF" fill="#FFFFFF" />
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700', marginLeft: 4 }}>Like Back</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={styles.interestedName} numberOfLines={1}>
                      {item.member?.name ?? "Member"}
                    </Text>
                    {myInterests.has(item.user_id) && (
                      <Heart size={10} color="#EC4899" fill="#EC4899" />
                    )}
                  </View>
                  {item.icebreaker_message ? (
                    <Text style={styles.interestedMsg} numberOfLines={1}>
                      {item.icebreaker_message}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {(["All", "Male", "Female", "Online Now"] as FilterType[]).map(
          (pill) => (
            <TouchableOpacity
              key={pill}
              style={flattenStyle([
                styles.filterPill,
filter === pill ? styles.filterPillActive : null,
              ])}
              activeOpacity={0.8}
              onPress={() => setFilter(pill)}
            >
              {pill === "Online Now" && (
                <Wifi
                  size={12}
                  color={filter === pill ? "#FFFFFF" : "#71717A"}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={flattenStyle([
                  styles.filterPillText,
filter === pill ? styles.filterPillTextActive : null,
                ])}
              >
                {pill}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* ── Sticky Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
            activeOpacity={0.8}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Discover People</Text>
            <Text style={styles.headerSubtitle}>
              Find people who want to video chat
            </Text>
          </View>
        </View>

        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.giftedButton} 
            activeOpacity={0.8}
            onPress={() => setShowCashoutModal(true)}
          >
            <DollarSign size={16} color="#10B981" />
            {gifted > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{gifted}</Text>
              </View>
            )}
            <Text style={styles.giftedButtonText}>Cash Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dmsButton} activeOpacity={0.8} onPress={() => router.push("/(tabs)/messages")}>
            <MessageSquare size={14} color="#3B82F6" />
            <Text style={styles.dmsButtonText}>DMs</Text>
          </TouchableOpacity>
          {isDiscoverable ? (
            <TouchableOpacity
              style={styles.removeButton}
              activeOpacity={0.8}
              onPress={handleRemoveListing}
            >
              <Trash2 size={14} color="#EF4444" />
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.getListedButton}
              activeOpacity={0.8}
              onPress={() => setSelfieModalVisible(true)}
            >
              <Text style={styles.getListedText}>Get Listed</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── FlatList with header sections ── */}
      <Animated.View style={{ flex: 1, opacity: shuffleOpacity }}>
      <FlatList
        ref={flatListRef}
        data={displayedMembers}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <UserCard
            member={item}
            isAdmin={adminIds.has(item.id)}
            isVip={vipIds.has(item.id)}
            isMod={modIds.has(item.id)}
            isSelf={item.id === user?.id}
            isNew={Date.now() - new Date(item.created_at).getTime() < 48 * 60 * 60 * 1000}
            isInterested={myInterests.has(item.id)}
            isMutualInterest={myInterests.has(item.id) && interestedInMe.some(i => i.user_id === item.id)}
            pinnedSocials={vipSettings.get(item.id)}
            callingId={activeInvite?.invitee_id === item.id ? item.id : null}
            onInterest={() => handleInterest(item.id)}
            onDirectCall={handleDirectCall}
            onMessage={handleMessage}
            onGift={handleGift}
            onSocials={() => {
              const socials = vipSettings.get(item.id);
              if (socials && socials.length > 0) {
                setSocialsSheet({ name: item.name, socials });
              }
            }}
            onView={() => trackView(item.id)}
            onPress={() => setSelectedMember({
              member: item,
              isAdmin: adminIds.has(item.id),
              isVip: vipIds.has(item.id),
              isMod: modIds.has(item.id),
              isInterested: myInterests.has(item.id),
              isMutualInterest: myInterests.has(item.id) && interestedInMe.some(i => i.user_id === item.id),
              pinnedSocials: vipSettings.get(item.id),
            })}
            cardWidth={CARD_WIDTH}
            cardHeight={CARD_HEIGHT}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>No members found</Text>
          </View>
        }
        ListFooterComponent={<FooterLinks />}
      />
      </Animated.View>

      {/* ── Floating Shuffle Button ── */}
      <TouchableOpacity
        style={styles.shuffleBtn}
        onPress={handleShuffle}
        activeOpacity={0.85}
        disabled={isShuffling}
      >
        <LinearGradient
          colors={["#EC4899", "#8B5CF6", "#6366F1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shuffleBtnGradient}
        >
          <Animated.View style={{
            transform: [{
              rotate: shuffleRotation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              })
            }],
            marginRight: 6,
          }}>
            <Shuffle size={18} color="#fff" />
          </Animated.View>
          <Text style={styles.shuffleBtnText}>Shuffle</Text>
        </LinearGradient>
      </TouchableOpacity>

      <SelfieCaptureModal
        visible={selfieModalVisible}
        onClose={() => setSelfieModalVisible(false)}
        onSuccess={() => {
          refetch();
          refreshProfile();
        }}
      />

      <GiftModal
        isOpen={showGiftModal}
        onClose={() => { setShowGiftModal(false); }}
        recipientId={selectedRecipient?.id || ""}
        recipientName={selectedRecipient?.name || ""}
        recipientIsVip={
          selectedRecipient
            ? vipIds.has(selectedRecipient.id) || adminIds.has(selectedRecipient.id)
            : true
        }
        onGiftSent={() => {
          setShowGiftModal(false);
          setShowGiftCelebration(true);
        }}
      />

      <CashoutModal
        isOpen={showCashoutModal}
        onClose={() => setShowCashoutModal(false)}
      />

      <GiftCelebration
        visible={showGiftCelebration}
        recipientName={selectedRecipient?.name || "them"}
        onDismiss={() => setShowGiftCelebration(false)}
      />

      {/* ── Member Profile Modal ── */}
      <MemberProfileModal
        member={selectedMember?.member ?? null}
        visible={!!selectedMember}
        isAdmin={selectedMember?.isAdmin ?? false}
        isVip={selectedMember?.isVip ?? false}
        isMod={selectedMember?.isMod ?? false}
        isInterested={selectedMember?.isInterested ?? false}
        isMutualInterest={selectedMember?.isMutualInterest ?? false}
        pinnedSocials={selectedMember?.pinnedSocials}
        callingId={activeInvite?.invitee_id === selectedMember?.member?.id ? selectedMember?.member?.id : null}
        onClose={() => setSelectedMember(null)}
        onInterest={() => {
          if (selectedMember) handleInterest(selectedMember.member.id);
        }}
        onDirectCall={(member) => { handleDirectCall(member); setSelectedMember(null); }}
        onMessage={(member) => { handleMessage(member); setSelectedMember(null); }}
        onGift={(member) => { handleGift(member); setSelectedMember(null); }}
      />

      {/* ── Socials Bottom Sheet ── */}
      <Modal
        visible={!!socialsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setSocialsSheet(null)}
      >
        <TouchableOpacity
          style={styles.socialsOverlay}
          activeOpacity={1}
          onPress={() => setSocialsSheet(null)}
        >
          <View style={styles.socialsSheet}>
            <View style={styles.socialsHandle} />
            <View style={styles.socialsHeaderRow}>
              <Text style={styles.socialsTitle}>{socialsSheet?.name}'s Socials</Text>
              <TouchableOpacity onPress={() => setSocialsSheet(null)}>
                <X size={20} color="#A1A1AA" />
              </TouchableOpacity>
            </View>
            {(socialsSheet?.socials ?? []).map((s, i) => {
              const [platform, handle] = s.split(':');
              if (!platform || !handle) return null;
              const cfg = SOCIAL_CONFIG[platform.toLowerCase()];
              if (!cfg) return null;
              const Icon = cfg.icon;
              const isSnapchat = platform.toLowerCase() === 'snapchat';
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.socialRow, { backgroundColor: cfg.color + '22' }]}
                  activeOpacity={cfg.url ? 0.7 : 1}
                  onPress={() => {
                    if (cfg.url) Linking.openURL(cfg.url(handle)).catch(() => {});
                  }}
                >
                  <View style={[styles.socialIconCircle, { backgroundColor: cfg.color }]}>
                    <Icon size={20} color={isSnapchat ? '#000' : '#FFF'} />
                  </View>
                  <View style={styles.socialTextCol}>
                    <Text style={styles.socialPlatformLabel}>{cfg.label}</Text>
                    <Text style={styles.socialHandle}>@{handle}</Text>
                  </View>
                  {cfg.url && <ExternalLink size={14} color="#A1A1AA" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111111",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#A1A1AA",
    textAlign: "center",
  },
  redFullButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
  },
  redFullButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "column",
    backgroundColor: "rgba(17,17,17,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E38",
    gap: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#71717A",
    marginTop: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  giftedButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    gap: 4,
    position: "relative",
  },
  giftedButtonText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
  },
  badgeCount: {
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
    borderColor: "#1A1A2E",
  },
  badgeCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  dmsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dmsButtonText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "600",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
  },
  getListedButton: {
    backgroundColor: "#EC4899",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  getListedText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Selfie Card ───────────────────────────────────────────────────────────
  selfieCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#1E1E38",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    padding: 12,
  },
  selfieRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selfieImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  selfieImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#2A2A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  selfieInfo: {
    flex: 1,
    gap: 6,
  },
  selfieName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#EC4899",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retakeText: {
    color: "#EC4899",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Accordion ─────────────────────────────────────────────────────────────
  accordion: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#1E1E38",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A4A",
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  accordionSub: {
    fontSize: 12,
    color: "#71717A",
  },
  countBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  bioInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    includeFontPadding: false,
  },
  saveButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  socialsDivider: {
    height: 1,
    backgroundColor: "#2A2A4A",
    marginVertical: 12,
  },
  socialsEditLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  socialEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
  },
  socialEditInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 8,
    color: "#FFFFFF",
    fontSize: 14,
    includeFontPadding: false,
  },
  socialHandleLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  socialsEditPlatform: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  socialInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#FFFFFF",
    fontSize: 13,
    includeFontPadding: false,
  },

  // ── Interested in You ─────────────────────────────────────────────────────
  interestedScroll: {
    paddingBottom: 14,
  },
  interestedScrollContent: {
    paddingHorizontal: 14,
    gap: 10,
  },
  interestedCard: {
    width: 60,
    alignItems: "center",
    gap: 4,
  },
  interestedAvatar: {
    width: 60,
    height: 80,
    borderRadius: 12,
  },
  interestedActions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 20, // Leave space for name
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  interestedActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestedAvatarPlaceholder: {
    width: 60,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#2A2A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  interestedInitial: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  interestedName: {
    fontSize: 11,
    color: "#A1A1AA",
    textAlign: "center",
  },
  interestedMsg: {
    fontSize: 10,
    color: "#71717A",
    textAlign: "center",
  },
  noInterestsText: {
    color: "#71717A",
    fontSize: 13,
    paddingVertical: 8,
  },

  // ── Filter Pills ──────────────────────────────────────────────────────────
  filterScroll: {
    marginBottom: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E38",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: "#EF4444",
  },
  filterPillText: {
    color: "#71717A",
    fontSize: 13,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },

  // ── Grid ──────────────────────────────────────────────────────────────────
  gridContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  emptyGrid: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyGridText: {
    color: "#71717A",
    fontSize: 14,
  },

  // ── Socials Sheet ─────────────────────────────────────────────────────────
  socialsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  socialsSheet: {
    backgroundColor: "#1A1A2E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "80%",
  },
  socialsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3A3A5A",
    alignSelf: "center",
    marginBottom: 16,
  },
  socialsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  socialsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
  },
  socialIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  socialTextCol: {
    flex: 1,
  },
  socialPlatformLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  socialHandle: {
    fontSize: 10,
    color: "#71717A",
    marginTop: 2,
  },

  // ── Shuffle Button ─────────────────────────────────────────────────────────
  shuffleBtn: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -60 }],
    borderRadius: 100,
  },
  shuffleBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 100,
  },
  shuffleBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});