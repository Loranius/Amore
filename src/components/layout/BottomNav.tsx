// ============================================================
// BottomNav — нижня навігація (мобільна)
// ------------------------------------------------------------
// Порт #bottom-nav: wishlist · finance · [дім] · покупки · Ще.
// Активність — з URL через NavLink (заміна updateActiveStates).
// Кнопка «Ще» відкриває MoreMenu і підсвічується, коли відкрито
// будь-який із MORE_PREFIXES-роутів.
// ============================================================
import { NavLink, useLocation } from 'react-router-dom';
import { BOTTOM_LEFT, BOTTOM_RIGHT, HOME_ITEM, MORE_PREFIXES } from '@/app/nav';
import type { NavItem } from '@/app/nav';
import { cn } from '@/lib/utils';

function NavButton({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) => cn('nav-btn', isActive && 'active')}
    >
      <span className="nav-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  );
}

export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const { pathname } = useLocation();
  const moreActive = MORE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  return (
    <nav className="bottom-nav" aria-label="Основна навігація">
      {BOTTOM_LEFT.map((i) => (
        <NavButton key={i.to} item={i} />
      ))}

      <NavLink
        to={HOME_ITEM.to}
        end
        className={({ isActive }) => cn('nav-btn nav-btn-home', isActive && 'active')}
        aria-label="Головна"
      >
        <span className="nav-icon-home" aria-hidden="true">
          {HOME_ITEM.icon}
        </span>
      </NavLink>

      {BOTTOM_RIGHT.map((i) => (
        <NavButton key={i.to} item={i} />
      ))}

      <button
        type="button"
        className={cn('nav-btn', moreActive && 'active')}
        onClick={onOpenMore}
        aria-haspopup="dialog"
      >
        <span className="nav-icon" aria-hidden="true">
          ⋯
        </span>
        <span className="nav-label">Ще</span>
      </button>
    </nav>
  );
}
