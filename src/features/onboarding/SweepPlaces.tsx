// ============================================================
// «Де ви були того року?» — місця в проході по роках.
// ------------------------------------------------------------
// ЧОМУ ЦЕ ОКРЕМИЙ БЛОК, А НЕ ЩЕ ОДНА ФІШКА. Виміряно на рушії: сім віх
// в одному модулі дають рокові 0.473, а план ПЛЮС одне датоване місце —
// 0.566. Наповненість зважена в бік широти, тож другий модуль важить
// більше, ніж скільки завгодно дотиків у першому (ADR-0078).
//
// Пошук — той самий гак, що й у нотатнику спогадів (`usePlaceSearch`):
// пауза, поріг і перегони відповідей уже вирішені там, і другої копії
// правил Nominatim у порталі бути не повинно.
// ============================================================
import { useState } from 'react';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { SearchIcon } from '@/components/icons/UiIcon';
import { usePlaceSearch } from '@/features/memories/usePlaceSearch';
import { placeLabel } from '@/features/memories/momentPlace';
import type { PlaceCandidate } from '@/features/memories/momentPlace';
import type { PlaceResult } from './useHistorySweep';
import type { RelationshipYearFill } from './yearFills';

interface SweepPlacesProps {
  year: RelationshipYearFill;
  /** Скільки датованих міток уже лежить у цьому році. */
  count: number;
  isSaving: boolean;
  onAdd: (place: PlaceCandidate) => Promise<PlaceResult>;
}

/** Що сказати парі після дотику. Третій рядок — відмова, названа вголос. */
function outcomeText(result: PlaceResult, title: string, label: number): string {
  switch (result.kind) {
    case 'created':
      return `${title} — на карті, у ${label} році.`;
    case 'dated':
      return `${title} уже був на карті без дати — тепер він належить ${label} року.`;
    case 'taken':
      return result.label === null
        ? `${title} уже позначений іншим разом, тож цей рік він не підніме.`
        : `${title} уже позначений ${result.label} роком. Мітка тримає одну дату,`
          + ' тож цей рік вона не підніме.';
  }
}

export function SweepPlaces({ year, count, isSaving, onAdd }: SweepPlacesProps) {
  const [query, setQuery] = useState('');
  const [said, setSaid] = useState('');
  const { found, searching } = usePlaceSearch(query);

  async function pick(place: PlaceCandidate) {
    const result = await onAdd(place);
    setSaid(outcomeText(result, place.title, year.label));
    setQuery('');
  }

  return (
    <section className="sweep-step">
      <h2 className="sweep-question">Де ви були того року?</h2>
      <p className="sweep-hint">
        {/*
          * Названо числом навмисно: пара має бачити, що це не «ще одне
          * поле», а найдорожчий дотик на екрані.
          */}
        Місце важить більше за ще одну віху: план плюс одне місце піднімають
        рік вище, ніж сім віх поспіль.
      </p>

      <div className="sweep-search">
        <SearchIcon size={16} />
        <input
          type="text"
          className="input sweep-search-input"
          value={query}
          placeholder="Місто, вулиця, кав'ярня…"
          onChange={(event) => { setQuery(event.target.value); setSaid(''); }}
          aria-label={`Де ви були у ${year.label} році`}
        />
      </div>

      {searching && <p className="sweep-hint">Шукаю…</p>}

      {found.length > 0 && (
        <ul className="sweep-found">
          {found.map((place) => (
            <li key={`${place.lat},${place.lng},${place.title}`}>
              <button
                type="button"
                className="sweep-found-item"
                disabled={isSaving}
                onClick={() => { void pick(place); }}
              >
                <MapPinIcon size={16} />
                <span className="sweep-found-name">{placeLabel(place)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {said !== '' && <p className="sweep-said">{said}</p>}

      <p className="sweep-hint">
        {count === 0
          ? 'У цьому році ще немає жодного місця на карті.'
          : `У цьому році вже ${count} на карті.`}
      </p>
    </section>
  );
}
