// ============================================================
// MemoriesPage — «Спогади», фотощоденник пари.
// ------------------------------------------------------------
// Один екран і один вхід. Попередня редакція давала три вигляди (стрічка /
// альбом / мозаїка), перемикач між ними й два різні входи додавання — і
// кожен із них показував ті самі фото інакше розкладеними. Модель теж була
// інша: одиницею архіву було ФОТО, згруповане по днях.
//
// Тепер одиниця — СПОГАД: назва, дата, місце, кілька слів і альбом знімків.
// Галерея — «нитка часу» (ADR-0249): вузол із віялом фото на лінії, де
// відстань між спогадами — це час між ними. Усе інше відкривається на
// власній сторінці.
//
// Полароїда тут більше немає (ADR-0248): грань «Фотографії» кристала тепер
// живлять фото самих спогадів, тож другий, безіменний шлях для фото став
// зайвим.
//
// Знизу дві кнопки, дзеркально: «+» праворуч створює спогад із нуля,
// значок карти ліворуч відкриває той самий архів у другому вимірі — на
// мапі світу. Окремого модуля «Наша карта» більше немає (ADR-0039).
//
// Розподіл між сусідніми модулями, щоб ніхто не додав сюди зайвого:
// «Спогади» — що вже було; «Наш шлях» — віхи; «Плани» — чого ще хочеться.
// ============================================================
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useNavigationType } from 'react-router-dom';
import { pluralUA } from '@/lib/utils';
import { useSettledPending } from '@/lib/useSettledPending';
import {
  hasMoreMemories,
  nextMemoriesCount,
  readGalleryPlace,
  restoredShown,
  writeGalleryPlace,
} from './memoriesPaging';
import { unseenFromPartner } from './memoryThread';
import { useSeenSince } from './useSeenSince';
import { useCurrentUser } from '@/providers/AuthProvider';
import { PlusIcon } from '@/components/icons/UiIcon';
import { FoldedMapIcon } from '@/components/icons/ViewIcon';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { CameraIcon } from '@/components/icons/NavIcon';
import { MemoryThread } from './MemoryThread';
import { MomentComposer } from './MomentComposer';
import { useMoments } from './useMoments';
import type { PlaceCandidate } from './momentPlace';
import './memories.css';
import { useWorldModule } from '@/features/world/useWorldModule';

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
  // Світ позаду, як у вішліста й планів (ADR-0215).
  const worldVisible = useWorldModule();
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
  /*
   * Місце на нитці (ADR-0251). Повертаючись «назад» зі спогаду, пара
   * опиняється там, де була, а не на початку року. Лише на «назад»
   * (`POP`): відкриваючи «Спогади» з меню, нитка починається згори.
   */
  const navigationType = useNavigationType();
  const [savedPlace] = useState(() => (
    navigationType === 'POP' ? readGalleryPlace(sessionStorageOrNull()) : null
  ));
  const [shown, setShown] = useState(() => restoredShown(total, savedPlace));
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const placeRestored = useRef(false);
  const seenSince = useSeenSince(me.id);

  // Архів приїхав (або змінився) — рахуємо першу пачку від його розміру.
  useEffect(() => {
    setShown(restoredShown(total, savedPlace));
  }, [total, savedPlace]);

  // Прокрутка відстежується, поки нитка на екрані, а пишеться при виході:
  // на момент прибирання новий маршрут уже змінив висоту вмісту, і читати
  // `scrollTop` тоді означало б прочитати вже обрізане число.
  useEffect(() => {
    const content = sectionRef.current?.closest('.content');
    if (!content || total === 0) return undefined;
    let top = content.scrollTop;
    const onScroll = () => { top = content.scrollTop; };
    content.addEventListener('scroll', onScroll, { passive: true });

    if (savedPlace && !placeRestored.current) {
      placeRestored.current = true;
      // Два кадри: `Layout` прокручує нагору у своєму ефекті після наших,
      // а вузли нитки мусять встигнути отримати висоту.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        content.scrollTo({ top: savedPlace.top });
      }));
    }

    return () => {
      content.removeEventListener('scroll', onScroll);
      writeGalleryPlace(sessionStorageOrNull(), { top, shown: shownRef.current });
    };
  }, [total, savedPlace]);

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
      <section className="memories world-module" data-world={worldVisible ? 'true' : undefined}>
        <div className="mt-list mt-list--skeleton" aria-hidden="true">
          {(['left', 'right', 'left'] as const).map((side, i) => (
            <div key={i} className={`mt-node mt-node--${side}`}>
              <span className="mt-link">
                <span className="mt-slot">
                  <span className="mt-stack"><span className="mt-frame mm-skeleton" /></span>
                </span>
                <span className="mt-dot" />
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Вікно очікування до порога: порожньо, але висота розділу вже своя.
  if (isPending) return <section className="memories world-module" data-world={worldVisible ? 'true' : undefined} aria-busy="true" />;

  if (isError) {
    return (
      <section className="memories world-module" data-world={worldVisible ? 'true' : undefined}>
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
    <section ref={sectionRef} className="memories world-module" data-world={worldVisible ? 'true' : undefined}>
      <PageHeader
        title="Спогади"
        meta={moments.length === 0
          ? 'Тут буде ваш фотощоденник'
          : `${moments.length} ${pluralUA(moments.length, ['спогад', 'спогади', 'спогадів'])} · ${data?.photoCount ?? 0} фото · від ${earliest?.slice(0, 4) ?? ''}`}
      />

      {moments.length === 0 ? (
        <EmptyState
          icon={<CameraIcon size={26} />}
          title="Ще жодного спогаду"
          hint="Фото, дата й кілька слів — цього досить. Спогад ляже на нитку, а його фото живитимуть кристал на головній."
        />
      ) : (
        <>
          <MemoryThread
            moments={moments}
            shown={shown}
            unseen={unseenFromPartner(moments, me.id, seenSince)}
            onNeed={(count) => setShown((current) => Math.max(current, nextMemoriesCount(count - 1, total)))}
          />
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
          moments={moments}
          places={data?.places ?? []}
          {...(fromMap ? { initialPlace: fromMap } : {})}
          onClose={() => { setComposing(false); setFromMap(null); }}
        />
      )}
    </section>
  );
}

/** `sessionStorage`, якщо браузер його дає; приватний режим може кинути вже на доступі. */
function sessionStorageOrNull(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
