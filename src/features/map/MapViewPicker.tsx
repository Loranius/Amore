// Перемикач вигляду карти. Той самий віджет, що в «Спогадах», щоб жест
// не довелось вчити двічі.
import { ViewPicker, type ViewOption } from '@/components/ui/ViewPicker';
import type { MapViewMode } from './mapView';

const MODES: ReadonlyArray<ViewOption<MapViewMode>> = [
  { value: 'map', label: 'Карта', description: 'Де це на світі', icon: '🗺' },
  { value: 'timeline', label: 'Хронологія', description: 'Коли ми там були', icon: '☰' },
  { value: 'cities', label: 'Міста', description: 'Де взагалі бували', icon: '▤' },
];

export function MapViewPicker({
  value, onChange,
}: {
  value: MapViewMode;
  onChange: (value: MapViewMode) => void;
}) {
  return <ViewPicker options={MODES} value={value} onChange={onChange} label="Вигляд карти" />;
}
