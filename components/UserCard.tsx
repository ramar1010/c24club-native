import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Crown,
  DollarSign,
  Eye,
  Gift,
  Link2,
  MessageCircle,
  Shield,
  Sparkles,
  Video,
} from "lucide-react-native";
import { DiscoverMember } from "@/types/members";
import { getTimeAgo, isEffectivelyOnline } from "@/utils/member-utils";
import { flattenStyle } from "@/utils/flatten-style";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;
const CARD_HEIGHT = CARD_WIDTH * (4 / 3);

// Generates a stable pseudo-random view count from a member's id string
function stableViewCount(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const base = 120 + (hash % 880); // range 120–999
  if (base >= 1000) return "1k+";
  return base.toString();
}

export interface UserCardProps {
  member: DiscoverMember;
  isAdmin: boolean;
  isVip: boolean;
  isMod: boolean;
  isSelf: boolean;
  isNew: boolean;
  isInterested: boolean;
  isMutualInterest: boolean;
  pinnedSocials?: string[];
  callingId?: string | null;
  fakeViews?: boolean;
  onInterest: () => void;
  onDirectCall: (member: DiscoverMember) => void;
  onMessage: (member: DiscoverMember) => void;
  onGift: (member: DiscoverMember) => void;
  onSocials: () => void;
  onView: () => void;
  onPress?: () => void;
  cardWidth?: number;
  cardHeight?: number;
}

export const UserCard = React.memo(({
  member,
  isAdmin,
  isVip,
  isMod,
  isSelf,
  isNew,
  isInterested,
  isMutualInterest,
  pinnedSocials,
  callingId,
  fakeViews = false,
  onInterest,
  onDirectCall,
  onMessage,
  onGift,
  onSocials,
  onView,
  onPress,
  cardWidth = CARD_WIDTH,
  cardHeight = CARD_HEIGHT,
}: UserCardProps) => {
  const viewTracked = useRef(false);
  const online = isEffectivelyOnline(member.id, member.gender, member.last_active_at);
  const isFemale = member.gender?.toLowerCase() === "female";
  const isRecipientVip = isVip || isAdmin;

  const placeholderBg = isFemale
    ? "rgba(236,72,153,0.15)"
    : member.gender?.toLowerCase() === "male"
    ? "rgba(59,130,246,0.15)"
    : "rgba(139,92,246,0.15)";

  const initial = member.name?.[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    if (!viewTracked.current) {
      viewTracked.current = true;
      onView();
    }
  }, [onView]);

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      activeOpacity={0.92}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Photo / Placeholder */}
      {member.image_url ? (
        <Image
          source={{ uri: member.image_url }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <View
          style={flattenStyle([
            StyleSheet.absoluteFillObject,
            { backgroundColor: placeholderBg, alignItems: "center", justifyContent: "center" },
          ])}
        >
          <Text style={styles.placeholderInitial}>{initial}</Text>
        </View>
      )}

      {/* Top-left badges */}
      <View style={styles.badgeStack}>
        {online && (
          <View style={styles.badgeOnline}>
            <View style={styles.pulseDot} />
            <Text style={styles.badgeText}>Online</Text>
          </View>
        )}
        {isNew && (
          <View style={styles.badgeNew}>
            <Sparkles size={9} color="#FFFFFF" />
            <Text style={styles.badgeText}> New</Text>
          </View>
        )}
        {isMutualInterest && (
          <View style={styles.badgeMatch}>
            <Text style={styles.badgeText}>Match!</Text>
          </View>
        )}
        {isAdmin && (
          <View style={styles.badgeOwner}>
            <Crown size={9} color="#FFFFFF" />
            <Text style={styles.badgeText}> Owner</Text>
          </View>
        )}
        {isVip && !isAdmin && (
          <View style={styles.badgeVip}>
            <Sparkles size={9} color="#FFFFFF" />
            <Text style={styles.badgeText}> VIP</Text>
          </View>
        )}
        {isMod && !isAdmin && (
          <View style={styles.badgeMod}>
            <Shield size={9} color="#FFFFFF" />
            <Text style={styles.badgeText}> Mod</Text>
          </View>
        )}
        {isSelf && (
          <View style={styles.badgeSelf}>
            <Text style={styles.badgeText}>You</Text>
          </View>
        )}
      </View>

      {/* Top-right: fake view counter */}
      {fakeViews && (
        <View style={styles.viewCountBadge}>
          <Eye size={9} color="#FACC15" />
          <Text style={styles.viewCountText}>{stableViewCount(member.id)}</Text>
        </View>
      )}

      {/* Bottom overlay */}
      <View style={styles.cardOverlay}>
        {member.bio ? (
          <Text style={styles.cardBio} numberOfLines={2}>
            &ldquo;{member.bio}&rdquo;
          </Text>
        ) : null}
        <Text style={styles.cardName}>{member.name}</Text>
        <Text
          style={flattenStyle([
            styles.cardTime,
            online && { color: "#22C55E" },
          ])}
        >
          {online ? "Online" : getTimeAgo(member.last_active_at)}
        </Text>
        {isFemale && (
          <View style={styles.earnsRow}>
            <DollarSign size={10} color="#22C55E" />
            <Text style={styles.earnsText}>Earns by chatting</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionBtnGreen} 
            activeOpacity={0.8}
            onPress={() => onDirectCall(member)}
            disabled={!!callingId}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 6 }}
          >
            {callingId === member.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Video size={12} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionBtnBlue} 
            activeOpacity={0.8} 
            onPress={() => onMessage(member)}
            hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          >
            <MessageCircle size={12} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionBtnAmber} 
            activeOpacity={0.8}
            onPress={() => onGift(member)}
            hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}
          >
            <Gift size={12} color="#FFFFFF" />
          </TouchableOpacity>

          {pinnedSocials && pinnedSocials.length > 0 && (
            <TouchableOpacity 
              style={styles.actionBtnPurple} 
              activeOpacity={0.8}
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
              onPress={onSocials}
            >
              <Link2 size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

UserCard.displayName = "UserCard";

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1E1E38",
  },
  placeholderInitial: {
    fontSize: 48,
    fontWeight: "800",
    color: "rgba(255,255,255,0.6)",
  },
  badgeStack: {
    position: "absolute",
    top: 8,
    left: 8,
    rowGap: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  badgeOnline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.9)",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  badgeNew: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(236,72,153,0.9)",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  badgeMatch: {
    backgroundColor: "rgba(236,72,153,0.9)",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeOwner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B45309",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  badgeVip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  badgeMod: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D4ED8",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  badgeSelf: {
    backgroundColor: "#06B6D4",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewCountBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  viewCountText: {
    color: "#FACC15",
    fontSize: 9,
    fontWeight: "800",
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    padding: 8,
  },
  cardBio: {
    fontSize: 10,
    color: "#A1A1AA",
    fontStyle: "italic",
    marginBottom: 2,
  },
  cardName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cardTime: {
    fontSize: 10,
    color: "#71717A",
    marginTop: 1,
  },
  earnsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 3,
  },
  earnsText: {
    color: "#22C55E",
    fontSize: 10,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 5,
  },
  actionBtnGreen: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(16,185,129,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnBlue: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPurple: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(139,92,246,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnAmber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(245,158,11,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
});