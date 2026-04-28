import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, Heart, Plus, ExternalLink, Star } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;

interface Promo {
  id: string;
  creator_id: string;
  link_url: string;
  views_count: number;
  likes_count: number;
  status: string;
  created_at: string;
  member?: {
    name: string;
    avatar_url: string | null;
  };
}

export default function PromosScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPromos = async () => {
    try {
      const { data, error } = await supabase
        .from("promos")
        .select(`
          *,
          member:members(name, avatar_url)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPromos(data as unknown as Promo[]);
    } catch (e) {
      console.warn("[Promos] Error fetching:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPromos();
  }, []);

  const handleVisit = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.warn("Couldn't load page", err)
    );
  };

  const renderItem = ({ item }: { item: Promo }) => (
    <View style={styles.promoCard}>
      {/* Placeholder for Promo Image - web app often uses a generic background or first image */}
      <View style={styles.imagePlaceholder}>
        <Star size={40} color="rgba(255,255,255,0.2)" />
        <Text style={styles.imageText}>C24 CLUB PROMO</Text>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <View style={styles.creatorInfo}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {item.member?.name?.charAt(0) || "U"}
              </Text>
            </View>
            <Text style={styles.creatorName}>
              {item.member?.name || "Member"}
            </Text>
          </View>
          <Text style={styles.timeAgo}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={styles.linkText} numberOfLines={1}>
          {item.link_url}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.statsGroup}>
            <View style={styles.stat}>
              <Eye size={16} color="#A1A1AA" />
              <Text style={styles.statValue}>{item.views_count}</Text>
            </View>
            <View style={styles.stat}>
              <Heart size={16} color="#EF4444" />
              <Text style={styles.statValue}>{item.likes_count}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.visitButton}
            onPress={() => handleVisit(item.link_url)}
          >
            <Text style={styles.visitText}>Visit</Text>
            <ExternalLink size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Promotions 🚀</Text>
          <Text style={styles.subtitle}>Discover links from the community</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#EF4444" />
          </View>
        ) : (
          <FlatList
            data={promos}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#EF4444"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Star size={48} color="#71717A" />
                <Text style={styles.emptyText}>No promotions active yet</Text>
              </View>
            }
          />
        )}

        {/* FAB for creating promo */}
        {user && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => Alert.alert("Coming Soon", "Promo creation will be available soon!")}
          >
            <Plus size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1A1A2E",
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#A1A1AA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  promoCard: {
    backgroundColor: "#1E1E38",
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    width: CARD_WIDTH,
  },
  imagePlaceholder: {
    height: 120,
    backgroundColor: "#2A2A4A",
    justifyContent: "center",
    alignItems: "center",
  },
  imageText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: 2,
  },
  cardContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  creatorInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  creatorName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  timeAgo: {
    color: "#71717A",
    fontSize: 12,
  },
  linkText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 16,
    textDecorationLine: "underline",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsGroup: {
    flexDirection: "row",
    gap: 16,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "600",
  },
  visitButton: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  visitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#71717A",
    fontSize: 16,
    marginTop: 16,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
});