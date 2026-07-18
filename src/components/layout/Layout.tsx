// ============================================================
// Layout — єдина обгортка застосунку
// ------------------------------------------------------------
// Замінює перемикання секцій через display:none (старий router.js):
// активну сторінку рендерить <Outlet/>, навігація — з URL.
//   • Sidebar   — десктоп (CSS ховає на мобільному);
//   • BottomNav — мобільна нижня навігація;
//   • MoreMenu  — шторка «Ще» (локальний стан);
//   • Settings  — модалка (локальний стан; не роут, як і в старому коді).
// sessionStorage 'portal:lastView' більше не потрібен — стан вкладки
// тримає сам URL (F5 відкриє ту саму сторінку).
// ============================================================
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { MoreMenu } from './MoreMenu';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { useRealtime } from '@/lib/realtime';

export function Layout() {
  // Realtime живе весь час автентифікованої сесії: Layout — батьківський
  // роут під RequireAuth, монтується один раз і від'єднується на logout.
  useRealtime();

  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // key за pathname → легкий fade-in при зміні сторінки (заміна slide-анімації
  // старого роутера; напрямок slide за VIEW_ORDER — окремий крок полірування).
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <div className="bg-video-layer" aria-hidden="true">
        <video src="/bg-loop.mp4" autoPlay muted loop playsInline />
      </div>

      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="content">
        <div key={pathname} className="page-fade">
          <Outlet />
        </div>
      </main>

      <BottomNav onOpenMore={() => setMoreOpen(true)} />

      <MoreMenu
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
