import React, { useEffect, useRef, useCallback } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Confetti Particle Config ─────────────────────────────────────────────────

interface ParticleConfig {
  id: number;
  color: string;
  startX: number;
  size: number;
  isCircle: boolean;
  duration: number;
  delay: number;
  endX: number;
  rotation: number;
}

const CONFETTI_COLORS = [
  "#FACC15", // Gold
  "#EF4444", // Red
  "#22C55E", // Green
  "#3B82F6", // Blue
  "#A855F7", // Purple
  "#F97316", // Orange
  "#EC4899", // Pink
];

function generateParticles(count: number): ParticleConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    startX: Math.random() * SCREEN_WIDTH,
    size: 8 + Math.random() * 8,
    isCircle: i % 3 === 0,
    duration: 1800 + Math.random() * 1000,
    delay: Math.random() * 800,
    endX: (Math.random() - 0.5) * 120,
    rotation: Math.random() * 720 - 360,
  }));
}

const PARTICLES = generateParticles(14);

// ─── Single Confetti Particle ─────────────────────────────────────────────────

interface ConfettiParticleProps {
  config: ParticleConfig;
  trigger: boolean;
}

const ConfettiParticle = React.memo(function ConfettiParticle({
  config,
  trigger,
}: ConfettiParticleProps) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!trigger) {
      translateY.setValue(-20);
      translateX.setValue(0);
      opacity.setValue(0);
      rotate.setValue(0);
      return;
    }

    const animation = Animated.sequence([
      Animated.delay(config.delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + 40,
          duration: config.duration,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: config.endX,
          duration: config.duration,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: config.rotation,
          duration: config.duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.delay(config.duration - 500),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [trigger]);

  const rotateStr = rotate.interpolate({
    inputRange: [-720, 720],
    outputRange: ["-720deg", "720deg"],
  });

  return (
    <Animated.View
      style={[
        config.isCircle ? styles.particleCircle : styles.particleSquare,
        {
          left: config.startX,
          width: config.size,
          height: config.size,
          borderRadius: config.isCircle ? config.size / 2 : 2,
          backgroundColor: config.color,
          opacity,
          transform: [
            { translateY },
            { translateX },
            { rotate: rotateStr },
          ],
        },
      ]}
    />
  );
});

// ─── Main GiftCelebration Component ──────────────────────────────────────────

export interface GiftCelebrationProps {
  visible: boolean;
  recipientName: string;
  onDismiss: () => void;
}

export function GiftCelebration({
  visible,
  recipientName,
  onDismiss,
}: GiftCelebrationProps) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const emojiTranslateY = useRef(new Animated.Value(40)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const dismissTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAnimations = useCallback(() => {
    overlayOpacity.setValue(0);
    emojiScale.setValue(0);
    emojiTranslateY.setValue(40);
    textOpacity.setValue(0);
  }, []);

  useEffect(() => {
    if (dismissTimeout.current) {
      clearTimeout(dismissTimeout.current);
      dismissTimeout.current = null;
    }

    if (!visible) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => resetAnimations());
      return;
    }

    resetAnimations();

    // Fade in overlay
    const enterAnimation = Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Bounce the gift emoji in
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(emojiScale, {
          toValue: 1,
          tension: 80,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(emojiTranslateY, {
          toValue: 0,
          tension: 80,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      // Fade in text after emoji settles
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]);

    enterAnimation.start();

    // Auto-dismiss after 2.5s
    dismissTimeout.current = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        resetAnimations();
        onDismiss();
      });
    }, 2500);

    return () => {
      if (dismissTimeout.current) {
        clearTimeout(dismissTimeout.current);
        dismissTimeout.current = null;
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      {/* Confetti particles */}
      {PARTICLES.map((p) => (
        <ConfettiParticle key={p.id} config={p} trigger={visible} />
      ))}

      {/* Center content */}
      <View style={styles.centerContent} pointerEvents="none">
        <Animated.Text
          style={[
            styles.giftEmoji,
            {
              transform: [
                { scale: emojiScale },
                { translateY: emojiTranslateY },
              ],
            },
          ]}
        >
          🎁
        </Animated.Text>

        <Animated.View style={{ opacity: textOpacity }}>
          <Text style={styles.titleText}>Gift Sent! 🎉</Text>
          <Text style={styles.subtitleText}>
            You sent {recipientName} a cash gift!
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  particleSquare: {
    position: "absolute",
    top: 0,
  },
  particleCircle: {
    position: "absolute",
    top: 0,
  },
  centerContent: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  giftEmoji: {
    fontSize: 80,
    marginBottom: 24,
    textAlign: "center",
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitleText: {
    color: "#A1A1AA",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },
});