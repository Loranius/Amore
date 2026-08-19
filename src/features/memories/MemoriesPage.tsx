// ============================================================
// MemoriesPage — «Спогади», фотощоденник пари.
// ------------------------------------------------------------
// Один екран і один вхід. Попередня редакція давала три вигляди (стрічка /
// альбом / мозаїка), перемикач між ними й два різні входи додавання — і
// кожен із них показував ті самі фото інакше розкладеними. Модель теж була
// інша: одиницею архіву було ФОТО, згруповане по днях.
//
// Тепер одиниця — СПОГАД: назва, дата, місце, кілька слів і альбом знімків.
// Галерея показує його карткою з віялом фото, а все інше відкривається на
// власній сторінці.
//
// Знизу дві кнопки, дзеркально: «+» праворуч створює спогад із нуля,
// значок карти ліворуч відкриває той самий архів у другому вимірі — на
// мапі світу. Окремого модуля «Наша карта» більше немає (ADR-0039).
//
// Розподіл між сусідніми модулями, щоб ніхто не додав сюди зайвого:
// «Спогади» — що вже було; «Наш шлях» — віхи; «Плани» — чого ще хочеться.
// ============================================================
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { PlusIcon } from '@/components/icons/UiIcon';
import { FoldedMapIcon } from '@/components/icons/ViewIcon';
import { MemoryCard } from './MemoryCard';
import { MomentComposer } from './MomentComposer';
import { useMoments } from './useMoments';
import type { PlaceCandidate } from './momentPlace';
import './memories.css';

/*
 * Карта — окремий шматок збірки.
 *
 * MapLibre важить сотні кілобайт, і платити за них при кожному відкритті
 * галереї немає за що: більшість заходів у «Спогади» карти не потребує.
 * `lazy` тягне її рівно тоді, коли пара натиснула значок.
 */
const MemoriesMap = lazy(() =>
  import('./MemoriesMap').then((m) => ({ default: m.MemoriesMap })),
);

export function MemoriesPage() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const { data, isPending, isError, refetch, isFetching } = useMoments();
  const [composing, setComposing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  /** Місце, з яким відкрити композер після вибору точки на карті. */
  const [fromMap, setFromMap] = useState<{ pinId: number | null; value: PlaceCandidate } | null>(null);

  if (isPending) {
    return (
      <section className="memories">
        <div className="mm-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="mm-skeleton" />)}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="memories">
        <div className="empty-state">
          <p>Не вдалось завантажити спогади.</p>
          <button type="button" className="btn" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Пробую…' : 'Спробувати ще раз'}
          </button>
        </div>
      </section>
    );
  }

  const moments = data?.moments ?? [];
  const earliest = moments[moments.length - 1]?.memory_date;

  return (
    <section className="memories">
      <header className="mm-head">
        <h1>Спогади</h1>
        <p className="mm-sub">
          {moments.length === 0
            ? 'Тут буде ваш фотощоденник'
            : `${moments.length} · ${data?.photoCount ?? 0} фото · від ${earliest?.slice(0, 4) ?? ''}`}
        </p>
      </header>

      {moments.length === 0 ? (
        <p className="empty-state">
          Ще жодного спогаду. Натисни «+» і збережи перший.
        </p>
      ) : (
        <div className="mm-grid">
          {moments.map((moment) => <MemoryCard key={moment.id} moment={moment} />)}
        </div>
      )}

      <button
        type="button"
        className="mm-map-fab"
        onClick={() => setMapOpen(true)}
        aria-label="Карта спогадів"
      >
        <FoldedMapIcon size={26} />
      </button>

      {/* Один вхід, а не меню «Спогад / Особливий день»: концепт просить
          відкривати створення одразу, без проміжного вибору. */}
      <button
        type="button"
        className="mm-fab"
        onClick={() => { setFromMap(null); setComposing(true); }}
        aria-label="Новий спогад"
      >
        <PlusIcon size={26} />
      </button>

      {mapOpen && (
        <Suspense fallback={null}>
          <MemoriesMap
            places={data?.places ?? []}
            moments={moments}
            onClose={() => setMapOpen(false)}
            onCreate={(place) => {
              // Карта закривається, а обране місце їде в композер уже
              // заповненим: пара поставила точку саме для цього.
              setMapOpen(false);
              setFromMap({ pinId: null, value: place });
              setComposing(true);
            }}
            onOpenMoment={(id) => { setMapOpen(false); navigate(`/memories/${id}`); }}
          />
        </Suspense>
      )}

      {composing && (
        <MomentComposer
          userId={me.id}
          places={data?.places ?? []}
          {...(fromMap ? { initialPlace: fromMap } : {})}
          onClose={() => { setComposing(false); setFromMap(null); }}
        />
      )}
    </section>
  );
}
