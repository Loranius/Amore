// ============================================================
// Екран одного дня — СПІЛЬНИЙ для всіх трьох виглядів.
// ------------------------------------------------------------
// Вибір вигляду міняє лише те, як виглядає огляд архіву. День один: тут
// живуть фільтри за джерелом, блоки за частиною доби й опис дня, і
// тримати три копії цієї логіки означало б три місця, де вони розійдуться.
// ============================================================
import { useMemo, useState } from 'react';
import { MemoryMosaic, SOURCE_META } from './MemoryPhoto';
import { formatMemoryDate, splitByTimeOfDay, TIME_BUCKET_LABEL } from './memoriesDate';
import type { MemoryLinksById } from './useMemories';
import type { MemoryRow, MemorySource } from '@/types';

type Filter = 'all' | 'manual' | MemorySource;

interface MemoryDayViewProps {
  date: string;
  photos: MemoryRow[];
  links: MemoryLinksById;
  description: string | null;
  onBack: () => void;
  onOpen: (photo: MemoryRow) => void;
}

export function MemoryDayView({
  date, photos, links, description, onBack, onOpen,
}: MemoryDayViewProps) {
  const [filter, setFilter] = useState<Filter>('all');

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
        <p className="mem-day-meta">{photos.length} фото</p>
      </header>

      {description && <p className="mem-day-desc">{description}</p>}

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
    </section>
  );
}
