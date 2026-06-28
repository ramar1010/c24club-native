import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import styles from './chat-styles';

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

interface ChatTopBarProps {
  callState: string;
  isFrozen: boolean;
  elapsedSeconds: number;
  totalMinutes: number;
  onBack: () => void;
  onFrozenPress: () => void;
}

export function ChatTopBar({
  callState,
  isFrozen,
  elapsedSeconds,
  totalMinutes,
  onBack,
  onFrozenPress,
}: ChatTopBarProps) {
  return (
    <View style={styles.topBar}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ChevronLeft size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Center — frozen button or session timer */}
      <View style={styles.topBarCenter}>
        {isFrozen ? (
          <TouchableOpacity style={styles.frozenBtn} onPress={onFrozenPress} activeOpacity={0.8}>
            <Text style={styles.frozenBtnText}>🥶 Unfreeze Minutes</Text>
          </TouchableOpacity>
        ) : callState === 'connected' ? (
          <View style={styles.timerRow}>
            <View style={styles.greenDot} />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        ) : callState === 'waiting' ? (
          <Text style={styles.searchingText}>Searching...</Text>
        ) : null}
      </View>

      {/* Minutes — top right */}
      <View style={styles.minutesRight}>
        <Text style={styles.minutesText}>{totalMinutes} mins ⏱️</Text>
      </View>
    </View>
  );
}