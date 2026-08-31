// ============================================================
// Заповнення історії: дані екрана й дві дії, які він робить.
// ------------------------------------------------------------
// Крок не зберігається, а виводиться з даних — чому саме так, сказано
// в `sweepModel.ts`, де ця відповідь і живе.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { InsertRow } from '@/types';
import {
  COUPLE_TIME_ZONE,
  coupleDay,
  fetchPortalSources,
  type PortalSources,
} from '@/features/world/portalSources';
import { sweepStepOf, type SweepStep } from './sweepModel';
import { relationshipYearFills, type HistoryFillSummary } from './yearFills';

export type { SweepStep };

export interface AnniversaryDraft {
  title: string;
  date: string;
}

const SOURCES_KEY = ['onboarding', 'portal-sources'] as const;

/** Дати, які пари святкують найчастіше — підказки, а не набір. */
export const ANNIVERSARY_SUGGESTIONS: readonly string[] = [
  'Перше побачення',
  'Перший поцілунок',
  'Почали жити разом',
  'День знайомства',
  'Заручини',
];

export interface HistorySweep {
  step: SweepStep;
  asOf: string;
  isPending: boolean;
  error: Error | null;
  relationshipStartedAt: string;
  /** Щорічні річниці, які вже є: саме вони піднімають усі минулі роки. */
  yearlyAnniversaries: { id: number; date: string }[];
  summary: HistoryFillSummary;
  setStartDate: (date: string) => Promise<void>;
  addAnniversary: (draft: AnniversaryDraft) => Promise<void>;
  isSaving: boolean;
}

export function useHistorySweep(): HistorySweep {
  const user = useCurrentUser();
  const client = useQueryClient();
  const [asOf] = useState(() => `${coupleDay(new Date(), COUPLE_TIME_ZONE)}T00:00:00.000Z`);

  const sources = useQuery({
    queryKey: SOURCES_KEY,
    queryFn: fetchPortalSources,
    staleTime: 0,
    retry: 1,
  });

  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: SOURCES_KEY }),
      client.invalidateQueries({ queryKey: qk.events() }),
      client.invalidateQueries({ queryKey: qk.settings() }),
    ]);
  }, [client]);

  const setStartDate = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'relationship_start_date', value: date }, { onConflict: 'key' });
      if (error) throw error;
      try {
        // Той самий ключ, яким головна малює лічильник до приходу мережі.
        localStorage.setItem('amore:startDate', date);
      } catch {
        /* сховище може бути закрите — це не привід не зберегти дату в базі */
      }
    },
    onSuccess: refresh,
  });

  const addAnniversary = useMutation({
    mutationFn: async (draft: AnniversaryDraft) => {
      /*
       * `yearly: true` — це і є весь важіль. Адаптер календаря
       * (`adapters/calendar.ts`) для такої події сам породжує по одній
       * події на кожен рік від дати до сьогодні, тож одна відповідь
       * піднімає ВСІ минулі роки, а не той, у який вона потрапила.
       *
       * `significance: 'regular'` навмисно: «початок стосунків» і
       * «одруження» існують у порталі в однині й стережуться частковим
       * унікальним індексом. Онбординг не має права їх зайняти — це
       * вибір пари в календарі, а не побічний ефект підказки.
       */
      const row: InsertRow<'events'> = {
        title: draft.title.trim(),
        date: draft.date,
        type: 'anniversary',
        yearly: true,
        significance: 'regular',
        created_by: user.id,
      };
      const { error } = await supabase.from('events').insert(row);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const data: PortalSources | undefined = sources.data;
  const relationshipStartedAt = data?.relationshipStartedAt.trim() ?? '';

  const yearlyAnniversaries = useMemo(() => (
    (data?.snapshot.calendarEvents ?? [])
      .filter((event) => event.type === 'anniversary' && event.yearly === true)
      .map((event) => ({ id: event.id, date: event.date }))
  ), [data]);

  const summary = useMemo((): HistoryFillSummary => {
    if (!data || relationshipStartedAt === '') {
      return { years: [], emptyCount: 0, averageFill: 0 };
    }
    return relationshipYearFills(data, asOf, `couple:${data.userIds.join('-')}`);
  }, [data, relationshipStartedAt, asOf]);

  const step = sweepStepOf({
    relationshipStartedAt,
    yearlyAnniversaryCount: yearlyAnniversaries.length,
  });

  return {
    step,
    asOf,
    isPending: sources.isPending,
    error: sources.error instanceof Error ? sources.error : null,
    relationshipStartedAt,
    yearlyAnniversaries,
    summary,
    setStartDate: async (date) => { await setStartDate.mutateAsync(date); },
    addAnniversary: async (draft) => { await addAnniversary.mutateAsync(draft); },
    isSaving: setStartDate.isPending || addAnniversary.isPending,
  };
}
