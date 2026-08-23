// ============================================================
// WhereToPage — «Куди піти» (порт whereto.js UI)
// ------------------------------------------------------------
// Пошук подій/місць у місті пари через events-finder. «Пошук подій»
// показує денний кеш (без нового веб-пошуку), «Ще варіанти» — свіжий.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { OBLASTS, readWhereToCache, writeWhereToCache } from './whereToConstants';
import { useWhereToLocation, useSaveLocation, useEventsSearch } from './useWhereTo';
import { Card } from '@/components/ui/Card';
import { geocodeCities, type UkraineCity } from '@/lib/geo';
import type { WhereToLocation, WhereToEvent } from '@/types';

import { PageHeader } from '@/components/ui/PageHeader';

import { MapPinIcon } from '@/components/icons/MapIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshIcon, SearchIcon } from '@/components/icons/UiIcon';

export function WhereToPage() {
  const { data: location } = useWhereToLocation();
  const saveLoc = useSaveLocation();
  const searchMut = useEventsSearch();

  const [results, setResults] = useState<WhereToEvent[]>([]);
  const [cityModal, setCityModal] = useState(false);
  const [embed, setEmbed] = useState<WhereToEvent | null>(null);
  const avoid = useRef<string[]>([]);

  // Перший вхід без міста — одразу пропонуємо обрати.
  useEffect(() => {
    if (location === null) setCityModal(true);
  }, [location]);

  // При наявній локації — підхоплюємо денний кеш.
  useEffect(() => {
    if (!location) return;
    const cached = readWhereToCache(location.city);
    if (cached) {
      setResults(cached);
      avoid.current = cached.map((e) => e.title);
    }
  }, [location]);

  const runSearch = (more: boolean) => {
    if (!location) {
      setCityModal(true);
      return;
    }
    if (!more) {
      const cached = readWhereToCache(location.city);
      if (cached) {
        setResults(cached);
        avoid.current = cached.map((e) => e.title);
        return;
      }
      avoid.current = [];
    }
    searchMut.mutate(
      { location, avoid: avoid.current },
      {
        onSuccess: (events) => {
          setResults(events);
          avoid.current = [...avoid.current, ...events.map((e) => e.title)];
          if (!more) writeWhereToCache(location.city, events);
        },
      },
    );
  };

  return (
    <section className="whereto pink-page">
      <PageHeader
        title="Куди піти"
        eyebrow="Події поруч"
        meta="Концерти, вистави й місця у вашому місті."
      />
      <div className="wt-head">
        <button type="button" className="wt-city-btn" onClick={() => setCityModal(true)}>
          <MapPinIcon size={16} />
          <span>{location ? `${location.city} · змінити` : 'Обрати місто'}</span>
        </button>
        <button
          type="button"
          className="btn wt-search-btn"
          onClick={() => runSearch(false)}
          disabled={searchMut.isPending}
        >
          <SearchIcon size={17} />
          <span>{searchMut.isPending ? 'Шукаю…' : 'Пошук подій'}</span>
        </button>
      </div>

      <div className="wt-results">
        {searchMut.isPending ? (
          <Card className="cul-loading">
            <div className="cul-loading-emoji">🗺️</div>
            <p className="cul-loading-text">Клод моніторить {location?.city}…</p>
            <p className="cul-step-hint">Шукаю події й цікаві місця на найближчі дні</p>
          </Card>
        ) : searchMut.isError ? (
          <Card className="cul-loading">
            <div className="cul-loading-emoji">😕</div>
            <p className="cul-loading-text">Не вдалось знайти події</p>
            <p className="cul-step-hint">
              {searchMut.error instanceof Error ? searchMut.error.message : 'Спробуй ще раз за хвилину'}
            </p>
          </Card>
        ) : results.length > 0 ? (
          <>
            {results.map((ev, i) => (
              <EventCard key={i} ev={ev} onOpen={() => setEmbed(ev)} />
            ))}
            <button type="button" className="btn-secondary wt-more-btn" onClick={() => runSearch(true)}>
              <RefreshIcon size={16} />
              <span>Ще варіанти</span>
            </button>
          </>
        ) : (
          <EmptyState
            icon={location ? <SearchIcon size={26} /> : <MapPinIcon size={26} />}
            title={location ? 'Ще нічого не шукали' : 'Місто не обране'}
            /* Місто в підказці НЕ згадується, і це не забудькуватість.
               Перша редакція писала «у ${location.city}» і дала «у
               Вінниця» замість «у Вінниці»: «у» вимагає місцевого
               відмінка, а відмінювати довільну назву міста портал не
               вміє (Вінниця→Вінниці, Львів→Львові, Одеса→Одесі).
               Місто й так стоїть на кнопці просто над цим текстом. */
            hint={location
              ? 'Пошук збере концерти, вистави й цікаві місця на найближчі дні.'
              : 'Події шукаються по місту — оберіть його, і портал знайде, куди піти.'}
            action={location ? undefined : (
              <button type="button" className="btn" onClick={() => setCityModal(true)}>
                Обрати місто
              </button>
            )}
          />
        )}
      </div>

      {cityModal && (
        <CityModal
          current={location ?? null}
          onClose={() => setCityModal(false)}
          onSave={(loc) => saveLoc.mutate(loc, { onSuccess: () => setCityModal(false) })}
        />
      )}
      {embed && <EmbedModal ev={embed} onClose={() => setEmbed(null)} />}
    </section>
  );
}

