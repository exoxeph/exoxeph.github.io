import { beforeEach, describe, expect, it, vi } from 'vitest';

const values = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
});
beforeEach(() => {
  values.clear();
  vi.resetModules();
});
describe('bench log', () => {
  it('adds, publishes and clears', async () => {
    const log = await import('../../src/lib/bench/engine');
    const seen: number[] = [];
    const off = log.subscribe((entries) => seen.push(entries.length));
    log.add({ title: 'C requests 2 seats', detail: 'refused, 3 of 3', provenance: 'executed' });
    log.clear();
    off();
    expect(seen).toEqual([0, 1, 0]);
  });
  it('persists a round trip and caps entries at forty', async () => {
    const log = await import('../../src/lib/bench/engine');
    for (let i = 0; i < 42; i++)
      log.add({ title: String(i), detail: 'accepted, 1 of 3', provenance: 'executed' });
    const stored = JSON.parse(values.get('bench-log-v1')!);
    expect(stored.entries).toHaveLength(40);
    vi.resetModules();
    const loaded = await import('../../src/lib/bench/engine');
    let last = 0;
    loaded.subscribe((entries) => (last = entries.length))();
    expect(last).toBe(40);
  });
  it('ignores corrupt storage', async () => {
    values.set('bench-log-v1', '{broken');
    const log = await import('../../src/lib/bench/engine');
    let count = -1;
    log.subscribe((entries) => (count = entries.length))();
    expect(count).toBe(0);
  });
});
