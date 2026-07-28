import { WishlistBubblePhysics } from './WishlistBubblePhysics';
import { partnerGenitive } from './partnerLabel';
import type { WishlistStatsV3 } from './wishlistRpc';
import type { WishIconComponent } from '@/components/icons/WishIcon';
import { TogetherIcon } from '@/components/icons/WishIcon';
import { CheckIcon, GiftIcon, PlusIcon } from '@/components/icons/UiIcon';
import { HeartIcon } from '@/components/icons/NavIcon';

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
  Symbol: WishIconComponent;
}

function heroCopy(tab: WishlistHeroTab, meName: string, partnerName: string): HeroCopy {
  if (tab === 'partner') {
    return {
      eyebrow: `Бажання ${partnerGenitive(partnerName)}`,
      title: `Мрії ${partnerGenitive(partnerName)}`,
      description: 'Можливо, саме тут заховався наступний приємний сюрприз.',
      Symbol: GiftIcon,
    };
  }

  if (tab === 'shared') {
    return {
      eyebrow: `${meName} + ${partnerName}`,
      title: 'Наші спільні мрії',
      description: 'Те, що ви хочете побачити, спробувати або здійснити разом.',
      Symbol: TogetherIcon,
    };
  }

  return {
    eyebrow: 'Особистий список',
    title: 'Мої мрії',
    description: 'Зберігай усе, що одного дня хочеться здійснити.',
    Symbol: HeartIcon,
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
  const canOpenCompleted = tab !== 'partner';

  const openCompleted = () => {
    document
      .querySelector<HTMLButtonElement>('.wishlist .wl-archive-entry')
      ?.click();
  };

  return (
    <>
      <WishlistBubblePhysics />
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

        <div className={`wl-hero-actions${canOpenCompleted ? ' wl-hero-actions--with-completed' : ''}`}>
          <span className="wl-hero-symbol" aria-hidden="true"><copy.Symbol size={26} /></span>
          <div className="wl-hero-action-row">
            <button type="button" className="btn wl-hero-add" disabled={busy} onClick={onAdd}>
              <PlusIcon size={16} />
              Додати мрію
            </button>
            {canOpenCompleted && (
              <button
                type="button"
                className="wl-hero-completed"
                disabled={busy || activeCount === null}
                onClick={openCompleted}
                aria-label="Відкрити здійснені мрії та подаровані спогади"
              >
                <CheckIcon size={15} />
                Здійснене
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
