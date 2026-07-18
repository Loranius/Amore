// ============================================================
// Модалки media: ручне додавання/редагування + додавання з пошуку
// ============================================================
import { useState } from 'react';
import { STATUS_CONFIG, TYPE_LABELS } from './mediaConstants';
import type { MediaItemRow, MediaType, MediaStatus, TmdbSearchResult } from '@/types';

const statusEntries = (type: MediaType) =>
  Object.entries(STATUS_CONFIG[type]) as [MediaStatus, string][];

// ── Додати вручну / редагувати ───────────────────────────────
interface MediaFormModalProps {
  type: MediaType;
  item: MediaItemRow | null; // null → додавання
  onClose: () => void;
  onAdd: (v: { title: string; status: MediaStatus; file?: File | undefined }) => void;
  onEdit: (v: { id: number; title: string; status: MediaStatus; file?: File | undefined }) => void;
}

export function MediaFormModal({ type, item, onClose, onAdd, onEdit }: MediaFormModalProps) {
  const isEdit = item !== null;
  const [title, setTitle] = useState(item?.title ?? '');
  const [status, setStatus] = useState<MediaStatus>(item?.status ?? 'want');
  const [file, setFile] = useState<File | undefined>();

  const save = () => {
    const t = title.trim();
    if (!t) return;
    if (isEdit) onEdit({ id: item.id, title: t, status, file });
    else onAdd({ title: t, status, file });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">{isEdit ? 'Редагувати' : `Додати ${TYPE_LABELS[type]}`}</h2>

        <label className="form-field">
          <span>Назва</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        {item?.poster_url && (
          <img src={item.poster_url} alt="" style={{ width: 60, borderRadius: 8 }} />
        )}

        <label className="form-field">
          <span>{isEdit ? 'Замінити постер' : 'Постер (фото)'}</span>
          <input
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>

        <label className="form-field">
          <span>Статус</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as MediaStatus)}>
            {statusEntries(type).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={!title.trim()}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Додати з результату TMDB-пошуку ──────────────────────────
interface AddFromSearchModalProps {
  type: MediaType;
  item: TmdbSearchResult;
  onClose: () => void;
  onAdd: (v: { item: TmdbSearchResult; status: MediaStatus }) => void;
}

export function AddFromSearchModal({ type, item, onClose, onAdd }: AddFromSearchModalProps) {
  const entries = statusEntries(type);
  const [status, setStatus] = useState<MediaStatus>(entries[0]![0]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <div className="media-search-modal-header">
          {item.poster_url && <img className="media-search-modal-poster" src={item.poster_url} alt="" />}
          <div>
            <div className="media-search-modal-title">{item.title}</div>
            {item.year && (
              <div className="media-search-modal-year">
                {item.year}
                {item.rating && ` · ★ ${item.rating}`}
              </div>
            )}
          </div>
        </div>

        <div className="form-field">
          <span>Додати як</span>
          <div className="chips">
            {entries.map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`chip${status === val ? ' active' : ''}`}
                onClick={() => setStatus(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onAdd({ item, status });
              onClose();
            }}
          >
            Додати до списку →
          </button>
        </div>
      </div>
    </div>
  );
}
