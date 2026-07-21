// ============================================================
// PlacesModal — список місць, що формують грань «Місця» кристала
// ------------------------------------------------------------
// Той самий патерн, що LocationHistoryModal (map-фіча): overlay +
// sheet, тап на рядок веде на «Нашу карту» замість власного
// drill-down.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useMapPins } from '@/features/map/useMapPins';
import { groupPinsByCity, CATEGORIES } from '@/features/map/mapConstants';

export function PlacesModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { data: pins = [], isPending } = useMapPins();
  const groups = groupPinsByCity(pins);

  const goToMap = () => {
    onClose();
    navigate('/map');
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="Місця на нашій карті">
        <h2 className="modal-title">📍 Місця на нашій карті</h2>

        <div className="crystal-places-list">
          {isPending ? (
            <p className="empty-state">Завантаження…</p>
          ) : pins.length === 0 ? (
            <p className="empty-state">Ще жодного місця не позначено 🗺️</p>
          ) : (
            groups.map((g) => (
              <div key={g.city}>
                <div className="crystal-places-city">{g.city}</div>
                {g.pins.map((p) => (
                  <button key={p.id} type="button" className="crystal-place-row" onClick={goToMap}>
                    <span aria-hidden="true">{CATEGORIES[p.category].emoji}</span>
                    <span className="crystal-place-title">{p.title}</span>
                  </button>
                ))}
              </div>
            ))
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
