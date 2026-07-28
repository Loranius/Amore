// ============================================================
// Спільна основа мальованих значків.
// ------------------------------------------------------------
// Один набір параметрів на всі іконки: без нього кожен файл заводив би
// власну товщину лінії й власні закінчення, і за десяток значків набір
// перестав би виглядати одним набором.
//
// `currentColor` — принципово: значок бере колір від батька, тож той
// самий файл працює і міткою кольору типу, і білою літерою на активній
// вкладці, і приглушеною дією в кутку картки.
//
// Розмір іде у width/height, viewBox лишається 24×24: так товщина
// обведення масштабується разом зі значком, а не «худне» на великих.
// ============================================================
export interface IconProps {
  size?: number;
  className?: string;
}

export const STROKE = 1.7;

export function iconAttrs(size: number, className: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className,
  };
}
