import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Animated,
} from 'react-native';

interface SocialConfig {
  label: string;
  emoji: string;
  bgColor: string;
  buildUrl: ((username: string) => string) | null;
}

const SOCIAL_CONFIG: Record<string, SocialConfig> = {
  cashapp:   { label: 'Cash App',  emoji: '💵', bgColor: '#00D632', buildUrl: (u) => `https://cash.app/${u}` },
  tiktok:    { label: 'TikTok',    emoji: '🎵', bgColor: '#010101', buildUrl: (u) => `https://tiktok.com/@${u}` },
  instagram: { label: 'Instagram', emoji: '📸', bgColor: '#E4405F', buildUrl: (u) => `https://instagram.com/${u}` },
  snapchat:  { label: 'Snapchat',  emoji: '👻', bgColor: '#FFFC00', buildUrl: (u) => `https://snapchat.com/add/${u}` },
  discord:   { label: 'Discord',   emoji: '🎮', bgColor: '#5865F2', buildUrl: null },
  venmo:     { label: 'Venmo',     emoji: '💸', bgColor: '#3D95CE', buildUrl: (u) => `https://venmo.com/${u}` },
  paypal:    { label: 'PayPal',    emoji: '🅿️', bgColor: '#003087', buildUrl: (u) => `https://paypal.me/${u}` },
};

function sanitizeUsername(raw: string): string {
  return raw.replace(/^[@$/]+/, '').trim();
}

function parseSocialEntry(entry: string): { platform: string; username: string } | null {
  const colonIdx = entry.indexOf(':');
  if (colonIdx === -1) return null;
  const platform = entry.slice(0, colonIdx).toLowerCase().trim();
  const username = entry.slice(colonIdx + 1).trim();
  if (!platform || !username) return null;
  return { platform, username };
}

// ─── Single social circle ─────────────────────────────────────────────────────

interface SocialCircleProps {
  platform: string;
  username: string;
}

function SocialCircle({ platform, username }: SocialCircleProps) {
  const cleanUsername = sanitizeUsername(username);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scaleAnim]);

  const config = SOCIAL_CONFIG[platform];
  if (!config) return null;

  const handlePress = useCallback(() => {
    if (!config.buildUrl) return;
    Linking.openURL(config.buildUrl(cleanUsername)).catch(console.warn);
  }, [config, cleanUsername]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!config.buildUrl}
        activeOpacity={1}
        style={[styles.circle, { backgroundColor: config.bgColor }]}
      >
        <Text style={styles.circleEmoji}>{config.emoji}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PinnedSocialsDisplayProps {
  socials: string[];
  showSendCash?: boolean;
  onSendCash?: () => void;
  giftPulseAnim?: Animated.Value;
}

export function PinnedSocialsDisplay({
  socials,
  showSendCash,
  onSendCash,
  giftPulseAnim,
}: PinnedSocialsDisplayProps) {
  if ((!socials || socials.length === 0) && !showSendCash) return null;

  const parsed = socials
    ? socials
        .map(parseSocialEntry)
        .filter((e): e is { platform: string; username: string } => e !== null)
        .slice(0, 1)
    : []; // show only the first pinned social

  return (
    <View style={styles.container}>
      {parsed.map((entry, i) => (
        <SocialCircle key={`${entry.platform}-${i}`} platform={entry.platform} username={entry.username} />
      ))}

      {showSendCash && (
        <Animated.View style={giftPulseAnim ? { transform: [{ scale: giftPulseAnim }] } : {}}>
          <TouchableOpacity
            style={[styles.circle, styles.giftCircle]}
            onPress={onSendCash}
            activeOpacity={0.8}
          >
            <Text style={styles.circleEmoji}>🎁</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 12,
    zIndex: 100,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  giftCircle: {
    backgroundColor: '#EF4444',
    borderColor: '#FACC15',
    borderWidth: 3,
  },
  circleEmoji: {
    fontSize: 22,
  },
});