import { partnerGenitive } from './partnerLabel';
import type { WishlistStatsV3 } from './wishlistRpc';

type WishlistHeroTab = 'me' | 'partner' | 'shared';

interface WishlistHeroProps {
  tab: WishlistHeroTab;
  meName: string;
  partnerName: string;
  activeCount: number | null;
  stats: WishlistStatsV3 | undefined;
  busy: boolean;
  onAdd: () => void;
}

interface HeroCopy {
  eyebrow: string;
  title: string;
  description: string;
  symbol: string;
}

function heroCopy(tab: WishlistHeroTab, meName: string, partnerName: string): HeroCopy {
  if (tab === 'partner') {
    return {
      eyebrow: `Бажання ${partnerGenitive(partnerName)}`,
      title: `Мрії ${partnerGenitive(partnerName)}`,
      description: 'Можливо, саме тут заховався наступний приємний сюрприз.',
      symbol: '🎁',
    };
  }

  if (tab === 'shared') {
    return {
      eyebrow: `${meName} + ${partnerName}`,
      title: 'Наші спільні мрії',
      description: 'Те, що ви хочете побачити, спробувати або здійснити разом.',
      symbol: '✨',
    };
  }

  return {
    eyebrow: 'Особистий список',
    title: 'Мої мрії',
    description: 'Зберігай усе, що одного дня хочеться здійснити.',
    symbol: '♡',
  };
}

export function activeWishlistLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'активних бажань';
  if (last === 1) return 'активне бажання';
  if (last >= 2 && last <= 4) return 'активні бажання';
  return 'активних бажань';
}

export function WishlistHero({
  tab,
  meName,
  partnerName,
  activeCount,
  stats,
  busy,
  onAdd,
}: WishlistHeroProps) {
  const copy = heroCopy(tab, meName, partnerName);

  return (
    <header className={`wl-hero wl-hero--${tab}`}>
      <div className="wl-hero-copy">
        <span className="wl-hero-eyebrow">{copy.eyebrow}</span>
        <h1 className="wl-hero-title">{copy.title}</h1>
        <p className="wl-hero-description">{copy.description}</p>

        <div className="wl-hero-metrics" aria-label="Статистика списку бажань">
          <span className={`wl-hero-metric${activeCount === null ? ' wl-hero-metric--pending' : ''}`}>
            <strong>{activeCount ?? '—'}</strong>
            {activeCount === null ? 'завантаження' : activeWishlistLabel(activeCount)}
          </span>
          {stats && stats.total > 0 && (
            <span className="wl-hero-metric wl-hero-metric--muted">
              <strong>{stats.done}</strong>
              здійснено разом
            </span>
          )}
        </div>
      </div>

      <div className="wl-hero-actions">
        <span className="wl-hero-symbol" aria-hidden="true">{copy.symbol}</span>
        <button type="button" className="btn wl-hero-add" disabled={busy} onClick={onAdd}>
          <span aria-hidden="true">＋</span>
          Додати мрію
        </button>
      </div>
    </header>
  );
}
