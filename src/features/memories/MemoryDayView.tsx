// ============================================================
// Екран одного дня — СПІЛЬНИЙ для всіх трьох виглядів.
// ------------------------------------------------------------
// Вибір вигляду міняє лише те, як виглядає огляд архіву. День один: тут
// живуть фільтри за джерелом, блоки за частиною доби й опис дня, і
// тримати три копії цієї логіки означало б три місця, де вони розійдуться.
// ============================================================
import { useMemo, useState } from 'react';
import { MemoryMosaic, SOURCE_META } from './MemoryPhoto';
import { formatMemoryDate, memoryTime, splitByTimeOfDay, TIME_BUCKET_LABEL } from './memoriesDate';
import { moveMemory, orderChanged, orderPatch } from './memoriesOrder';
import type { MemoryLinksById } from './useMemories';
import type { MemoryRow, MemorySource } from '@/types';

type Filter = 'all' | 'manual' | MemorySource;

interface MemoryDayViewProps {
  date: string;
  photos: MemoryRow[];
  links: MemoryLinksById;
  description: string | null;
  savingOrder: boolean;
  onBack: () => void;
  onOpen: (photo: MemoryRow) => void;
  onSaveOrder: (patch: Array<{ id: number; sort_order: number }>) => void;
}

export function MemoryDayView({
  date, photos, links, description, savingOrder, onBack, onOpen, onSaveOrder,
}: MemoryDayViewProps) {
  const [filter, setFilter] = useState<Filter>('all');
  // null — звичайний перегляд; масив — чернетка порядку, ще не збережена.
  const [draft, setDraft] = useState<MemoryRow[] | null>(null);

  const counts = useMemo(() => {
    const c: Partial<Record<Filter, number>> = { all: photos.length, manual: 0 };
    for (const p of photos) {
      const sources = links[p.id] ?? [];
      if (sources.length === 0) c.manual = (c.manual ?? 0) + 1;
      for (const s of sources) c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [photos, links]);

  const shown = photos.filter((p) => {
    if (filter === 'all') return true;
    const sources = links[p.id] ?? [];
    return filter === 'manual' ? sources.length === 0 : sources.includes(filter);
  });

  const groups = splitByTimeOfDay(shown);
  // Блоки доби мають сенс лише коли час справді відомий і день не з двох
  // знімків — інакше «Ранок 1 · Вечір 1» це заголовки заради заголовків.
  const useBuckets = groups.length > 1 && shown.length > 4;

  const chips: Array<[Filter, string]> = [
    ['all', 'Усі'],
    ['manual', 'Вручну'],
    ...(Object.keys(SOURCE_META) as MemorySource[]).map(
      (s) => [s, SOURCE_META[s].short] as [Filter, string],
    ),
  ];
  const visibleChips = chips.filter(([k]) => counts[k]);

  return (
    <section className="mem-day">
      <header className="mem-day-hd">
        <button type="button" className="mem-back" onClick={onBack}>‹ Назад</button>
        <h2>{formatMemoryDate(date, photos[0]?.date_precision ?? 'day')}</h2>
        <div className="mem-day-row">
          <p className="mem-day-meta">{photos.length} фото</p>
          {/* Переставляти є сенс лише коли знімків більше одного. */}
          {photos.length > 1 && draft === null && (
            <button type="button" className="mem-order-toggle" onClick={() => { setFilter('all'); setDraft(photos); }}>
              Порядок
            </button>
          )}
        </div>
      </header>

      {description && draft === null && <p className="mem-day-desc">{description}</p>}

      {draft !== null ? (
        <MemoryReorder
          photos={draft}
          busy={savingOrder}
          onMove={(index, delta) => setDraft((d) => (d ? moveMemory(d, index, delta) : d))}
          onCancel={() => setDraft(null)}
          onSave={() => {
            if (!orderChanged(photos, draft)) { setDraft(null); return; }
            onSaveOrder(orderPatch(draft));
            setDraft(null);
          }}
        />
      ) : (
      <>
      {visibleChips.length > 2 && (
        <div className="mem-filters">
          {visibleChips.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="mem-chip"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label} {counts[key]}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="empty-state">У цій добірці порожньо.</p>
      ) : useBuckets ? (
        groups.map((group) => (
          <div key={group.bucket ?? 'untimed'}>
            <p className="mem-part">
              {group.bucket ? TIME_BUCKET_LABEL[group.bucket] : 'Без часу'}
            </p>
            <MemoryMosaic photos={group.photos} links={links} onOpen={onOpen} />
          </div>
        ))
      ) : (
        <MemoryMosaic photos={shown} links={links} onOpen={onOpen} />
      )}
      </>
      )}
    </section>
  );
}

/**
 * Режим перестановки: список замість мозаїки.
 *
 * Стрілки, а не перетягування. Перетягування по сітці 3×3 на телефоні
 * промахується пальцем і не має жодного шляху з клавіатури; список із
 * «вгору/вниз» працює і там, і там, і не вимагає власного шару жестів.
 *
 * Порядок — чернетка до натискання «Зберегти»: помилкове торкання не
 * має одразу писати в базу й смикати весь архів перезавантаженням.
 */
function MemoryReorder({
  photos, busy, onMove, onCancel, onSave,
}: {
  photos: readonly MemoryRow[];
  busy: boolean;
  onMove: (index: number, delta: number) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mem-order">
      <p className="mem-order-hint">
        Перетягування замінили стрілки — так само працює і пальцем, і з клавіатури.
        Порядок збережеться лише після «Готово».
      </p>
      <ol className="mem-order-list">
        {photos.map((photo, i) => (
          <li key={photo.id} className="mem-order-row">
            <span className="mem-order-n">{i + 1}</span>
            <img src={photo.photo_url} alt="" loading="lazy" decoding="async" />
            <span className="mem-order-cap">
              {photo.caption ?? memoryTime(photo.taken_at) ?? 'Без підпису'}
            </span>
            <span className="mem-order-btns">
              <button
                type="button" className="mem-order-btn"
                onClick={() => onMove(i, -1)} disabled={i === 0 || busy}
                aria-label={`Пересунути вище, зараз ${i + 1}`}
              >↑</button>
              <button
                type="button" className="mem-order-btn"
                onClick={() => onMove(i, 1)} disabled={i === photos.length - 1 || busy}
                aria-label={`Пересунути нижче, зараз ${i + 1}`}
              >↓</button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mem-order-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Скасувати</button>
        <button type="button" className="btn" onClick={onSave} disabled={busy}>
          {busy ? 'Зберігаю…' : 'Готово'}
        </button>
      </div>
    </div>
  );
}
