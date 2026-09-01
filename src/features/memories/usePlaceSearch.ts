// ============================================================
// Пошук місця геокодером — один на весь портал.
// ------------------------------------------------------------
// Ефект нижче стояв усередині `PlaceSheet`, і поки читач був один, це
// було правильно. Читачів стало двоє: заповнення історії питає в пари
// «де ви були того року?» тим самим пошуком.
//
// Друга копія тут коштувала б дорожче, ніж виглядає. Пауза в 350 мс і
// поріг у три символи — не оздоба, а домовленість із Nominatim, у якого
// писане правило «не частіше разу на секунду» й покарання за IP
// (`lib/geo.ts`). Дві копії розійшлись би тихо: одна лишилась би з
// паузою, друга — з тим, що хтось колись вирішив, що 200 мс «швидше», і
// заблокований був би весь портал, а не той екран.
// ============================================================
import { useEffect, useState } from 'react';
import { geocodePlaces } from '@/lib/geo';
import { placeFromFeature } from './momentPlace';
import type { PlaceCandidate } from './momentPlace';

/** Коротше за це геокодер віддає пів країни. Той самий поріг, що в `geo.ts`. */
const MIN_QUERY = 3;

/**
 * Пауза між останньою натиснутою літерою й запитом.
 *
 * Без неї кожна літера — окреме звернення: «Хмельницький» коштував би
 * дванадцять запитів замість одного, і відповіді приходили б не в тому
 * порядку, у якому їх просили.
 */
const DEBOUNCE_MS = 350;

export interface PlaceSearch {
  found: PlaceCandidate[];
  searching: boolean;
}

export function usePlaceSearch(query: string): PlaceSearch {
  const [found, setFound] = useState<PlaceCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY) { setFound([]); setSearching(false); return; }
    setSearching(true);
    /*
     * `alive` закриває перегони: відповідь на «Льв» не має права
     * перезаписати відповідь на «Львів», хай би якою прийшла раніше.
     */
    let alive = true;
    const timer = setTimeout(() => {
      void geocodePlaces(text).then((features) => {
        if (!alive) return;
        setFound(features.map(placeFromFeature).filter((p): p is PlaceCandidate => p !== null));
        setSearching(false);
      });
    }, DEBOUNCE_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [query]);

  return { found, searching };
}
