// ============================================================
// PhotoCalendarPage — «Фото» (порт photo-calendar.js UI)
// ------------------------------------------------------------
// Місячна сітка; клітинка показує крапки (моя рожева / партнер
// бузковий), майбутні дні заблоковані. Клік → модалка дня.
// ============================================================
import { useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { usePartner } from '@/features/_shared/useUsers';
import { Lightbox } from '@/components/ui/Lightbox';
import {
  MONTHS_UA,
  DAYS_UA,
  ymd,
  todayLocal,
  daysInMonth,
  firstMondayOffset,
  currentYearMonth,
  stepMonth,
} from '@/features/_shared/month';
import { usePhotoCalendar, usePhotoCalendarMutations } from './usePhotoCalendar';
import { PhotoDayModal } from './PhotoDayModal';

export function PhotoCalendarPage() {
  const me = useCurrentUser();
  const partner = usePartner();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: photos = {} } = usePhotoCalendar(yr, mo);
  const { upload, saveComment } = usePhotoCalendarMutations(yr, mo);

  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const today = todayLocal();

  const dayPhotos = openDate ? (photos[openDate] ?? []) : [];
  const myPhoto = dayPhotos.find((p) => p.user_id === me.id) ?? null;
  const partnerPhoto = dayPhotos.find((p) => p.user_id !== me.id) ?? null;

  return (
    <section className="pcal">
      <div className="sched-nav">
        <button type="button" className="sched-nav-btn" onClick={() => setYm(stepMonth(yr, mo, -1))} aria-label="Попередній місяць">
          ‹
        </button>
        <span className="sched-month-label">
          {MONTHS_UA[mo - 1]} {yr}
        </span>
        <button type="button" className="sched-nav-btn" onClick={() => setYm(stepMonth(yr, mo, +1))} aria-label="Наступний місяць">
          ›
        </button>
      </div>

      <div className="pcal-grid">
        {DAYS_UA.map((d) => (
          <div key={d} className="pcal-dow">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e${i}`} className="pcal-cell pcal-cell--empty" />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const day = i + 1;
          const ds = ymd(yr, mo, day);
          const cellPhotos = photos[ds] ?? [];
          const isToday = ds === today;
          const isFuture = ds > today;
          const hasMine = cellPhotos.some((p) => p.user_id === me.id);
          const hasPartner = cellPhotos.some((p) => p.user_id !== me.id);
          return (
            <button
              key={ds}
              type="button"
              className={
                'pcal-cell' +
                (isToday ? ' pcal-cell--today' : '') +
                (isFuture ? ' pcal-cell--future' : '')
              }
              disabled={isFuture}
              onClick={() => setOpenDate(ds)}
            >
              <span className="pcal-cell-num">{day}</span>
              {(hasMine || hasPartner) && (
                <div className="pcal-dots">
                  {hasMine && <span className="pcal-dot pcal-dot--me" />}
                  {hasPartner && <span className="pcal-dot pcal-dot--partner" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {openDate && (
        <PhotoDayModal
          date={openDate}
          me={me}
          partner={partner}
          myPhoto={myPhoto}
          partnerPhoto={partnerPhoto}
          onClose={() => setOpenDate(null)}
          onPhotoClick={setLightbox}
          onUpload={(v) =>
            upload.mutate({ date: openDate, userId: me.id, ...v })
          }
          onSaveComment={(photoId, comment) => saveComment.mutate({ photoId, comment })}
        />
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
