// ============================================================
// Три оглядові екрани архіву. Три різні відповіді на одне питання —
// що є головним екраном; усе інше (день, фото, підписи) спільне.
//
// Вони живуть в одному файлі навмисно: разом це ~150 рядків розмітки над
// спільними `MemoryMosaic` і `groupMemoriesByDate`, і тримати їх поруч
// простіше, ніж три файли по 50 рядків, які треба звіряти між собою.
// ============================================================
import { MemoryMosaic } from './MemoryPhoto';
import { memoryDayLabel } from './memoriesDate';
import {
  DAYS_UA, MONTHS_UA, daysInMonth, firstMondayOffset, todayLocal, ymd,
} from '@/features/_shared/month';
import type { MemoryDayGroup } from './memoriesDate';
import type { MemoryLinksById } from './useMemories';
import type { MemoryRow } from '@/types';

interface OverviewProps {
  groups: MemoryDayGroup[];
  links: MemoryLinksById;
  days: Record<string, string>;
  onOpenDay: (date: string) => void;
  onOpenPhoto: (photo: MemoryRow) => void;
}

// ── A. Стрічка ───────────────────────────────────────────────
/** Суцільна хронологія з липким заголовком дня. Єдиний вигляд, що
 *  витримує архів на тисячі знімків: порожніх днів у ньому не існує. */
export function MemoriesFeed({ groups, links, days, onOpenDay, onOpenPhoto }: OverviewProps) {
  return (
    <div className="mem-feed">
      {groups.map((group) => (
        <section key={group.date}>
          <button type="button" className="mem-daybar" onClick={() => onOpenDay(group.date)}>
            <b>{memoryDayLabel(group.date, group.precision)}</b>
            <span>{group.photos.length} фото</span>
            {days[group.date] && <em>· {days[group.date]}</em>}
          </button>
          <MemoryMosaic photos={group.photos} links={links} onOpen={onOpenPhoto} />
        </section>
      ))}
    </div>
  );
}

// ── B. Альбом ────────────────────────────────────────────────
/** День — сторінка на папері: кадри з білим полем, куточки-тримачі,
 *  підпис на полях. Показуємо перші чотири, решта — за кнопкою. */
export function MemoriesAlbum({ groups, days, onOpenDay, onOpenPhoto }: OverviewProps) {
  return (
    <div className="mem-album">
      {groups.map((group) => {
        const shown = group.photos.slice(0, 4);
        const rest = group.photos.length - shown.length;
        return (
          <article key={group.date} className="mem-spread">
            <header className="mem-spread-hd">
              <b>{memoryDayLabel(group.date, group.precision)}</b>
              <span>{group.photos.length} фото</span>
            </header>
            {days[group.date] && <p className="mem-spread-note">{days[group.date]}</p>}
            <div className="mem-paperwall">
              {shown.map((photo, i) => (
                <div key={photo.id} className={`mem-mount ${i % 2 ? 'tilt-b' : 'tilt-a'}`}>
                  <button
                    type="button"
                    className="mem-mount-photo"
                    onClick={() => onOpenPhoto(photo)}
                    aria-label={photo.caption ?? 'Відкрити фото'}
                  >
                    <img src={photo.photo_url} alt="" loading="lazy" decoding="async" />
                  </button>
                  <span className="mem-corner mem-corner--tl" aria-hidden="true" />
                  <span className="mem-corner mem-corner--br" aria-hidden="true" />
                  <span className="mem-mount-cap">{photo.caption ?? ' '}</span>
                </div>
              ))}
            </div>
            <button type="button" className="mem-more" onClick={() => onOpenDay(group.date)}>
              {rest > 0 ? `Відкрити сторінку дня · ще ${rest}` : 'Відкрити сторінку дня'}
            </button>
          </article>
        );
      })}
    </div>
  );
}

// ── C. Мозаїка ───────────────────────────────────────────────
interface MosaicProps extends OverviewProps {
  year: number;
  month: number;
  onStepMonth: (delta: number) => void;
}

/** Календар лишається головним екраном, але клітинка з фото показує сам
 *  знімок і кількість — місяць читається як мозаїка прожитого. */
export function MemoriesMosaicMonth({
  groups, year, month, onStepMonth, onOpenDay,
}: MosaicProps) {
  const byDate = new Map(groups.map((g) => [g.date, g]));
  const total = daysInMonth(year, month);
  const offset = firstMondayOffset(year, month);
  const today = todayLocal();

  return (
    <div className="mem-cal">
      <div className="mem-cal-nav">
        <button type="button" className="mem-nav-btn" onClick={() => onStepMonth(-1)} aria-label="Попередній місяць">‹</button>
        <span>{MONTHS_UA[month - 1]} {year}</span>
        <button type="button" className="mem-nav-btn" onClick={() => onStepMonth(1)} aria-label="Наступний місяць">›</button>
      </div>

      <div className="mem-dow">
        {DAYS_UA.map((d) => <span key={d}>{d}</span>)}
      </div>

      <div className="mem-cgrid">
        {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} className="mem-cell mem-cell--empty" />)}
        {Array.from({ length: total }, (_, i) => {
          const day = i + 1;
          const date = ymd(year, month, day);
          const group = byDate.get(date);
          const cover = group?.photos[0];
          return (
            <button
              key={date}
              type="button"
              className={`mem-cell${group ? ' mem-cell--has' : ''}${date === today ? ' mem-cell--today' : ''}`}
              disabled={!group}
              onClick={() => group && onOpenDay(date)}
            >
              <span className="mem-cell-n">{day}</span>
              {cover && (
                <>
                  <img src={cover.photo_url} alt="" loading="lazy" decoding="async" />
                  <span className="mem-cell-veil" aria-hidden="true" />
                  <span className="mem-cell-cnt">{group.photos.length}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
