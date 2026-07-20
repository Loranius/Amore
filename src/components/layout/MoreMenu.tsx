// ============================================================
// MoreMenu — мобільна шторка «Інші розділи» (порт #more-menu-overlay)
// ------------------------------------------------------------
// Відкриття/закриття з анімацією тепер керується класом `open` +
// CSS-transition (rAF-хаки старого openMoreMenu() більше не потрібні —
// монтуванням/станом керує React). Клік по бекдропу, по пункту або
// Escape — закриває. Перехід за пунктом робить <NavLink>, а onClose
// ховає шторку.
// ============================================================
import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { MORE_GROUPS } from '@/app/nav';
import { cn } from '@/lib/utils';

interface MoreMenuProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function MoreMenu({ open, onClose, onOpenSettings }: MoreMenuProps) {
  // Escape закриває. Блокування скролу фону — в Layout (там же .content).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn('more-menu-overlay', open && 'more-menu--open')}
      // Клік саме по підкладці (не по вмісту) — закриває.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <div className="more-menu-sheet" role="dialog" aria-modal="true" aria-label="Інші розділи">
        <p className="more-menu-title">Інші розділи</p>

        {MORE_GROUPS.map((group) => (
          <div key={group.label} className="more-menu-group">
            <p className="more-menu-group-label">{group.label}</p>
            <div className="more-menu-grid">
              {group.items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.end ?? false}
                  className="more-menu-item"
                  onClick={onClose}
                >
                  <span className="more-menu-icon" aria-hidden="true">
                    {i.icon}
                  </span>
                  <span className="more-menu-label">{i.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          className="more-menu-item more-menu-settings-btn"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
        >
          <span className="more-menu-icon" aria-hidden="true">
            ⚙️
          </span>
          <span className="more-menu-label">Налаштування</span>
        </button>

        <button type="button" className="more-menu-close" onClick={onClose}>
          Закрити
        </button>
      </div>
    </div>
  );
}
