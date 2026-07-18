// ============================================================
// useSwipeDeck — колода свайпу (порт swipe.js даних/стану)
// ------------------------------------------------------------
// Тягне популярне з TMDB, фільтрує вже свайпнуті картки, дозавантажує
// на льоту. Голос: upsert у swipe_votes + авто-додавання в media_items
// (крім 'down' = пропустити). Логіка напрямів збережена:
//   up=done · right=watching · left=want · down=skip.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { tmdbDiscover } from '@/lib/tmdb';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { SwipeCard, SwipeType, SwipeDirection, MediaStatus } from '@/types';

const STATUS_BY_DIR: Record<Exclude<SwipeDirection, 'down'>, MediaStatus> = {
  up: 'done',
  right: 'watching',
  left: 'want',
};

export function useSwipeDeck(type: SwipeType, enabled: boolean) {
  const me = useCurrentUser();
  const client = useQueryClient();

  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  // Рефи для стану, що не має тригерити ре-рендер.
  const pageRef = useRef(1);
  const swipedIds = useRef<Set<number>>(new Set());
  const refilling = useRef(false);

  const fetchSwipedIds = useCallback(async () => {
    const { data } = await supabase.from('swipe_votes').select('tmdb_id').eq('user_id', me.id);
    return new Set((data ?? []).map((r) => r.tmdb_id));
  }, [me.id]);

  const initStack = useCallback(async () => {
    setLoading(true);
    setExhausted(false);
    pageRef.current = Math.floor(Math.random() * 50) + 1;
    swipedIds.current = await fetchSwipedIds();

    const collected: SwipeCard[] = [];
    let attempts = 0;
    while (collected.length < 15 && attempts < 12) {
      attempts++;
      const batch = await tmdbDiscover(type, pageRef.current);
      pageRef.current++;
      if (!batch.length) {
        pageRef.current = Math.floor(Math.random() * 100) + 1;
        continue;
      }
      collected.push(...batch.filter((c) => !swipedIds.current.has(c.tmdb_id)));
    }
    setCards(collected);
    setExhausted(collected.length === 0);
    setLoading(false);
  }, [type, fetchSwipedIds]);

  // (Пере)ініціалізація при відкритті панелі / зміні типу.
  useEffect(() => {
    if (enabled) void initStack();
  }, [enabled, initStack]);

  // Дозавантаження, коли лишається мало карток (без паралельних запитів).
  const maybeRefill = useCallback(async () => {
    if (refilling.current || cards.length > 5) return;
    refilling.current = true;
    try {
      const more = await tmdbDiscover(type, pageRef.current);
      pageRef.current++;
      const fresh = more.filter((c) => !swipedIds.current.has(c.tmdb_id));
      if (fresh.length) setCards((prev) => [...prev, ...fresh]);
    } finally {
      refilling.current = false;
    }
  }, [cards.length, type]);

  const saveVote = useCallback(
    async (card: SwipeCard, direction: SwipeDirection) => {
      await supabase.from('swipe_votes').upsert(
        {
          user_id: me.id,
          tmdb_id: card.tmdb_id,
          title: card.title,
          poster_path: card.poster_path,
          direction,
        },
        { onConflict: 'user_id,tmdb_id' },
      );
      if (direction === 'down') return;

      const mediaType = type === 'movie' ? 'movie' : 'series';
      const status = STATUS_BY_DIR[direction];

      // Додаємо в media_items лише якщо ще нема такого за назвою.
      const { data: existing } = await supabase
        .from('media_items')
        .select('id')
        .eq('type', mediaType)
        .eq('title', card.title)
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from('media_items').insert({
          type: mediaType,
          title: card.title,
          poster_url: card.poster_path,
          status,
          created_by: me.id,
        });
        void client.invalidateQueries({ queryKey: qk.media(mediaType) });
      }
    },
    [me.id, type, client],
  );

  /** Викидає верхню картку зі стека, зберігає голос і дозавантажує. */
  const commitTop = useCallback(
    (card: SwipeCard, direction: SwipeDirection) => {
      swipedIds.current.add(card.tmdb_id);
      setCards((prev) => prev.filter((c) => c.tmdb_id !== card.tmdb_id));
      void saveVote(card, direction);
      void maybeRefill();
    },
    [saveVote, maybeRefill],
  );

  return { cards, loading, exhausted, commitTop, reload: initStack };
}
