// ============================================================
// Джерела порталу: один похід у базу на всю історію пари.
// ------------------------------------------------------------
// ЧОМУ ЦЕ БІЛЬШЕ НЕ ФАЙЛ РИФА. Запит тут не знає про вид узагалі: він
// приносить події, плани, вішліст, карту, спогади й медіа — тобто рівно
// ті шість модулів, із яких `relationshipYear` рахує прожитий рік.
// Лежав він у `reef3d/world/reefPortalSources.ts` з єдиної причини:
// рифові він знадобився першим.
//
// Другим став онбординг, якому треба показати пари ЇЇ роки числами
// рушія. Тримати «портальні джерела» всередині одного виду, коли їх
// читають двоє, означало б завести другий такий самий запит — і два
// знімки одного порталу, які тихо розходяться. Цей файл уже
// створювався саме проти цього («двом гакам потрібен ОДИН запит»),
// тож переїзд лише доводить ту саму думку до кінця.
//
// Тут немає жодного рішення про ріст. Тільки «сходити й принести».
// ============================================================
import { fetchPairWishlistEvolutionArchive } from '@/features/wishlist/wishlistEvolutionArchive';
import { supabase } from '@/lib/supabase';
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';
import {
  buildEvolutionMemoryLinks,
  evolutionWishlistFromPairArchive,
} from '@/features/home/crystal3d/evolution/sourceSnapshot';

export { COUPLE_TIME_ZONE, ENGINE_VERSION } from './coupleEngine';

export interface PortalSources {
  relationshipStartedAt: string;
  userIds: number[];
  sharedDaysOff: string[];
  snapshot: EvolutionSourceSnapshot;
}

export function coupleDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value ?? ''
  );
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function fetchPortalSources(): Promise<PortalSources> {
  const [
    startDateResult,
    usersResult,
    eventsResult,
    plansResult,
    scheduleResult,
    pinsResult,
    memoriesResult,
    memoryLinksResult,
    mediaResult,
    wishlistArchive,
  ] = await Promise.all([
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'relationship_start_date')
      .maybeSingle(),
    supabase.from('users').select('id').order('id', { ascending: true }),
    supabase
      .from('events')
      .select('id,date,type,yearly,significance,is_milestone')
      .or('type.neq.other,is_milestone.eq.true')
      .order('date', { ascending: true }),
    supabase
      .from('plans')
      .select('id,category,status,start_date,end_date,completed_at,created_at'),
    supabase
      .from('work_schedule')
      .select('date,user_id')
      .eq('mark', 'Х')
      .order('date', { ascending: true }),
    supabase
      .from('map_pins')
      .select('id,category,visited_at,created_at,rating,city,country'),
    supabase
      .from('memories')
      .select('id,memory_date,date_precision,taken_at,created_at')
      .order('memory_date', { ascending: false }),
    supabase.from('memory_links').select('memory_id,source_type,source_id'),
    supabase
      .from('media_items')
      .select('id,status,created_at,finished_at')
      .eq('status', 'done'),
    fetchPairWishlistEvolutionArchive(),
  ]);

  if (startDateResult.error) throw startDateResult.error;
  if (usersResult.error) throw usersResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (plansResult.error) throw plansResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  if (pinsResult.error) throw pinsResult.error;
  if (memoriesResult.error) throw memoriesResult.error;
  if (memoryLinksResult.error) throw memoryLinksResult.error;
  if (mediaResult.error) throw mediaResult.error;

  const relationshipStartedAt = typeof startDateResult.data?.value === 'string'
    ? startDateResult.data.value.trim()
    : '';
  if (!relationshipStartedAt) {
    throw new Error('Reef production preview requires relationship_start_date.');
  }

  const userIds = (usersResult.data ?? [])
    .map((user) => user.id)
    .filter(Number.isSafeInteger)
    .sort((left, right) => left - right);
  if (userIds.length === 0) {
    throw new Error('Reef production preview could not assemble the couple snapshot.');
  }

  const offByDate = new Map<string, Set<number>>();
  for (const row of scheduleResult.data ?? []) {
    if (typeof row.date !== 'string') continue;
    const users = offByDate.get(row.date) ?? new Set<number>();
    users.add(row.user_id);
    offByDate.set(row.date, users);
  }
  const sharedDaysOff = [...offByDate.entries()]
    .filter(([, ids]) => userIds.every((id) => ids.has(id)))
    .map(([date]) => date)
    .sort();

  const linkIds: Record<number, Partial<Record<string, number>>> = {};
  for (const row of memoryLinksResult.data ?? []) {
    if (!Number.isSafeInteger(row.memory_id) || !Number.isSafeInteger(row.source_id)) continue;
    const entry = (linkIds[row.memory_id] ??= {});
    entry[row.source_type] ??= row.source_id;
  }

  const snapshot: EvolutionSourceSnapshot = {
    calendarEvents: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      date: event.date,
      type: event.type,
      yearly: event.yearly,
      isMilestone: event.is_milestone,
    })),
    plans: (plansResult.data ?? []).map((plan) => ({
      id: plan.id,
      category: plan.category,
      status: plan.status,
      startDate: plan.start_date,
      endDate: plan.end_date,
      completedAt: plan.completed_at,
      createdAt: plan.created_at,
    })),
    wishlistItems: evolutionWishlistFromPairArchive(wishlistArchive),
    mapPlaces: (pinsResult.data ?? []).map((pin) => ({
      id: pin.id,
      category: pin.category,
      visitedAt: pin.visited_at,
      createdAt: pin.created_at,
      rating: pin.rating,
      city: pin.city,
      country: pin.country,
    })),
    memories: (memoriesResult.data ?? []).map((memory) => ({
      id: memory.id,
      memoryDate: memory.memory_date,
      datePrecision: memory.date_precision,
      takenAt: memory.taken_at,
      createdAt: memory.created_at,
    })),
    memoryLinks: buildEvolutionMemoryLinks(linkIds),
    media: (mediaResult.data ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.created_at,
      finishedAt: item.finished_at,
    })),
  };

  return {
    relationshipStartedAt,
    userIds,
    sharedDaysOff,
    snapshot,
  };
}
