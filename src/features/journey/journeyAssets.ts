// ============================================================
// Асети сцени «Наш шлях».
// ------------------------------------------------------------
// Один файл: сонце, яким розкривається обрана подія. CC-BY-4.0, атрибуція лежить поруч у
// `public/models/AMORE_JOURNEY_LICENSE.txt`.
//
// Стелі тут не побажання, а те, що стереже `journeyAssets.test.ts`: він читає
// самі контейнери.
//
// **Скайбокса тут більше немає (ADR-0214).** Панорама на 8.5 МБ вантажилась
// довго й на екрані була розтягнута втричі; небо тепер малюється
// (`journeySky.ts`). Лишилось сонце.
// ============================================================

export const JOURNEY_SUN_PATH = 'models/amore_journey_sun.glb';
export const JOURNEY_LICENSE_PATH = 'models/AMORE_JOURNEY_LICENSE.txt';

/** Сонце їде як є — воно й так дрібне. */
export const JOURNEY_SUN_MAX_BYTES = 160_000;

/** Сфера сонця низькополігональна; гладкість дає нормаль, не сітка. */
export const JOURNEY_MAX_TRIANGLES = 1_200;

/** URL асета в збірці. Моделі не імпортуються — вони лежать у `public/`. */
export function journeyAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
