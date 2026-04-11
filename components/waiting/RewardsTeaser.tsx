import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text } from '@/components/ui/text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 3;
const CARD_HEIGHT = CARD_WIDTH * (4 / 3);

interface Reward {
  id: string;
  title: string;
  image_url: string | null;
  rarity: string | null;
  minutes_cost: number;
  type: string | null;
  sub_type: string | null;
  target_gender: string | null;
}

interface Props {
  userGender: string;
  onRewardsLoaded?: (count: number) => void;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RewardsTeaser({ userGender, onRewardsLoaded }: Props) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const scrollIndex = useRef(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('rewards')
          .select('id, title, image_url, rarity, minutes_cost, type, sub_type, target_gender')
          .eq('visible', true)
          .order('minutes_cost', { ascending: true })
          .limit(20);

        if (!cancelled) {
          const genderLower = userGender.toLowerCase();
          const filtered = (data ?? []).filter((r: Reward) => {
            const isGiftCard =
              r.type === 'giftcard' || r.sub_type === 'giftcard';
            if (isGiftCard) return true;
            if (!r.target_gender) return true;
            return r.target_gender.toLowerCase() === genderLower;
          });
          const shuffled = shuffleArray(filtered).slice(0, 12);
          setRewards(shuffled);
          onRewardsLoaded?.(shuffled.length);
        }
      } catch (_) {
        if (!cancelled) onRewardsLoaded?.(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [userGender]);

  // Auto-scroll every 3 seconds
  useEffect(() => {
    if (rewards.length === 0) return;
    const interval = setInterval(() => {
      if (!scrollRef.current) return;
      scrollIndex.current = (scrollIndex.current + 1) % rewards.length;
      scrollRef.current.scrollTo({
        x: scrollIndex.current * (CARD_WIDTH + 8),
        animated: true,
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [rewards]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#22C55E" />
      </View>
    );
  }

  if (rewards.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Gift size={16} color="#22C55E" />
        <Text style={styles.headerText}> Rewards you can redeem</Text>
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {rewards.map((reward) => (
          <TouchableOpacity
            key={reward.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/rewards' as any)}
          >
            {reward.image_url ? (
              <Image
                source={{ uri: reward.image_url }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.cardPlaceholder}>
                <Gift size={28} color="#4B5563" />
              </View>
            )}

            {/* Legendary badge */}
            {reward.rarity === 'legendary' && (
              <View style={styles.legendaryBadge}>
                <Star size={10} color="#FACC15" fill="#FACC15" />
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={styles.cardGradient}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>
                {reward.title}
              </Text>
              <Text style={styles.cardCost}>
                {reward.minutes_cost} min
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={() => router.push('/(tabs)/rewards' as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaBtnText}>Browse Store →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    color: '#22C55E',
    fontWeight: '700',
    fontSize: 14,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E1E3A',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cardPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  legendaryBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    padding: 4,
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingTop: 20,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 3,
  },
  cardCost: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '700',
  },
  ctaBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: SCREEN_WIDTH - 48,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
});