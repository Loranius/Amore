import type { WishlistArchiveViewMode } from './wishlistArchiveView';

interface WishlistArchiveViewPickerProps {
  value: WishlistArchiveViewMode;
  onChange: (value: WishlistArchiveViewMode) => void;
}

const MODES: Array<{
  value: WishlistArchiveViewMode;
  label: string;
  description: string;
  icon: string;
}> = [
  { value: 'bubbles', label: 'Бульбашки', description: 'Жива хмара спогадів', icon: '◯' },
  { value: 'feed', label: 'Стрічка', description: 'Фото та деталі в ряд', icon: '☷' },
  { value: 'polaroid', label: 'Полароїд', description: 'Закріплені фотографії', icon: '▱' },
];

export function WishlistArchiveViewPicker({
  value,
  onChange,
}: WishlistArchiveViewPickerProps) {
  return (
    <div className="wl-archive-view-picker" role="group" aria-label="Вигляд архіву">
      {MODES.map((mode) => {
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            className={`wl-archive-view-option${active ? ' active' : ''}`}
            data-view={mode.value}
            aria-pressed={active}
            onClick={() => onChange(mode.value)}
          >
            <span className="wl-archive-view-option-icon" aria-hidden="true">{mode.icon}</span>
            <span className="wl-archive-view-option-copy">
              <strong>{mode.label}</strong>
              <small>{mode.description}</small>
            </span>
            <span className="wl-archive-view-option-check" aria-hidden="true">✓</span>
          </button>
        );
      })}
    </div>
  );
}
