import type { WishlistArchiveViewMode } from './wishlistArchiveView';
import { WISH_VIEW_ICON, type WishIconComponent } from '@/components/icons/WishIcon';
import { CheckIcon } from '@/components/icons/UiIcon';

interface WishlistArchiveViewPickerProps {
  value: WishlistArchiveViewMode;
  onChange: (value: WishlistArchiveViewMode) => void;
}

// Значки — з тієї самої таблиці, що й у панелі дошки: це той самий
// вибір вигляду, лише над архівом замість активних мрій.
const MODES: Array<{
  value: WishlistArchiveViewMode;
  label: string;
  description: string;
  Icon: WishIconComponent;
}> = [
  { value: 'bubbles', label: 'Бульбашки', description: 'Жива хмара спогадів', Icon: WISH_VIEW_ICON.bubbles },
  { value: 'feed', label: 'Стрічка', description: 'Фото та деталі в ряд', Icon: WISH_VIEW_ICON.feed },
  { value: 'polaroid', label: 'Полароїд', description: 'Закріплені фотографії', Icon: WISH_VIEW_ICON.polaroid },
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
            <span className="wl-archive-view-option-icon" aria-hidden="true"><mode.Icon size={20} /></span>
            <span className="wl-archive-view-option-copy">
              <strong>{mode.label}</strong>
              <small>{mode.description}</small>
            </span>
            <span className="wl-archive-view-option-check" aria-hidden="true"><CheckIcon size={14} /></span>
          </button>
        );
      })}
    </div>
  );
}
