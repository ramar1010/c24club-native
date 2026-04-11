import React from 'react';
import {
  View,
  Text,
  Switch,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifyFemaleOnline } from '@/hooks/useNotifyFemaleOnline';

const GIRL_1 = require('@/assets/images/f9f187e1b233e297e07f76993e51ba54-removebg-preview.png');
const GIRL_2 = require('@/assets/images/3412476ba9d5bc62606c2dee9bc7972b-removebg-preview (2).png');

interface FemaleNotifyCardProps {
  onSettingsPress?: () => void;
  compact?: boolean;
}

export function FemaleNotifyCard({ onSettingsPress, compact = false }: FemaleNotifyCardProps) {
  const { profile } = useAuth();
  const { enabled, setEnabled } = useNotifyFemaleOnline();

  // Only show to male users
  if (profile?.gender?.toLowerCase() !== 'male') return null;

  // ── Compact version for Chat page ──────────────────────────────────────────
  if (compact) {
    return (
      <View style={styles.compactWrapper}>
        <View style={styles.compactCard}>
          {/* Tiny sticker left */}
          <Image source={GIRL_1} style={styles.compactStickerLeft} resizeMode="contain" pointerEvents="none" />
          {/* Tiny sticker right */}
          <Image source={GIRL_2} style={styles.compactStickerRight} resizeMode="contain" pointerEvents="none" />

          {/* Content squeezed between stickers */}
          <View style={styles.compactContent}>
            <Text style={styles.compactTitle}>🔔 Notify me when a girl is searching</Text>
            <View style={styles.compactRow}>
              <View style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}>
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  trackColor={{ false: '#3F3F5A', true: '#EC4899' }}
                  thumbColor={enabled ? '#FFFFFF' : '#A1A1AA'}
                  ios_backgroundColor="#3F3F5A"
                />
              </View>
              <Text style={styles.compactToggleLabel}>{enabled ? 'ON' : 'OFF'}</Text>
            </View>
            {onSettingsPress && (
              <TouchableOpacity onPress={onSettingsPress} activeOpacity={0.7}>
                <Text style={styles.compactSettingsLink}>More settings →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── Full version for Home page ─────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      {/* Pink glow backdrop */}
      <View style={styles.glowBackdrop} />

      {/* Card body */}
      <View style={styles.card}>
        {/* Left sticker girl */}
        <View style={styles.stickerLeft} pointerEvents="none">
          <Image
            source={GIRL_1}
            style={styles.stickerImageLeft}
            resizeMode="contain"
          />
        </View>

        {/* Right sticker girl */}
        <View style={styles.stickerRight} pointerEvents="none">
          <Image
            source={GIRL_2}
            style={styles.stickerImageRight}
            resizeMode="contain"
          />
        </View>

        {/* Card content */}
        <View style={styles.content}>
          <Text style={styles.title}>
            {'\uD83D\uDD14'} Get notified when a{'\n'}female is searching!
          </Text>
          <Text style={styles.subtitle}>
            Be the first to connect — never miss a match
          </Text>

          {/* Toggle row */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {enabled ? 'Notifications ON' : 'Notifications OFF'}
            </Text>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: '#3F3F5A', true: '#EC4899' }}
              thumbColor={enabled ? '#FFFFFF' : '#A1A1AA'}
              ios_backgroundColor="#3F3F5A"
            />
          </View>

          {/* Settings link */}
          {onSettingsPress && (
            <TouchableOpacity
              onPress={onSettingsPress}
              activeOpacity={0.7}
              style={styles.settingsLink}
            >
              <Text style={styles.settingsLinkText}>
                View more notification settings →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  glowBackdrop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 20,
    backgroundColor: '#EC4899',
    opacity: 0.18,
    // blur simulation via shadow
    ...Platform.select({
      ios: {
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 30,
      },
      android: {},
      default: {},
    }),
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EC4899',
    paddingHorizontal: 110,
    paddingVertical: 20,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      default: {
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
      },
    }),
  },
  compactWrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  compactCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EC4899',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      },
    }),
  },
  compactStickerLeft: {
    width: 44,
    height: 60,
    transform: [{ rotate: '-6deg' }],
    marginRight: 8,
  },
  compactStickerRight: {
    width: 44,
    height: 60,
    transform: [{ rotate: '6deg' }],
    marginLeft: 8,
  },
  compactContent: {
    flex: 1,
    alignItems: 'center',
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 8, columnGap: 8,
  },
  compactToggleLabel: {
    color: '#F9A8D4',
    fontSize: 12,
    fontWeight: '600',
  },
  compactSettingsLink: {
    color: '#9D4E7C',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  stickerLeft: {
    position: 'absolute',
    left: -10,
    top: -20,
    zIndex: 10,
  },
  stickerImageLeft: {
    width: 100,
    height: 130,
    transform: [{ rotate: '-8deg' }],
  },
  stickerRight: {
    position: 'absolute',
    right: -10,
    top: -20,
    zIndex: 10,
  },
  stickerImageRight: {
    width: 100,
    height: 130,
    transform: [{ rotate: '8deg' }],
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: '#F9A8D4',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.85,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 12, columnGap: 12,
    marginBottom: 10,
  },
  toggleLabel: {
    color: '#F9A8D4',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsLink: {
    paddingVertical: 4,
  },
  settingsLinkText: {
    color: '#9D4E7C',
    fontSize: 12,
    textAlign: 'center',
  },
});