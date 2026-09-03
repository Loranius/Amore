// ============================================================
// Лабораторія «Нашої історії» — екран без мережі.
// ------------------------------------------------------------
// Цей екран був єдиним у порталі, який НЕ МОЖНА було подивитись перед
// тим, як віддати парі: живий портал у пісочниці вимагає Supabase й
// логіна, а правило CLAUDE.md §8 вимагає перевіряти на екрані все, що
// пара побачить. Тобто кожна зміна тут ішла наосліп — і саме тут
// накопичились дві вади, які власник урешті назвав сам: рік не видно, а
// помилковий дотик не прибрати.
//
// Тут `HistorySweepView` дістає вигаданий `HistorySweep` замість гака.
// Другої розкладки при цьому не заводиться: сторінка й лабораторія
// малюють ОДИН компонент, тож знімок показує те саме, що побачить пара.
//
//   sweep-lab.html?state=years   — прохід по роках (типовий стан)
//   sweep-lab.html?state=full    — рік, повний по вінця, з чужими рядками
//   sweep-lab.html?state=empty   — рік, у якому ще нічого немає
//   sweep-lab.html?state=dates   — крок «які дати ви святкуєте»
//   sweep-lab.html?state=start   — найперший крок
//   sweep-lab.html?state=error   — історія не прочиталась
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ArtifactWorldProvider } from '@/features/world/ArtifactWorld';
import { HistorySweepView } from '@/features/onboarding/HistorySweepView';
import type {
  HistorySweep,
  SweepAnniversary,
  SweepEntry,
} from '@/features/onboarding/useHistorySweep';
import type { RelationshipYearFill } from '@/features/onboarding/yearFills';
import '@/index.css';

type LabState = 'years' | 'full' | 'empty' | 'dates' | 'start' | 'error';

const START_YEAR = 2022;
const YEAR_COUNT = 4;

/** Чотири роки пари з екрана власника: 2022→2025, останній ще триває. */
function labYears(): RelationshipYearFill[] {
  const fills = [0.74, 0.81, 0.78, 0.52];
  return Array.from({ length: YEAR_COUNT }, (_, position) => ({
    index: position + 1,
    label: START_YEAR + position,
    startsAt: `${START_YEAR + position}-12-26`,
    endsAt: `${START_YEAR + position + 1}-12-26`,
    complete: position < YEAR_COUNT - 1,
    fill: fills[position]!,
  }));
}

const ANNIVERSARIES: SweepAnniversary[] = [
  { id: 1, title: 'Перше побачення', date: '2022-05-22' },
  { id: 2, title: 'Перший поцілунок', date: '2022-10-04' },
  { id: 3, title: 'День знайомства', date: '2022-12-26' },
];

const entry = (
  kind: SweepEntry['kind'],
  id: number,
  label: string,
  detail = '',
  removable = true,
): SweepEntry => ({ kind, id, label, detail, removable });

const FILLED: Record<SweepEntry['kind'], SweepEntry[]> = {
  milestone: [
    entry('milestone', 41, 'Подорож'),
    entry('milestone', 40, 'Весілля'),
    entry('milestone', 39, 'Побачення, яке пам\'ятаємо'),
    entry('milestone', 38, 'Переїзд'),
    entry('milestone', 12, 'Ремонт на кухні', '', false),
  ],
  place: [
    entry('place', 8, 'Кав\'ярня «Світло»', 'Київ'),
    entry('place', 3, 'Оболонська набережна', 'Київ', false),
  ],
  watched: [
    entry('watched', 22, 'Everything Everywhere All at Once', 'фільм'),
    entry('watched', 21, 'Severance', 'серіал'),
  ],
};

const EMPTY: Record<SweepEntry['kind'], SweepEntry[]> = {
  milestone: [], place: [], watched: [],
};

