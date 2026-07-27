// ============================================================
// PinModal — перегляд/редагування місця.
// ------------------------------------------------------------
// Тут живе весь текст мітки, і це важливо: `note` писався при створенні,
// але не показувався ніде — ані в картці, ані тут. Тепер обидва тексти
// видимі й редаговані, кожен зі своєю роллю: нотатка це факт про місце
// («столик біля вікна»), враження — те, що лишилось після.
//
// Дата відвідання теж редагується: саме вона вирішує, у який день архіву
// «Спогадів» стане фото цієї мітки, і помилку в ній треба мати змогу
// виправити пізніше.
// ============================================================
import { useState } from 'react';
import { Lightbox } from '@/components/ui/Lightbox';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import { CATEGORIES } from './mapConstants';
import { directionsUrl } from '@/lib/mapbox';
import { uploadPinPhoto, type PinUpdate } from './useMapPins';
import { useToast } from '@/providers/ToastProvider';
import { useUsersMap } from '@/features/_shared/useUsers';
import { formatDateUA } from '@/features/_shared/month';
import type { MapPinRow } from '@/types';

interface PinModalProps {
  pin: MapPinRow;
  onClose: () => void;
  onSave: (patch: PinUpdate) => void;
  onDelete: () => void;
}

export function PinModal({ pin, onClose, onSave, onDelete }: PinModalProps) {
  const toast = useToast();
  const users = useUsersMap();
  const cat = CATEGORIES[pin.category];

  const [title, setTitle] = useState(pin.title);
  const [rating, setRating] = useState(pin.rating ?? 0);
  const [review, setReview] = useState(pin.review ?? '');
  const [note, setNote] = useState(pin.note ?? '');
  const [visitedAt, setVisitedAt] = useState(pin.visited_at ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const author = pin.created_by ? users[pin.created_by] : undefined;

  const save = async () => {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    const patch: PinUpdate = {
      title: t,
      review: review.trim() || null,
      note: note.trim() || null,
      rating: rating || null,
    };
    // Порожню дату не пишемо: краще лишити стару, ніж стерти той єдиний
    // орієнтир, за яким фото місця стоїть у своєму дні в «Спогадах».
    if (visitedAt) patch.visited_at = visitedAt;
    if (file) {
      const url = await uploadPinPhoto(file, pin.id);
      if (url) patch.photo_url = url;
      else toast.show('Фото не завантажилось, зберігаю без нього');
    }
    onSave(patch);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet pin-view-modal" role="dialog" aria-modal="true">
        {pin.photo_url ? (
          <div className="pin-view-photo-wrap">
            <img
              className="pin-view-photo"
              src={pin.photo_url}
              alt=""
              onClick={() => setLightbox(pin.photo_url)}
            />
            <div className="pin-view-photo-caption">{pin.title}</div>
          </div>
        ) : (
          <div className="pin-view-photo-placeholder">{cat.emoji}</div>
        )}

        <div className="pin-view-body">
          {/* Хто поставив мітку й коли там були — досі це знала лише база. */}
          <p className="pin-view-meta">
            {cat.emoji} {cat.label}
            {pin.city && <> · {pin.city}</>}
            {pin.visited_at && <> · були {formatDateUA(pin.visited_at)}</>}
            {/* «від Х», а не «додав/додала Х»: рід із імені не вгадується,
                а помилятись у ньому щоразу — гірше за нейтральний підпис. */}
            {author && <> · від {author}</>}
          </p>

          <label className="form-field">
            <span>Назва</span>
            <input id="pin-edit-title" name="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div className="form-field">
            <span>Оцінка</span>
            <div className="pin-rating-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`map-star${n <= rating ? ' filled' : ''}`}
                  onClick={() => setRating(n === rating ? 0 : n)}
                  aria-label={`${n} зірок`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <label className="form-field">
            <span>Враження</span>
            <textarea
              id="pin-edit-review"
              name="review"
              rows={3}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Що сподобалось…"
              style={{ resize: 'vertical' }}
            />
          </label>

          <label className="form-field">
            <span>Нотатка</span>
            <textarea
              id="pin-edit-note"
              name="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Деталь, яку не хочеться забути…"
              style={{ resize: 'vertical' }}
            />
          </label>

          <label className="form-field">
            <span>Коли були</span>
            <input
              id="pin-edit-visited"
              name="visited_at"
              type="date"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
            />
          </label>

          <div className="form-field">
            <span>Замінити фото</span>
            <FilePickerButton id="pin-edit-photo-file" onPick={setFile}>
              🖼 Обрати з пристрою
            </FilePickerButton>
          </div>

          <div className="modal-actions pin-view-actions">
            <a
              className="btn-secondary"
              href={directionsUrl(pin.lat, pin.lng)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              🧭 Маршрут
            </a>
            <button type="button" className="btn-secondary pin-delete-action" onClick={onDelete}>
              Видалити
            </button>
            <button type="button" className="btn" onClick={() => void save()} disabled={saving || !title.trim()}>
              {saving ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
        </div>
      </div>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
