// ============================================================
// TMDB — клієнт The Movie DB (спільний для media + swipe)
// ------------------------------------------------------------
// Ключ публічний (клієнтський, як у старому бандлі) — читаємо з
// env із фолбеком. Усі відповіді TMDB нетипізовані ззовні, тож
// звужуємо їх на межі вручну до наших типів (TmdbSearchResult тощо).
// ============================================================
import type { TmdbSearchResult, TmdbDetails, SwipeCard, MediaType, SwipeType } from '@/types';

const KEY = import.meta.env.VITE_TMDB_KEY ?? '1b28cacaab2f90a8c2bd0c383c636f01';
const BASE = 'https://api.themoviedb.org/3';
const IMG_SM = 'https://image.tmdb.org/t/p/w185';
const IMG_LG = 'https://image.tmdb.org/t/p/w500';

/** Мінімум полів TMDB, які реально читаємо (решта ігнорується). */
interface TmdbRaw {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  runtime?: number;
  genres?: { name: string }[];
}
interface TmdbVideo {
  site: string;
  type: string;
  key: string;
}

const apiType = (t: MediaType | SwipeType) => (t === 'series' ? 'tv' : 'movie');

async function getJson(path: string, lang = 'uk-UA'): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}api_key=${KEY}&language=${lang}`);
  return res.json() as Promise<Record<string, unknown>>;
}

/** Пошук двома мовами (uk+en), дедуплікація за id, до 8 результатів. */
export async function tmdbSearch(query: string, type: MediaType): Promise<TmdbSearchResult[]> {
  const t = apiType(type);
  const q = encodeURIComponent(query);
  try {
    const [uk, en] = await Promise.all([
      getJson(`/search/${t}?query=${q}&page=1`, 'uk-UA'),
      getJson(`/search/${t}?query=${q}&page=1`, 'en-US'),
    ]);
    const raw = [
      ...((uk.results as TmdbRaw[]) ?? []),
      ...((en.results as TmdbRaw[]) ?? []),
    ];
    const seen = new Set<number>();
    const out: TmdbSearchResult[] = [];
    for (const r of raw) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({
        tmdb_id: r.id,
        title: r.title || r.name || '?',
        poster_url: r.poster_path ? IMG_SM + r.poster_path : null,
        year: (r.release_date || r.first_air_date || '').slice(0, 4),
        rating: r.vote_average ? r.vote_average.toFixed(1) : null,
        overview: r.overview || '',
      });
      if (out.length >= 8) break;
    }
    return out;
  } catch (e) {
    console.error('tmdbSearch error:', e);
    return [];
  }
}

/** Деталі за назвою: пошук → перший збіг → details + videos (трейлер). */
export async function tmdbDetails(
  title: string,
  type: MediaType,
  fallbackPoster: string | null,
): Promise<TmdbDetails | null> {
  const t = apiType(type);
  const q = encodeURIComponent(title);
  try {
    const [uk, en] = await Promise.all([
      getJson(`/search/${t}?query=${q}&page=1`, 'uk-UA'),
      getJson(`/search/${t}?query=${q}&page=1`, 'en-US'),
    ]);
    const first =
      ((uk.results as TmdbRaw[]) ?? [])[0] ?? ((en.results as TmdbRaw[]) ?? [])[0];
    if (!first) return null;

    const [d, v] = await Promise.all([
      getJson(`/${t}/${first.id}`, 'uk-UA'),
      getJson(`/${t}/${first.id}/videos`, 'en-US'),
    ]);
    const details = d as unknown as TmdbRaw;
    const trailer = ((v.results as TmdbVideo[]) ?? []).find(
      (x) => x.site === 'YouTube' && (x.type === 'Trailer' || x.type === 'Teaser'),
    );
    return {
      title: details.title || details.name || title,
      overview: details.overview || first.overview || '',
      year: (details.release_date || details.first_air_date || '').slice(0, 4),
      rating: details.vote_average ? details.vote_average.toFixed(1) : null,
      runtime: details.runtime ?? null,
      genres: (details.genres ?? []).slice(0, 3).map((g) => g.name),
      backdrop: details.backdrop_path ? 'https://image.tmdb.org/t/p/w780' + details.backdrop_path : null,
      poster: details.poster_path ? 'https://image.tmdb.org/t/p/w342' + details.poster_path : fallbackPoster,
      youtubeKey: trailer ? trailer.key : null,
    };
  } catch (e) {
    console.error('tmdbDetails error:', e);
    return null;
  }
}

/** Стрічка популярного для свайпу; фільтрує неевропейські назви. */
export async function tmdbDiscover(type: SwipeType, page: number): Promise<SwipeCard[]> {
  const t = apiType(type);
  try {
    const data = await getJson(`/discover/${t}?sort_by=popularity.desc&page=${page}`);
    const results = (data.results as TmdbRaw[]) ?? [];
    return results
      .filter((r) => {
        const title = r.title || r.name || '';
        return !/[\u3000-\u9fff\uac00-\ud7af\u0600-\u06ff]/.test(title);
      })
      .map((r) => ({
        tmdb_id: r.id,
        title: r.title || r.name || '?',
        overview: r.overview || '',
        poster_path: r.poster_path ? IMG_LG + r.poster_path : null,
        year: (r.release_date || r.first_air_date || '').slice(0, 4),
        rating: r.vote_average ? r.vote_average.toFixed(1) : null,
      }));
  } catch (e) {
    console.error('tmdbDiscover error:', e);
    return [];
  }
}

/** YouTube-ключ трейлера за tmdb_id (для модалки свайпу). */
export async function tmdbTrailer(type: SwipeType, tmdbId: number): Promise<string | null> {
  try {
    const v = await getJson(`/${apiType(type)}/${tmdbId}/videos`, 'en-US');
    const trailer = ((v.results as TmdbVideo[]) ?? []).find(
      (x) => x.site === 'YouTube' && (x.type === 'Trailer' || x.type === 'Teaser'),
    );
    return trailer ? trailer.key : null;
  } catch {
    return null;
  }
}
