// ============================================================
// Геометрія карти плану: нитки між блоками й стелі вмісту.
// ------------------------------------------------------------
// Без React і без DOM — на вхід ідуть прямокутники, на вихід криві. Саме тут
// живуть три правила, які макет (`docs/prototypes/plans-map.html`) вивів
// вимірюванням, а не здогадом:
//
// 1. Нитка між блоками в РІЗНИХ рядах іде згори вниз, між блоками в ОДНОМУ
//    ряду — вбік. Ознака одна: наскільки вони перекриваються по вертикалі.
// 2. Тісні сусіди не з'єднуються взагалі. У ряді між блоками 11 px, а по
//    вертикалі вони розходяться на сорок; крива в такому вікні виходить не
//    ниткою, а закарлючкою — на макеті вона читалась як значок помилки.
// 3. Стеля вмісту тримає екран без скролу. Карта не має куди прокручуватись,
//    тому довгий список мусить обриватись рядком «ще N», а не з'їжджати під
//    док.
//
// Числа тут — не смак, а розмір екрана: 739 px під карту на 412×915 після
// шапки й дока, і найважчий план займає 727 з них.
// ============================================================

export interface MapRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapThread {
  /** Крива у координатах полотна карти. */
  d: string;
  /** Кінці — там малюються вузлики, щоб нитка не обривалась у порожнечі. */
  from: MapPoint;
  to: MapPoint;
}

/** Скільки пунктів підготовки видно до «ще N». */
export const VISIBLE_TASKS = 4;

/** Скільки рядків зв'язків видно в блоці «Пов'язане». */
export const VISIBLE_LINKS = 3;

/**
 * Мінімальний проміжок, у якому нитку ще видно ниткою.
 *
 * Менше — і крива згортається сама в себе між двома краями.
 */
const MIN_SIDE_GAP = 26;

/** Яка частка спільної висоти означає «блоки стоять поруч, а не один під одним». */
const SIDE_OVERLAP = 0.45;

const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * Перші N елементів і скільки лишилось за кадром.
 *
 * Повертає новий масив: зрізати на місці означало б псувати кеш React Query,
 * звідки список приходить за посиланням.
 */
export function capped<T>(items: readonly T[], limit: number): { shown: T[]; hidden: number } {
  const shown = items.slice(0, limit);
  return { shown, hidden: Math.max(0, items.length - shown.length) };
}

/**
 * Нитка між двома блоками або `null`, коли її краще не малювати.
 *
 * Координати — відносно `frame`, тобто полотна карти: SVG лежить під блоками
 * у тих самих межах, і перерахунок в екранні координати нікому не потрібен.
 */
export function threadBetween(a: MapRect, b: MapRect, frame: MapRect): MapThread | null {
  if (a.width < 1 || b.width < 1 || frame.width < 1) return null;

  const aBottom = a.top + a.height;
  const bBottom = b.top + b.height;
  const overlap = Math.min(aBottom, bBottom) - Math.max(a.top, b.top);
  const sideways = overlap > Math.min(a.height, b.height) * SIDE_OVERLAP;

  if (sideways) {
    const [first, second] = a.left <= b.left ? [a, b] : [b, a];
    const firstRight = first.left + first.width;
    if (second.left - firstRight < MIN_SIDE_GAP) return null;

    const from = { x: firstRight - frame.left, y: first.top + first.height * 0.62 - frame.top };
    const to = { x: second.left - frame.left, y: second.top + second.height * 0.42 - frame.top };
    const bend = Math.max(18, (to.x - from.x) * 0.6);
    return curve(from, to, { x: from.x + bend, y: from.y }, { x: to.x - bend, y: to.y });
  }

  const [upper, lower] = a.top <= b.top ? [a, b] : [b, a];
  const from = {
    x: upper.left + upper.width * 0.5 - frame.left,
    y: upper.top + upper.height - frame.top,
  };
  const to = {
    x: lower.left + lower.width * 0.5 - frame.left,
    y: lower.top - frame.top,
  };
  const bend = Math.max(20, (to.y - from.y) * 0.55);
  return curve(from, to, { x: from.x, y: from.y + bend }, { x: to.x, y: to.y - bend });
}

function curve(from: MapPoint, to: MapPoint, c1: MapPoint, c2: MapPoint): MapThread {
  const at = (point: MapPoint) => `${round(point.x)} ${round(point.y)}`;
  return {
    d: `M ${at(from)} C ${at(c1)}, ${at(c2)}, ${at(to)}`,
    from: { x: round(from.x), y: round(from.y) },
    to: { x: round(to.x), y: round(to.y) },
  };
}
