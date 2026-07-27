// Перемикач вигляду архіву. Зроблений за зразком
// WishlistArchiveViewPicker — той самий жест і та сама розмітка, щоб
// користувач не вчився двічі.
import type { MemoriesViewMode } from './memoriesView';

interface MemoriesViewPickerProps {
  value: MemoriesViewMode;
  onChange: (value: MemoriesViewMode) => void;
}

const MODES: Array<{ value: MemoriesViewMode; label: string; description: string; icon: string }> = [
  { value: 'feed', label: 'Стрічка', description: 'Уся хронологія поспіль', icon: '☰' },
  { value: 'album', label: 'Альбом', description: 'Сторінки на папері', icon: '▤' },
  { value: 'mosaic', label: 'Мозаїка', description: 'Місяць у клітинках', icon: '▦' },
];

export function MemoriesViewPicker({ value, onChange }: MemoriesViewPickerProps) {
  return (
    <div className="mem-view-picker" role="group" aria-label="Вигляд архіву">
      {MODES.map((mode) => {
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            className={`mem-view-option${active ? ' active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange(mode.value)}
          >
            <span className="mem-view-icon" aria-hidden="true">{mode.icon}</span>
            <span className="mem-view-copy">
              <strong>{mode.label}</strong>
              <small>{mode.description}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
