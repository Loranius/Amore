// ============================================================
// HubTabs — сабтаби хабів «Календар» / «Ми»
// ------------------------------------------------------------
// Заміна старого updateHubTabs(): панелі більше не ховаються через
// display:none/hidden — активна сабсторінка рендериться через <Outlet/>
// вкладеного роуту, а активність вкладки бере NavLink з URL.
// ============================================================
import { NavLink, useLocation } from 'react-router-dom';
import { isNavItemActive } from '@/app/nav';
import type { NavItem } from '@/app/nav';
import { cn } from '@/lib/utils';

export function HubTabs({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const activeIndex = items.findIndex((t) => isNavItemActive(t, pathname));

  return (
    <div className="hub-tabs">
      <div className="hub-tabs-track" role="tablist">
        <div
          className="hub-tabs-indicator"
          aria-hidden="true"
          style={{
            width: `${100 / items.length}%`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        />
        {items.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end ?? false}
            role="tab"
            className={({ isActive }) => cn('hub-tab', isActive && 'active')}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