function EventCard({ ev, onOpen }: { ev: WhereToEvent; onOpen: () => void }) {
  const meta = [ev.when, ev.place].filter(Boolean).join(' · ');
  return (
    <div className="card wt-card">
      <div className="wt-card-head">
        {ev.kind === 'місце' ? (
          <span className="wt-badge wt-badge--place">🌳 місце</span>
        ) : (
          <span className="wt-badge wt-badge--event">🎫 подія</span>
        )}
        {ev.price && <span className="wt-price">{ev.price}</span>}
      </div>
      <p className="wt-title">{ev.title}</p>
      {meta && <p className="wt-meta">{meta}</p>}
      {ev.off_note && <p className="wt-offnote">🗓 {ev.off_note}</p>}
      {ev.description && <p className="wt-desc">{ev.description}</p>}
      {ev.url && (
        <button type="button" className="btn wt-open-btn" onClick={onOpen}>
          ✨ Прийняти й відкрити
        </button>
      )}
    </div>
  );
}

/**
 * Де ви зараз: одне поле, підказки з геокодера, область сама.
 *
 * Було два незалежні контроли: `<select>` із 27 областей і вільний
 * текст під ним. Ніщо їх не пов'язувало — «Львів» у «Вінницькій
 * області» зберігався без єдиного слова, — а область при першому вході
 * ще й стояла на `OBLASTS[0]`, тобто «Вінницька» виглядала відповіддю
 * пари, хоча її ніхто не давав.
 *
 * Тепер відповідь одна: пара пише місто, а область приїжджає з тим
 * самим геокодером OSM, який уже возить «Спогади» (ADR-0039). Поле
 * області лишилось — але нижче, підписане як те, що заповнюється саме,
 * і виправити його можна. Це не обережність заради обережності:
 * Nominatim — громадський сервіс, і день, коли він мовчить, не має
 * бути днем, коли місто задати неможливо.
 *
 * **Це підтвердження, а не автодоповнення, і так навмисно.** Перша
 * редакція показувала список із першої ж пари літер. Виміряно прямим
 * запитом до Nominatim: `featureType=settlement` шукає ЦІЛИМИ словами —
 * «Вінн» віддає порожньо, «Вінниця» віддає одне місто. Тобто список,
 * обіцяний як «пиши три літери й обирай», мовчав би рівно доти, доки
 * назва не набрана повністю, і виглядав би зламаним.
 *
 * Тому робота розділена так, як її насправді робить геокодер:
 *
 *  - один збіг, що дослівно збігається з набраним, — область
 *    підставляється мовчки, зайвого дотику немає;
 *  - кілька збігів — питаємо, і це не педантизм: «Львів» є в
 *    чотирьох областях, зокрема в Дніпропетровській і Миколаївській;
 *  - жодного — кажемо про це прямо, і поле області лишається під
 *    рукою.
 */
