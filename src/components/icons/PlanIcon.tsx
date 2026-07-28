// ============================================================
// Значки категорій і статусів планів.
// ------------------------------------------------------------
// Той самий набір і та сама основа, що в EventIcon: дошка планів живе
// на одному екрані зі списком подій, і мішати там мальоване з
// системними емодзі означало б лишити роботу зробленою наполовину.
// ============================================================
import { iconAttrs, type IconProps } from './iconBase';
import type { PlanCategory, PlanStatus } from '@/types';

/**
 * Два келихи, зсунуті чашами — побачення.
 *
 * Перша спроба малювала вузькі чаші «тюльпаном»: на 16 пікселях це
 * читалось як дві виделки. Трикутна чаша ширша й упізнається одразу, а
 * нахил назустріч робить із двох склянок «цокнулись».
 */
export function GlassesIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <g transform="rotate(-13 8 11)">
        <path d="M4.6 4.4h6.8L8 9.3 4.6 4.4Z" />
        <path d="M8 9.3v5.4M5.9 14.7h4.2" />
      </g>
      <g transform="rotate(13 16 11)">
        <path d="M12.6 4.4h6.8L16 9.3l-3.4-4.9Z" />
        <path d="M16 9.3v5.4M13.9 14.7h4.2" />
      </g>
    </svg>
  );
}

/** Місяць із зіркою — мрії. */
export function DreamIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M19.6 14.8A7.6 7.6 0 0 1 9.4 4.6a7 7 0 1 0 10.2 10.2Z" />
      {/* Зірка дрібніша й винесена вище: у першій версії вона торкалась
          краю місяця й на 16px зливалась із ним в одну пляму. */}
      <path d="m17.9 2.6.75 1.85 1.85.75-1.85.75-.75 1.85-.75-1.85-1.85-.75 1.85-.75.75-1.85Z" />
    </svg>
  );
}

/** Паперовий літачок — подорожі. */
export function PlaneIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M20.6 3.6 3.9 10.2a.5.5 0 0 0 0 .93l4.9 1.9 1.9 4.9a.5.5 0 0 0 .93 0L20.6 3.6Z" />
      <path d="m10.7 13.3 4.9-4.9" />
    </svg>
  );
}

/** Мішень — цілі. */
export function TargetIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Три крапки — інше. */
export function DotsIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="8.4" cy="12" r=".95" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r=".95" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="12" r=".95" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Пісковий годинник — планується. */
export function HourglassIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M6.5 3.4h11M6.5 20.6h11" />
      <path d="M8 3.4v3.2c0 2 4 3.5 4 5.4 0-1.9 4-3.4 4-5.4V3.4" />
      <path d="M8 20.6v-3.2c0-2 4-3.5 4-5.4 0 1.9 4 3.4 4 5.4v3.2" />
    </svg>
  );
}

/** Полумʼя — в процесі. */
export function FlameIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M12 21.2c3.6 0 6.2-2.4 6.2-5.8 0-4-3.3-5.7-3.3-9.2 0-1-.4-2-1.3-3-.3 3-1.9 4.3-3.4 5.6-1.9 1.6-4.4 3.4-4.4 6.6 0 3.4 2.6 5.8 6.2 5.8Z" />
      <path d="M12 21.2c1.6 0 2.7-1.1 2.7-2.6 0-1.8-1.6-2.6-1.6-4.3-1.2.9-2.6 2-2.6 4 0 1.6 1 2.9 1.5 2.9Z" />
    </svg>
  );
}

/** Галочка в колі — виконано. */
export function CheckCircleIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m8.2 12.2 2.6 2.6 5-5.4" />
    </svg>
  );
}

const BY_CAT = {
  date: GlassesIcon,
  dream: DreamIcon,
  trip: PlaneIcon,
  goal: TargetIcon,
  other: DotsIcon,
} as const;

const BY_STATUS = {
  planned: HourglassIcon,
  active: FlameIcon,
  done: CheckCircleIcon,
} as const;

export function PlanCatIcon({
  cat, size = 24, className = '',
}: IconProps & { cat: PlanCategory }) {
  const Icon = BY_CAT[cat];
  return <Icon size={size} className={className} />;
}

export function PlanStatusIcon({
  status, size = 24, className = '',
}: IconProps & { status: PlanStatus }) {
  const Icon = BY_STATUS[status];
  return <Icon size={size} className={className} />;
}
