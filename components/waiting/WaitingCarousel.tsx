import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { DiscoverTeaser } from './DiscoverTeaser';
import { RewardsTeaser } from './RewardsTeaser';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = (SCREEN_WIDTH - 48) / 3;
const CARD_H = CARD_W * (4 / 3);
const PANEL_HEIGHT = 30 + CARD_H + 44 + 40;

interface Props {
  userId: string;
  userGender: string;
}

export function WaitingCarousel({ userId, userGender }: Props) {
  const [showRewards, setShowRewards] = useState(false);

  // Track counts in refs so the interval always reads fresh values without restarting
  const discoverCountRef = useRef<number | null>(null);
  const rewardsCountRef = useRef<number | null>(null);
  const showRewardsRef = useRef(false);

  const discoverOpacity = useRef(new Animated.Value(1)).current;
  const rewardsOpacity = useRef(new Animated.Value(0)).current;

  const switchTo = useCallback((toRewards: boolean) => {
    showRewardsRef.current = toRewards;
    setShowRewards(toRewards);

    Animated.parallel([
      Animated.timing(toRewards ? discoverOpacity : rewardsOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: false,
      }),
      Animated.timing(toRewards ? rewardsOpacity : discoverOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
      }),
    ]).start();
  }, [discoverOpacity, rewardsOpacity]);

  // Set up a single long-lived interval — reads refs so it never needs to restart
  useEffect(() => {
    const interval = setInterval(() => {
      const dc = discoverCountRef.current;
      const rc = rewardsCountRef.current;
      const canDiscover = dc === null || dc > 0;
      const canRewards = rc === null || rc > 0;
      const current = showRewardsRef.current;

      if (!canDiscover && !canRewards) return;

      if (!canDiscover) {
        // Only rewards available — make sure we're on rewards
        if (!current) switchTo(true);
        return;
      }
      if (!canRewards) {
        // Only discover available — make sure we're on discover
        if (current) switchTo(false);
        return;
      }

      // Both available — toggle
      switchTo(!current);
    }, 5000);

    return () => clearInterval(interval);
  }, [switchTo]); // stable dep — never restarts

  const handleDiscoverLoaded = useCallback((count: number) => {
    discoverCountRef.current = count;
    // If no discover members, immediately jump to rewards
    if (count === 0) {
      switchTo(true);
    }
  }, [switchTo]);

  const handleRewardsLoaded = useCallback((count: number) => {
    rewardsCountRef.current = count;
  }, []);

  return (
    <View style={styles.container}>
      {/* Discover Teaser */}
      <Animated.View
        style={[StyleSheet.flatten(styles.panel), { opacity: discoverOpacity }]}
        pointerEvents={showRewards ? 'none' : 'auto'}
      >
        <DiscoverTeaser
          userId={userId}
          userGender={userGender}
          onMembersLoaded={handleDiscoverLoaded}
        />
      </Animated.View>

      {/* Rewards Teaser */}
      <Animated.View
        style={[StyleSheet.flatten(styles.panel), { opacity: rewardsOpacity }]}
        pointerEvents={showRewards ? 'auto' : 'none'}
      >
        <RewardsTeaser
          userGender={userGender}
          onRewardsLoaded={handleRewardsLoaded}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: PANEL_HEIGHT,
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});