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
//
// .content — єдиний скрол-контейнер застосунку (.app-shell фіксований,
// сам ніколи не скролиться, див. index.css). Тому тут же:
//   • скидаємо scrollTop .content при зміні сторінки (інакше нова
//     сторінка могла відкритись "серед скролу" попередньої);
//   • блокуємо скрол .content, поки відкрита шторка «Ще» чи Налаштування
//     (звичайний div коректно реагує на overflow:hidden навіть на iOS,
//     на відміну від document.body під час активного тача).
// ============================================================
import { useEffect, useRef, useState } from 'react';
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

  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.style.overflowY = moreOpen || settingsOpen ? 'hidden' : '';
  }, [moreOpen, settingsOpen]);

  return (
    <div className="app-shell">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="content" ref={contentRef}>
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
