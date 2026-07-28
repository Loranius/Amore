// Перемикач вигляду архіву. Розмітка й стилі спільні з картою
// (components/ui/ViewPicker) — тут лишаються самі підписи.
import { ViewPicker, type ViewOption } from '@/components/ui/ViewPicker';
import { AlbumIcon, MosaicIcon } from '@/components/icons/ViewIcon';
import { ListIcon } from '@/components/icons/UiIcon';
import type { MemoriesViewMode } from './memoriesView';

const MODES: ReadonlyArray<ViewOption<MemoriesViewMode>> = [
  { value: 'feed', label: 'Стрічка', description: 'Уся хронологія поспіль', icon: <ListIcon size={20} /> },
  { value: 'album', label: 'Альбом', description: 'Сторінки на папері', icon: <AlbumIcon size={20} /> },
  { value: 'mosaic', label: 'Мозаїка', description: 'Місяць у клітинках', icon: <MosaicIcon size={20} /> },
];

export function MemoriesViewPicker({
  value, onChange,
}: {
  value: MemoriesViewMode;
  onChange: (value: MemoriesViewMode) => void;
}) {
  return <ViewPicker options={MODES} value={value} onChange={onChange} label="Вигляд архіву" />;
}
