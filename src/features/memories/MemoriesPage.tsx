// ============================================================
// MemoriesPage — «Спогади», центральний фотоархів пари.
// ------------------------------------------------------------
// Замінює PhotoCalendarPage, у якого модель була «одне фото на
// користувача на день». Тут дата — контейнер на будь-яку кількість фото,
// а вигляд огляду обирає користувач (стрічка / альбом / мозаїка).
// Екран дня спільний для всіх трьох.
// ============================================================
import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { currentYearMonth, stepMonth } from '@/features/_shared/month';
import { MemoriesViewPicker } from './MemoriesViewPicker';
import { MemoriesAlbum, MemoriesFeed, MemoriesMosaicMonth } from './MemoriesOverviews';
import { MemoryDayView } from './MemoryDayView';
import { MemoryImportModal } from './MemoryImportModal';
import { MemoryUploadModal } from './MemoryUploadModal';
import { MemoryViewer } from './MemoryViewer';
import { groupMemoriesByDate } from './memoriesDate';
import { useMemoriesView } from './memoriesView';
import { useMemories, useMemoriesMutations } from './useMemories';
import './memories.css';
import type { MemoryRow } from '@/types';

export function MemoriesPage() {
  const me = useCurrentUser();
  const { data, isPending, isError, refetch, isFetching } = useMemories();
  const { upload, uploadMany, saveOrder, unlink, remove } = useMemoriesMutations();
  const [view, setView] = useMemoriesView();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<MemoryRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [{ yr, mo }, setYm] = useState(currentYearMonth);

  const groups = useMemo(() => groupMemoriesByDate(data?.photos ?? []), [data?.photos]);
  const links = data?.links ?? {};
  const days = data?.days ?? {};

  const dayGroup = openDate ? groups.find((g) => g.date === openDate) : undefined;

  if (isPending) {
    return (
      <section className="memories">
        <div className="mem-skeleton" aria-hidden="true">
          {[0, 1, 2].map((i) => <div key={i} className="mem-skeleton-block" />)}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="memories">
        <div className="empty-state mem-error">
          <p>Не вдалось завантажити спогади.</p>
          <button type="button" className="btn" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Пробую…' : 'Спробувати ще раз'}
          </button>
        </div>
      </section>
    );
  }

  if (dayGroup) {
    return (
      <section className="memories">
        <MemoryDayView
          date={dayGroup.date}
          photos={dayGroup.photos}
          links={links}
          description={days[dayGroup.date] ?? null}
          savingOrder={saveOrder.isPending}
          onBack={() => setOpenDate(null)}
          onOpen={setLightbox}
          onSaveOrder={(patch) => saveOrder.mutate(patch)}
        />
      {lightbox && (
        <MemoryViewer
          photo={lightbox}
          sources={links[lightbox.id] ?? []}
          busy={unlink.isPending || remove.isPending}
          onClose={() => setLightbox(null)}
          onUnlink={(source) => unlink.mutate({ memoryId: lightbox.id, source })}
          onDelete={() => remove.mutate(lightbox, { onSuccess: () => setLightbox(null) })}
        />
      )}
      </section>
    );
  }

  const totalPhotos = data?.photos.length ?? 0;
  const earliest = groups[groups.length - 1]?.date;

  return (
    <section className="memories">
      <header className="mem-head">
        <div>
          <h1>Спогади</h1>
          <p className="mem-sub">
            {totalPhotos === 0
              ? 'Архів поки порожній'
              : `${totalPhotos} фото · від ${earliest?.slice(0, 4) ?? ''}`}
          </p>
        </div>
        {/* Два входи, а не один із перемикачем усередині: додати один
            знімок — це підпис і точність дати, а завантажити сотню — це
            зовсім інший екран, із розкладкою по днях. */}
        <div className="mem-add">
          <button type="button" className="btn btn-ghost" onClick={() => setImporting(true)}>Багато</button>
          <button type="button" className="btn" onClick={() => setAdding(true)}>+ Додати</button>
        </div>
      </header>

      <MemoriesViewPicker value={view} onChange={setView} />

      {totalPhotos === 0 ? (
        <p className="empty-state">Спогадів ще немає. Додай перше фото!</p>
      ) : view === 'feed' ? (
        <MemoriesFeed
          groups={groups} links={links} days={days}
          onOpenDay={setOpenDate} onOpenPhoto={setLightbox}
        />
      ) : view === 'album' ? (
        <MemoriesAlbum
          groups={groups} links={links} days={days}
          onOpenDay={setOpenDate} onOpenPhoto={setLightbox}
        />
      ) : (
        <MemoriesMosaicMonth
          groups={groups} links={links} days={days}
          year={yr} month={mo}
          onStepMonth={(delta) => setYm(stepMonth(yr, mo, delta))}
          onOpenDay={setOpenDate} onOpenPhoto={setLightbox}
        />
      )}

      {adding && (
        <MemoryUploadModal
          userId={me.id}
          busy={upload.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(input) => upload.mutate(input, { onSuccess: () => setAdding(false) })}
        />
      )}

      {importing && (
        <MemoryImportModal
          busy={uploadMany.isPending}
          progress={progress}
          onClose={() => { setImporting(false); setProgress(null); }}
          onSubmit={(items) => {
            setProgress({ done: 0, total: items.length });
            uploadMany.mutate(
              {
                items,
                userId: me.id,
                onProgress: (done, total) => setProgress({ done, total }),
              },
              { onSettled: () => { setImporting(false); setProgress(null); } },
            );
          }}
        />
      )}

      {lightbox && (
        <MemoryViewer
          photo={lightbox}
          sources={links[lightbox.id] ?? []}
          busy={unlink.isPending || remove.isPending}
          onClose={() => setLightbox(null)}
          onUnlink={(source) => unlink.mutate({ memoryId: lightbox.id, source })}
          onDelete={() => remove.mutate(lightbox, { onSuccess: () => setLightbox(null) })}
        />
      )}
    </section>
  );
}
