import { stableHash32 } from '@/engine/evolution/seed';

// ============================================================
// Геометрія альбому на сторінці спогаду: пропорція кадру й колонки.
// ------------------------------------------------------------
// Симетричне віяло карток сітки жило тут, доки галереєю була сітка. Сітку
// замінила «нитка часу» (ADR-0249), і її однобічне віяло рахує
// `memoryThread.ts::threadFan`.
//
// Чистий модуль без React і без CSS: числа перевіряє тест, а не око.
// ============================================================

/** Дробове число 0…1 із цілого. Фіналізатор — щоб сусідні `id` не злипались. */
function unit(seed: string): number {
  let value = stableHash32(seed);
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97) >>> 0;
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
}

// ── Альбом на сторінці спогаду ──────────────────────────────

/**
 * Пропорції кадру в альбомі спогаду.
 *
 * Три форми, а не одна: бриф просить «різні пропорції фото». Однакові
 * квадрати дають каталог товарів, а не альбом.
 *
 * Значення — це `aspect-ratio`, тобто ширина поділена на висоту. Кадр
 * обрізається по `object-fit: cover`; так само працює будь-який полароїд —
 * рамка має свій формат, і знімок у неї вкладають, а не навпаки.
 */
const ALBUM_SHAPES = [0.78, 1, 1.34] as const;

export function photoAspect(id: number): number {
  return ALBUM_SHAPES[Math.floor(unit(`shape:${id}`) * ALBUM_SHAPES.length)] ?? 1;
}

/**
 * Розкладка альбому в дві колонки.
 *
 * Не `column-count` і не masonry: обидва розкладають ПО ВЕРТИКАЛІ, тобто
 * перше фото опиняється над другим, а не поруч із ним — і хронологія, яку
 * пара щойно склала руками, читається зигзагом.
 *
 * Тому колонки набираються тут, і набираються ЖАДІБНО: наступний кадр іде в
 * ту колонку, яка зараз коротша. Висота кадру відома наперед (це обернена
 * пропорція), тож перебирати нічого не треба.
 */
export function albumColumns<T extends { id: number }>(
  photos: readonly T[],
  columns = 2,
): T[][] {
  const lanes: T[][] = Array.from({ length: Math.max(1, columns) }, () => []);
  const heights = new Array<number>(lanes.length).fill(0);

  for (const photo of photos) {
    let shortest = 0;
    for (let lane = 1; lane < heights.length; lane += 1) {
      if (heights[lane]! < heights[shortest]!) shortest = lane;
    }
    lanes[shortest]!.push(photo);
    // Висота при однаковій ширині — це 1 / (ширина ÷ висота).
    heights[shortest] = heights[shortest]! + 1 / photoAspect(photo.id);
  }

  return lanes;
}
