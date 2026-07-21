// ============================================================
// CrystalStats — смужка статистики під кристалом (SVG- і 3D-рендер)
// ============================================================
import type { CrystalDNA } from './useCrystal';

export function CrystalStats({ dna, isPending }: { dna: CrystalDNA; isPending: boolean }) {
  const stats: { icon: string; label: string; value: number }[] = [
    { icon: '💞', label: 'разом, дн.', value: dna.daysTogether },
    { icon: '📍', label: 'місць', value: dna.places },
    { icon: '📷', label: 'фото', value: dna.photos },
    { icon: '🎬', label: 'переглянуто', value: dna.moviesWatched },
    { icon: '📚', label: 'прочитано', value: dna.booksRead },
    { icon: '💗', label: 'бажань', value: dna.wishesDone },
    { icon: '🎯', label: 'цілей', value: dna.goalsAchieved },
    { icon: '🎂', label: 'річниць', value: dna.anniversaries },
    { icon: '🍲', label: 'рецептів', value: dna.recipesSaved },
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
        </div>
      ))}
    </div>
  );
}
