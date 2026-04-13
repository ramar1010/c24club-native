import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, X, User as UserIcon, Sparkles, Video, MessageCircle, Gift, Link2, ExternalLink, Star, BookOpen, ChevronDown, ChevronUp } from "lucide-react-native";
import { flattenStyle } from "@/utils/flatten-style";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { FemaleVipBanner } from "@/components/FemaleVipBanner";
import { FemaleNotifyCard } from "@/components/FemaleNotifyCard";
import { supabase } from "@/lib/supabase";
import { DiscoverMember } from "@/types/members";
import { UserCard } from "@/components/UserCard";
import { GiftModal } from "@/components/modals/GiftModal";
import { useCall } from "@/contexts/CallContext";
import { Instagram, Music, DollarSign } from "lucide-react-native";
import { Alert, Linking } from "react-native";
import { notifyGiftAttempt } from "@/lib/gift-utils";
import { GiftCelebration } from "@/components/GiftCelebration";
import { FooterLinks } from "@/components/FooterLinks";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Use same card size as discover
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2.2; // Slightly smaller for horizontal scroll feel
const CARD_HEIGHT = CARD_WIDTH * (4 / 3);

const GIFT_IMG = require("@/assets/images/image 1347.png");
const BAGS_IMG = require("@/assets/images/adsdad.png");
const CHAT_IMG = require("@/assets/images/Group 140111195.png");
const EARN_IMG = require("@/assets/images/Icon.png");

const STEPS = [
  {
    image: CHAT_IMG,
    title: "Chat",
    desc: "Video chat 1-on-1 with strangers. Earn minutes per chat!",
  },
  {
    emoji: "⏩",
    title: "Quick Skips",
    desc: "Don't like the vibe? Skip instantly and find someone new, but skip too fast and you'll lose minutes!",
  },
  {
    image: EARN_IMG,
    title: "Earn",
    desc: "Every minute chatting earns you reward minutes to spend in the store.",
  },
  {
    image: BAGS_IMG,
    title: "Free shop",
    desc: "Redeem your minutes for real prizes: clothes, gift cards, cash & more!",
  },
  {
    image: GIFT_IMG,
    title: "Gift",
    desc: "Other users can gift you reward minutes — the more you chat, the more you attract gifts!",
  },
];

const COMPARISON = [
  { feature: "Earn 100+ rewards", c24: true, others: false },
  { feature: "Gifted by strangers", c24: true, others: false },
  { feature: "Safe & moderated", c24: true, others: false },
  { feature: "1-on-1 video", c24: true, others: true },
  { feature: "Free to use", c24: true, others: true },
];

const SOCIAL_CONFIG: Record<string, { icon: any; color: string; label: string; url?: (handle: string) => string }> = {
  instagram: {
    icon: Instagram,
    color: "#E1306C",
    label: "Instagram",
    url: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  },
  tiktok: {
    icon: Music,
    color: "#000000",
    label: "TikTok",
    url: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  },
  snapchat: {
    icon: Sparkles,
    color: "#FFFC00",
    label: "Snapchat",
    // Snapchat doesn't have a reliable web URL for users always
  },
  cashapp: {
    icon: DollarSign,
    color: "#00D632",
    label: "CashApp",
    url: (h) => `https://cash.app/$${h.replace(/^\$/, "")}`,
  },
  venmo: {
    icon: DollarSign,
    color: "#3D95CE",
    label: "Venmo",
    url: (h) => `https://venmo.com/${h.replace(/^@/, "")}`,
  },
  paypal: {
    icon: Link2,
    color: "#003087",
    label: "PayPal",
    url: (h) => `https://paypal.me/${h}`,
  },
};

