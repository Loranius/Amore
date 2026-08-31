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
  /**
   * Колір смужки, крапки й підпису категорії — ТОКЕНОМ, а не числом.
   *
   * Тут стояли одинадцять шістнадцяткових чисел, і саме тому плани
   * лишались рожево-фіолетовими в кожному світі: портал перевдягається
   * у дерево й риф цілком, а ці числа не знали про це нічого. Власник
   * побачив рівно це — бокові смужки з кристалічної гами на зеленому
   * дереві.
   *
   * Значення живуть у `index.css` (кристал) і `artifactThemes.css`
   * (дерево, риф — темні й світлі), як і решта токенів світу. Тут
   * лишається лише ІМ'Я ролі.
   */
  color: string;
}

/**
 * Одинадцять категорій із §7 специфікації.
 *
 * Порядок — не алфавітний, а за частотою: побачення й подорожі пара
 * заводить щотижня, «Навчання» й «Для дому» — кілька разів на рік.
 */
export const PLAN_CATEGORIES: Record<PlanCategory, PlanCategoryDef> = {
  date: { label: 'Побачення', Icon: GlassesIcon, color: 'var(--plan-cat-date)' },
  trip: { label: 'Подорож', Icon: PlaneIcon, color: 'var(--plan-cat-trip)' },
  ride: { label: 'Поїздка', Icon: CarIcon, color: 'var(--plan-cat-ride)' },
  place: { label: 'Місце', Icon: MapPinIcon, color: 'var(--plan-cat-place)' },
  event: { label: 'Захід', Icon: TicketIcon, color: 'var(--plan-cat-event)' },
  activity: { label: 'Активність', Icon: ActivityIcon, color: 'var(--plan-cat-activity)' },
  rest: { label: 'Відпочинок', Icon: MugIcon, color: 'var(--plan-cat-rest)' },
  holiday: { label: 'Свято', Icon: SparkIcon, color: 'var(--plan-cat-holiday)' },
  learning: { label: 'Навчання', Icon: BookIcon, color: 'var(--plan-cat-learning)' },
  home: { label: 'Для дому', Icon: HouseIcon, color: 'var(--plan-cat-home)' },
  other: { label: 'Інше', Icon: DotsIcon, color: 'var(--plan-cat-other)' },
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
