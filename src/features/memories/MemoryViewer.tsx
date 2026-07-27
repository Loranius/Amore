// ============================================================
// Повний екран знімка.
// ------------------------------------------------------------
// Замість голого Lightbox: тут живуть підпис, звідки фото прийшло, і —
// головне — вибір при видаленні (§16). Архів ніколи не видаляє мовчки:
// «прибрати з архіву» і «видалити фото» це різні дії, і обидві видно
// одразу, а не за підтвердженням, де користувач не бачить наслідку.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsersMap } from '@/features/_shared/useUsers';
import { SOURCE_META } from './MemoryPhoto';
import { formatMemoryDate, memoryTime } from './memoriesDate';
import type { MemoryRow, MemorySource } from '@/types';

interface MemoryViewerProps {
  photo: MemoryRow;
  sources: MemorySource[];
  /** id сутності на тому кінці зв'язку — для переходу за позначкою. */
  sourceIds: Partial<Record<MemorySource, number>>;
  busy: boolean;
  onClose: () => void;
  onUnlink: (source: MemorySource) => void;
  onDelete: () => void;
}

export function MemoryViewer({
  photo, sources, sourceIds, busy, onClose, onUnlink, onDelete,
}: MemoryViewerProps) {
  const navigate = useNavigate();
  const usersMap = useUsersMap();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Обидва модулі вміють відкриватись на конкретній сутності, тож
  // позначка веде до самого бажання чи самої мітки, а не просто на екран.
  const openSource = (source: MemorySource) => {
    const id = sourceIds[source];
    if (source === 'wish' && id) navigate(`/wishlist?archive=1&wish=${id}`);
    else if (source === 'place') navigate(id ? `/map?pin=${id}` : '/map');
  };

  const author = photo.uploaded_by ? usersMap[photo.uploaded_by] : null;
  const time = memoryTime(photo.taken_at);

  return (
    <div className="mem-viewer" role="dialog" aria-modal="true" aria-label="Спогад">
      <button type="button" className="mem-viewer-x" onClick={onClose} aria-label="Закрити">✕</button>

      <div className="mem-viewer-stage">
        <img src={photo.photo_url} alt={photo.caption ?? ''} />
      </div>

      <div className="mem-viewer-foot">
        {photo.caption && <p className="mem-viewer-cap">{photo.caption}</p>}

        <p className="mem-viewer-meta">
          {formatMemoryDate(photo.memory_date, photo.date_precision)}
          {time && ` · ${time}`}
          {author && ` · ${author}`}
        </p>

        {sources.length > 0 && (
          <div className="mem-viewer-sources">
            {sources.map((s) => (
              <button
                key={s}
                type="button"
                className={`mem-viewer-badge ${SOURCE_META[s].cls}`}
                onClick={() => openSource(s)}
              >
                {SOURCE_META[s].icon} {SOURCE_META[s].label} ›
              </button>
            ))}
          </div>
        )}

        {confirming ? (
          <div className="mem-viewer-choice">
            {/* Два різні наслідки, тому дві різні кнопки, а не одне
                «Ви впевнені?». Прибирання зв'язку не втрачає фото —
                видалення втрачає, і це має бути видно до натискання. */}
            {sources.map((s) => (
              <button
                key={s}
                type="button"
                className="mem-viewer-act"
                disabled={busy}
                onClick={() => { onUnlink(s); setConfirming(false); }}
              >
                Відв'язати від «{SOURCE_META[s].label}» — фото лишиться в архіві
              </button>
            ))}
            <button
              type="button"
              className="mem-viewer-act mem-viewer-act--danger"
              disabled={busy}
              onClick={onDelete}
            >
              {photo.storage_path
                ? 'Видалити фото назавжди'
                : 'Прибрати з архіву (файл належить іншому модулю)'}
            </button>
            <button type="button" className="mem-viewer-act" onClick={() => setConfirming(false)}>
              Скасувати
            </button>
          </div>
        ) : (
          <button type="button" className="mem-viewer-more" onClick={() => setConfirming(true)}>
            Прибрати або видалити…
          </button>
        )}
      </div>
    </div>
  );
}
