// ============================================================
// Значки категорій міток на карті.
// ------------------------------------------------------------
// Особливість цього набору: маркери карти — це живі вузли DOM, які
// створює імперативний код (`mapMarkers.ts`), а не React. Тому шляхи
// лежать окремою константою, а React-компонент і будівник вузла беруть
// їх з одного місця. Дві копії тих самих кривих розійшлись би при
// першій же правці.
// ============================================================
import { iconAttrs, STROKE, type IconProps } from './iconBase';
import type { PinCategory } from '@/types';

/**
 * Криві по категоріях.
 *
 * «Були» — галочка, а не шпилька: сам маркер уже крапля, і шпилька
 * всередині шпильки нічого не додає.
 */
export const PIN_CATEGORY_PATHS: Record<PinCategory, readonly string[]> = {
  visited: ['m5.4 12.4 4.2 4.2L18.6 7.2'],
  restaurant: [
    'M7 3.2v7.2a2.4 2.4 0 0 0 4.8 0V3.2',
    'M9.4 10.6V20.8',
    'M17.2 3.2c-1.6 1-2.4 2.8-2.4 5s.8 3.4 2.4 3.4V20.8',
  ],
  favorite: ['m12 3.6 2.62 5.5 5.88.82-4.28 4.3 1.04 6.02L12 17.3l-5.26 2.94 1.04-6.02L3.5 9.92l5.88-.82L12 3.6Z'],
};

function CategoryIcon({ cat, size, className }: { cat: PinCategory; size: number; className: string }) {
  return (
    <svg {...iconAttrs(size, className)}>
      {PIN_CATEGORY_PATHS[cat].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export function PinCategoryIcon({
  cat, size = 24, className = '',
}: IconProps & { cat: PinCategory }) {
  return <CategoryIcon cat={cat} size={size} className={className} />;
}

/**
 * Той самий значок як вузол DOM — для маркера карти.
 *
 * `createElementNS` замість innerHTML: рядок довелось би збирати
 * конкатенацією, а це саме той шлях, яким у розмітку зрештою потрапляє
 * щось неочікуване. Тут узагалі немає рядків ззовні, але звичка дешева.
 */
export function pinCategoryNode(cat: PinCategory, size: number): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(STROKE));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of PIN_CATEGORY_PATHS[cat]) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/** Серце як вузол DOM — маркер геолокації партнера на карті. */
export function heartNode(size: number): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute(
    'd',
    'M12 20.3c-.35.22-.79.22-1.14 0C9 19.06 3.6 15.3 3.6 10.6a4.1 4.1 0 0 1 7.83-1.72A4.1 4.1 0 0 1 19.26 10.6c0 4.7-5.4 8.46-7.26 9.7Z',
  );
  svg.appendChild(path);
  return svg;
}

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
