// Конфігурація вибору вигляду календаря для спільного механізму
// `_shared/viewPreference` — того самого, яким користуються вішлист,
// «Спогади» й карта. Свого сховища модуль не заводить.
import { useViewPreference, type ViewPreferenceConfig } from '@/features/_shared/viewPreference';

export type CalendarViewMode = 'list' | 'month' | 'year';

/** Область одна: календар у пари спільний. */
type CalendarScope = 'events';

const CONFIG: ViewPreferenceConfig<CalendarViewMode> = {
  storageKey: 'amore:calendar:view-mode:v1',
  modes: ['list', 'month', 'year'],
  // Список відповідає на «що найближче» — питання, з яким сюди заходять
  // щодня. Сітка й рік потрібні рідше й обираються свідомо.
  fallback: 'list',
};

export function useCalendarView(): readonly [CalendarViewMode, (view: CalendarViewMode) => void] {
  return useViewPreference<CalendarViewMode, CalendarScope>(CONFIG, 'events');
}
