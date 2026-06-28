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
import { MessageCircle, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Text } from '@/components/ui/text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 3;
const CARD_HEIGHT = CARD_WIDTH * (4 / 3);

interface Member {
  id: string;
  name: string;
  image_url: string;
  country: string | null;
}

interface Props {
  userId: string;
  userGender: string; // 'Male' | 'Female'
  onMembersLoaded?: (count: number) => void;
}

export function DiscoverTeaser({ userId, userGender, onMembersLoaded }: Props) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const scrollIndex = useRef(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch opposite-gender members
  useEffect(() => {
    let cancelled = false;
    const oppositeGender =
      userGender.toLowerCase() === 'male' ? 'Female' : 'Male';

    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('members')
          .select('id, name, image_url, country')
          .eq('is_discoverable', true)
          .eq('image_status', 'approved')
          .eq('gender', oppositeGender)
          .neq('id', userId)
          .order('last_active_at', { ascending: false })
          .limit(8);

        if (!cancelled) {
          const filtered = (data ?? []).filter((m: Member) => !!m.image_url);
          setMembers(filtered);
          onMembersLoaded?.(filtered.length);
        }
      } catch (_) {
        if (!cancelled) onMembersLoaded?.(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [userId, userGender]);

  // Auto-scroll every 3 seconds
  useEffect(() => {
    if (members.length === 0) return;
    const interval = setInterval(() => {
      if (!scrollRef.current) return;
      scrollIndex.current = (scrollIndex.current + 1) % members.length;
      scrollRef.current.scrollTo({
        x: scrollIndex.current * (CARD_WIDTH + 8),
        animated: true,
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [members]);

  const openDM = (memberId: string) => {
    router.push(`/messages/${memberId}` as any);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FACC15" />
      </View>
    );
  }

  if (members.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Sparkles size={16} color="#FACC15" fill="#FACC15" />
        <Text style={styles.headerText}> People waiting to chat</Text>
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
        {members.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => openDM(member.id)}
          >
            <Image
              source={{ uri: member.image_url }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.82)']}
              style={styles.cardGradient}
            >
              <Text style={styles.cardName} numberOfLines={1}>
                {member.name}
              </Text>
              {member.country ? (
                <Text style={styles.cardCountry} numberOfLines={1}>
                  {member.country}
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.dmBtn}
                onPress={() => openDM(member.id)}
                activeOpacity={0.8}
              >
                <MessageCircle size={12} color="#FFFFFF" />
                <Text style={styles.dmBtnText}> DM</Text>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={() => router.push('/(tabs)/discover')}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaBtnText}>Open Discover →</Text>
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
    color: '#FACC15',
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
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingTop: 24,
  },
  cardName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 1,
  },
  cardCountry: {
    color: '#D1D5DB',
    fontSize: 10,
    marginBottom: 6,
  },
  dmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EC4899',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  dmBtnText: {
    color: '#FFFFFF',
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