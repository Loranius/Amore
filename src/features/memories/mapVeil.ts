// ============================================================
// Карта-вуаль: світ порталу проступає крізь мапу спогадів (ADR-0216).
// ------------------------------------------------------------
// Власник: «зроби так само [як у модулях — просвітлювалось] для мапи
// спогадів». Карта — це непрозорі шари стилю: тло, вода, забудова. Крізь
// них світу не видно, хоч би що робила сторінка.
//
// Правило просте й перевірене тестом:
//  - ТЛО карти зникає зовсім — суша без заливки стає вікном у світ;
//  - ЗАЛИВКИ (вода, парки, забудова) — напівпрозорі, щоб мапа лишалась
//    мапою: де річка, а де квартал, видно й далі;
//  - ЛІНІЇ й ПІДПИСИ не чіпаються: дороги й назви — це те, за чим пара
//    шукає місце, і вони мусять лишатись чіткими.
//
// Заливка, чия прозорість уже залежить від масштабу (вираз `interpolate`),
// лишається як є: MapLibre не дозволяє загорнути вираз масштабу в множення,
// а такі шари й так напівпрозорі.
// ============================================================

export interface VeilLayer {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
}

export interface VeilChange {
  id: string;
  property: 'background-opacity' | 'fill-opacity';
  value: number;
}

/** Прозорість заливок під вуаллю. */
export const MAP_VEIL_FILL = 0.5;

function isZoomExpression(value: unknown): boolean {
  return Array.isArray(value);
}

export function mapVeilChanges(layers: readonly VeilLayer[]): VeilChange[] {
  const changes: VeilChange[] = [];
  for (const layer of layers) {
    if (layer.type === 'background') {
      changes.push({ id: layer.id, property: 'background-opacity', value: 0 });
      continue;
    }
    if (layer.type !== 'fill') continue;
    const current = layer.paint?.['fill-opacity'];
    if (isZoomExpression(current)) continue;
    const base = typeof current === 'number' ? current : 1;
    changes.push({ id: layer.id, property: 'fill-opacity', value: Math.min(base, MAP_VEIL_FILL) });
  }
  return changes;
}
