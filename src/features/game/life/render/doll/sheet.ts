// ============================================================
// Аркуш шару людини: рядки — напрями (0 до нас, 1 ліворуч, 2 праворуч,
// 3 від нас), стовпці — кадри. Кольори лише непрозорі або порожні: жодних
// напівпрозорих пікселів, тож при масштабуванні «найближчим сусідом»
// нічого не змішується.
// ============================================================
import { hexToRgb } from '../pixel';
import { paletteOf, type Doll } from './dolls';
import { CELL, DOLL_DIRS, renderLayer, type LayerName } from './rig';

export interface Rgba {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** Аркуш одного шару (поки один кадр «стоїть» на напрям). Порожній шар — прозорий аркуш. */
export function layerSheet(d: Doll, layer: LayerName): Rgba {
  const pal = paletteOf(d);
  const width = CELL.w;
  const height = CELL.h * DOLL_DIRS.length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (const dir of DOLL_DIRS) {
    const rows = renderLayer(layer, dir, d);
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x += 1) {
        const k = r[x]!;
        if (k === '.') continue;
        const hex = pal[k];
        if (!hex) throw new Error(`Люди: ключу «${k}» шару ${layer} не дано кольору`);
        const [R, G, B] = hexToRgb(hex);
        const i = ((dir * CELL.h + y) * width + x) * 4;
        data[i] = R;
        data[i + 1] = G;
        data[i + 2] = B;
        data[i + 3] = 255;
      }
    });
  }
  return { width, height, data };
}
