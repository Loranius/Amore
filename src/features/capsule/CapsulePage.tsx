// ============================================================
// CapsulePage — капсули часу (порт capsule.js UI)
// ------------------------------------------------------------
// Автор бачить/редагує свій лист завжди. Партнер: до дати — лише
// «є лист», після — повний зміст.
// ============================================================
import { useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsersMap } from '@/features/_shared/useUsers';
import { useCapsules, useCapsuleMutations, isUnlocked, formatDate, type CapsuleInput } from './useCapsule';
import type { TimeCapsuleRow } from '@/types';

export function CapsulePage() {
  const me = useCurrentUser();
  const usersMap = useUsersMap();
  const { data: capsules = [], isPending } = useCapsules();
  const { add, edit, remove } = useCapsuleMutations();

  const [modal, setModal] = useState<{ capsule: TimeCapsuleRow | null } | null>(null);

  const onDelete = (id: number) => {
    if (confirm('Видалити цей лист?')) remove.mutate(id);
  };

  return (
    <section className="capsule">
      <div className="capsule-head">
        <h1>Капсули часу</h1>
        <button type="button" className="btn" onClick={() => setModal({ capsule: null })}>
          + Лист
        </button>
      </div>

      {isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : capsules.length === 0 ? (
        <p className="empty-state">Листів ще немає. Напиши перший!</p>
      ) : (
        <div className="capsule-grid">
          {capsules.map((c) => (
            <CapsuleCard
              key={c.id}
              capsule={c}
              isOwner={c.created_by === me.id}
              authorName={(c.created_by !== null ? usersMap[c.created_by] : null) ?? 'Хтось'}
              onEdit={() => setModal({ capsule: c })}
              onDelete={() => onDelete(c.id)}
            />
          ))}
        </div>
      )}

      {modal && (
        <CapsuleModal
          capsule={modal.capsule}
          onClose={() => setModal(null)}
          onSubmit={(input) => {
            if (modal.capsule) edit.mutate({ id: modal.capsule.id, input });
            else add.mutate(input);
          }}
        />
      )}
    </section>
  );
}

function CapsuleCard({
  capsule,
  isOwner,
  authorName,
  onEdit,
  onDelete,
}: {
  capsule: TimeCapsuleRow;
  isOwner: boolean;
  authorName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const unlocked = isUnlocked(capsule.open_date);
  const showContent = isOwner || unlocked;

  return (
    <div className={`capsule-card${unlocked ? '' : ' locked'}`}>
      {(isOwner || unlocked) && (
        <button type="button" className="delete-btn" onClick={onDelete} aria-label="Видалити">
          ×
        </button>
      )}
      {isOwner && (
        <button type="button" className="capsule-edit-btn" onClick={onEdit} aria-label="Редагувати">
          ✏️
        </button>
      )}

      <span className="capsule-icon">{unlocked ? '✉️' : '🔒'}</span>

      {showContent ? (
        <>
          <p className="capsule-title">{capsule.title}</p>
          <span className="capsule-date">
            {unlocked ? 'Відкрито' : 'Відкриється'} {formatDate(capsule.open_date)}
          </span>
          <p className="capsule-content">{capsule.content}</p>
        </>
      ) : (
        <>
          <p className="capsule-title">Є лист від {authorName}</p>
          <span className="capsule-date">Відкриється {formatDate(capsule.open_date)}</span>
          <p className="capsule-locked-note">Зміст прихований до дати відкриття.</p>
        </>
      )}
    </div>
  );
}

function CapsuleModal({
  capsule,
  onClose,
  onSubmit,
}: {
  capsule: TimeCapsuleRow | null;
  onClose: () => void;
  onSubmit: (input: CapsuleInput) => void;
}) {
  const isEdit = capsule !== null;
  const [title, setTitle] = useState(capsule?.title ?? '');
  const [openDate, setOpenDate] = useState(capsule?.open_date ?? '');
  const [content, setContent] = useState(capsule?.content ?? '');

  const save = () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !openDate || !c) return;
    onSubmit({ title: t, open_date: openDate, content: c });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">{isEdit ? 'Редагувати лист' : 'Новий лист у капсулу часу'}</h2>
        <label className="form-field">
          <span>Назва</span>
          <input
            id="capsule-title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад, До нашої п'ятої річниці"
            autoFocus
          />
        </label>
        <label className="form-field">
          <span>Дата відкриття</span>
          <input id="capsule-open-date" name="openDate" type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
        </label>
        <label className="form-field">
          <span>Текст листа</span>
          <textarea
            id="capsule-content"
            name="content"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Напиши, що хочеш сказати в майбутньому…"
            style={{ resize: 'vertical' }}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={!title.trim() || !openDate || !content.trim()}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