/** Довгий рік — щоб побачити, як список згортається під «показати ще». */
const CROWDED: Record<SweepEntry['kind'], SweepEntry[]> = {
  milestone: [
    ...FILLED.milestone,
    entry('milestone', 11, 'Курс англійської', '', false),
    entry('milestone', 10, 'Похід у гори', '', false),
    entry('milestone', 9, 'Концерт у Палаці спорту', '', false),
  ],
  place: FILLED.place,
  watched: FILLED.watched,
};

function labSweep(state: LabState): HistorySweep {
  const years = labYears();
  const entries = state === 'empty' ? EMPTY : state === 'full' ? CROWDED : FILLED;
  const step = state === 'start' ? 'date' : state === 'dates' ? 'anniversaries' : 'years';
  const noop = async () => {};
  return {
    step,
    asOf: '2026-09-02T00:00:00.000Z',
    isPending: false,
    error: state === 'error'
      ? new Error('мережа не відповіла')
      : null,
    relationshipStartedAt: state === 'start' ? '' : `${START_YEAR}-12-26`,
    yearlyAnniversaries: step === 'date' ? [] : ANNIVERSARIES,
    summary: {
      years: step === 'date' ? [] : years,
      emptyCount: state === 'empty' ? 2 : 0,
      averageFill: 0.71,
    },
    setStartDate: noop,
    addAnniversary: noop,
    addMilestone: noop,
    addPlace: async () => ({ kind: 'created' }),
    addWatched: noop,
    importPhotos: async () => ({ createdDays: 0, createdPhotos: 0, failedAt: null }),
    entriesFor: () => entries,
    removeEntry: noop,
    removeAnniversary: noop,
    /*
     * СКАЗАНЕ ЧИСЛО показується непорожнім навмисно: порожній стан цього
     * блоку — чотири однакові поля з рискою, і на такому знімку не видно
     * ані підпису «7 без назви», ані того, як він читається поруч зі
     * справжніми списками. Лабораторія існує саме для другого.
     */
    declared: step === 'years' && state !== 'empty'
      ? { [years[0]?.startsAt ?? '']: { photos: 24, movies: 9, places: 3 } }
      : {},
    declaredGapFor: () => (
      state === 'empty'
        ? { photos: 0, movies: 0, series: 0, places: 0 }
        : { photos: 24, movies: 7, series: 0, places: 3 }
    ),
    setDeclared: noop,
    isSaving: false,
  };
}

function readState(): LabState {
  const value = new URLSearchParams(window.location.search).get('state') ?? 'years';
  const allowed: LabState[] = ['years', 'full', 'empty', 'dates', 'start', 'error'];
  return allowed.includes(value as LabState) ? value as LabState : 'years';
}

function SweepLab() {
  const [state] = useState(readState);
  const sweep = useMemo(() => labSweep(state), [state]);
  return (
    /*
     * Та сама рамка, що в `Layout`: `.app-shell` фіксований, а `.content` —
     * ЄДИНИЙ скрол-контейнер порталу. Це не декорація знімка: липка шапка
     * року рахує позицію саме від цього контейнера, тож без нього
     * лабораторія показувала б поведінку, якої на екрані немає.
     */
    <div className="app-shell" data-sweep-lab={state}>
      <main className="content">
        <div className="page-fade">
          <HistorySweepView sweep={sweep} onDone={() => {}} />
        </div>
      </main>
    </div>
  );
}

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <MemoryRouter>
      {/* Тема береться ТИМ САМИМ провайдером, що в порталі: інакше
          `--theme=light` у харнесі нічого не міняв би, і денна рожева
          лишалась би неперевіреною. */}
      <ThemeProvider>
        {/* Перемикач видів у кроці «у чому ви хочете, щоб це росло» читає
            світ артефакта — без цього провайдера екран падає цілком. */}
        <ArtifactWorldProvider>
          <SweepLab />
        </ArtifactWorldProvider>
      </ThemeProvider>
    </MemoryRouter>
  </QueryClientProvider>,
);
