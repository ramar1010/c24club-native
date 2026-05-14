import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2, Share2, RefreshCw } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { readDebugLogs, clearDebugLogs, type DebugEntry } from '@/lib/debug-log';

const TAG_COLORS: Record<string, string> = {
  SESSION:     '#FACC15',
  CallContext: '#60A5FA',
  ChatScreen:  '#34D399',
  VideoCall:   '#F87171',
};

function tagColor(tag: string): string {
  return TAG_COLORS[tag] ?? '#A1A1AA';
}

export default function DebugLogsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<DebugEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const entries = await readDebugLogs();
    setLogs(entries.reverse()); // newest first
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onClear = () => {
    Alert.alert('Clear Logs', 'Delete all debug logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearDebugLogs();
          setLogs([]);
        },
      },
    ]);
  };

  const onShare = async () => {
    const text = logs
      .slice()
      .reverse()
      .map(e => `[${e.t.slice(11, 23)}] [${e.tag}] ${e.msg}${e.data !== undefined ? '\n  ' + JSON.stringify(e.data) : ''}`)
      .join('\n');
    await Share.share({ message: text, title: 'C24 Debug Logs' });
  };

  const formatTime = (iso: string) => iso.slice(11, 23); // HH:MM:SS.mmm

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Debug Logs</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onShare} style={styles.iconBtn}>
            <Share2 color="#60A5FA" size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClear} style={styles.iconBtn}>
            <Trash2 color="#F87171" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.hint}>
        {logs.length} entries · newest first · tap Share to send to dev
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EF4444" />}
      >
        {logs.length === 0 && (
          <Text style={styles.empty}>No logs yet. Trigger a direct call then come back here.</Text>
        )}
        {logs.map((entry, i) => (
          <View
            key={i}
            style={[
              styles.entry,
              entry.tag === 'SESSION' && styles.sessionEntry,
            ]}
          >
            <View style={styles.entryHeader}>
              <Text style={[styles.tagBadge, { color: tagColor(entry.tag) }]}>
                {entry.tag}
              </Text>
              <Text style={styles.time}>{formatTime(entry.t)}</Text>
            </View>
            <Text style={styles.msg}>{entry.msg}</Text>
            {entry.data !== undefined && (
              <Text style={styles.data}>{JSON.stringify(entry.data, null, 2)}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0F0F1A' },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:       { marginRight: 12 },
  title:         { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconBtn:       { padding: 4 },
  hint:          { color: '#52525B', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 40 },
  empty:         { color: '#52525B', textAlign: 'center', marginTop: 40, fontSize: 14 },
  entry: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#27272A',
  },
  sessionEntry: {
    borderLeftColor: '#FACC15',
    backgroundColor: '#1C1A0F',
  },
  entryHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  tagBadge:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  time:          { fontSize: 11, color: '#52525B' },
  msg:           { color: '#E4E4E7', fontSize: 13 },
  data:          { color: '#71717A', fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
});