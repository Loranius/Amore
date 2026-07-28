// Перемикач вигляду карти. Той самий віджет, що в «Спогадах», щоб жест
// не довелось вчити двічі.
import { ViewPicker, type ViewOption } from '@/components/ui/ViewPicker';
import { CityIcon, FoldedMapIcon, TimelineIcon } from '@/components/icons/ViewIcon';
import type { MapViewMode } from './mapView';

const MODES: ReadonlyArray<ViewOption<MapViewMode>> = [
  { value: 'map', label: 'Карта', description: 'Де це на світі', icon: <FoldedMapIcon size={20} /> },
  { value: 'timeline', label: 'Хронологія', description: 'Коли ми там були', icon: <TimelineIcon size={20} /> },
  { value: 'cities', label: 'Міста', description: 'Де взагалі бували', icon: <CityIcon size={20} /> },
];

export function MapViewPicker({
  value, onChange,
}: {
  value: MapViewMode;
  onChange: (value: MapViewMode) => void;
}) {
  return <ViewPicker options={MODES} value={value} onChange={onChange} label="Вигляд карти" />;
}
