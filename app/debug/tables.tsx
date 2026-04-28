import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function DebugTables() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log('[DEBUG]', msg);
    setLogs((prev) => [...prev, msg]);
  };

  useEffect(() => {
    const check = async () => {
      addLog('Checking tables...');
      
      const { data, error } = await supabase
        .from('direct_call_invites')
        .select('*')
        .limit(1);

      if (error) {
        addLog('Error fetching direct_call_invites: ' + error.message);
        if (error.message.includes('relation "public.direct_call_invites" does not exist')) {
          addLog('Table "direct_call_invites" is MISSING from your database.');
        }
      } else {
        addLog('Table "direct_call_invites" exists! Found ' + (data?.length || 0) + ' rows.');
      }

      const { data: signals, error: signalError } = await supabase
        .from('room_signals')
        .select('*')
        .limit(1);

      if (signalError) {
        addLog('Error fetching room_signals: ' + signalError.message);
      } else {
        addLog('Table "room_signals" exists! Found ' + (signals?.length || 0) + ' rows.');
      }

      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .limit(1);

      if (convError) {
        addLog('Error fetching conversations: ' + convError.message);
      } else {
        addLog('Table "conversations" exists!');
      }

      const { data: messages, error: msgError } = await supabase
        .from('dm_messages')
        .select('*')
        .limit(1);

      if (msgError) {
        addLog('Error fetching dm_messages: ' + msgError.message);
      } else {
        addLog('Table "dm_messages" exists!');
      }
    };

    check();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Supabase Table Debug</Text>
      {logs.map((log, i) => (
        <Text key={i} style={styles.log}>
          {log}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E', padding: 20 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 20 },
  log: { color: '#A1A1AA', fontSize: 14, marginBottom: 8, fontFamily: 'System' },
});