function CityModal({
  current,
  onClose,
  onSave,
}: {
  current: WhereToLocation | null;
  onClose: () => void;
  onSave: (loc: WhereToLocation) => void;
}) {
  const [region, setRegion] = useState(current?.region ?? '');
  const [city, setCity] = useState(current?.city ?? '');
  const [hints, setHints] = useState<UkraineCity[]>([]);
  const [asking, setAsking] = useState(false);
  /** Що сказав геокодер про набране: `null` — ще нічого не питали. */
  const [verdict, setVerdict] = useState<'exact' | 'none' | null>(null);
  /*
   * Підказки замовкають після вибору, і саме тому це окремий стан.
   *
   * Без нього тап по «Вінниця» ставив текст у поле, текст запускав
   * пошук, і список відкривався знову — просто над щойно обраним
   * містом. Пара обирала, а екран показував їй те саме питання.
   */
  const [picked, setPicked] = useState(current !== null);

  useEffect(() => {
    const text = city.trim();
    // Три літери — не кругле число: найкоротші назви міст України саме
    // такі («Бар»). Менше — і запит гарантовано порожній.
    if (picked || text.length < 3) {
      setHints([]);
      setVerdict(null);
      return;
    }
    let alive = true;
    setAsking(true);
    // 350 мс — та сама пауза, що й у пошуку місця спогаду: Nominatim
    // просить не частіше разу на секунду, і чергу тримає сам `geo.ts`.
    const timer = setTimeout(() => {
      geocodeCities(text)
        .then((found) => {
          if (!alive) return;
          const only = found.length === 1 ? found[0]! : null;
          if (only && only.city.toLowerCase() === text.toLowerCase()) {
            // Однозначно. Питати нема про що — область просто стає відома.
            if (only.region) setRegion(only.region);
            setHints([]);
            setVerdict('exact');
            return;
          }
          setHints(found);
          setVerdict(found.length === 0 ? 'none' : null);
        })
        .catch(() => {
          // Геокодер мовчить — не привід блокувати збереження: область
          // нижче лишається звичайним полем, як і була.
          if (alive) { setHints([]); setVerdict('none'); }
        })
        .finally(() => { if (alive) setAsking(false); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [city, picked]);

  const pick = (one: UkraineCity) => {
    setCity(one.city);
    if (one.region) setRegion(one.region);
    setPicked(true);
    setHints([]);
  };

  const save = () => {
    const c = city.trim();
    if (!c) return;
    onSave({ region: region.trim(), city: c });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="wt-city-heading">
        <h2 className="modal-title" id="wt-city-heading">Де ви зараз?</h2>
        <p className="modal-sub">Місто вирішує, де шукати події. Область підставиться сама.</p>

        <label className="form-field wt-city-field">
          <span>Місто</span>
          <input
            id="wt-city"
            name="city"
            type="text"
            autoComplete="off"
            value={city}
            onChange={(e) => { setCity(e.target.value); setPicked(false); setVerdict(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && city.trim()) save(); }}
            placeholder="Наприклад: Дніпро"
            autoFocus
          />
          {!picked && city.trim().length >= 3 && (
            <div className="wt-city-hints">
              {hints.length > 0 && (
                <>
                  <span className="wt-city-hint-note">Таких міст кілька — котре ваше?</span>
                  {hints.map((one) => (
                    <button
                      key={`${one.city}|${one.region}`}
                      type="button"
                      className="wt-city-hint"
                      onClick={() => pick(one)}
                    >
                      <b>{one.city}</b>
                      {one.region && <small>{one.region}</small>}
                    </button>
                  ))}
                </>
              )}
              {hints.length === 0 && (
                <span className="wt-city-hint-note">
                  {asking ? 'Звіряю з картою…'
                    : verdict === 'exact' ? `Знайшли: ${region || 'область невідома'}`
                    : verdict === 'none' ? 'Такого міста не знайшли — область можна обрати нижче.'
                    : ''}
                </span>
              )}
            </div>
          )}
        </label>

        <label className="form-field">
          <span>Область <small className="wt-city-auto">заповнюється сама</small></span>
          <select id="wt-region" name="region" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">— не вказано —</option>
            {OBLASTS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={!city.trim()}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}

function EmbedModal({ ev, onClose }: { ev: WhereToEvent; onClose: () => void }) {
  return (
    <div className="modal-overlay wt-embed-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wt-embed">
        <div className="wt-embed-bar">
          <span className="wt-embed-title">{ev.title}</span>
          {ev.url && (
            <a className="wt-embed-ext" href={ev.url} target="_blank" rel="noopener noreferrer">
              У браузері ↗
            </a>
          )}
          <button type="button" className="wt-embed-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="wt-embed-hint">
          Якщо нижче порожньо — сайт заборонив вбудовування, тисни «У браузері»
        </p>
        {ev.url && <iframe className="wt-embed-frame" src={ev.url} referrerPolicy="no-referrer" title={ev.title} />}
      </div>
    </div>
  );
}
