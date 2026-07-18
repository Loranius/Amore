// ============================================================
// PhotoDayModal — модалка дня (порт openDayModal)
// ------------------------------------------------------------
// Слот мій і партнера. Можна додати/замінити своє фото (файл із
// пристрою, HEIC нормалізується для прев'ю) з коментарем, або
// відредагувати коментар до наявного. Клік по фото → lightbox.
// ============================================================
import { useEffect, useState } from 'react';
import { normalize } from '@/lib/images';
import { useToast } from '@/providers/ToastProvider';
import { MONTHS_UA } from '@/features/_shared/month';
import type { PhotoCalendarRow, AppUser } from '@/types';

interface PhotoDayModalProps {
  date: string;
  me: AppUser;
  partner: AppUser | null;
  myPhoto: PhotoCalendarRow | null;
  partnerPhoto: PhotoCalendarRow | null;
  onClose: () => void;
  onPhotoClick: (src: string) => void;
  onUpload: (v: { file: File; comment: string | null; existingId?: number | undefined }) => void;
  onSaveComment: (photoId: number, comment: string | null) => void;
}

export function PhotoDayModal({
  date,
  me,
  partner,
  myPhoto,
  partnerPhoto,
  onClose,
  onPhotoClick,
  onUpload,
  onSaveComment,
}: PhotoDayModalProps) {
  const toast = useToast();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comment, setComment] = useState(myPhoto?.comment ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [y, m, d] = date.split('-');
  const label = `${parseInt(d!, 10)} ${MONTHS_UA[parseInt(m!, 10) - 1]} ${y}`;

  const pickFile = async (file: File) => {
    let normalized = file;
    try {
      normalized = await normalize(file);
    } catch (e) {
      toast.show('Не вдалося обробити HEIC-фото: ' + (e as Error).message);
      return;
    }
    setPendingFile(normalized);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewSrc((e.target?.result as string) ?? null);
    reader.readAsDataURL(normalized);
  };

  const confirmUpload = () => {
    if (!pendingFile) return;
    onUpload({
      file: pendingFile,
      comment: newComment.trim() || null,
      existingId: myPhoto?.id,
    });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet pcal-day-card" role="dialog" aria-modal="true">
        <div className="pcal-modal-date">📆 {label}</div>

        <div className="pcal-photos-row">
          <div className="pcal-photo-slot">
            <div className="pcal-slot-label">
              <span className="pcal-dot pcal-dot--me" /> {me.name}
            </div>
            <div className="pcal-slot-media">
              {myPhoto ? (
                <>
                  <img
                    className="pcal-thumb"
                    src={myPhoto.photo_url}
                    loading="lazy"
                    alt=""
                    onClick={() => onPhotoClick(myPhoto.photo_url)}
                  />
                  <FilePicker id="pcal-photo-replace" label="Замінити фото" onPick={pickFile} />
                </>
              ) : (
                <FilePicker id="pcal-photo-add" label="📷 Додати фото" big onPick={pickFile} />
              )}
            </div>
          </div>

          <div className="pcal-photo-slot">
            <div className="pcal-slot-label">
              <span className="pcal-dot pcal-dot--partner" /> {partner?.name ?? 'Партнер'}
            </div>
            <div className="pcal-slot-media">
              {partnerPhoto ? (
                <>
                  <img
                    className="pcal-thumb"
                    src={partnerPhoto.photo_url}
                    loading="lazy"
                    alt=""
                    onClick={() => onPhotoClick(partnerPhoto.photo_url)}
                  />
                  {partnerPhoto.comment && (
                    <p className="pcal-thumb-comment">{partnerPhoto.comment}</p>
                  )}
                </>
              ) : (
                <div className="pcal-empty-slot">Ще немає 🌸</div>
              )}
            </div>
          </div>
        </div>

        {/* Редагування коментаря до наявного мого фото */}
        {myPhoto && !pendingFile && (
          <div className="pcal-comment-block">
            <input
              id="pcal-comment"
              name="comment"
              type="text"
              placeholder="Коментар до твого фото…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSaveComment(myPhoto.id, comment.trim() || null)}
            >
              Зберегти коментар
            </button>
          </div>
        )}

        {/* Форма підтвердження завантаження обраного файлу */}
        {pendingFile && (
          <div className="pcal-upload-form">
            {previewSrc && <img className="pcal-preview-img" src={previewSrc} alt="" />}
            <input
              id="pcal-new-comment"
              name="newComment"
              type="text"
              placeholder="Коментар (необов'язково)"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button type="button" className="btn" onClick={confirmUpload}>
              Завантажити
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPendingFile(null);
                setPreviewSrc(null);
              }}
            >
              Скасувати вибір
            </button>
          </div>
        )}

        <button type="button" className="more-menu-close" onClick={onClose}>
          Закрити
        </button>
      </div>
    </div>
  );
}

function FilePicker({
  id,
  label,
  big = false,
  onPick,
}: {
  id: string;
  label: string;
  big?: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <label className={big ? 'pcal-upload-btn' : 'pcal-replace-btn'}>
      {label}
      <input
        id={id}
        name={id}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}
