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
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettledPending } from '@/lib/useSettledPending';
import {
  hasMoreMemories,
  initialMemoriesCount,
  nextMemoriesCount,
} from './memoriesPaging';
import { useCurrentUser } from '@/providers/AuthProvider';
import { PlusIcon } from '@/components/icons/UiIcon';
import { FoldedMapIcon } from '@/components/icons/ViewIcon';
import { PageHeader } from '@/components/ui/PageHeader';
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
  // Хуки ДО ранніх виходів нижче: порядок виклику хуків між рендерами
  // мусить лишатись однаковим.
  const skeletonVisible = useSettledPending(isPending);

  const total = data?.moments.length ?? 0;
  const [shown, setShown] = useState(() => initialMemoriesCount(total));
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Архів приїхав (або змінився) — рахуємо першу пачку від його розміру.
  useEffect(() => {
    setShown(initialMemoriesCount(total));
  }, [total]);

  // Пара догортала до позначки — додаємо наступну пачку.
  //
  // `rootMargin` знизу навмисно щедрий: пачка мусить приїхати ДО того, як
  // список скінчиться під пальцем, інакше нарощування читається як ривок
  // саме там, де ми його й прибираємо.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setShown((current) => nextMemoriesCount(current, total));
    }, { rootMargin: '600px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [total, shown]);

  // Порядок гілок тут вирішує все, і це виміряно.
  //
  // Спершу було `if (isPending) { … skeletonVisible && <скелет> }` — тобто
  // зовнішню гілку обирало завантаження, а скелет лише ховався всередині.
  // Наслідок: щойно дані приїжджали, гілка мінялась ЦІЛКОМ, і мінімальний
  // час показу не діяв — на живому екрані скелет блимнув на 10 мс, тобто
  // рівно тим блиманням, яке поріг мав прибрати.
  //
  // Тепер зовнішню гілку обирає САМ скелет: поки він тримається, сторінка
  // показує його, навіть якщо дані вже є.
  if (skeletonVisible) {
    return (
      <section className="memories">
        <div className="mm-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="mm-skeleton" />)}
        </div>
      </section>
    );
  }

  // Вікно очікування до порога: порожньо, але висота розділу вже своя.
  if (isPending) return <section className="memories" aria-busy="true" />;

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
      <PageHeader
        title="Спогади"
        meta={moments.length === 0
          ? 'Тут буде ваш фотощоденник'
          : `${moments.length} · ${data?.photoCount ?? 0} фото · від ${earliest?.slice(0, 4) ?? ''}`}
      />

      {moments.length === 0 ? (
        <p className="empty-state">
          Ще жодного спогаду. Натисни «+» і збережи перший.
        </p>
      ) : (
        <>
          <div className="mm-grid">
            {moments.slice(0, shown).map((moment) => (
              <MemoryCard key={moment.id} moment={moment} />
            ))}
          </div>
          {/* Позначка кінця списку. Порожня за призначенням: вона нічого
              не показує, лише повідомляє, що пара догортала — і тоді
              з'являється наступна пачка (`memoriesPaging.ts`). */}
          {hasMoreMemories(shown, moments.length) && (
            <div ref={sentinelRef} className="mm-more-sentinel" aria-hidden="true" />
          )}
        </>
      )}

      <button
        type="button"
        className="fab fab--left"
        onClick={() => setMapOpen(true)}
        aria-label="Карта спогадів"
      >
        <FoldedMapIcon size={26} />
      </button>

      {/* Один вхід, а не меню «Спогад / Особливий день»: концепт просить
          відкривати створення одразу, без проміжного вибору. */}
      <button
        type="button"
        className="fab"
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
