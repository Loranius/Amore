// ============================================================
// «Що ви дивились того року?» — четвертий модуль проходу.
// ------------------------------------------------------------
// З'явився лише тоді, коли в `media_items` завелась дата завершення
// (ADR-0080). До неї рушій датував переглянуте днем СТВОРЕННЯ рядка, тож
// «ми дивились це у сімнадцятому» лягло б у поточний рік — крок обіцяв
// би те, чого не робить.
//
// Виміряно, чого він вартий: рік із трьома модулями впирався в 0.613, з
// чотирма дає 0.707 — тобто саме медіа переводять прохід через ціль
// 0.68, названу в ADR-0077 на самому початку.
//
// Книжок тут немає навмисно: TMDB їх не шукає (`useTmdbSearch` вимикає
// себе для `book`), а поле без пошуку в проході — це вже не один дотик.
// Книжку пара додає у вотчлісті, і рушій зарахує її так само.
// ============================================================
import { useState } from 'react';
import { SearchIcon } from '@/components/icons/UiIcon';
import { useTmdbSearch } from '@/features/media/useTmdb';
import type { MediaType, TmdbSearchResult } from '@/types';
import { SweepEntryList } from './SweepEntryList';
import type { SweepEntry } from './useHistorySweep';
import type { RelationshipYearFill } from './yearFills';

interface SweepWatchedProps {
  year: RelationshipYearFill;
  entries: readonly SweepEntry[];
  isSaving: boolean;
  onAdd: (item: TmdbSearchResult, type: MediaType) => Promise<void>;
  onRemove: (entry: SweepEntry) => void;
}

const KINDS: readonly { type: MediaType; label: string }[] = [
  { type: 'movie', label: 'Фільм' },
  { type: 'series', label: 'Серіал' },
];

export function SweepWatched({ year, entries, isSaving, onAdd, onRemove }: SweepWatchedProps) {
  const [type, setType] = useState<MediaType>('movie');
  const [query, setQuery] = useState('');
  const [said, setSaid] = useState('');
  const search = useTmdbSearch(query, type);
  const found = search.data ?? [];

  async function pick(item: TmdbSearchResult) {
    await onAdd(item, type);
    setSaid(`«${item.title}» — у ${year.label} році.`);
    setQuery('');
  }

  return (
    <div className="sweep-part">
      <h2 className="sweep-sub">Що ви дивились того року?</h2>
      <p className="sweep-hint">
        Кіно й серіали — окремий модуль, тож перший же фільм важить стільки ж,
        скільки перша віха: рік складається з того, скількох різних частин
        життя він торкнувся.
      </p>

      <div className="sweep-chips">
        {KINDS.map((kind) => (
          <button
            type="button"
            key={kind.type}
            className={`sweep-chip${type === kind.type ? ' sweep-chip--on' : ''}`}
            onClick={() => { setType(kind.type); setSaid(''); }}
          >
            {kind.label}
          </button>
        ))}
      </div>

      <div className="sweep-search">
        <SearchIcon size={16} />
        <input
          type="text"
          className="input sweep-search-input"
          value={query}
          placeholder="Назва…"
          onChange={(event) => { setQuery(event.target.value); setSaid(''); }}
          aria-label={`Що ви дивились у ${year.label} році`}
        />
      </div>

      {search.isFetching && <p className="sweep-hint">Шукаю…</p>}

      {found.length > 0 && (
        <ul className="sweep-found">
          {found.slice(0, 6).map((item) => (
            <li key={item.tmdb_id}>
              <button
                type="button"
                className="sweep-found-item"
                disabled={isSaving}
                onClick={() => { void pick(item); }}
              >
                {item.poster_url !== null && (
                  <img className="sweep-found-poster" src={item.poster_url} alt="" loading="lazy" />
                )}
                <span className="sweep-found-name">
                  {item.title}
                  {item.year !== '' && <small> · {item.year}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {said !== '' && <p className="sweep-said">{said}</p>}

      <SweepEntryList
        entries={entries}
        isSaving={isSaving}
        onRemove={onRemove}
        removeVerb="Прибрати"
        empty="У цьому році ще нічого не позначено переглянутим."
      />
    </div>
  );
}
