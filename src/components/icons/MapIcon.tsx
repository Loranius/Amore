// ============================================================
// Значки карти й місць: шпилька, компас, приціл.
// ------------------------------------------------------------
// Значки категорій міток (галочка, ресторан, зірка) і серце партнера
// жили тут для імперативних маркерів `mapMarkers.ts`; той модуль
// видалено, і вони лишились без жодного виклику — прибрано.
// ============================================================
import { iconAttrs, type IconProps } from './iconBase';

/** Шпилька — місце. Використовується поза картою: у джерелах «Спогадів». */
export function MapPinIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M12 21.2s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10.2" r="2.6" />
    </svg>
  );
}

/** Компас — маршрут. */
export function CompassIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9 4.9-1.9Z" />
    </svg>
  );
}

/** Приціл — «я тут». */
export function CrosshairIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <circle cx="12" cy="12" r="7.4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6" />
    </svg>
  );
}
