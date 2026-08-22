import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './wishlistPriorityPicker.css';
import { WISH_PRIORITY_ICON, type WishIconComponent } from '@/components/icons/WishIcon';
import { CheckIcon, ChevronDownIcon, MinusIcon } from '@/components/icons/UiIcon';

type WishlistPriority = 'high' | 'medium' | 'low';

interface WishlistPriorityPickerProps {
  value: WishlistPriority | '';
  disabled?: boolean;
  onChange: (value: WishlistPriority | '') => void;
}

const OPTIONS: Array<{
  value: WishlistPriority | '';
  Icon: WishIconComponent;
  label: string;
  description: string;
}> = [
  {
    value: '',
    // Мальована риска, а не тире зі шрифту: серед трьох значків
    // текстовий символ стояв на власній висоті й вибивався з ряду.
    Icon: MinusIcon,
    label: 'Не вказано',
    description: 'Бульбашка середнього розміру',
  },
  {
    value: 'high',
    Icon: WISH_PRIORITY_ICON.high,
    label: 'Жадане',
    description: 'Найбільша фокусна бульбашка',
  },
  {
    value: 'medium',
    Icon: WISH_PRIORITY_ICON.medium,
    label: 'Бажане',
    description: 'Середня бульбашка у хмарі',
  },
  {
    value: 'low',
    Icon: WISH_PRIORITY_ICON.low,
    label: 'Приємне',
    description: 'Маленька легка бульбашка',
  },
];

export function WishlistPriorityPicker({
  value,
  disabled = false,
  onChange,
}: WishlistPriorityPickerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const selected = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0]!;

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      sheetRef.current
        ?.querySelector<HTMLButtonElement>(`[data-priority-value="${value || 'none'}"]`)
        ?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close(true);
        return;
      }

      if (event.key !== 'Tab' || !sheetRef.current) return;
      const controls = Array.from(
        sheetRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      );
      if (controls.length === 0) return;

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, value]);

  const priorityDialog = open ? (
    <div
      className="wl-priority-picker-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close(true);
      }}
    >
      <div
        ref={sheetRef}
        className="wl-priority-picker-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="wl-priority-picker-handle" aria-hidden="true" />
        <div className="wl-priority-picker-header">
          <div>
            <span className="wl-priority-picker-eyebrow">Вага мрії</span>
            <h3 id={titleId}>Оберіть розмір бульбашки</h3>
          </div>
          <button
            type="button"
            className="wl-priority-picker-close"
            aria-label="Закрити вибір пріоритету"
            onClick={() => close(true)}
          >
            ×
          </button>
        </div>

        <div className="wl-priority-picker-options" role="radiogroup" aria-labelledby={titleId}>
          {OPTIONS.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value || 'none'}
                type="button"
                className={`wl-priority-picker-option${active ? ' is-active' : ''}`}
                role="radio"
                aria-checked={active}
                data-priority-value={option.value || 'none'}
                onClick={() => {
                  onChange(option.value);
                  close(true);
                }}
              >
                <span className="wl-priority-picker-icon" aria-hidden="true">
                  <option.Icon size={18} />
                </span>
                <span className="wl-priority-picker-copy">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="wl-priority-picker-radio" aria-hidden="true">
                  {active ? <CheckIcon size={15} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id="wish-priority"
        className="wl-priority-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="wl-priority-picker-trigger-value">
          <selected.Icon size={18} />
          {selected.label}
        </span>
        <span className="wl-priority-picker-chevron" aria-hidden="true"><ChevronDownIcon size={16} /></span>
      </button>

      {priorityDialog ? createPortal(priorityDialog, document.body) : null}
    </>
  );
}
