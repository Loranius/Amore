// ============================================================
// HubLayout — обгортка хабів (Календар / Ми)
// ------------------------------------------------------------
// HubTabs + <Outlet/> для сабсторінки. Замінює хаб-секцію старого
// index.html, де сабпанелі перемикались класом hidden.
// ============================================================
import { Outlet } from 'react-router-dom';
import { HubTabs } from './HubTabs';
import { CALENDAR_TABS, US_TABS } from '@/app/nav';

export function CalendarHub() {
  return (
    <div className="hub">
      <HubTabs items={CALENDAR_TABS} />
      <Outlet />
    </div>
  );
}

export function UsHub() {
  return (
    <div className="hub">
      <HubTabs items={US_TABS} />
      <Outlet />
    </div>
  );
}
