// ============================================================
// Mapbox — токен + геокодинг (порт geocode-частин map.js)
// ------------------------------------------------------------
// mapbox-gl тепер npm-пакет (типізований), тож старий any-виняток для
// CDN-бібліотеки більше не потрібен. Токен — публічний pk (як у старому
// бандлі), читаємо з env із фолбеком.
// ============================================================
import type { MapboxFeature, GeocodeResult } from '@/types';

export const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ??
  'pk.eyJ1IjoiZGVpbW8iLCJhIjoiY21xZ2pzMGh3MDB4ZjJxcG1rdGo1MnRldCJ9.zZLQQDugc3XC14fOWY1Ftw';

/** Пошук місць за текстом (для випадаючого списку). */
export async function geocodePlaces(query: string): Promise<MapboxFeature[]> {
  const url =
    'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
    encodeURIComponent(query) +
    `.json?access_token=${MAPBOX_TOKEN}&limit=5&language=uk`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: MapboxFeature[] };
    return json.features ?? [];
  } catch (e) {
    console.error('geocode error:', e);
    return [];
  }
}

/** Зворотний геокод: координати → { address, city }. */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  try {
    const url =
      'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
      `${lng},${lat}.json?types=address,place&language=uk&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    const data = (await res.json()) as { features?: MapboxFeature[] };
    const features = data.features ?? [];

    let address = '';
    let city = '';

    const addr = features.find((f) => f.place_type?.includes('address'));
    if (addr) {
      address = addr.text ?? '';
      if (addr.address) address = `${address}, ${addr.address}`;
    }

    const cityFeat = features.find(
      (f) => f.place_type?.includes('place') || f.place_type?.includes('locality'),
    );
    if (!cityFeat && addr) {
      const placeCtx = (addr.context ?? []).find((c) => c.id.startsWith('place'));
      if (placeCtx) city = placeCtx.text ?? '';
    } else if (cityFeat) {
      city = cityFeat.text ?? '';
    }

    // Mapbox завжди додає повну контекстну ієрархію (включно з країною)
    // до кожної фічі, незалежно від фільтру types= у запиті.
    const countryCtx = (cityFeat?.context ?? addr?.context ?? []).find((c) =>
      c.id.startsWith('country'),
    );
    const country = countryCtx?.text ?? '';

    return { address, city, country };
  } catch (e) {
    console.warn('reverseGeocode error:', e);
    return { address: '', city: '', country: '' };
  }
}

export const directionsUrl = (lat: number, lng: number): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
