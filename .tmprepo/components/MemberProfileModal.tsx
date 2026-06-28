import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Crown,
  DollarSign,
  Gift,
  Instagram,
  Link2,
  MessageCircle,
  MessageSquare,
  Music,
  Shield,
  Sparkles,
  Video,
  X,
} from "lucide-react-native";
import { DiscoverMember } from "@/types/members";
import { getTimeAgo, isEffectivelyOnline } from "@/utils/member-utils";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SOCIAL_CONFIG: Record<string, { label: string; color: string; icon: any; url: ((h: string) => string) | null }> = {
  instagram: { label: "Instagram", color: "#E4405F", icon: Instagram, url: (h) => `https://instagram.com/${h}` },
  tiktok:    { label: "TikTok",    color: "#010101", icon: Music,     url: (h) => `https://tiktok.com/@${h}` },
  snapchat:  { label: "Snapchat",  color: "#FFFC00", icon: MessageSquare, url: (h) => `https://snapchat.com/add/${h}` },
  discord:   { label: "Discord",   color: "#5865F2", icon: MessageSquare, url: null },
  cashapp:   { label: "Cash App",  color: "#00D632", icon: DollarSign, url: (h) => `https://cash.app/$${h}` },
  venmo:     { label: "Venmo",     color: "#3D95CE", icon: DollarSign, url: (h) => `https://venmo.com/${h}` },
  paypal:    { label: "PayPal",    color: "#003087", icon: DollarSign, url: (h) => `https://paypal.me/${h}` },
};

