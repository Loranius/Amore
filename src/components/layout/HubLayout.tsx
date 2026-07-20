// ============================================================
// HubLayout — обгортка хаба «Календар»
// ------------------------------------------------------------
// HubTabs + <Outlet/> для сабсторінки. Замінює хаб-секцію старого
// index.html, де сабпанелі перемикались класом hidden.
// .pink-page + PortalDecor — той самий фон «Pink Portal», що на
// Home, застосований тут ОДИН раз на весь хаб (усі сабтаби разом).
// ============================================================
import { Outlet } from 'react-router-dom';
import { HubTabs } from './HubTabs';
import { PortalDecor } from '@/features/auth/PortalDecor';
import { CALENDAR_TABS } from '@/app/nav';

export function CalendarHub() {
  return (
    <div className="hub pink-page">
      <PortalDecor density="light" parallax={false} />
      <HubTabs items={CALENDAR_TABS} />
      <Outlet />
    </div>
  );
}
