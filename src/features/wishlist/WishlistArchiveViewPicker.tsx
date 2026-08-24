import type { WishlistViewMode } from './wishlistBoardView';
import { WISH_VIEW_ICON, type WishIconComponent } from '@/components/icons/WishIcon';
import { CheckIcon } from '@/components/icons/UiIcon';

interface WishlistArchiveViewPickerProps {
  value: WishlistViewMode;
  onChange: (value: WishlistViewMode) => void;
}

// Значки — з тієї самої таблиці, що й у панелі дошки: це той самий
// вибір вигляду, лише над архівом замість активних мрій.
const MODES: Array<{
  value: WishlistViewMode;
  label: string;
  description: string;
  Icon: WishIconComponent;
}> = [
  { value: 'bubbles', label: 'Бульбашки', description: 'Жива хмара спогадів', Icon: WISH_VIEW_ICON.bubbles },
  { value: 'grid', label: 'Список', description: 'Фото, назва й ціна', Icon: WISH_VIEW_ICON.grid },
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
