// ============================================================
// Значки типів подій — перший мальований набір замість емодзі.
// ------------------------------------------------------------
// Чому не емодзі: 🎂💕🎉 малює операційна система, тож на Android і на
// iPhone це різні картинки різної ваги, кольору й оптичного розміру. У
// банері вони 32px і найпомітніші на екрані — тобто найпомітніше в
// модулі виглядає по-різному в двох людей однієї пари.
//
// Усе намальоване обведенням у `currentColor`: значок бере колір типу
// (--ev-*) від батька, а не носить власний. Та сама іконка працює
// міткою на смужці, чорнилом у чипі й 32-піксельним знаком у банері.
//
// Розмір задається через `size` і потрапляє у width/height, а не в
// viewBox: viewBox лишається 24×24, тож товщина ліній масштабується
// разом зі значком і не «худне» на великих розмірах.
// ============================================================
import type { EventType } from '@/types';

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  className,
});

/** Торт зі свічкою — день народження. */
export function CakeIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20.5h16" />
      <path d="M5.5 20.5v-6.2a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6.2" />
      {/* Хвиля глазурі — те, що робить прямокутник тортом. */}
      <path d="M5.5 15.4c1.05 0 1.05-1.2 2.1-1.2s1.05 1.2 2.1 1.2 1.05-1.2 2.1-1.2 1.05 1.2 2.1 1.2 1.05-1.2 2.1-1.2 1.05 1.2 2.1 1.2" />
      <path d="M12 12.3V9.4" />
      <path d="M12 9.4c1 0 1.5-.7 1.5-1.6C13.5 6.6 12 5.2 12 5.2s-1.5 1.4-1.5 2.6c0 .9.5 1.6 1.5 1.6Z" />
    </svg>
  );
}

/**
 * Серце — річниця.
 *
 * Одне, а не два. Друге серце півконтуром читалось як вм'ятина на
 * першому, а два повні на 18 пікселях зливались у пляму. Емодзі 💕
 * малює пару сердець, але копіювати його немає причини: у наборі
 * серце одне, і жодної двозначності воно не створює.
 */
export function HeartsIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 20.3c-.35.22-.79.22-1.14 0C9 19.06 3.6 15.3 3.6 10.6a4.1 4.1 0 0 1 7.83-1.72A4.1 4.1 0 0 1 19.26 10.6c0 4.7-5.4 8.46-7.26 9.7Z" />
    </svg>
  );
}

/** Спалах-конфеті — свято. */
export function SparkIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3.4 13.5 8l4.6 1.5-4.6 1.5L12 15.6 10.5 11 5.9 9.5 10.5 8 12 3.4Z" />
      <path d="M18.4 15.6v3.2M16.8 17.2H20" />
      <path d="M5.6 14.2v2.4M4.4 15.4h2.4" />
    </svg>
  );
}

/** Прапорець — плани. */
export function FlagIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      {/* Коротше древко й ширший полотнище: у першій версії значок був
          удвічі «вищий» за сусідів по набору й читався порожнім. */}
      <path d="M6.4 20.6V4.4" />
      <path d="M6.4 5.2h11.4l-2.7 3.7 2.7 3.7H6.4" />
    </svg>
  );
}

const BY_TYPE = {
  birthday: CakeIcon,
  anniversary: HeartsIcon,
  holiday: SparkIcon,
  other: FlagIcon,
} as const;

/** Значок за типом події. Колір успадковується від батька. */
export function EventIcon({
  type, size = 24, className = '',
}: IconProps & { type: EventType | null }) {
  const Icon = BY_TYPE[type ?? 'other'];
  return <Icon size={size} className={className} />;
}
