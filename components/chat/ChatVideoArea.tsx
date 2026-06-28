import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/text';
import { RTCView } from '@/lib/webrtc';
import { BlurView } from 'expo-blur';
import { PinnedSocialsDisplay } from '@/components/videocall/PinnedSocialsDisplay';
import { VoiceModeAvatar } from './VoiceModeAvatar';
import styles from './chat-styles';

interface ChatVideoAreaProps {
  // Streams
  localStream: any;
  remoteStream: any;
  // State
  isVoiceMode: boolean;
  isCameraOff: boolean;
  partnerIsVoiceMode: boolean;
  remoteHasVideo: boolean;
  showVideo: boolean;
  videoOpacity: Animated.Value;
  partnerGender: string | null | undefined;
  // Topics
  partnerTopics: string[];
  partnerPinnedTopics: string[];
  pinnedTopicIds: Set<string>;
  pinnedTopicNames: string[];
  // Socials / Gift
  partnerSocials: any[];
  showGiftIcon: boolean;
  giftPulseAnim: Animated.Value;
  // Profile
  profileGender: string | null | undefined;
  // Blur
  isBlurred?: boolean;
  isRestricted?: boolean;
  onUnblur?: () => void;
  // Partner left indicator
  partnerLeft?: boolean;
  // Callbacks
  onSendCash: () => void;
  onTopicsTabPress: () => void;
}

export function ChatVideoArea({
  localStream,
  remoteStream,
  isVoiceMode,
  isCameraOff,
  partnerIsVoiceMode,
  remoteHasVideo,
  showVideo,
  videoOpacity,
  partnerGender,
  partnerTopics,
  partnerPinnedTopics,
  pinnedTopicIds,
  pinnedTopicNames,
  partnerSocials,
  showGiftIcon,
  giftPulseAnim,
  profileGender,
  isBlurred,
  isRestricted,
  onUnblur,
  partnerLeft,
  onSendCash,
  onTopicsTabPress,
}: ChatVideoAreaProps) {
  // Treat as voice mode if explicitly signaled OR if remote stream has no video tracks
  const effectivelyVoiceMode = partnerIsVoiceMode || (!!remoteStream && !remoteHasVideo);

  return (
    <View style={styles.videoArea}>
      {/* Self-Blur Indicator (for restricted users) */}
      {isRestricted && (
        <View style={{ position: 'absolute', top: 8, alignSelf: 'center', backgroundColor: 'rgba(239, 68, 68, 0.8)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, zIndex: 100 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>⚠️ YOUR VIDEO IS BLURRED FOR OTHERS</Text>
        </View>
      )}

      {/* Remote video */}
      {effectivelyVoiceMode ? (
        <View style={styles.remoteVideoPlaceholder}>
          <VoiceModeAvatar size={120} gender={partnerGender} />
        </View>
      ) : remoteStream ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Placeholder shown for first 3s */}
          {!showVideo && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0F0F1A', alignItems: 'center', justifyContent: 'center', zIndex: 10 }]}>
              <LinearGradient
                colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ alignItems: 'center', gap: 14 }}>
                <VoiceModeAvatar size={90} label={false} gender={partnerGender} />
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>Match found!</Text>
                  <Text style={{ color: '#71717A', fontSize: 13 }}>Starting video…</Text>
                </View>
                <ActivityIndicator size="small" color="#EF4444" style={{ marginTop: 4 }} />
              </View>
            </View>
          )}
          {/* RTCView — mounted immediately but revealed after delay */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]}>
            <RTCView
              streamURL={typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : undefined}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          </Animated.View>
        </View>
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={{ color: '#A1A1AA', marginTop: 12 }}>Connecting...</Text>
        </View>
      )}

      {/* Blur Overlay */}
      {isBlurred && showVideo && !effectivelyVoiceMode && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} style={StyleSheet.absoluteFill} tint="dark" />
          {/* Android Fallback: Add a darkened semi-transparent layer because BlurView can be flaky on some Android devices over RTCView */}
          {Platform.OS === 'android' && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />
          )}
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 20 }]}>
            <View style={{ alignItems: 'center', padding: 24, backgroundColor: 'rgba(30, 30, 58, 0.9)', borderRadius: 24, borderWidth: 1, borderColor: '#2A2A4A' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
                Video Blurred
              </Text>
              <Text style={{ color: '#A1A1AA', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                This partner has a history of strikes or you are in safe-mode.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#EF4444', borderRadius: 100, paddingVertical: 12, paddingHorizontal: 32 }}
                onPress={onUnblur}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Unblur Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Partner Left Overlay — shown instantly when partner disconnects ── */}
      {partnerLeft && (
        <View style={partnerLeftStyles.overlay}>
          <View style={partnerLeftStyles.card}>
            <Text style={partnerLeftStyles.wave}>👋</Text>
            <Text style={partnerLeftStyles.title}>Partner left</Text>
            <Text style={partnerLeftStyles.sub}>Finding your next match…</Text>
            <ActivityIndicator size="small" color="#EF4444" style={{ marginTop: 12 }} />
          </View>
        </View>
      )}

      {/* Partner topics (from useVideoChat hook — legacy) */}
      {partnerTopics.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.topicsRow}
          contentContainerStyle={styles.topicsContent}
          removeClippedSubviews={false}
        >
          {partnerTopics.map((topic, i) => (
            <View key={i} style={styles.topicChip}>
              <Text style={styles.topicChipText}>{topic}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Partner's pinned topics — blue chips, top-right */}
      {partnerPinnedTopics.length > 0 && (
        <View style={styles.partnerChipsContainer}>
          {partnerPinnedTopics.map((name, i) => (
            <View key={i} style={styles.partnerChip}>
              <Text style={styles.partnerChipText}>{name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* My pinned topics — red chips, bottom-left */}
      {pinnedTopicNames.length > 0 && (
        <View style={styles.myChipsContainer}>
          {pinnedTopicNames.map((name, i) => (
            <View key={i} style={styles.myChip}>
              <Text style={styles.myChipText}>{name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Topics bookmark tab — left edge */}
      <TouchableOpacity
        style={styles.topicsTab}
        onPress={onTopicsTabPress}
        activeOpacity={0.8}
      >
        <Text style={styles.topicsTabText}>📌</Text>
        <Text style={styles.topicsTabLabel}>Topics</Text>
        {pinnedTopicIds.size > 0 && (
          <View style={styles.topicsTabBadge}>
            <Text style={styles.topicsTabBadgeText}>{pinnedTopicIds.size}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Partner's VIP pinned socials + Send Cash */}
      <PinnedSocialsDisplay
        socials={partnerSocials}
        showSendCash={showGiftIcon}
        onSendCash={onSendCash}
        giftPulseAnim={giftPulseAnim}
      />

      {/* Local PiP */}
      <View style={styles.localPip}>
        {isVoiceMode ? (
          <VoiceModeAvatar size={60} label={false} gender={profileGender} />
        ) : isCameraOff ? (
          <View style={styles.pipPlaceholder}>
            {/* VideoOff icon imported inline to keep component deps clean */}
            <Text style={{ color: '#555', fontSize: 22 }}>📵</Text>
          </View>
        ) : localStream ? (
          <RTCView
            streamURL={typeof localStream.toURL === 'function' ? localStream.toURL() : undefined}
            style={styles.localPipRTC}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
        ) : (
          <View style={styles.pipPlaceholder}>
            <ActivityIndicator size="small" color="#EF4444" />
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Partner Left Overlay Styles ──────────────────────────────────────────────
const partnerLeftStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 40, 0.95)',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    gap: 4,
  },
  wave: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
});