interface MemberProfileModalProps {
  member: DiscoverMember | null;
  visible: boolean;
  isAdmin: boolean;
  isVip: boolean;
  isMod: boolean;
  isInterested: boolean;
  isMutualInterest: boolean;
  pinnedSocials?: string[];
  callingId?: string | null;
  onClose: () => void;
  onInterest: () => void;
  onDirectCall: (member: DiscoverMember) => void;
  onMessage: (member: DiscoverMember) => void;
  onGift: (member: DiscoverMember) => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  member,
  visible,
  isAdmin,
  isVip,
  isMod,
  isInterested,
  isMutualInterest,
  pinnedSocials,
  callingId,
  onClose,
  onInterest,
  onDirectCall,
  onMessage,
  onGift,
}) => {
  if (!member) return null;

  const online = isEffectivelyOnline(member.id, member.gender, member.last_active_at);
  const isFemale = member.gender?.toLowerCase() === "female";
  const isRecipientVip = isVip || isAdmin;

  const placeholderBg = isFemale
    ? "rgba(236,72,153,0.2)"
    : member.gender?.toLowerCase() === "male"
    ? "rgba(59,130,246,0.2)"
    : "rgba(139,92,246,0.2)";

  const initial = member.name?.[0]?.toUpperCase() ?? "?";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* ── Close button ── */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* ── Large photo ── */}
            <View style={styles.imageContainer}>
              {member.image_url ? (
                <Image
                  source={{ uri: member.image_url }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.photo, { backgroundColor: placeholderBg, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={styles.placeholderInitial}>{initial}</Text>
                </View>
              )}

              {/* Online pill overlaid on image */}
              {online && (
                <View style={styles.onlinePill}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlinePillText}>Online Now</Text>
                </View>
              )}
            </View>

            {/* ── Profile info ── */}
            <View style={styles.infoSection}>
              {/* Name + badges row */}
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>{member.name}</Text>
                <View style={styles.badgesRow}>
                  {isAdmin && (
                    <View style={styles.badgeOwner}>
                      <Crown size={10} color="#FFFFFF" />
                      <Text style={styles.badgeText}>Owner</Text>
                    </View>
                  )}
                  {isVip && !isAdmin && (
                    <View style={styles.badgeVip}>
                      <Sparkles size={10} color="#FFFFFF" />
                      <Text style={styles.badgeText}>VIP</Text>
                    </View>
                  )}
                  {isMod && !isAdmin && (
                    <View style={styles.badgeMod}>
                      <Shield size={10} color="#FFFFFF" />
                      <Text style={styles.badgeText}>Mod</Text>
                    </View>
                  )}
                  {isMutualInterest && (
                    <View style={styles.badgeMatch}>
                      <Text style={styles.badgeText}>
                        <Text style={{ fontSize: 11, lineHeight: 14, includeFontPadding: false }}>💚</Text> Match!
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Gender + last seen */}
              <View style={styles.metaRow}>
                {member.gender ? (
                  <Text style={styles.metaText}>{member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}</Text>
                ) : null}
                {member.gender && <Text style={styles.metaDot}>·</Text>}
                <Text style={[styles.metaText, online && { color: "#22C55E" }]}>
                  {online ? "Online" : getTimeAgo(member.last_active_at)}
                </Text>
              </View>

              {/* Earns row (females) */}
              {isFemale && (
                <View style={styles.earnsRow}>
                  <DollarSign size={12} color="#22C55E" />
                  <Text style={styles.earnsText}>Earns minutes by chatting</Text>
                </View>
              )}

              {/* Bio */}
              {member.bio ? (
                <View style={styles.bioBox}>
                  <Text style={styles.bioText}>"{member.bio}"</Text>
                </View>
              ) : null}

              {/* Socials */}
              {pinnedSocials && pinnedSocials.length > 0 && (
                <View style={styles.socialsSection}>
                  <Text style={styles.socialsSectionTitle}>Socials</Text>
                  {pinnedSocials.map((s, i) => {
                    const [platform, handle] = s.split(":");
                    if (!platform || !handle) return null;
                    const cfg = SOCIAL_CONFIG[platform.toLowerCase()];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    const isSnapchat = platform.toLowerCase() === "snapchat";
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.socialRow, { backgroundColor: cfg.color + "22" }]}
                        activeOpacity={cfg.url ? 0.7 : 1}
                        onPress={() => {
                          if (cfg.url) Linking.openURL(cfg.url(handle)).catch(() => {});
                        }}
                      >
                        <View style={[styles.socialIcon, { backgroundColor: cfg.color }]}>
                          <Icon size={16} color={isSnapchat ? "#000" : "#FFF"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.socialLabel}>{cfg.label}</Text>
                          <Text style={styles.socialHandle}>@{handle}</Text>
                        </View>
                        {cfg.url && <Link2 size={14} color="#A1A1AA" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* ── Action Buttons ── */}
          <View style={styles.actionsBar}>
            {/* Interest */}
            <TouchableOpacity
              style={[styles.actionChip, isInterested ? styles.actionChipActive : undefined]}
              activeOpacity={0.8}
              onPress={onInterest}
              disabled={isInterested}
            >
              <Text style={styles.actionChipText}>
                <Text style={{ fontSize: 14, lineHeight: 18, includeFontPadding: false }}>💚</Text> {isInterested ? "Interested" : "Interest"}
              </Text>
            </TouchableOpacity>

            {/* Video call */}
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => { onDirectCall(member); onClose(); }}
              disabled={!!callingId}
            >
              {callingId === member.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Video size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            {/* Message */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "rgba(59,130,246,0.9)" }]}
              activeOpacity={0.8}
              onPress={() => { onMessage(member); onClose(); }}
            >
              <MessageCircle size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Gift — always shown; modal handles locked state for non-VIP recipients */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "rgba(245,158,11,0.9)" }]}
              activeOpacity={0.8}
              onPress={() => { onGift(member); onClose(); }}
            >
              <Gift size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.92,
    overflow: "hidden",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 8,
  },
  imageContainer: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.52,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  placeholderInitial: {
    fontSize: 80,
    fontWeight: "800",
    color: "rgba(255,255,255,0.5)",
  },
  onlinePill: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.9)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  onlinePillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  infoSection: {
    padding: 18,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  nameText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  badgeOwner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B45309",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeVip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeMod: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D4ED8",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeMatch: {
    backgroundColor: "rgba(34,197,94,0.2)",
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  metaText: {
    color: "#A1A1AA",
    fontSize: 13,
  },
  metaDot: {
    color: "#52525B",
    fontSize: 13,
  },
  earnsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  earnsText: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "600",
  },
  bioBox: {
    backgroundColor: "#1E1E38",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  bioText: {
    color: "#D4D4D8",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 20,
  },
  socialsSection: {
    gap: 8,
  },
  socialsSectionTitle: {
    color: "#71717A",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 10,
    gap: 12,
  },
  socialIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  socialLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  socialHandle: {
    color: "#A1A1AA",
    fontSize: 12,
  },
  actionsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#1E1E38",
  },
  actionChip: {
    flex: 1,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
    borderRadius: 100,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipActive: {
    backgroundColor: "rgba(34,197,94,0.25)",
    borderColor: "#22C55E",
  },
  actionChipText: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "700",
  },
  actionBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(16,185,129,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
});