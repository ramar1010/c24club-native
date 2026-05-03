import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Mic, MicOff, Video, VideoOff, Flag, X, SkipForward, Star } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { flattenStyle } from '@/utils/flatten-style';
import styles from './chat-styles';

interface ChatBottomControlsProps {
  callState: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isVoiceMode: boolean;
  genderFilter: 'Both' | 'Girls' | 'Guys';
  isVip: boolean | undefined;
  hasSubmittedSelfie: boolean;
  /** Whether this user has been shadowbanned from starting calls */
  isRestricted?: boolean;
  onStart: () => void;
  onCancel: () => void;
  onNext: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleVoiceMode: () => void;
  onReport: () => void;
  onGenderPill: (option: 'Both' | 'Girls' | 'Guys') => void;
  onTakeSelfie: () => void;
}

export function ChatBottomControls({
  callState,
  isMuted,
  isCameraOff,
  isVoiceMode,
  genderFilter,
  isVip,
  hasSubmittedSelfie,
  isRestricted = false,
  onStart,
  onCancel,
  onNext,
  onToggleMute,
  onToggleCamera,
  onToggleVoiceMode,
  onReport,
  onGenderPill,
  onTakeSelfie,
}: ChatBottomControlsProps) {
  const renderGenderFilter = () => (
    <View style={styles.genderFilterRow}>
      {(['Girls', 'Both', 'Guys'] as const).map((opt) => {
        const isActive = genderFilter === opt;
        const isLocked = opt !== 'Both' && !isVip;
        return (
          <TouchableOpacity
            key={opt}
            style={flattenStyle([styles.genderPill, isActive ? styles.genderPillActive : null])}
            onPress={() => onGenderPill(opt)}
            activeOpacity={0.8}
          >
            <Text style={flattenStyle([styles.genderPillText, isActive ? styles.genderPillTextActive : null])}>
              {opt === 'Girls' ? '👧 Girls' : opt === 'Guys' ? '👦 Guys' : 'Both'}
            </Text>
            {isLocked && (
              <Star size={11} color="#FACC15" fill="#FACC15" style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (callState === 'idle') {
    return (
      <View style={styles.bottomBar}>
        {renderGenderFilter()}
        {!hasSubmittedSelfie ? (
          <TouchableOpacity style={styles.selfieBtn} onPress={onTakeSelfie} activeOpacity={0.85}>
            <Text style={styles.selfieBtnText}>📸 Take Selfie to Start Chatting</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={flattenStyle([styles.startBtn, isRestricted ? { opacity: 0.4 } : null])}
            onPress={onStart}
            activeOpacity={isRestricted ? 1 : 0.85}
          >
            <Text style={styles.startBtnText}>
              {isRestricted ? '🚫 START CHATTING' : 'START CHATTING'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (callState === 'waiting') {
    return (
      <View style={styles.bottomBar}>
        {renderGenderFilter()}
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (callState === 'connecting' || callState === 'connected') {
    return (
      <View style={styles.bottomBar}>
        {renderGenderFilter()}
        <View style={styles.callControls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={onToggleMute} activeOpacity={0.8}>
            {isMuted ? <MicOff size={22} color="#EF4444" /> : <Mic size={22} color="#FFFFFF" />}
            <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ctrlBtn} onPress={onToggleVoiceMode} activeOpacity={0.8}>
            {isVoiceMode ? <VideoOff size={22} color="#EF4444" /> : <Video size={22} color="#FFFFFF" />}
            <Text style={styles.ctrlLabel}>{isVoiceMode ? 'Voice ON' : 'Voice Mode'}</Text>
          </TouchableOpacity>

          {/* End call button */}
          <TouchableOpacity style={styles.endCallBtn} onPress={onCancel} activeOpacity={0.85}>
            <X size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.85}>
            <SkipForward size={20} color="#FFFFFF" />
            <Text style={styles.nextBtnText}>NEXT</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ctrlBtn} onPress={onReport} activeOpacity={0.8}>
            <Flag size={22} color="#A1A1AA" />
            <Text style={styles.ctrlLabel}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}