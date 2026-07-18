// ============================================================
// LocationHistoryModal — архів геолокацій за 24 год (порт openLocationHistory)
// ============================================================
import { useMemo } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { useLocationHistory } from './useLocations';
import { USER_LOCATION_STYLES } from './mapConstants';

export function LocationHistoryModal({ onClose }: { onClose: () => void }) {
  const { data: users = [] } = useUsers();
  const { data: history = [], isPending } = useLocationHistory(true);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">📋 Архів за 24 год</h2>

        <div className="loc-hist-list">
          {isPending ? (
            <p className="empty-state">Завантаження…</p>
          ) : history.length === 0 ? (
            <p className="loc-hist-empty">Ще немає записів за останні 24 години 🗺️</p>
          ) : (
            history.map((rec, i) => {
              const idx = sortedUsers.findIndex((u) => u.id === rec.user_id);
              const style = USER_LOCATION_STYLES[idx] ?? USER_LOCATION_STYLES[0];
              const userName = sortedUsers[idx]?.name ?? style.label;
              const d = new Date(rec.created_at);
              const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
              const date = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
              const place = [rec.address, rec.city].filter(Boolean).join(', ') || '(адреса невідома)';
              const mapsUrl = `https://www.google.com/maps?q=${rec.lat},${rec.lng}`;

              return (
                <div key={i} className="loc-hist-row">
                  <span className="loc-hist-emoji">{style.emoji}</span>
                  <div className="loc-hist-info">
                    <span className="loc-hist-name">{userName}</span>
                    <a className="loc-hist-place" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      {place}
                    </a>
                  </div>
                  <div className="loc-hist-time">
                    <span>{time}</span>
                    <span className="loc-hist-date">{date}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
