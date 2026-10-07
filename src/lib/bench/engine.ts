export type Provenance = 'executed' | 'replay' | 'model';
export type LogEntry = {
  n: number;
  title: string;
  detail: string;
  provenance: Provenance;
  limit?: boolean;
  channel?: 'pool' | 'email' | 'rag' | 'speech' | 'research';
};
const key = 'bench-log-v1';
const listeners = new Set<(entries: LogEntry[]) => void>();
let entries: LogEntry[] = [];

try {
  const value = JSON.parse(sessionStorage.getItem(key) || 'null');
  if (value?.v === 1 && Array.isArray(value.entries)) {
    entries = value.entries.filter((entry: unknown) => entry && typeof entry === 'object').slice(-40);
  }
} catch {
  // Private browsing and malformed storage leave the log in memory.
}

function publish() {
  try {
    sessionStorage.setItem(key, JSON.stringify({ v: 1, entries }));
  } catch {
    /* in memory */
  }
  listeners.forEach((fn) => fn([...entries]));
}

export function add(entry: Omit<LogEntry, 'n'>): LogEntry {
  const item = { ...entry, n: (entries.at(-1)?.n ?? 0) + 1 };
  entries = [...entries, item].slice(-40);
  publish();
  return item;
}
export function clear() {
  entries = [];
  publish();
}
export function subscribe(fn: (entries: LogEntry[]) => void) {
  listeners.add(fn);
  fn([...entries]);
  return () => listeners.delete(fn);
}
