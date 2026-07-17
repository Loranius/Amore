// ============================================================
// useQuestion — питання дня (порт question.js)
// ------------------------------------------------------------
// Питання генерує Edge Function daily-question-ai (ідемпотентно —
// обоє бачать одне). Fallback: детермінований вибір із пулу
// daily_questions за хешем дати. Лог дня — один рядок; кожен пише
// свою колонку (answer_dima / answer_lena).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, invokeFn } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { DailyQuestionLogRow, DailyQuestionRow, UserName } from '@/types';

export interface QuestionOfDay {
  id: number;
  text: string;
}
export type AnswerField = 'answer_dima' | 'answer_lena';

/** Локальна 'YYYY-MM-DD' (не UTC — інакше вночі питання «відкочувалось»). */
export function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatToday(): string {
  return new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Колонка відповіді для користувача (нема для невідомого імені). */
export function answerFieldFor(name: string): AnswerField | null {
  const map: Record<UserName, AnswerField> = { Діма: 'answer_dima', Лєна: 'answer_lena' };
  return name in map ? map[name as UserName] : null;
}

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
}

async function fetchPool(): Promise<DailyQuestionRow[]> {
  const { data, error } = await supabase
    .from('daily_questions')
    .select('id,text')
    .order('id', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Питання дня: AI → fallback на детермінований вибір із пулу. */
export function useDailyQuestion(date: string) {
  return useQuery({
    queryKey: qk.question(date),
    staleTime: 6 * 60 * 60_000,
    queryFn: async (): Promise<QuestionOfDay | null> => {
      try {
        const data = await invokeFn('daily-question-ai', { date });
        if (data && typeof data.text === 'string' && data.text) {
          return { id: data.id, text: data.text };
        }
      } catch (e) {
        console.warn('daily-question-ai недоступна, fallback на пул', e);
      }
      const pool = await fetchPool();
      if (!pool.length) return null;
      return pool[hashStringToInt(date) % pool.length]!;
    },
  });
}

/** Лог дня: гарантує рядок (idempotent upsert) і повертає його. */
export function useQuestionLog(date: string, questionId: number | null) {
  return useQuery({
    queryKey: ['question', 'log', date],
    enabled: questionId !== null,
    queryFn: async (): Promise<DailyQuestionLogRow | null> => {
      const { data, error } = await supabase
        .from('daily_question_log')
        .upsert({ date, question_id: questionId }, { onConflict: 'date', ignoreDuplicates: true })
        .select('id,date,question_id,answer_dima,answer_lena')
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      // upsert нічого не повернув (рядок уже був) — читаємо окремо.
      const { data: existing } = await supabase
        .from('daily_question_log')
        .select('id,date,question_id,answer_dima,answer_lena')
        .eq('date', date)
        .maybeSingle();
      return existing ?? null;
    },
  });
}

export function useQuestionMutations(date: string) {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const field = answerFieldFor(me.name);
  const invalidate = () => void client.invalidateQueries({ queryKey: ['question', 'log', date] });

  const save = useMutation({
    mutationFn: async (text: string) => {
      if (!field) throw new Error('Невідомий користувач');
      const patch = field === 'answer_dima' ? { answer_dima: text } : { answer_lena: text };
      const { error } = await supabase.from('daily_question_log').update(patch).eq('date', date);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалось зберегти відповідь'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!field) throw new Error('Невідомий користувач');
      const patch = field === 'answer_dima' ? { answer_dima: null } : { answer_lena: null };
      const { error } = await supabase.from('daily_question_log').update(patch).eq('date', date);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Не вдалось видалити відповідь'),
  });

  return { save, remove, field };
}
