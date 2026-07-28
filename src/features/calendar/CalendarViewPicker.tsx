// Перемикач вигляду календаря. Той самий віджет, що в «Спогадах» і на
// карті — тут лишаються самі підписи.
import { ViewPicker, type ViewOption } from '@/components/ui/ViewPicker';
import { YearIcon } from '@/components/icons/ViewIcon';
import { CalendarIcon, ListIcon } from '@/components/icons/UiIcon';
import type { CalendarViewMode } from './calendarView';

const MODES: ReadonlyArray<ViewOption<CalendarViewMode>> = [
  { value: 'list', label: 'Список', description: 'Що найближче', icon: <ListIcon size={20} /> },
  { value: 'month', label: 'Місяць', description: 'Що в цьому місяці', icon: <CalendarIcon size={20} /> },
  { value: 'year', label: 'Рік', description: 'Де густо, де пусто', icon: <YearIcon size={20} /> },
];

export function CalendarViewPicker({
  value, onChange,
}: {
  value: CalendarViewMode;
  onChange: (value: CalendarViewMode) => void;
}) {
  return <ViewPicker options={MODES} value={value} onChange={onChange} label="Вигляд календаря" />;
}
