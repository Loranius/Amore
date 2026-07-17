// ============================================================
// WishArchive — згортний архів виконаних бажань (порт makeArchiveBlock)
// ------------------------------------------------------------
// Показується лише у власному списку. Дані вантажаться ліниво —
// тільки коли блок розгорнуто (enabled).
// ============================================================
import { useState } from 'react';
import { useFulfilledWishes } from './useWishlist';
import { useUsersMap } from '@/features/_shared/useUsers';

export function WishArchive({ ownerId }: { ownerId: number }) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isPending } = useFulfilledWishes(ownerId, open);
  const usersMap = useUsersMap();

  return (
    <div className="wl-archive-wrap">
      <button
        type="button"
        className="wl-archive-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="wl-archive-toggle-label">✅ Виконані бажання</span>
        <span className="wl-archive-toggle-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="wl-archive-body">
          {isPending ? (
            <p className="empty-state">Завантаження…</p>
          ) : items.length === 0 ? (
            <p className="empty-state">Поки жодного виконаного бажання 🌸</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="wl-archive-card">
                <div className="wl-archive-check">✅</div>
                <div className="wl-archive-info">
                  <div className="wl-archive-header">
                    {item.link ? (
                      <a
                        className="wl-archive-title"
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="wl-archive-title">{item.title}</span>
                    )}
                    {item.price != null && (
                      <span className="wl-archive-price">
                        {item.price.toLocaleString('uk-UA')} ₴
                      </span>
                    )}
                  </div>
                  <div className="wl-archive-meta">
                    {item.fulfilled_by != null && (
                      <span className="wl-archive-by">
                        Купив(ла): {usersMap[item.fulfilled_by] ?? '?'}
                      </span>
                    )}
                    {item.fulfilled_at && (
                      <span className="wl-archive-date">
                        {new Date(item.fulfilled_at).toLocaleDateString('uk-UA', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
