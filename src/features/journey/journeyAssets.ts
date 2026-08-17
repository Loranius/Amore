// ============================================================
// Асети сцени «Наш шлях».
// ------------------------------------------------------------
// Два файли, і більше жодного: небо навколо пари й сонце, яким розкривається
// обрана подія. Обидва — CC-BY-4.0, атрибуція лежить поруч у
// `public/models/AMORE_JOURNEY_LICENSE.txt`.
//
// Стелі тут не побажання, а те, що стереже `journeyAssets.test.ts`: він читає
// самі контейнери. Скайбокс приїхав на 8.12 МБ однією PNG 2048×2048 — це
// більше за всю решту асетів застосунку разом. Текстуру перетиснуто в WebP
// усередині контейнера через `EXT_texture_webp`; зменшити її не можна, бо
// точкові зірки на 1536 px змазуються (PSNR по пікселях зірок падає з 23.1 дБ
// до 15.6 дБ — виміряно на цій самій текстурі).
// ============================================================

export const JOURNEY_SKYBOX_PATH = 'models/amore_journey_skybox.glb';
export const JOURNEY_SUN_PATH = 'models/amore_journey_sun.glb';
export const JOURNEY_LICENSE_PATH = 'models/AMORE_JOURNEY_LICENSE.txt';

/** Стеля контейнера скайбокса. Оригінал важив 8 511 640 байтів. */
export const JOURNEY_SKYBOX_MAX_BYTES = 900_000;
/** Сонце їде як є — воно й так дрібне. */
export const JOURNEY_SUN_MAX_BYTES = 160_000;

/** Роздільність панорами. Зменшення забороняє тест, а не смак. */
export const JOURNEY_SKYBOX_TEXTURE_SIZE = 2_048;

/** Обидві сфери низькополігональні; гладкість дає нормаль, не сітка. */
export const JOURNEY_MAX_TRIANGLES = 1_200;

/** URL асета в збірці. Моделі не імпортуються — вони лежать у `public/`. */
export function journeyAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
