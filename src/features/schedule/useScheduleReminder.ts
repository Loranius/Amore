import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';

export type ScheduleReminderResult =
  | 'sent'
  | 'already_sent'
  | 'already_complete';

interface ScheduleReminderInput {
  recipientId: number;
  month: string;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

const RESULTS: readonly ScheduleReminderResult[] = [
  'sent', 'already_sent', 'already_complete',
];

/**
 * Відповідь RPC → результат, або виняток.
 *
 * Виділено з мутації, щоб бути перевіреним: список станів може змінитись
 * разом із базою (стан `recipient_off_duty` тут був і пішов разом із
 * «тишею у вихідний»), і незнайоме значення мусить ЛАМАТИСЬ, а не
 * проходити мовчки. Мовчазне проходження коштувало б рівно того, заради
 * чого перевірка й існує: портал сказав би «нагадування надіслано» там,
 * де база його не створила.
 */
export function parseScheduleReminderResult(data: unknown): ScheduleReminderResult {
  if (RESULTS.includes(data as ScheduleReminderResult)) return data as ScheduleReminderResult;
  throw new Error('Schedule reminder RPC returned an invalid result');
}

async function sendScheduleFillReminder(
  input: ScheduleReminderInput,
): Promise<ScheduleReminderResult> {
  const { data, error } = await rpc('send_schedule_fill_reminder', {
    p_recipient_id: input.recipientId,
    p_month: input.month,
  });
  if (error) throw new Error(error.message);
  return parseScheduleReminderResult(data);
}

export function useScheduleReminder() {
  const toast = useToast();

  return useMutation({
    mutationFn: sendScheduleFillReminder,
    onSuccess: (result) => {
      if (result === 'sent') {
        toast.show('Нагадування партнеру надіслано.', 'success');
        return;
      }
      if (result === 'already_sent') {
        toast.show('Сьогодні нагадування вже надсилалось.', 'warn');
        return;
      }
      toast.show('Графік партнера на цей місяць уже заповнений.', 'success');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('month_in_past')) {
        toast.show('Не можна нагадувати про минулий місяць.', 'warn');
        return;
      }
      if (message.includes('partner_not_found') || message.includes('invalid_recipient')) {
        toast.show('Не вдалося визначити партнера.', 'error');
        return;
      }
      toast.show('Не вдалося надіслати нагадування. Спробуй ще.', 'error');
    },
  });
}
