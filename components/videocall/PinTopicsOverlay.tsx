import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { X, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { TopicCategory, Topic } from '@/hooks/usePinTopics';

interface Props {
  visible: boolean;
  onClose: () => void;
  categories: TopicCategory[];
  topics: Topic[];
  pinnedTopicIds: Set<string>;
  loading: boolean;
  onOpen: () => void; // called when overlay becomes visible (to lazy-load data)
  onTogglePin: (topicId: string) => void;
}

export function PinTopicsOverlay({
  visible,
  onClose,
  categories,
  topics,
  pinnedTopicIds,
  loading,
  onOpen,
  onTogglePin,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory | null>(null);

  // Reset drill-down when overlay opens, and trigger data load
  useEffect(() => {
    if (visible) {
      setSelectedCategory(null);
      onOpen();
    }
  }, [visible]);

  const topicsForCategory = selectedCategory
    ? topics.filter((t) => t.category_id === selectedCategory.id)
    : [];

  // Does a category have any pinned topics?
  const categoryHasPinned = (catId: string) =>
    topics.some((t) => t.category_id === catId && pinnedTopicIds.has(t.id));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          {selectedCategory ? (
            <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedCategory(null)}>
              <ChevronLeft size={22} color="#FFFFFF" />
              <Text style={styles.backBtnText}>Categories</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.title}>📌 Pin Topics</Text>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {selectedCategory && (
          <Text style={styles.categoryLabel}>{selectedCategory.name}</Text>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#EF4444" />
            <Text style={styles.loadingText}>Loading topics...</Text>
          </View>
        ) : selectedCategory ? (
          /* ── Topic list ─────────────────────────────────────── */
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {topicsForCategory.length === 0 ? (
              <Text style={styles.emptyText}>No topics in this category.</Text>
            ) : (
              topicsForCategory.map((topic) => {
                const isPinned = pinnedTopicIds.has(topic.id);
                return (
                  <TouchableOpacity
                    key={topic.id}
                    style={[styles.row, isPinned ? styles.rowPinned : null]}
                    onPress={() => onTogglePin(topic.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.rowText, isPinned ? styles.rowTextPinned : null]}>
                      {isPinned ? '📌 ' : ''}{topic.name}
                    </Text>
                    <View style={[styles.pin, isPinned ? styles.pinActive : null]}>
                      <Text style={styles.pinText}>{isPinned ? 'Unpin' : 'Pin'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        ) : (
          /* ── Category list ──────────────────────────────────── */
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {categories.length === 0 ? (
              <Text style={styles.emptyText}>No categories available.</Text>
            ) : (
              categories.map((cat) => {
                const hasPinned = categoryHasPinned(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.row}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.rowText}>
                      {hasPinned ? '📌 ' : ''}{cat.name}
                    </Text>
                    <ChevronRight size={18} color="#71717A" />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        {/* Pinned count footer */}
        {pinnedTopicIds.size > 0 && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {pinnedTopicIds.size} topic{pinnedTopicIds.size !== 1 ? 's' : ''} pinned — visible to your match
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0c0c14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4A',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap: 4, // removed unsupported property
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4, // Add marginLeft since backBtn is row-direction
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E38',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  rowPinned: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rowText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  rowTextPinned: {
    color: '#EF4444',
    fontWeight: '800',
  },
  pin: {
    backgroundColor: '#2A2A4A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pinActive: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  pinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // gap: 16, // removed unsupported property
  },
  loadingText: {
    color: '#A1A1AA',
    fontSize: 14,
    marginTop: 16,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
    alignItems: 'center',
  },
  footerText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
  },
});