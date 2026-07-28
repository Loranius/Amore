// ============================================================
// Загальні значки дій.
// ------------------------------------------------------------
// Олівець, кошик, око й галочка трапляються не лише на дошці планів —
// вони розсипані по всьому застосунку. Тому вони тут, у спільному
// файлі, а не поруч із першим місцем, де знадобились.
//
// Основа спільна з EventIcon і PlanIcon (iconBase), тож набір лишається
// одним набором навіть коли росте.
// ============================================================
import { iconAttrs, type IconProps } from './iconBase';

export function CheckIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="m5 12.6 4.4 4.4L19 6.8" />
    </svg>
  );
}

export function UndoIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M4.4 8.6h9.8a5.4 5.4 0 0 1 0 10.8H8" />
      <path d="m8 4.4-3.6 4.2L8 12.8" />
    </svg>
  );
}

export function EyeIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M2.6 12s3.6-6.2 9.4-6.2S21.4 12 21.4 12s-3.6 6.2-9.4 6.2S2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

export function PencilIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M16.6 3.9a2.2 2.2 0 0 1 3.1 3.1L8.4 18.3l-4.1 1 1-4.1L16.6 3.9Z" />
      <path d="m14.9 5.6 3.1 3.1" />
    </svg>
  );
}

export function TrashIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M4.4 6.6h15.2" />
      <path d="M9.3 6.6V4.8a1.2 1.2 0 0 1 1.2-1.2h3a1.2 1.2 0 0 1 1.2 1.2v1.8" />
      <path d="M6.4 6.6 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.9-12.4" />
      <path d="M10.4 10.2v6.4M13.6 10.2v6.4" />
    </svg>
  );
}

export function CalendarIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="2.4" />
      <path d="M3.6 9.8h16.8M8.2 3.4v3.4M15.8 3.4v3.4" />
    </svg>
  );
}

export function WarningIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M10.7 4.2 2.9 17.6a1.5 1.5 0 0 0 1.3 2.3h15.6a1.5 1.5 0 0 0 1.3-2.3L13.3 4.2a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 9.6v4.1" />
      <circle cx="12" cy="16.7" r=".95" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Дзвіночок — нагадування. */
export function BellIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M18 9.4a6 6 0 1 0-12 0c0 5.2-2 6.7-2 6.7h16s-2-1.5-2-6.7Z" />
      <path d="M13.7 19.4a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/** Коробка — порожній архів. */
export function BoxIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M3.4 8.2 12 3.6l8.6 4.6v7.6L12 20.4l-8.6-4.6V8.2Z" />
      <path d="M3.4 8.2 12 12.8l8.6-4.6M12 12.8v7.6" />
    </svg>
  );
}
