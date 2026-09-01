// ============================================================
// Вибір місця для спогаду.
// ------------------------------------------------------------
// Три входи, у порядку від найдешевшого до найдорожчого:
//
//  1. **місце зі знімка** — якщо в EXIF був GPS, координата вже відома, і
//     пара просто підтверджує підпис;
//  2. **місця, де пара вже була** — мітки карти спогадів. Найчастіший
//     випадок: тераса, парк, дача повторюються десятками разів;
//  3. **пошук** — геокодер OpenStreetMap, коли місця ще немає на карті.
//
// Власної карти тут немає навмисно. Вона важить кілька сотень кілобайт і
// вантажиться довше, ніж триває сам вибір; для «постав крапку на карті» є
// повноекранна карта спогадів, і дублювати її всередині нотатника не варто.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { CloseIcon, SearchIcon } from '@/components/icons/UiIcon';
import { placeLabel } from './momentPlace';
import { usePlaceSearch } from './usePlaceSearch';
import type { PlaceCandidate } from './momentPlace';
import type { MomentPlace } from './useMoments';

interface PlaceSheetProps {
  /** Мітки карти — щоб не заводити другу таку саму. */
  known: readonly MomentPlace[];
  /** Місце зі знімка, якщо EXIF його дав. */
  fromPhoto: PlaceCandidate | null;
  onPick: (place: PlaceCandidate, pinId: number | null) => void;
  onClear: () => void;
  onClose: () => void;
}

export function PlaceSheet({ known, fromPhoto, onPick, onClear, onClose }: PlaceSheetProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Пауза, поріг і перегони живуть у самому гаку — його ділять два екрани.
  const { found, searching } = usePlaceSearch(query);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const matchingKnown = known
    .filter((pin) => {
      const text = query.trim().toLowerCase();
      if (!text) return true;
      return placeLabel(pin).toLowerCase().includes(text);
    })
    .slice(0, 6);

  return (
    <div className="mm-sheet" role="dialog" aria-label="Місце спогаду">
      <header className="mm-sheet-head">
        <b>Місце</b>
        <button type="button" className="mm-icon-btn" onClick={onClose} aria-label="Закрити">
          <CloseIcon size={20} />
        </button>
      </header>

      <label className="mm-search">
        <SearchIcon size={18} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Знайти місце"
          enterKeyHint="search"
        />
      </label>

      <div className="mm-sheet-body">
        {fromPhoto && !query.trim() && (
          <button
            type="button"
            className="mm-place-row mm-place-row--exif"
            onClick={() => onPick(fromPhoto, null)}
          >
            <MapPinIcon size={17} />
            <span>
              <b>{placeLabel(fromPhoto)}</b>
              <i>Із метаданих знімка</i>
            </span>
          </button>
        )}

        {matchingKnown.map((pin) => (
          <button
            key={pin.id}
            type="button"
            className="mm-place-row"
            onClick={() => onPick(
              { title: pin.title ?? '', city: pin.city, country: pin.country, lat: pin.lat, lng: pin.lng },
              pin.id,
            )}
          >
            <MapPinIcon size={17} />
            <span><b>{placeLabel(pin)}</b><i>На вашій карті</i></span>
          </button>
        ))}

        {searching && <p className="mm-sheet-note">Шукаю…</p>}

        {found.map((place, i) => (
          <button
            key={`${place.lat},${place.lng},${i}`}
            type="button"
            className="mm-place-row"
            onClick={() => onPick(place, null)}
          >
            <MapPinIcon size={17} />
            <span><b>{place.title}</b><i>{placeLabel({ city: place.city, country: place.country })}</i></span>
          </button>
        ))}

        {!searching && query.trim().length >= 3 && found.length === 0 && matchingKnown.length === 0 && (
          <p className="mm-sheet-note">Нічого не знайшлось.</p>
        )}
      </div>

      <button type="button" className="btn btn-ghost mm-sheet-clear" onClick={onClear}>
        Без місця
      </button>
    </div>
  );
}
