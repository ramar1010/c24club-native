import React from 'react';
import { View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui/text';
import styles from './chat-styles';

interface VoiceModeAvatarProps {
  size?: number;
  label?: boolean;
  gender?: string | null;
}

export function VoiceModeAvatar({ size = 80, label = true, gender }: VoiceModeAvatarProps) {
  const emoji = gender?.toLowerCase() === 'male' ? '👦' : '👩';
  return (
    <View style={{ alignItems: 'center' }}>
      <LinearGradient
        colors={['#7C3AED', '#4F46E5']}
        style={[styles.voiceAvatarCircle, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text
          style={{
            fontSize: size * 0.45,
            lineHeight: Platform.OS === 'ios' ? size * 0.7 : undefined,
            textAlign: 'center',
            includeFontPadding: false,
            color: '#FFFFFF',
          }}
        >
          {emoji}
        </Text>
      </LinearGradient>
      {label && <Text style={styles.voiceModeLabel}>Voice</Text>}
    </View>
  );
}