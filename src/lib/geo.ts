import type { GeocodeResult, GeoFeature } from '@/types';

// ============================================================
// Геокодер на OpenStreetMap (Nominatim).
// ------------------------------------------------------------
// Замінює Mapbox Geocoding API. Причина не в грошах, а в ключі: портал
// пішов від Mapbox цілком (ADR-0039), а Mapbox без токена не віддає
// нічого. Nominatim не потребує ключа взагалі.
//
// **Що з цього виходить платити.** Nominatim — громадський сервіс, і в
// нього є писані правила користування:
//
//  - не більше одного запиту на секунду;
//  - обов'язковий `User-Agent` або `Referer`, за яким видно застосунок;
//  - результати можна кешувати, і саме цього від нас і чекають.
//
// Перше правило тримає пауза в полі пошуку (350 мс) плюс черга нижче:
// вона не дає двом запитам піти одночасно, хай би скільки місць пара
// набирала. Друге в браузері не наше — `User-Agent` підставляє сам
// браузер, а `Referer` іде з домену порталу. Третє — кеш у пам'яті на
// час сесії.
//
// Форма відповіді навмисно лишилась `GeoFeature`. Не з ліні: цей тип
// уже вживають `PlaceSheet` і `momentPlace.placeFromFeature`, і міняти
// його означало б чіпати розбір координат — рівно те місце, де
// переплутані місцями широта й довгота ставлять хмельницьку терасу в
// Судан. Тип лишається, джерело даних під ним міняється.
// ============================================================

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Мова відповідей. Портал україномовний, і назви мають бути такі самі. */
const LANGUAGE = 'uk';

/**
 * Мінімальна пауза між запитами до Nominatim, у мілісекундах.
 *
 * Правило сервісу — не частіше разу на секунду. Порушення карається
 * блокуванням за IP, тобто картою, яка перестане шукати геть у всіх.
 * Тисяча плюс запас: мережева затримка сама по собі рознесе запити, але
 * покладатись на неї не можна.
 */
const MIN_GAP_MS = 1100;

let nextSlot = 0;

/**
 * Черга з одного місця: наступний запит чекає, поки мине пауза.
 *
 * Проста обіцянка, а не бібліотека: усе, що тут потрібно — знати, коли
 * звільниться наступне вікно, і посунути його вперед.
 */
