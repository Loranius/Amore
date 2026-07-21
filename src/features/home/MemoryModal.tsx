// ============================================================
// MemoryModal — «клік по кристалу показує випадковий спогад»
// ------------------------------------------------------------
// Джерело спогадів — photo_calendar (фото дня + коментар): це вже
// існуючі особисті моменти пари, а не окрема нова сутність. Модалка
// відкривається з новим випадковим індексом щоразу (і на кнопці
// «Ще один спогад»), тому повторний тап рідко показує те саме.
// ============================================================
import { useMemo, useState } from 'react';
import { useMemories } from './useMemories';
import { useUsersMap } from '@/features/_shared/useUsers';
import { formatSinceDate } from './homeUtils';

export function MemoryModal({ onClose }: { onClose: () => void }) {
  const { data: memories = [], isPending } = useMemories();
  const usersMap = useUsersMap();
  const [roll, setRoll] = useState(0);

  const memory = useMemo(() => {
    if (memories.length === 0) return null;
    // roll — єдина залежність, що навмисно міняється (кнопка «Ще один
    // спогад»); сам випадковий вибір рахується лише при цій зміні, а не
    // на кожен рендер.
    return memories[Math.floor(Math.random() * memories.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories, roll]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet memory-modal-sheet" role="dialog" aria-modal="true" aria-label="Спогад">
        <h2 className="modal-title">💗 Спогад</h2>

        {isPending ? (
          <p className="empty-state">Завантаження…</p>
        ) : !memory ? (
          <p className="empty-state">Ще немає жодного спогаду — додайте фото дня в календарі 📸</p>
        ) : (
          <div className="memory-card">
            <img src={memory.photo_url} alt="" className="memory-photo" />
            <p className="memory-date">{formatSinceDate(memory.date)}</p>
            {memory.comment && <p className="memory-comment">«{memory.comment}»</p>}
            <p className="memory-author">— {usersMap[memory.user_id] ?? ''}</p>
          </div>
        )}

        <div className="modal-actions">
          {memories.length > 1 && (
            <button type="button" className="btn-secondary" onClick={() => setRoll((r) => r + 1)}>
              Ще один спогад
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
