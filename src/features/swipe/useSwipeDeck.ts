// ============================================================
// useSwipeDeck — колода свайпу (порт swipe.js даних/стану)
// ------------------------------------------------------------
// Тягне популярне з TMDB, фільтрує вже свайпнуті картки, дозавантажує
// на льоту. Голос: upsert у swipe_votes + авто-додавання в media_items
// (крім 'down' = пропустити). Логіка напрямів збережена:
//   up=done · right=watching · left=want · down=skip.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { tmdbDiscover } from '@/lib/tmdb';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { SwipeCard, SwipeType, SwipeDirection, MediaStatus } from '@/types';
import { randomInt } from '@/lib/entropy';

const STATUS_BY_DIR: Record<Exclude<SwipeDirection, 'down'>, MediaStatus> = {
  up: 'done',
  right: 'watching',
  left: 'want',
};

export function useSwipeDeck(
  type: SwipeType,
  enabled: boolean,
  /**
   * Обрані жанри. Порожньо — колода без звуження, як було завжди.
   *
   * Масив приходить ззовні, тому в залежностях ефекту лежить його
   * СКЛЕЄНИЙ ключ, а не сам масив: новий масив із тим самим вмістом
   * інакше перезбирав би колоду на кожному рендері панелі.
   */
  genreIds: readonly number[] = [],
) {
  const me = useCurrentUser();
  const client = useQueryClient();
  // Склеєний ключ, і вже з нього — сталий масив. Саме він іде в
  // залежності: інакше `[]`, створений у батька на кожному рендері,
  // перезбирав би колоду безкінечно.
  const genreKey = genreIds.join(',');
  const genres = useMemo(
    () => (genreKey === '' ? [] : genreKey.split(',').map(Number)),
    [genreKey],
  );

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
    // Випадкова сторінка — це і є різноманіття колоди: без неї пара
    // щоразу бачила б ті самі найпопулярніші назви.
    const startPage = randomInt(1, 50);

    /*
     * Сторінки беруться ПАРАЛЕЛЬНО, а не по одній у циклі.
     *
     * Було так: `while (collected.length < 15 && attempts < 12)` — до
     * дванадцяти послідовних походів у TMDB, кожен чекає на попередній,
     * і лише потім колода з'являлась на екрані. Плюс окремий похід у
     * Supabase перед ними всіма. На звичайній мережі це секунди
     * порожнього екрана, і саме вони читались як «вотчліст гальмує».
     *
     * Трьох сторінок вистачає: TMDB віддає по 20 карток, тобто до 60 на
     * старті проти потрібних 15 — навіть якщо більшість уже свайпнута.
     * А список свайпнутих їде ОДНОЧАСНО з ними, а не перед ними: він
     * потрібен лише для фільтрації результату.
     */
    const [swiped, ...batches] = await Promise.all([
      fetchSwipedIds(),
      ...[0, 1, 2].map((offset) => tmdbDiscover(type, startPage + offset, genres)),
    ]);
    swipedIds.current = swiped;
    pageRef.current = startPage + 3;

    // Дедуплікація потрібна саме тут: три сторінки поспіль у TMDB можуть
    // перетинатись, коли список популярного зсувається між запитами.
    const seen = new Set<number>();
    const collected: SwipeCard[] = [];
    for (const card of batches.flat()) {
      if (swiped.has(card.tmdb_id) || seen.has(card.tmdb_id)) continue;
      seen.add(card.tmdb_id);
      collected.push(card);
    }

    setCards(collected);
    setExhausted(collected.length === 0);
    setLoading(false);
  }, [type, genres, fetchSwipedIds]);

  // (Пере)ініціалізація при відкритті панелі / зміні типу.
  useEffect(() => {
    if (enabled) void initStack();
  }, [enabled, initStack]);

  // Дозавантаження, коли лишається мало карток (без паралельних запитів).
  const maybeRefill = useCallback(async () => {
    if (refilling.current || cards.length > 5) return;
    refilling.current = true;
    try {
      const more = await tmdbDiscover(type, pageRef.current, genres);
      pageRef.current++;
      const fresh = more.filter((c) => !swipedIds.current.has(c.tmdb_id));
      if (fresh.length) setCards((prev) => [...prev, ...fresh]);
    } finally {
      refilling.current = false;
    }
  }, [cards.length, type, genres]);

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
