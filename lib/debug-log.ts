/**
 * debug-log.ts
 *
 * Persistent crash-safe logger. Writes to AsyncStorage so logs survive
 * app crashes and can be read after restart.
 *
 * Usage:
 *   dlog('tag', 'message', { optional: 'data' });
 *   const logs = await readDebugLogs();
 *   await clearDebugLogs();
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_KEY = 'c24_debug_logs';
const MAX_ENTRIES = 200;

export interface DebugEntry {
  t: string;   // timestamp ISO
  tag: string;
  msg: string;
  data?: any;
}

/** Write a log entry. Fire-and-forget — never throws. */
export async function dlog(tag: string, msg: string, data?: any): Promise<void> {
  try {
    const entry: DebugEntry = {
      t: new Date().toISOString(),
      tag,
      msg,
      data: data !== undefined ? safeSerialize(data) : undefined,
    };

    // console.log for Xcode/Metro visibility too
    console.log(`[${tag}] ${msg}`, data !== undefined ? data : '');

    const raw = await AsyncStorage.getItem(LOG_KEY);
    const entries: DebugEntry[] = raw ? JSON.parse(raw) : [];
    entries.push(entry);

    // Keep only the last MAX_ENTRIES to avoid storage bloat
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(entries));
  } catch (_) {
    // Never let the logger crash the app
  }
}

/** Read all stored log entries. */
export async function readDebugLogs(): Promise<DebugEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Clear all stored logs. */
export async function clearDebugLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOG_KEY);
  } catch (_) {}
}

/** Mark the start of a new session so logs are easy to read. */
export async function markSession(label: string): Promise<void> {
  await dlog('SESSION', `━━━━━━ ${label} ━━━━━━`);
}

function safeSerialize(val: any): any {
  try {
    if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack };
    JSON.stringify(val); // test serializability
    return val;
  } catch {
    return String(val);
  }
}