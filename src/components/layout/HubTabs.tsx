// ============================================================
// HubTabs — сабтаби хабів «Календар» / «Ми»
// ------------------------------------------------------------
// Заміна старого updateHubTabs(): панелі більше не ховаються через
// display:none/hidden — активна сабсторінка рендериться через <Outlet/>
// вкладеного роуту, а активність вкладки бере NavLink з URL.
// ============================================================
import { NavLink } from 'react-router-dom';
import type { NavItem } from '@/app/nav';
import { cn } from '@/lib/utils';

export function HubTabs({ items }: { items: NavItem[] }) {
  return (
    <div className="hub-tabs" role="tablist">
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          role="tab"
          className={({ isActive }) => cn('hub-tab', isActive && 'active')}
        >
          <span aria-hidden="true">{t.icon}</span> {t.label}
        </NavLink>
      ))}
    </div>
  );
}
