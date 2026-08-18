import type { MapboxFeature } from '@/types';

// ============================================================
// Місце спогаду.
// ------------------------------------------------------------
// Спогад НЕ зберігає власних координат. Він посилається на мітку «Нашої
// карти» (`map_pins`), і причина не в економії полів: пара вже має карту
// відвіданих місць, і якби архів завів свої точки, та сама тераса існувала
// б двічі — окремо на карті й окремо в спогаді, з різними назвами.
//
// Наслідок, за який доводиться платити: перед тим як прив'язати місце,
// треба знайти, чи такої мітки ще немає. Саме це й рахує `nearestPin`.
//
// Модуль чистий: ні мережі, ні бази. Пошук у Mapbox і вставка мітки живуть
// у хуках, а тут — тільки арифметика й розбір відповіді.
// ============================================================

/** Місце, яке пара щойно обрала, але яке ще може не існувати як мітка. */
export interface PlaceCandidate {
  title: string;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
}

/** Уже наявна мітка карти — рівно ті поля, за якими її можна впізнати. */
export interface PinLike {
  id: number;
  title: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
}

/**
 * Підпис місця в рядку спогаду: «Тераса, Хмельницький».
 *
 * Місто дописується лише коли воно не повторює назву. Інакше мітка
 * «Хмельницький» дала б «Хмельницький, Хмельницький» — а таких міток на
 * карті пари вистачає, бо назва часто береться з геокодера як є.
 */
export function placeLabel(place: {
  title?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const title = (place.title ?? '').trim();
  const city = (place.city ?? '').trim();
  const country = (place.country ?? '').trim();

  const head = title || city || country;
  if (!head) return '';

  const tail = city && city !== head ? city : country && country !== head ? country : '';
  return tail ? `${head}, ${tail}` : head;
}

/**
 * Відстань між двома точками в метрах.
 *
 * Плоске наближення, а не гаверсинус: воно вживається лише для питання
 * «це та сама мітка?» на дистанціях у сотні метрів, де кривина Землі
 * дає похибку нижче сантиметра. Косинус широти обов'язковий — без нього
 * градус довготи в Україні рахувався б на 40% довшим, ніж він є.
 */
export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const METRES_PER_DEGREE = 111_320;
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dy = (a.lat - b.lat) * METRES_PER_DEGREE;
  const dx = (a.lng - b.lng) * METRES_PER_DEGREE * Math.cos(midLat);
  return Math.hypot(dx, dy);
}

/**
 * Наскільки близько дві точки вважаються одним місцем.
 *
 * 120 метрів — це приблизно квартал. Менше (скажімо, 25 м) означало б, що
 * координата з EXIF і координата з геокодера тієї самої кав'ярні дадуть
 * дві мітки: GPS телефона в місті рідко точніший за півсотні метрів.
 * Більше (півкілометра) почало б склеювати сусідні заклади в один.
 */
export const SAME_PLACE_METRES = 120;

/**
 * Найближча наявна мітка в межах допуску, або `null`.
 *
 * Повертається саме НАЙБЛИЖЧА, а не перша-ліпша в радіусі: у центрі міста
 * в коло 120 м потрапляє кілька міток, і взяти першу за порядком у базі
 * означало б прив'язати спогад до випадкової сусідньої.
 */
export function nearestPin<T extends PinLike>(
  pins: readonly T[],
  point: { lat: number; lng: number },
  tolerance: number = SAME_PLACE_METRES,
): T | null {
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const pin of pins) {
    if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) continue;
    const distance = metresBetween(pin, point);
    if (distance <= tolerance && distance < bestDistance) {
      best = pin;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Відповідь геокодера → кандидат на мітку.
 *
 * `center` у Mapbox іде як [довгота, широта] — саме в такому порядку, і це
 * найчастіша помилка при роботі з GeoJSON. Місто й країна беруться з
 * контексту фічі, який Mapbox додає завжди, незалежно від `types=`.
 */
export function placeFromFeature(feature: MapboxFeature): PlaceCandidate | null {
  const [lng, lat] = feature.center ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const context = feature.context ?? [];
  const pick = (prefix: string) =>
    context.find((c) => c.id.startsWith(prefix))?.text?.trim() || null;

  const title = (feature.text ?? '').trim() || (feature.place_name ?? '').split(',')[0]?.trim() || '';
  if (!title) return null;

  const city = pick('place') ?? pick('locality');
  return {
    title,
    city: city === title ? null : city,
    country: pick('country'),
    lat,
    lng,
  };
}
