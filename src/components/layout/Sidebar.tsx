// ============================================================
// Sidebar — навігація для десктопу (заміна .desktop-nav-item)
// ------------------------------------------------------------
// На мобільному прихована через CSS (як старі desktop-nav-item).
// Містить головну + всі розділи + кнопку налаштувань (модалка).
// ============================================================
import { NavLink } from 'react-router-dom';
import { BOTTOM_LEFT, BOTTOM_RIGHT, HOME_ITEM, MORE_ITEMS } from '@/app/nav';
import type { NavItem } from '@/app/nav';
import { cn } from '@/lib/utils';

const ALL_ITEMS: NavItem[] = [HOME_ITEM, ...BOTTOM_LEFT, ...BOTTOM_RIGHT, ...MORE_ITEMS];

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <aside className="sidebar" aria-label="Бічна навігація">
      <div className="sidebar-brand">Amore</div>

      <nav className="sidebar-nav">
        {ALL_ITEMS.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end ?? false}
            className={({ isActive }) => cn('sidebar-item', isActive && 'active')}
          >
            <span className="sidebar-icon" aria-hidden="true">
              {i.icon}
            </span>
            <span className="sidebar-label">{i.label}</span>
          </NavLink>
        ))}
      </nav>

      <button type="button" className="sidebar-item sidebar-settings" onClick={onOpenSettings}>
        <span className="sidebar-icon" aria-hidden="true">
          ⚙️
        </span>
        <span className="sidebar-label">Налаштування</span>
      </button>
    </aside>
  );
}
