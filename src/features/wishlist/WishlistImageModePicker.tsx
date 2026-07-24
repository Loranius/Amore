import type { WishlistImagePreference } from './wishlistImagePreference';
import './wishlistImageModePicker.css';

interface WishlistImageModePickerProps {
  value: WishlistImagePreference;
  disabled?: boolean;
  hasSavedImage: boolean;
  imageChanged: boolean;
  processing: boolean;
  status: 'idle' | 'processing' | 'success' | 'error';
  onChange: (value: WishlistImagePreference) => void;
  onReprocess: () => void;
}

const OPTIONS: ReadonlyArray<{
  value: WishlistImagePreference;
  icon: string;
  label: string;
  description: string;
}> = [
  {
    value: 'auto',
    icon: '✨',
    label: 'Автоматично',
    description: 'Портал сам вибере найкращий спосіб.',
  },
  {
    value: 'product-cutout',
    icon: '📦',
    label: 'Товар без фону',
    description: 'Для одягу, техніки та предметів.',
  },
  {
    value: 'portrait-cutout',
    icon: '🧍',
    label: 'Людина без фону',
    description: 'AI-сегментація портретного фото.',
  },
  {
    value: 'photo-cover',
    icon: '🖼',
    label: 'Оригінальне фото',
    description: 'Показувати кадр без вирізання.',
  },
];

export function WishlistImageModePicker({
  value,
  disabled = false,
  hasSavedImage,
  imageChanged,
  processing,
  status,
  onChange,
  onReprocess,
}: WishlistImageModePickerProps) {
  const reprocessDisabled = disabled || processing || !hasSavedImage || imageChanged;

  return (
    <div className="wm-image-mode-editor">
      <div className="wm-image-mode-heading">
        <div>
          <strong>Вигляд у бульбашці</strong>
          <small>Режим зберігається для обох пристроїв.</small>
        </div>
      </div>

      <div className="wm-image-mode-grid" role="radiogroup" aria-label="Режим відображення фото">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className="wm-image-mode-option"
              data-selected={selected ? 'true' : 'false'}
              role="radio"
              aria-checked={selected}
              disabled={disabled || processing}
              onClick={() => onChange(option.value)}
            >
              <span className="wm-image-mode-icon" aria-hidden="true">{option.icon}</span>
              <span className="wm-image-mode-copy">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <span className="wm-image-mode-check" aria-hidden="true">✓</span>
            </button>
          );
        })}
      </div>

      <div className="wm-image-reprocess-row">
        <button
          type="button"
          className="btn-secondary wm-image-reprocess-button"
          disabled={reprocessDisabled}
          onClick={onReprocess}
        >
          <span aria-hidden="true">↻</span>
          {processing ? 'Обробляємо…' : 'Застосувати й обробити ще раз'}
        </button>

        <div className="wm-image-reprocess-status" role="status" aria-live="polite">
          {!hasSavedImage && <small>Кнопка стане доступною після першого збереження фото.</small>}
          {hasSavedImage && imageChanged && <small>Спочатку збережи нове фото.</small>}
          {status === 'processing' && <small>Створюємо нову версію зображення…</small>}
          {status === 'success' && <small className="wm-image-reprocess-status--success">Готово. Нова версія збережена.</small>}
          {status === 'error' && <small className="wm-image-reprocess-status--error">Не вдалося переобробити фото. Спробуй ще раз.</small>}
        </div>
      </div>
    </div>
  );
}
