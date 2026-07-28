// ============================================================
// Значки категорій і статусів планів.
// ------------------------------------------------------------
// Той самий набір і та сама основа, що в EventIcon.
//
// Тут лежать САМІ значки, без таблиць «категорія → значок»: категорії
// й статуси належать модулю «Плани» (features/plans/planConstants.ts),
// і тримати їхній перелік ще й тут означало б двічі правити при кожній
// зміні. Рівно так уже розійшлись були PLAN_CATS у calendarUtils і в
// lib/guards.
// ============================================================
import { iconAttrs, type IconProps } from './iconBase';

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

/**
 * Лампочка — «Ідея».
 *
 * Спершу тут стояв місяць із зіркою (DreamIcon). На 14px у чипі
 * статусу півмісяць читався незамкненим колом, тобто круговою
 * стрілкою «оновити» — рендер показав це одразу на сторінці плану.
 */
export function BulbIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M12 3.2a6.2 6.2 0 0 0-3.6 11.25V17h7.2v-2.55A6.2 6.2 0 0 0 12 3.2Z" />
      <path d="M9.6 19.4h4.8M10.4 21.4h3.2" />
    </svg>
  );
}

/** Авто — поїздка (коротша за подорож, без літака). */
export function CarIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M3.4 15.4v-2.2l1.8-4.4a2 2 0 0 1 1.85-1.2h9.9a2 2 0 0 1 1.85 1.2l1.8 4.4v2.2" />
      <path d="M3.4 13.2h17.2" />
      <path d="M4.6 15.4h14.8v2.6a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-.8H8v.8a1 1 0 0 1-1 1H5.6a1 1 0 0 1-1-1v-2.6Z" />
    </svg>
  );
}

/** Пульс — спільна активність. */
export function ActivityIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M2.8 12h3.6l2.2-6 3.6 12 2.4-7.4 1.6 3.4h4.9" />
    </svg>
  );
}

/** Чашка — відпочинок. */
export function MugIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M4.4 8.6h11.2v7a4 4 0 0 1-4 4H8.4a4 4 0 0 1-4-4v-7Z" />
      <path d="M15.6 10.6h1.8a2.6 2.6 0 0 1 0 5.2h-1.8" />
      <path d="M7.6 3.4v2.4M11.4 3.4v2.4" />
    </svg>
  );
}

/** Книга — навчання. */
export function BookIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M5 4.4h10.6a2.4 2.4 0 0 1 2.4 2.4v12.8H7.4a2.4 2.4 0 0 1-2.4-2.4V4.4Z" />
      <path d="M5 17.2a2.4 2.4 0 0 1 2.4-2.4H18" />
      <path d="M9 8.4h5" />
    </svg>
  );
}

/** Будинок — для дому. */
export function HouseIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M3.6 10.4 12 3.8l8.4 6.6v8.2a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6v-8.2Z" />
      <path d="M9.4 20.2v-6h5.2v6" />
    </svg>
  );
}
