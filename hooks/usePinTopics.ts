import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface TopicCategory {
  id: string;
  name: string;
}

export interface Topic {
  id: string;
  name: string;
  category_id: string;
}

export function usePinTopics() {
  const { profile } = useAuth();
  const userId = profile?.id;

  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [pinnedTopicIds, setPinnedTopicIds] = useState<Set<string>>(new Set());
  const [pinnedTopicNames, setPinnedTopicNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Load categories + topics + user's pinned topics ──────────────────────
  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [catRes, topicRes, pinnedRes] = await Promise.all([
        supabase
          .from('topic_categories')
          .select('id, name')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('topics')
          .select('id, name, category_id')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('pinned_topics')
          .select('topic_id')
          .eq('user_id', userId),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (topicRes.data) setTopics(topicRes.data);

      if (pinnedRes.data) {
        const ids = new Set(pinnedRes.data.map((r: { topic_id: string }) => r.topic_id));
        setPinnedTopicIds(ids);
        // Resolve names from already-loaded topics
        if (topicRes.data) {
          const names = topicRes.data
            .filter((t: Topic) => ids.has(t.id))
            .map((t: Topic) => t.name);
          setPinnedTopicNames(names);
        }
      }
    } catch (err) {
      console.warn('[usePinTopics] loadAll error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ── Fetch only the user's pinned topic names (lightweight, call on mount) ─
  const loadPinnedNames = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('pinned_topics')
        .select('topic_id, topics(name)')
        .eq('user_id', userId);

      if (data) {
        const names = data
          .map((r: any) => r.topics?.name)
          .filter(Boolean) as string[];
        setPinnedTopicNames(names);
        const ids = new Set(data.map((r: any) => r.topic_id as string));
        setPinnedTopicIds(ids);
      }
    } catch (err) {
      console.warn('[usePinTopics] loadPinnedNames error:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadPinnedNames();
  }, [loadPinnedNames]);

  // ── Pin a topic ───────────────────────────────────────────────────────────
  const pinTopic = useCallback(async (topicId: string) => {
    if (!userId) return;
    // Optimistic update
    setPinnedTopicIds((prev) => new Set([...prev, topicId]));
    const topicName = topics.find((t) => t.id === topicId)?.name;
    if (topicName) {
      setPinnedTopicNames((prev) => [...prev, topicName]);
    }

    const { error } = await supabase
      .from('pinned_topics')
      .insert({ user_id: userId, topic_id: topicId });

    if (error) {
      console.warn('[usePinTopics] pin error:', error.message);
      // Rollback
      setPinnedTopicIds((prev) => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
      if (topicName) {
        setPinnedTopicNames((prev) => prev.filter((n) => n !== topicName));
      }
    }
  }, [userId, topics]);

  // ── Unpin a topic ─────────────────────────────────────────────────────────
  const unpinTopic = useCallback(async (topicId: string) => {
    if (!userId) return;
    const topicName = topics.find((t) => t.id === topicId)?.name;

    // Optimistic update
    setPinnedTopicIds((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
    if (topicName) {
      setPinnedTopicNames((prev) => prev.filter((n) => n !== topicName));
    }

    const { error } = await supabase
      .from('pinned_topics')
      .delete()
      .eq('user_id', userId)
      .eq('topic_id', topicId);

    if (error) {
      console.warn('[usePinTopics] unpin error:', error.message);
      // Rollback
      setPinnedTopicIds((prev) => new Set([...prev, topicId]));
      if (topicName) {
        setPinnedTopicNames((prev) => [...prev, topicName]);
      }
    }
  }, [userId, topics]);

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const togglePin = useCallback(async (topicId: string) => {
    if (pinnedTopicIds.has(topicId)) {
      await unpinTopic(topicId);
    } else {
      await pinTopic(topicId);
    }
  }, [pinnedTopicIds, pinTopic, unpinTopic]);

  // ── Fetch partner's pinned topic names ────────────────────────────────────
  const fetchPartnerTopics = useCallback(async (partnerId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('pinned_topics')
        .select('topics(name)')
        .eq('user_id', partnerId);

      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.topics?.name)
        .filter(Boolean) as string[];
    } catch (err) {
      console.warn('[usePinTopics] fetchPartnerTopics error:', err);
      return [];
    }
  }, []);

  return {
    categories,
    topics,
    pinnedTopicIds,
    pinnedTopicNames,
    loading,
    loadAll,
    togglePin,
    fetchPartnerTopics,
  };
}