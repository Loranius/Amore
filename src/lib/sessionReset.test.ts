import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from './queryClient';
import { DEVICE_PREFERENCE_KEYS, isCoupleScopedKey, resetPortalSession } from './sessionReset';
import { GAME_PATH, canPlayGame, visibleNavItems } from '@/features/game/gameAccess';

// ============================================================
// ADR-0236: після входу іншою парою на тому самому пристрої портал не
// показує жодних даних попередньої — ні з кешу запитів, ні зі сховища.
// Регресія скріну власника: чужі дні, дата, плани й «353 нові миті».
// ============================================================

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

afterEach(() => vi.unstubAllGlobals());

describe('скидання сесії', () => {
  it('ключі даних пари — геть; вибір пристрою лишається', () => {
    for (const key of ['amore:startDate', 'amore:home-artifact', 'amore:crystalSeed', 'amore:evolutionSeenEventIds:crystal',
      'amore:portal-evolution:3:1', 'portal_session_user_id', 'amore:whereto:kyiv']) {
      expect(isCoupleScopedKey(key), key).toBe(true);
    }
    for (const key of DEVICE_PREFERENCE_KEYS) expect(isCoupleScopedKey(key), key).toBe(false);
    expect(isCoupleScopedKey('sb-yicalgoqegluzuagxssk-auth-token')).toBe(false);
  });

  it('стирає і кеш запитів, і сховище', () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    local.setItem('amore:startDate', '2022-12-26');
    local.setItem('amore:theme', 'dark');
    session.setItem('amore:wishlist-storage-cleanup:v1', 'done');
    vi.stubGlobal('window', { localStorage: local, sessionStorage: session });
    queryClient.setQueryData(['settings', 'relationship_start_date'], '2022-12-26');

    resetPortalSession();

    expect(queryClient.getQueryData(['settings', 'relationship_start_date'])).toBeUndefined();
    expect(local.getItem('amore:startDate')).toBeNull();
    expect(local.getItem('amore:theme')).toBe('dark');
    expect(session.length).toBe(0);
  });
});

describe('гра — лише для пари 1', () => {
  const items = [{ to: '/memories' }, { to: GAME_PATH }, { to: '/sizes' }];
  it('пара 1 бачить гру; інша пара й невідома — ні', () => {
    expect(canPlayGame(1)).toBe(true);
    expect(visibleNavItems(items, 1).map((i) => i.to)).toContain(GAME_PATH);
    for (const other of [10, 2, null]) {
      expect(visibleNavItems(items, other).map((i) => i.to)).toEqual(['/memories', '/sizes']);
    }
  });
});