// ─── Guide data ────────────────────────────────────────────────────────────────
const GUIDE_SECTIONS = [
  {
    title: "🎥  Video Chatting & Collecting Minutes",
    items: [
      { q: "How do I collect minutes?", a: 'Tap the Chat tab and press "Start Chatting". You earn minutes for every video chat you complete. The longer you stay in a chat, the more you earn. Minutes are credited automatically during video sessions.' },
      { q: "What are minutes used for?", a: "Minutes are your in-app currency. Use them to redeem items from the Reward Store, spin for rare or legendary prizes, or gift them to other members." },
      { q: "What happens if I skip too fast?", a: "Skipping a chat too quickly (under a few seconds) will deduct minutes as a penalty. Stay in chats a bit longer to keep earning!" },
      { q: "Is there a collection cap?", a: "Yes. To keep things fair and reward participation, there are session limits: \n\n• Video Mode: 10 mins per session (Free users) / 30 mins per session (VIP members).\n• Voice Mode: 5 mins per session (Female users).\n• Frozen Minutes: 2 mins per session.\n\nOnce you hit a limit, earning pauses for that match. Start a new match to continue earning!" },
    ],
  },
  {
    title: "🎁  Reward Store & Redeeming",
    items: [
      { q: "How do I redeem rewards?", a: 'Go to the Rewards tab. Browse available items and tap "Redeem" on any item you can afford. For physical items, you\'ll be asked to enter a shipping address.' },
      { q: "What types of rewards are available?", a: "Rewards include physical fashion items (clothing, accessories, bags), cash and digital items. Browse by category using the filter tabs at the top of the Rewards screen." },
      { q: "What are reward rarities?", a: "Items come in three rarities — Common, Rare, and Legendary. Common items can be redeemed directly. Rare and Legendary items require a Spin to Win." },
      { q: "How does shipping work?", a: "After winning or redeeming a physical item, you'll fill in your shipping details. You can save a default address in your profile for faster checkout next time." },
    ],
  },
  {
    title: "🎰  Spin to Win",
    items: [
      { q: "Are there different types of Spin to Win?", a: "Yes — Rare spins cost fewer minutes and chance of winning is based off your Chance Enhancer %. Legendary spins cost more and chance of winning is also based off your Chance Enhancer % — these items are higher in value." },
      { q: "What is the Chance Enhancer?", a: "The Chance Enhancer (CE) increases your win percentage on every spin. It builds up automatically as you chat. You can see your current CE % on the spin modal or in your profile page." },
    ],
  },
  {
    title: "⭐  VIP Membership",
    items: [
      { q: "What are the VIP tiers?", a: "There are two VIP tiers — Basic VIP and Premium VIP. Both give access to gender filters, higher minute caps, and exclusive features. Premium VIP also includes a free re-spin on Legendary items & much more!" },
      { q: "What are gender filters?", a: "VIP members can filter who they match with in random video chats — choose Male, Female, or Both. Free users are matched randomly." },
      { q: "What is Minute Unfreezing?", a: "If your minute collection is frozen due to skipping too fast, VIP members can unfreeze their balance instantly instead of having a slow earn rate." },
    ],
  },
  {
    title: "📢  Ad Points & Promos",
    items: [
      { q: "Ad Points & Promos", a: "Coming soon! Stay tuned for updates on Ad Points and Promos." },
    ],
  },
  {
    title: "🎯  Weekly Challenges",
    items: [
      { q: "Weekly Challenges", a: "Coming soon! Weekly Challenges are on their way." },
    ],
  },
  {
    title: "💝  Gifting Minutes",
    items: [
      { q: "How do I gift minutes?", a: "On the Home or Discover tab, tap a member's profile card and select the gift icon. Choose how many minutes to send. The recipient gets notified instantly. You can also gift in DMs, messages & Video Calls." },
      { q: "Can I see gifts I've received?", a: "Yes — your Profile tab shows your gift history and total minutes received from other members." },
    ],
  },
  {
    title: "📌  Topics & Socials",
    items: [
      { q: "What are pinned topics?", a: "You can pin interest topics to your profile. When you match with someone in a chat, your shared topics are shown so you always have something to talk about." },
      { q: "How do I pin my socials?", a: "VIP members can pin their social media handles (Instagram, TikTok, Snapchat, CashApp, etc.) to their profile. These appear as tappable badges during video chats so your match can follow you." },
    ],
  },
  {
    title: "⚠️  Safety & Rules",
    items: [
      { q: "What gets you banned?", a: "Nudity, sexual content, harassment, racism, underage users, and ban evasion all result in an immediate ban. Bans are enforced by our moderation team." },
      { q: "How do I report someone?", a: "During any video chat, tap the flag/report button on screen. Fill in the reason and submit. Our team reviews all reports promptly." },
    ],
  },
];
// ───────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, profile, loading, minutes } = useAuth();
  const router = useRouter();
  const { startCall, activeInvite } = useCall();
  const [warningDismissed, setWarningDismissed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // How To Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  // VIP Spotlight state
  const [vipMembers, setVipMembers] = useState<DiscoverMember[]>([]);
  const [vipLoading, setVipLoading] = useState(true);
  const [vipIds, setVipIds] = useState<Set<string>>(new Set());
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [modIds, setModIds] = useState<Set<string>>(new Set());
  const [vipSettings, setVipSettings] = useState<Map<string, string[]>>(new Map());

  // Gift & Socials state
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<DiscoverMember | null>(null);
  const [showGiftCelebration, setShowGiftCelebration] = useState(false);
  const [socialsSheet, setSocialsSheet] = useState<{ name: string; socials: string[] } | null>(null);

  const fetchVipSpotlight = useCallback(async () => {
    setVipLoading(true);
    try {
      // Use the same RPCs as discover.tsx — these bypass RLS and return ALL VIP/admin/mod IDs
      const [adminRpc, modRpc, vipRpc] = await Promise.all([
        supabase.rpc('get_admin_user_ids'),
        supabase.rpc('get_moderator_user_ids'),
        supabase.rpc('get_vip_user_ids'),
      ]);

      const privilegedUserIds = Array.from(new Set([
        ...(adminRpc.data ?? []),
        ...(modRpc.data ?? []),
        ...(vipRpc.data ?? []),
      ]));

      // Also include members with non-Free membership as a fallback
      const { data: membershipMembers } = await supabase
        .from("members")
        .select("id")
        .not("membership", "eq", "Free")
        .not("membership", "is", null);

      const allVipIds = Array.from(new Set([
        ...privilegedUserIds,
        ...(membershipMembers?.map((m) => m.id) ?? []),
      ]));

      if (allVipIds.length === 0) {
        setVipMembers([]);
        setVipLoading(false);
        return;
      }

      // Fetch all VIP members — no is_discoverable or image_status filter
      // so offline VIPs still appear in the spotlight
      const { data: members, error } = await supabase
        .from("members")
        .select("*")
        .in("id", allVipIds)
        .limit(50);

      if (error) throw error;

      if (members && members.length > 0) {
        const shuffled = [...members].sort(() => Math.random() - 0.5);
        setVipMembers(shuffled as DiscoverMember[]);

        // Build role sets
        const vips = new Set<string>();
        const admins = new Set<string>();
        const mods = new Set<string>();

        (vipRpc.data ?? []).forEach((id: string) => vips.add(id));
        (adminRpc.data ?? []).forEach((id: string) => admins.add(id));
        (modRpc.data ?? []).forEach((id: string) => mods.add(id));
        members.forEach((m) => {
          const role = (m.membership ?? "").toLowerCase();
          if (role.includes("vip") || role.includes("premium")) vips.add(m.id);
          if (role === "admin") admins.add(m.id);
          if (role === "moderator" || role === "mod") mods.add(m.id);
        });
        setVipIds(vips);
        setAdminIds(admins);
        setModIds(mods);

        // Fetch pinned socials
        const { data: settings } = await supabase
          .from("vip_settings")
          .select("user_id, pinned_socials")
          .in("user_id", members.map((m) => m.id));

        const settingsMap = new Map<string, string[]>();
        settings?.forEach((s: any) => {
          if (s.pinned_socials?.length) settingsMap.set(s.user_id, s.pinned_socials);
        });
        setVipSettings(settingsMap);
      } else {
        setVipMembers([]);
      }
    } catch (err) {
      console.error("[HomeScreen] Error fetching VIP spotlight:", err);
    } finally {
      setVipLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVipSpotlight();
  }, [fetchVipSpotlight]);

  const handleDirectCall = async (member: DiscoverMember) => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    try {
      await startCall(member.id);
      router.push("/video-call");
    } catch (err: any) {
      Alert.alert("Call failed", err.message || "Something went wrong");
    }
  };

  const handleMessage = (member: DiscoverMember) => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
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
  };

  const handleGift = async (member: DiscoverMember) => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }

    // Open the gift modal — server-side enforces eligibility.
    // Fire a background notification to nudge non-premium recipients (cooldown prevents spam).
    notifyGiftAttempt(member.id);
    setSelectedRecipient(member);
    setShowGiftModal(true);
  };

  const handleOpenSocial = (platform: string, handle: string) => {
    const cfg = SOCIAL_CONFIG[platform.toLowerCase()];
    if (cfg?.url) {
      Linking.openURL(cfg.url(handle)).catch(() => {
        Alert.alert("Error", "Could not open social link");
      });
    }
  };

  // Auto-scrolling effect for "How It Works"
  useEffect(() => {
    const interval = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= STEPS.length) {
        nextIndex = 0;
      }
      
      setCurrentIndex(nextIndex);
      
      // Card width is 200, gap is 12
      scrollRef.current?.scrollTo({
        x: nextIndex * (200 + 12),
        animated: true,
      });
    }, 3500); // Scroll every 3.5 seconds

    return () => clearInterval(interval);
  }, [currentIndex]);

  const handleCTA = () => {
    if (user) {
      router.push("/(tabs)/chat");
    } else {
      router.push("/(auth)/login");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Text style={styles.logoC24}>C24</Text>
            <Text style={styles.logoClub}> CLUB</Text>
          </View>
          {user && profile ? (
            <View style={styles.welcomeRow}>
              <Text style={styles.welcomeText}>Welcome back, {profile.name}!</Text>
            </View>
          ) : (
            <Text style={styles.tagline}>The Omegle Alternative That Rewards You!</Text>
          )}
        </View>

        {/* Age Warning Banner */}
        {!warningDismissed && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              🔞 18+ Only — By using C24 Club you confirm you are 18 years or older
            </Text>
            <TouchableOpacity
              onPress={() => setWarningDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* How It Works */}
        <View style={styles.section}>
          <FemaleVipBanner />
          <Text style={styles.sectionTitle}>How It Works</Text>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stepsScroll}
            onScrollBeginDrag={() => {
              // Optionally we could stop the timer here, 
              // but for now we'll just let it continue
            }}
          >
            {STEPS.map((step) => (
              <View key={step.title} style={styles.stepCard}>
                {"image" in step ? (
                  <Image source={step.image} style={styles.stepImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.stepEmoji}>{step.emoji}</Text>
                )}
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
                {step.title === "Free shop" && (
                  <TouchableOpacity 
                    style={styles.stepButton}
                    onPress={() => router.push("/(tabs)/rewards")}
                  >
                    <Text style={styles.stepButtonText}>View shop</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Why C24 Comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why C24?</Text>
          <View style={styles.comparisonCard}>
            {/* Table Header */}
            <View style={styles.tableRow}>
              <Text style={flattenStyle([styles.tableCell, styles.tableFeatureHeader])}>
                Feature
              </Text>
              <Text style={flattenStyle([styles.tableCell, styles.tableHeaderRed])}>
                C24 Club
              </Text>
              <Text style={flattenStyle([styles.tableCell, styles.tableHeaderGray])}>
                Others
              </Text>
            </View>
            <View style={styles.divider} />
            {COMPARISON.map((row, i) => (
              <View
                key={row.feature}
                style={flattenStyle([
                  styles.tableRow,
                  i < COMPARISON.length -1 ? styles.tableRowBorder : null,
                ])}
              >
                <Text style={flattenStyle([styles.tableCell, styles.tableFeatureText])}>
                  {row.feature}
                </Text>
                <View style={flattenStyle([styles.tableCell, styles.tableCellCenter])}>
                  {row.c24 ? (
                    <Check size={18} color="#22C55E" />
                  ) : (
                    <X size={18} color="#EF4444" />
                  )}
                </View>
                <View style={flattenStyle([styles.tableCell, styles.tableCellCenter])}>
                  {row.others ? (
                    <Check size={18} color="#22C55E" />
                  ) : (
                    <X size={18} color="#EF4444" />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity 
            style={styles.ctaButton} 
            activeOpacity={0.85}
            onPress={handleCTA}
          >
            <Text style={styles.ctaText}>
              {user ? "Start Chatting Now →" : "Get Started Now →"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rulesButton}
            activeOpacity={0.7}
            onPress={() => router.push("/rules")}
          >
            <Text style={styles.rulesText}>View Rules</Text>
          </TouchableOpacity>
        </View>

        {/* VIP Spotlight Section */}
        <View style={styles.vipSpotlightContainer}>
          <View style={styles.vipHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Sparkles size={18} color="#FACC15" />
              <Text style={styles.vipTitle}>VIP Spotlight</Text>
            </View>
            <TouchableOpacity onPress={fetchVipSpotlight}>
              <Text style={styles.refreshText}>Shuffle</Text>
            </TouchableOpacity>
          </View>

          {vipLoading ? (
            <View style={styles.vipLoading}>
              <ActivityIndicator color="#EF4444" />
            </View>
          ) : (
            <FlatList
              data={vipMembers}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vipListContent}
              renderItem={({ item }) => (
                <View style={{ marginRight: 12 }}>
                  <UserCard
                    member={item}
                    isAdmin={adminIds.has(item.id)}
                    isVip={vipIds.has(item.id)}
                    isMod={modIds.has(item.id)}
                    isSelf={item.id === user?.id}
                    isNew={Date.now() - new Date(item.created_at).getTime() < 48 * 60 * 60 * 1000}
                    isInterested={false}
                    isMutualInterest={false}
                    pinnedSocials={vipSettings.get(item.id)}
                    callingId={activeInvite?.invitee_id === item.id ? item.id : null}
                    fakeViews={true}
                    onInterest={() => {}}
                    onDirectCall={handleDirectCall}
                    onMessage={handleMessage}
                    onGift={handleGift}
                    onSocials={() => {
                      const socials = vipSettings.get(item.id);
                      if (socials && socials.length > 0) {
                        setSocialsSheet({ name: item.name, socials });
                      }
                    }}
                    onView={() => {}}
                    cardWidth={CARD_WIDTH}
                    cardHeight={CARD_HEIGHT}
                  />
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.vipEmpty}>
                  <Text style={styles.vipEmptyText}>No VIPs online right now</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Upgrade to VIP Section */}
        {!(minutes?.is_vip) && (
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

        {/* Female Online Notify Card — male users only */}
        <FemaleNotifyCard
          onSettingsPress={() => router.push('/notification-settings')}
        />

        {/* How To Guide Button */}
        <TouchableOpacity
          style={styles.guideButton}
          activeOpacity={0.8}
          onPress={() => setShowGuide(true)}
        >
          <BookOpen size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.guideButtonText}>How To Guide</Text>
        </TouchableOpacity>

        <FooterLinks />

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Gift Modal */}
      <GiftModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
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

      <GiftCelebration
        visible={showGiftCelebration}
        recipientName={selectedRecipient?.name || "them"}
        onDismiss={() => setShowGiftCelebration(false)}
      />

      {/* How To Guide Modal */}
      <Modal
        visible={showGuide}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowGuide(false)}
      >
        <SafeAreaView style={styles.guideModal} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={styles.guideHeader}>
            <BookOpen size={20} color="#FACC15" />
            <Text style={styles.guideHeaderTitle}>How To Guide</Text>
            <TouchableOpacity onPress={() => setShowGuide(false)} style={styles.guideCloseBtn}>
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.guideScroll}
            contentContainerStyle={styles.guideScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {GUIDE_SECTIONS.map((section, sIdx) => (
              <View key={sIdx} style={styles.guideSection}>
                {/* Section header */}
                <TouchableOpacity
                  style={styles.guideSectionHeader}
                  activeOpacity={0.75}
                  onPress={() => setOpenAccordion(openAccordion === sIdx ? null : sIdx)}
                >
                  <Text style={styles.guideSectionTitle}>{section.title}</Text>
                  {openAccordion === sIdx
                    ? <ChevronUp size={18} color="#FACC15" />
                    : <ChevronDown size={18} color="#A1A1AA" />
                  }
                </TouchableOpacity>

                {/* Q&A items */}
                {openAccordion === sIdx && (
                  <View style={styles.guideItemsContainer}>
                    {section.items.map((item, iIdx) => (
                      <View key={iIdx} style={styles.guideItem}>
                        <Text style={styles.guideQuestion}>{item.q}</Text>
                        <Text style={styles.guideAnswer}>{item.a}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Socials Bottom Sheet */}
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
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.socialRow, { backgroundColor: cfg.color + '22' }]}
                  onPress={() => handleOpenSocial(platform, handle)}
                >
                  <View style={[styles.socialIconCircle, { backgroundColor: cfg.color }]}>
                    <Icon size={20} color="#FFFFFF" />
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
    backgroundColor: "#1A1A2E",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  logoC24: {
    fontSize: 52,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  logoClub: {
    fontSize: 52,
    fontWeight: "900",
    color: "#EF4444",
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: "#A1A1AA",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  welcomeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 8, columnGap: 8,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EF4444',
  },
  warningBanner: {
    backgroundColor: "#EF4444",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  warningText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginLeft: 20,
    marginBottom: 14,
  },
  stepsScroll: {
    paddingLeft: 20,
    paddingRight: 8,
    rowGap: 12, columnGap: 12,
  },
  stepCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 24,
    padding: 20,
    width: 200,
  },
  stepImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginBottom: 10,
  },
  stepEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 13,
    color: "#A1A1AA",
    lineHeight: 18,
  },
  stepButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    alignItems: "center",
  },
  stepButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  comparisonCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 20,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A4A",
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A4A",
  },
  tableCell: {
    flex: 1,
  },
  tableCellCenter: {
    alignItems: "center",
  },
  tableFeatureHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#71717A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableHeaderRed: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
    textAlign: "center",
  },
  tableHeaderGray: {
    fontSize: 13,
    fontWeight: "700",
    color: "#71717A",
    textAlign: "center",
  },
  tableFeatureText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  ctaContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  ctaButton: {
    backgroundColor: "#EF4444",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  rulesButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  rulesText: {
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  bottomPad: {
    height: 40,
  },
  // VIP Spotlight
  vipSpotlightContainer: {
    marginTop: 24,
    marginBottom: 12,
  },
  vipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  vipTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  refreshText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '700',
  },
  vipListContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  vipLoading: {
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipEmpty: {
    width: SCREEN_WIDTH - 32,
    height: CARD_HEIGHT,
    backgroundColor: '#1E1E38',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4A',
    borderStyle: 'dashed',
  },
  vipEmptyText: {
    color: '#71717A',
    fontSize: 13,
  },
  // VIP Upgrade
  vipUpgradeBox: {
    backgroundColor: "#1E1E38",
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A4A",
  },
  vipUpgradeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  vipUpgradeCrown: {
    fontSize: 24,
    color: "#FACC15",
  },
  vipUpgradeTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  vipUpgradeTagline: {
    fontSize: 14,
    color: "#A1A1AA",
    marginTop: 4,
  },
  vipUpgradeBadge: {
    backgroundColor: "#FACC15",
    borderRadius: 12,
    padding: 4,
    paddingHorizontal: 8,
  },
  vipUpgradeBadgeText: {
    color: "#1A1A2E",
    fontSize: 12,
    fontWeight: "700",
  },
  vipPerksList: {
    marginBottom: 16,
  },
  vipPerkItem: {
    fontSize: 14,
    color: "#A1A1AA",
    marginBottom: 4,
    lineHeight: 18,
  },
  vipUpgradeCTA: {
    alignItems: "center",
  },
  vipUpgradeCTAText: {
    color: "#FACC15",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  // How To Guide
  guideButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    backgroundColor: "transparent",
  },
  guideButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  guideModal: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A4A",
    gap: 10,
  },
  guideHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  guideCloseBtn: {
    padding: 4,
  },
  guideScroll: {
    flex: 1,
  },
  guideScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  guideSection: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  guideSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16213E",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  guideSectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginRight: 8,
  },
  guideItemsContainer: {
    backgroundColor: "#0F1928",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  guideItem: {
    marginTop: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#EF4444",
    paddingLeft: 12,
  },
  guideQuestion: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FACC15",
    marginBottom: 4,
  },
  guideAnswer: {
    fontSize: 14,
    color: "#A1A1AA",
    lineHeight: 20,
  },
  // Socials Sheet
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
});