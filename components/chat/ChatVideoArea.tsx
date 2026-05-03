import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Flag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/text';
import { RTCView } from '@/lib/webrtc';
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
  // Callbacks
  onReport: () => void;
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
  onReport,
  onSendCash,
  onTopicsTabPress,
}: ChatVideoAreaProps) {
  // Treat as voice mode if explicitly signaled OR if remote stream has no video tracks
  const effectivelyVoiceMode = partnerIsVoiceMode || (!!remoteStream && !remoteHasVideo);

  return (
    <View style={styles.videoArea}>
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
              streamURL={typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : remoteStream}
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

      {/* Partner topics (from useVideoChat hook — legacy) */}
      {partnerTopics.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.topicsRow}
          contentContainerStyle={styles.topicsContent}
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

      {/* Report button */}
      <TouchableOpacity style={styles.reportBtn} onPress={onReport}>
        <Flag size={18} color="#EF4444" />
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
            streamURL={typeof localStream.toURL === 'function' ? localStream.toURL() : localStream}
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