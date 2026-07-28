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

/** Зірка. `filled` — для шкали оцінки, де порожня й повна мусять
 *  відрізнятись формою, а не лише кольором. */
export function StarIcon({ size = 24, className = '', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...iconAttrs(size, className)} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3.6 2.62 5.5 5.88.82-4.28 4.3 1.04 6.02L12 17.3l-5.26 2.94 1.04-6.02L3.5 9.92l5.88-.82L12 3.6Z" />
    </svg>
  );
}

/** Лупа — пошук і порожній результат. */
export function SearchIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="10.6" cy="10.6" r="6.6" />
      <path d="m15.4 15.4 4.6 4.6" />
    </svg>
  );
}

/** Хрестик — закрити. */
export function CloseIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" />
    </svg>
  );
}

/** Картинка — вибір фото. */
export function ImageIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4" />
      <circle cx="8.6" cy="9.6" r="1.6" />
      <path d="m3.9 16.6 4.5-4.2a2 2 0 0 1 2.7 0l5.2 4.8M14.6 14.2l1.5-1.4a2 2 0 0 1 2.7 0l1.6 1.5" />
    </svg>
  );
}

/** Список — архів геолокацій. */
export function ListIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M9 6.4h11M9 12h11M9 17.6h11" />
      <circle cx="4.8" cy="6.4" r=".95" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="12" r=".95" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="17.6" r=".95" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Подарунок — виконане бажання. */
export function GiftIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <rect x="3.6" y="9.4" width="16.8" height="10.8" rx="1.8" />
      <path d="M2.8 9.4h18.4M12 9.4v10.8" />
      <path d="M12 9.4S10.6 4 8.2 4a2.2 2.2 0 0 0 0 5.4M12 9.4S13.4 4 15.8 4a2.2 2.2 0 0 1 0 5.4" />
    </svg>
  );
}

/** Стрілки перестановки — ручний порядок у «Спогадах». */
export function ArrowUpIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M12 19.4V5.2M5.8 11.4 12 5.2l6.2 6.2" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M12 4.6v14.2M5.8 12.6 12 18.8l6.2-6.2" />
    </svg>
  );
}

/** Стрілки врізнобіч — розгорнути карту на весь екран. */
export function ExpandIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M14.6 4.6h4.8v4.8M19.4 4.6l-6 6" />
      <path d="M9.4 19.4H4.6v-4.8M4.6 19.4l6-6" />
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
