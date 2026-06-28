import React, { useState } from 'react';
import { ActivityIndicator, View, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Mic, MicOff, Video, VideoOff, Flag, X, SkipForward, Star, MessageCircle, Users, Check } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { flattenStyle } from '@/utils/flatten-style';
import styles from './chat-styles';

interface ChatBottomControlsProps {
  callState: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isVoiceMode: boolean;
  genderFilter: 'Both' | 'Women' | 'Men';
  isVip: boolean | undefined;
  userGender: string | null | undefined;
  partnerGender: string | null | undefined;
  hasSubmittedSelfie: boolean;
  /** Whether this user has been shadowbanned from starting calls */
  isRestricted?: boolean;
  isStarting?: boolean;
  onStart: () => void;
  onCancel: () => void;
  onNext: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleVoiceMode: () => void;
  onReport: () => void;
  onMessageMe: () => void;
  onGenderPill: (option: 'Both' | 'Women' | 'Men') => void;
  onTakeSelfie: () => void;
}

export function ChatBottomControls({
  callState,
  isMuted,
  isCameraOff,
  isVoiceMode,
  genderFilter,
  isVip,
  userGender,
  partnerGender,
  hasSubmittedSelfie,
  isRestricted = false,
  isStarting = false,
  onStart,
  onCancel,
  onNext,
  onToggleMute,
  onToggleCamera,
  onToggleVoiceMode,
  onReport,
  onMessageMe,
  onGenderPill,
  onTakeSelfie,
}: ChatBottomControlsProps) {
  const [isGenderModalVisible, setIsGenderModalVisible] = useState(false);

  const renderGenderFilter = (showFullSelector: boolean) => {
    if (showFullSelector) {
      return (
        <View style={styles.genderFilterSegmented}>
          {(['Women', 'Both', 'Men'] as const).map((opt) => {
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
                  {opt === 'Women' ? '👧 Women' : opt === 'Men' ? '👦 Men' : 'Both'}
                </Text>
                {isLocked && (
                  <Star size={11} color="#FACC15" fill="#FACC15" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // Circular toggle button
    return (
      <TouchableOpacity
        style={flattenStyle([styles.genderCircleBtn, genderFilter !== 'Both' ? styles.genderCircleBtnActive : null])}
        onPress={() => setIsGenderModalVisible(true)}
        activeOpacity={0.8}
      >
        {genderFilter === 'Women' ? (
          <Text style={{ fontSize: 18 }}>👧</Text>
        ) : genderFilter === 'Men' ? (
          <Text style={{ fontSize: 18 }}>👦</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14 }}>👧</Text>
            <Text style={{ fontSize: 14, marginLeft: -4 }}>👦</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGenderModal = () => (
    <Modal
      visible={isGenderModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsGenderModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={() => setIsGenderModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.modalTitle}>Connect to...</Text>
                <TouchableOpacity onPress={() => setIsGenderModalVisible(false)}>
                  <X size={24} color="#A1A1AA" />
                </TouchableOpacity>
              </View>

              <View style={styles.genderOptionList}>
                {(['Women', 'Both', 'Men'] as const).map((opt) => {
                  const isActive = genderFilter === opt;
                  const isLocked = opt !== 'Both' && !isVip;
                  
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={flattenStyle([
                        styles.genderOptionBtn,
                        isActive ? styles.genderOptionBtnActive : null,
                        isLocked ? styles.disabledBtn : null
                      ])}
                      onPress={() => {
                        onGenderPill(opt);
                        setIsGenderModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 24 }}>
                          {opt === 'Women' ? '👧' : opt === 'Men' ? '👦' : '👧👦'}
                        </Text>
                        <View>
                          <Text style={flattenStyle([styles.genderOptionText, isActive ? styles.genderOptionTextActive : null])}>
                            {opt}
                          </Text>
                          {isLocked && (
                            <Text style={{ color: '#FACC15', fontSize: 11, fontWeight: '700' }}>VIP ONLY</Text>
                          )}
                        </View>
                      </View>
                      {isActive ? (
                        <Check size={22} color="#EF4444" />
                      ) : isLocked ? (
                        <Star size={18} color="#FACC15" fill="#FACC15" />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity 
                style={[styles.modalGrayBtn, { marginTop: 12 }]} 
                onPress={() => setIsGenderModalVisible(false)}
              >
                <Text style={styles.modalGrayBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  if (callState === 'idle') {
    return (
      <View style={styles.bottomBar}>
        <View style={styles.genderFilterRow}>
          {renderGenderFilter(true)}
        </View>
        {!hasSubmittedSelfie ? (
          <TouchableOpacity style={styles.selfieBtn} onPress={onTakeSelfie} activeOpacity={0.85}>
            <Text style={styles.selfieBtnText}>📸 Take Selfie to Start Chatting</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={onStart}
            activeOpacity={0.85}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.startBtnText}>
                START CHATTING
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (callState === 'waiting') {
    return (
      <View style={styles.bottomBar}>
        <View style={styles.genderFilterRow}>
          {renderGenderFilter(true)}
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelBtnText}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (callState === 'connecting' || callState === 'connected') {
    const isMaleUser = userGender?.toLowerCase() === 'male';
    const isFemaleUser = userGender?.toLowerCase() === 'female';

    // We show the button/prompt based on the user's own gender to be more robust
    // if the partner's gender hasn't been fetched yet.
    const showMessageMe = isMaleUser && callState === 'connected';
    const showFemalePrompt = isFemaleUser && callState === 'connected';

    return (
      <View style={styles.bottomBar}>
        <View style={styles.genderFilterRow}>
          {showMessageMe && (
            <TouchableOpacity style={styles.messageMeBtn} onPress={onMessageMe} activeOpacity={0.85}>
              <MessageCircle size={20} color="#000000" />
              <Text style={styles.messageMeBtnText}>MESSAGE ME</Text>
            </TouchableOpacity>
          )}

          {showFemalePrompt && (
            <View style={styles.femalePromptContainer}>
              <Text style={styles.femalePromptText}>
                Tell him to "Message You" to keep chatting and earn cash bounties! 💰💬
              </Text>
            </View>
          )}

          {/* If neither button nor prompt is shown, we need a placeholder to push gender circle to the right */}
          {!showMessageMe && !showFemalePrompt && <View style={{ flex: 1 }} />}

          {renderGenderFilter(false)}
        </View>

        {renderGenderModal()}
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