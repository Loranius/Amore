// ============================================================
// PinModal — перегляд/редагування місця (порт openPinModal)
// ============================================================
import { useState } from 'react';
import { Lightbox } from '@/components/ui/Lightbox';
import { CATEGORIES } from './mapConstants';
import { directionsUrl } from '@/lib/mapbox';
import { uploadPinPhoto, type PinUpdate } from './useMapPins';
import { useToast } from '@/providers/ToastProvider';
import type { MapPinRow } from '@/types';

interface PinModalProps {
  pin: MapPinRow;
  onClose: () => void;
  onSave: (patch: PinUpdate) => void;
  onDelete: () => void;
}

export function PinModal({ pin, onClose, onSave, onDelete }: PinModalProps) {
  const toast = useToast();
  const cat = CATEGORIES[pin.category];

  const [title, setTitle] = useState(pin.title);
  const [rating, setRating] = useState(pin.rating ?? 0);
  const [review, setReview] = useState(pin.review ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const save = async () => {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    const patch: PinUpdate = { title: t, review: review.trim() || null, rating: rating || null };
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
          <label className="form-field">
            <span>Назва</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
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
              rows={3}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Що сподобалось…"
              style={{ resize: 'vertical' }}
            />
          </label>

          <label className="form-field">
            <span>Замінити фото</span>
            <input
              type="file"
              accept="image/*,.heic,.heif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

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
