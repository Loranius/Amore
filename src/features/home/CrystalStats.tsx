// ============================================================
// CrystalStats — смужка статистики під кристалом (SVG- і 3D-рендер)
// ------------------------------------------------------------
// Дельта («+N цього місяця») показується лише там, де її можна
// порахувати чесно з наявних даних (useCrystal.ts, CrystalDeltas).
// ============================================================
import type { CrystalDNA, CrystalDeltas } from './useCrystal';

interface StatItem {
  icon: string;
  label: string;
  value: number;
  delta?: number;
}

export function CrystalStats({
  dna,
  deltas,
  isPending,
}: {
  dna: CrystalDNA;
  deltas: CrystalDeltas;
  isPending: boolean;
}) {
  const stats: StatItem[] = [
    { icon: '💞', label: 'разом, дн.', value: dna.daysTogether },
    { icon: '📍', label: 'місць', value: dna.places, delta: deltas.placesThisMonth },
    { icon: '📷', label: 'фото', value: dna.photos },
    { icon: '🎬', label: 'переглянуто', value: dna.moviesWatched, delta: deltas.moviesWatchedThisMonth },
    { icon: '📚', label: 'прочитано', value: dna.booksRead, delta: deltas.booksReadThisMonth },
    { icon: '💗', label: 'бажань', value: dna.wishesDone, delta: deltas.wishesDoneThisMonth },
    { icon: '🎯', label: 'цілей', value: dna.goalsAchieved },
    { icon: '🎂', label: 'річниць', value: dna.anniversaries },
    { icon: '🍲', label: 'рецептів', value: dna.recipesSaved, delta: deltas.recipesSavedThisMonth },
    { icon: '🌍', label: 'країн', value: dna.distinctCountries },
    { icon: '💍', label: 'великих подій', value: dna.milestones },
  ];

  return (
    <div className="crystal-stats">
      {stats.map((s) => (
        <div key={s.label} className="crystal-stat-chip">
          <span className="crystal-stat-icon" aria-hidden="true">
            {s.icon}
          </span>
          <span className="crystal-stat-value">{isPending ? '…' : s.value.toLocaleString('uk-UA')}</span>
          <span className="crystal-stat-label">{s.label}</span>
          {!isPending && !!s.delta && s.delta > 0 && (
            <span className="crystal-stat-delta">+{s.delta} цього місяця</span>
          )}
        </div>
      ))}
    </div>
  );
}
