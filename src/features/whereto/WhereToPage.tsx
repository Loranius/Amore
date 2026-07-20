// ============================================================
// WhereToPage — «Куди піти» (порт whereto.js UI)
// ------------------------------------------------------------
// Пошук подій/місць у місті пари через events-finder. «Пошук подій»
// показує денний кеш (без нового веб-пошуку), «Ще варіанти» — свіжий.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { OBLASTS, readWhereToCache, writeWhereToCache } from './whereToConstants';
import { useWhereToLocation, useSaveLocation, useEventsSearch } from './useWhereTo';
import { PortalDecor } from '@/features/auth/PortalDecor';
import type { WhereToLocation, WhereToEvent } from '@/types';

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
      <PortalDecor density="light" parallax={false} />
      <div className="wt-head">
        <button type="button" className="wt-city-btn" onClick={() => setCityModal(true)}>
          {location ? `📍 ${location.city} · змінити` : '📍 Обрати місто'}
        </button>
        <button
          type="button"
          className="btn wt-search-btn"
          onClick={() => runSearch(false)}
          disabled={searchMut.isPending}
        >
          {searchMut.isPending ? '🔎 Шукаю…' : '🔎 Пошук подій'}
        </button>
      </div>

      <div className="wt-results">
        {searchMut.isPending ? (
          <div className="cul-card cul-loading">
            <div className="cul-loading-emoji">🗺️</div>
            <p className="cul-loading-text">Клод моніторить {location?.city}…</p>
            <p className="cul-step-hint">Шукаю події й цікаві місця на найближчі дні</p>
          </div>
        ) : searchMut.isError ? (
          <div className="cul-card cul-loading">
            <div className="cul-loading-emoji">😕</div>
            <p className="cul-loading-text">Не вдалось знайти події</p>
            <p className="cul-step-hint">
              {searchMut.error instanceof Error ? searchMut.error.message : 'Спробуй ще раз за хвилину'}
            </p>
          </div>
        ) : results.length > 0 ? (
          <>
            {results.map((ev, i) => (
              <EventCard key={i} ev={ev} onOpen={() => setEmbed(ev)} />
            ))}
            <button type="button" className="btn-secondary wt-more-btn" onClick={() => runSearch(true)}>
              🔄 Ще варіанти
            </button>
          </>
        ) : (
          <p className="empty-state">
            {location ? 'Натисни «Пошук подій» 🔎' : 'Спершу обери місто 📍'}
          </p>
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

function CityModal({
  current,
  onClose,
  onSave,
}: {
  current: WhereToLocation | null;
  onClose: () => void;
  onSave: (loc: WhereToLocation) => void;
}) {
  const [region, setRegion] = useState(current?.region ?? OBLASTS[0]);
  const [city, setCity] = useState(current?.city ?? '');

  const save = () => {
    const c = city.trim();
    if (!c) return;
    onSave({ region, city: c });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Де ви зараз?</h2>
        <label className="form-field">
          <span>Область</span>
          <select id="wt-region" name="region" value={region} onChange={(e) => setRegion(e.target.value)}>
            {OBLASTS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Місто</span>
          <input
            id="wt-city"
            name="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Наприклад: Дніпро"
            autoFocus
          />
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
