// ============================================================
// SettingsModal — ЗАГЛУШКА (повний модуль — Крок 4+)
// ------------------------------------------------------------
// Порт modules/settings.js (теми, розміри, керування фото) прийде
// пізніше. Тут — робочий каркас модалки з керуванням темою, щоб
// кнопки налаштувань у Sidebar/MoreMenu вже щось відкривали.
// ============================================================
import { useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="Налаштування">
        <h2 className="modal-title">Налаштування</h2>
        {user && <p className="modal-sub">Профіль: {user.name}</p>}

        <button type="button" className="btn" onClick={toggle}>
          Тема: {theme === 'dark' ? 'темна' : 'світла'}
        </button>

        <button type="button" className="btn btn-danger" onClick={logout}>
          Вийти
        </button>

        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Закрити
        </button>

        <p className="modal-note">
          Розміри, керування фото й інше — переносяться в Кроці 4.
        </p>
      </div>
    </div>
  );
}
