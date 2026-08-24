// ============================================================
// Словник значків вішлиста.
// ------------------------------------------------------------
// Вішлист — найбільший модуль порталу, і його позначки досі були
// набором типографських гліфів (✦ ♡ ❀ ◯ ☷ ▱), який розповзся по
// дев'яти файлах. Через це три різні стани картки показували ОДНЕ Й ТЕ
// САМЕ серце, а «Усі» у фільтрі мало той самий знак, що й «Жадане».
//
// Тому пріоритети й вигляди лежать тут таблицями, а не рядками в
// кожному компоненті: панель дошки й перемикач архіву — це два різні
// віджети з однаковим змістом, і поки значення жили в обох, вони вже
// починали розходитись.
// ============================================================
import type { ReactNode } from 'react';
import { iconAttrs, type IconProps } from './iconBase';
import { FlameIcon } from './PlanIcon';
import { LayersIcon, ListIcon } from './UiIcon';
import { HeartIcon } from './NavIcon';

/**
 * Пір'їна — «Приємне»: найлегша вага мрії.
 *
 * Спершу тут була квітка з чотирьох пелюсток. На 12px у чипі картки —
 * розмірі, де цей значок стоїть найчастіше, — вона зліплювалась у
 * цятку, а на 18px читалась молекулою, тобто тим самим, що й
 * «Бульбашки» через два ряди в тій самій панелі.
 */
export function FeatherIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M19.6 4.4a6.6 6.6 0 0 0-9.4 0L5 9.6v9.4h9.4l5.2-5.2a6.6 6.6 0 0 0 0-9.4Z" />
      <path d="M5 19 19 5M13.4 10.6H8.8" />
    </svg>
  );
}

/**
 * Два кільця — «Разом / Спільне».
 *
 * Не два серця: HeartsIcon у календарі свідомо намальований ОДНИМ
 * серцем (два повні зливались на 18px), тож у чипах вішлиста «Разом» і
 * «Моя мрія» виходили однаковими. Кільця лишаються двома фігурами й на
 * 13 пікселях — це перевірено рендером, а не припущено.
 */
export function TogetherIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="9" cy="12" r="5.6" />
      <circle cx="15" cy="12" r="5.6" />
    </svg>
  );
}

/** Бульбашки — «жива хмара мрій». */
export function BubblesIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="9.4" cy="13.6" r="5.4" />
      <circle cx="17" cy="7.6" r="3.4" />
      <circle cx="17.8" cy="16.8" r="2.1" />
    </svg>
  );
}

/** Полароїд — знімок із широким полем унизу. */
export function PolaroidIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <rect x="4.2" y="3.6" width="15.6" height="16.8" rx="1.8" />
      <rect x="6.8" y="6.2" width="10.4" height="8.4" rx="1" />
      <path d="M9 17.6h6" />
    </svg>
  );
}

export type WishIconComponent = (props: IconProps) => ReactNode;

/**
 * Вага мрії.
 *
 * Полум'я / серце / квітка — три різні форми, а не три різні розміри
 * однієї: у «Бульбашках» значок стоїть на колі 174, 116 і 78 пікселів,
 * і коли форма спільна, розмір кола лишається єдиною підказкою.
 */
export const WISH_PRIORITY_ICON = {
  high: FlameIcon,
  medium: HeartIcon,
  low: FeatherIcon,
} satisfies Record<'high' | 'medium' | 'low', WishIconComponent>;

/** «Усі» у фільтрі — стос, бо жоден із трьох окремих знаків тут не підходить. */
export const WISH_ALL_ICON: WishIconComponent = LayersIcon;

/**
 * Вигляди дошки й архіву — однакові в обох віджетах.
 *
 * «Стрічка» бере той самий список, що в «Спогадах» і календарі: це той
 * самий вигляд, і власний значок тут лише навчив би читати його вдруге.
 */
/*
 * Два вигляди вішліста, два значки.
 *
 * `feed` і `polaroid` жили тут, поки виглядів було три; вони показували
 * те саме різними обгортками (ADR-0056). `PolaroidIcon` лишається в
 * наборі — його носять «Спогади».
 */
export const WISH_VIEW_ICON = {
  bubbles: BubblesIcon,
  grid: ListIcon,
} satisfies Record<'bubbles' | 'grid', WishIconComponent>;
