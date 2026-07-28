// ============================================================
// Словник модуля «Плани»: категорії, статуси, їхні підписи й значки.
// ------------------------------------------------------------
// Одне місце на весь модуль. Попередній набір жив одразу в трьох:
// `PLAN_CATS` у calendarUtils, приватна копія списку в lib/guards і
// таблиці BY_CAT/BY_STATUS усередині PlanIcon. Через це «дозволені
// значення» треба було правити тричі, і вони вже почали розходитись.
// ============================================================
import type { ReactNode } from 'react';
import type { IconProps } from '@/components/icons/iconBase';
import {
  ActivityIcon, BookIcon, BulbIcon, CarIcon, CheckCircleIcon, DotsIcon,
  FlameIcon, GlassesIcon, HourglassIcon, HouseIcon, MugIcon, PlaneIcon,
} from '@/components/icons/PlanIcon';
import { SparkIcon } from '@/components/icons/EventIcon';
import { CheckIcon, CloseIcon, PauseIcon } from '@/components/icons/UiIcon';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { TicketIcon } from '@/components/icons/NavIcon';
import type { PlanCategory, PlanDatePrecision, PlanStatus } from '@/types';

export type PlanIconComponent = (props: IconProps) => ReactNode;

export interface PlanCategoryDef {
  label: string;
  Icon: PlanIconComponent;
  /** Колір смужки й крапки. Текст цим кольором не фарбуємо. */
  color: string;
}

/**
 * Одинадцять категорій із §7 специфікації.
 *
 * Порядок — не алфавітний, а за частотою: побачення й подорожі пара
 * заводить щотижня, «Навчання» й «Для дому» — кілька разів на рік.
 */
export const PLAN_CATEGORIES: Record<PlanCategory, PlanCategoryDef> = {
  date: { label: 'Побачення', Icon: GlassesIcon, color: '#FF6B9D' },
  trip: { label: 'Подорож', Icon: PlaneIcon, color: '#5BA3D9' },
  ride: { label: 'Поїздка', Icon: CarIcon, color: '#6FB1C4' },
  place: { label: 'Місце', Icon: MapPinIcon, color: '#7EC8A9' },
  event: { label: 'Захід', Icon: TicketIcon, color: '#D9A441' },
  activity: { label: 'Активність', Icon: ActivityIcon, color: '#E8829C' },
  rest: { label: 'Відпочинок', Icon: MugIcon, color: '#B98A9A' },
  holiday: { label: 'Свято', Icon: SparkIcon, color: '#C9922F' },
  learning: { label: 'Навчання', Icon: BookIcon, color: '#9B6EA8' },
  home: { label: 'Для дому', Icon: HouseIcon, color: '#8A9BB8' },
  other: { label: 'Інше', Icon: DotsIcon, color: '#A08D97' },
};

export const PLAN_CATEGORY_ORDER: PlanCategory[] = [
  'date', 'trip', 'ride', 'place', 'event', 'activity',
  'rest', 'holiday', 'learning', 'home', 'other',
];

export interface PlanStatusDef {
  label: string;
  Icon: PlanIconComponent;
  /** Чи означає цей статус, що план більше не в роботі. */
  closed: boolean;
}

/**
 * Сім станів із §24.
 *
 * `closed` виділений окремим полем, а не переліком у трьох місцях: за
 * ним і фільтр «Завершені», і виключення з нагадувань, і те, чи рахувати
 * план у «найближчих». Раніше те саме питання ставилось як
 * `status === 'done'` у чотирьох файлах, включно з edge-функцією.
 */
export const PLAN_STATUSES: Record<PlanStatus, PlanStatusDef> = {
  idea: { label: 'Ідея', Icon: BulbIcon, closed: false },
  planning: { label: 'Плануємо', Icon: HourglassIcon, closed: false },
  preparing: { label: 'Готуємося', Icon: FlameIcon, closed: false },
  ready: { label: 'Готово', Icon: CheckIcon, closed: false },
  done: { label: 'Виконано', Icon: CheckCircleIcon, closed: true },
  postponed: { label: 'Відкладено', Icon: PauseIcon, closed: true },
  cancelled: { label: 'Скасовано', Icon: CloseIcon, closed: true },
};

export const PLAN_STATUS_ORDER: PlanStatus[] = [
  'idea', 'planning', 'preparing', 'ready', 'done', 'postponed', 'cancelled',
];

/** Підписи точності дати — для перемикача у формі. */
export const PLAN_PRECISION_LABEL: Record<PlanDatePrecision, string> = {
  day: 'Конкретний день',
  range: 'Період',
  month: 'Місяць',
  season: 'Сезон',
  year: 'Рік',
  none: 'Дата не визначена',
};
