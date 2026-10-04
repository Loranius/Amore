// ============================================================
// Назви записів для хроніки росту (ADR-0238).
// ------------------------------------------------------------
// Знімок росту несе лише id і дати. Назви — з тих самих запитів, якими
// користуються модулі (плани, події, архів виконаних бажань, спогади), тож
// окремого джерела правди не з'являється, а кеш запитів уже теплий.
// Чого модуль не називає (місця, переглянуте, вихідні), хроніка показує
// датою й видом запису — без вигаданого тексту.
// ============================================================
import { useMemo } from 'react';
import type { ActivityKind } from '@/engine/species/crystalV2/model';
import { useEvents } from '@/features/_shared/events';
import { useMemories } from '@/features/memories/useMemories';
import { usePlans } from '@/features/plans/usePlans';
import { useWishlistArchive } from '@/features/wishlist/useWishlistArchive';

export type TitleKey = `${ActivityKind}:${string}`;

export function titleKey(kind: ActivityKind, id: number | string): TitleKey {
  return `${kind}:${id}`;
}

export function useChronicleTitles(partners: readonly (number | null | undefined)[]): Map<TitleKey, string> {
  const plans = usePlans();
  const events = useEvents();
  const memories = useMemories();
  const first = partners[0] ?? null;
  const second = partners[1] ?? null;
  const shared = useWishlistArchive('shared', null, true);
  const firstWishes = useWishlistArchive('personal', first, first !== null);
  const secondWishes = useWishlistArchive('personal', second, second !== null);

  return useMemo(() => {
    const out = new Map<TitleKey, string>();
    for (const row of plans.data ?? []) if (row.title) out.set(titleKey('plans', row.id), row.title);
    for (const row of events.data ?? []) {
      if (!row.title) continue;
      out.set(titleKey('events', row.id), row.title);
      out.set(titleKey('milestones', row.id), row.title);
    }
    for (const row of memories.data?.photos ?? []) if (row.caption) out.set(titleKey('memories', row.id), row.caption);
    for (const list of [shared.data, firstWishes.data, secondWishes.data]) {
      for (const row of list ?? []) if (row.title) out.set(titleKey('wishes', row.id), row.title);
    }
    return out;
  }, [plans.data, events.data, memories.data, shared.data, firstWishes.data, secondWishes.data]);
}