async function slot(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

/**
 * Кеш на час сесії.
 *
 * Nominatim прямо просить кешувати, і причина зрозуміла: пара шукає ті
 * самі кілька міст, а зворотний геокод тієї самої мітки повторюється
 * щоразу, коли відкривається її картка.
 */
const cache = new Map<string, unknown>();

async function ask<T>(path: string): Promise<T | null> {
  const hit = cache.get(path);
  if (hit !== undefined) return hit as T;
  try {
    await slot();
    const res = await fetch(`${NOMINATIM}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as T;
    cache.set(path, json);
    return json;
  } catch (e) {
    console.warn('[geo] Nominatim не відповів:', e);
    return null;
  }
}

/** Те, що Nominatim повертає в `address`. Полів там більше — беремо потрібні. */
interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  /** Область. Nominatim віддає її повною назвою: «Вінницька область». */
  state?: string;
  country?: string;
  country_code?: string;
}

export interface NominatimPlace {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

/**
 * Населений пункт із адреси.
 *
 * Nominatim кладе його в різні поля залежно від розміру: місто в `city`,
 * містечко в `town`, село в `village`, хутір у `hamlet`. Перебрати всі —
 * єдиний спосіб не отримати порожнє місто на пів країни.
 */
function settlement(a: NominatimAddress | undefined): string {
  if (!a) return '';
  return (a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? '').trim();
}

/** Вулиця з номером будинку, якщо він відомий. */
function street(a: NominatimAddress | undefined): string {
  if (!a) return '';
  const road = (a.road ?? a.pedestrian ?? '').trim();
  if (!road) return '';
  const house = (a.house_number ?? '').trim();
  return house ? `${road}, ${house}` : road;
}

/**
 * Коротка назва місця для рядка результату.
 *
 * `name` є не завжди (у будинку його немає взагалі), тож запасний шлях —
 * вулиця, потім населений пункт, потім перший сегмент повного підпису.
 */
function shortName(place: NominatimPlace): string {
  const own = (place.name ?? '').trim();
  if (own) return own;
  const road = street(place.address);
  if (road) return road;
  const town = settlement(place.address);
  if (town) return town;
  return (place.display_name ?? '').split(',')[0]?.trim() ?? '';
}

/**
 * Одне місце Nominatim → `GeoFeature`, або `null`.
 *
 * Винесено окремо навмисно: це єдине місце модуля, де є координати, і
 * єдине, яке можна (і треба) перевірити тестом без мережі.
 */
export function featureFromPlace(place: NominatimPlace): GeoFeature | null {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const name = shortName(place);
  if (!name) return null;

  const context: Array<{ id: string; text?: string }> = [];
  const town = settlement(place.address);
  if (town) context.push({ id: 'place.osm', text: town });
  const country = (place.address?.country ?? '').trim();
  if (country) context.push({ id: 'country.osm', text: country });

  return {
    text: name,
    // Порядок [довгота, широта] — контракт GeoJSON, і саме його чекає
    // `placeFromFeature`. Переставлені місцями числа тут дали б мітку на
    // іншому континенті, і жоден тип цього не спіймає.
    center: [lng, lat],
    place_name: place.display_name ?? name,
    context,
  };
}

/**
 * Адреса Nominatim → `GeocodeResult`. Теж чиста, теж заради тесту.
 */
export function resultFromPlace(place: NominatimPlace | null): GeocodeResult {
  if (!place) return { address: '', city: '', country: '' };
  return {
    address: street(place.address) || (place.name ?? '').trim(),
    city: settlement(place.address),
    country: (place.address?.country ?? '').trim(),
  };
}

/**
 * Пошук місць за текстом.
 *
 * Повертає `GeoFeature[]` — форму, яку вже розбирає
 * `momentPlace.placeFromFeature`. Контекст збирається вручну з полів
 * адреси: `place.*` для міста, `country.*` для країни, бо саме за цими
 * префіксами розбір і шукає.
 */
export async function geocodePlaces(query: string): Promise<GeoFeature[]> {
  const text = query.trim();
  if (text.length < 3) return [];
  const path =
    `/search?q=${encodeURIComponent(text)}&format=jsonv2&addressdetails=1` +
    `&limit=6&accept-language=${LANGUAGE}`;
  const found = await ask<NominatimPlace[]>(path);
  if (!Array.isArray(found)) return [];
  return found
    .map(featureFromPlace)
    .filter((f): f is GeoFeature => f !== null);
}

/**
 * Чи справді підказка стосується набраного.
 *
 * Nominatim шукає за всім записом місця, а не лише за назвою, тож у
 * відповіді трапляється населений пункт, чия назва з набраним не має
 * нічого спільного. Виміряно живим запитом «Львів»: серед чотирьох
 * відповідей приїхало «Семисотське сільське поселення» в АР Крим — там
 * усередині є хутір Львів. У списку підтвердження такий рядок питає
 * пару про місто, якого вона не писала.
 */
export function matchesQuery(one: UkraineCity, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return one.city.toLowerCase().includes(needle);
}

/** Населений пункт України: те, що потрібно «Куди піти». */
export interface UkraineCity {
  city: string;
  /** Область у тій самій формі, що й `OBLASTS`: «Вінницька», «м. Київ». */
  region: string;
}

/**
 * Область Nominatim → область у словнику порталу.
 *
 * Nominatim віддає повну назву («Вінницька область»), а список
 * `OBLASTS` тримає коротку («Вінницька») — і зберігати треба саме ту,
 * що є в списку, інакше `<select>` не покаже нічого обраного, а
 * events-finder отримає рядок, якого не чекає.
 *
 * Три міста зі спеціальним статусом Nominatim віддає без слова
 * «область» узагалі («Київ»), і в списку вони теж окремі («м. Київ»).
 * Крим приходить як «Автономна Республіка Крим».
 */
export function regionFromState(state: string | undefined): string {
  const raw = (state ?? '').trim();
  if (!raw) return '';
  if (/^Автономна Республіка Крим$/i.test(raw)) return 'АР Крим';
  if (/^Київ$/i.test(raw)) return 'м. Київ';
  if (/^Севастополь$/i.test(raw)) return 'м. Севастополь';
  const short = raw.replace(/\s+обл(асть|\.)?$/i, '').trim();
  return short || raw;
}

/**
 * Одне місце Nominatim → населений пункт, або `null`.
 *
 * `null` тут означає «відповідь без назви міста». Такі приходять:
 * `featureType=settlement` не гарантує, що адреса заповнена, і місце без
 * назви в списку виглядало б порожнім рядком, який нікуди не веде.
 */
export function cityFromPlace(place: NominatimPlace): UkraineCity | null {
  const city = settlement(place.address) || (place.name ?? '').trim();
  if (!city) return null;
  return { city, region: regionFromState(place.address?.state) };
}

/**
 * Прибирає повтори за парою «місто + область».
 *
 * Nominatim на один запит легко віддає ту саму Вінницю кількома
 * записами — містом, громадою й районом, — і в списку вибору це три
 * однакові рядки, з яких пара мусить обрати навмання.
 */
export function dedupeCities(cities: readonly UkraineCity[]): UkraineCity[] {
  const seen = new Set<string>();
  const out: UkraineCity[] = [];
  for (const one of cities) {
    const key = `${one.city}|${one.region}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(one);
  }
  return out;
}

/**
 * Пошук населеного пункту в Україні: текст → місто плюс область.
 *
 * Окремо від `geocodePlaces` навмисно. Той шукає МІСЦЕ — кав'ярню,
 * вулицю, будинок — і повертає координати. Тут потрібне інше: назва
 * міста й область, у якій воно лежить, без жодних координат. Спільним
 * запитом це не робиться, бо `featureType=settlement` відсіює саме те,
 * що потрібно першому, і навпаки.
 */
export async function geocodeCities(query: string): Promise<UkraineCity[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const path =
    `/search?q=${encodeURIComponent(text)}&format=jsonv2&addressdetails=1`
    + `&countrycodes=ua&featureType=settlement&limit=6&accept-language=${LANGUAGE}`;
  const found = await ask<NominatimPlace[]>(path);
  if (!Array.isArray(found)) return [];
  const cities = found.map(cityFromPlace).filter((c): c is UkraineCity => c !== null);
  return dedupeCities(cities.filter((c) => matchesQuery(c, text)));
}

/**
 * Зворотний геокод: координати → адреса, місто, країна.
 *
 * `zoom=18` — рівень «будинок». Дрібніше Nominatim віддає квартал і
 * вулицю зникає; крупніше — назву області замість міста.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const empty: GeocodeResult = { address: '', city: '', country: '' };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return empty;

  const path =
    `/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1` +
    `&zoom=18&accept-language=${LANGUAGE}`;
  return resultFromPlace(await ask<NominatimPlace>(path));
}

/**
 * Посилання «прокласти маршрут».
 *
 * Лишається на Google Maps і після переходу порталу на OSM: це не карта
 * всередині застосунку, а передача точки в те, чим людина вже
 * користується на телефоні.
 */
export const directionsUrl = (lat: number, lng: number): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
