import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
/*
 * Розбір відповіді живе окремо й БЕЗ клієнта бази: цей модуль на першому
 * рядку тягне `@/lib/supabase`, який кидає виняток при імпорті, коли
 * немає ключів. Поки чиста функція лежала тут, її тест падав у CI, де
 * ключів немає (ADR-0172).
 */
import {
  parseScheduleReminderResult,
  type ScheduleReminderResult,
} from './scheduleReminderResult';

import { useToast } from '@/providers/ToastProvider';

export { parseScheduleReminderResult };
export type { ScheduleReminderResult };

interface ScheduleReminderInput {
  recipientId: number;
  month: string;
}

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

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
