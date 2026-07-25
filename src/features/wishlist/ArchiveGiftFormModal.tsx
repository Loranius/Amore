import { useEffect, useRef, useState } from 'react';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import { normalizeToPreview } from '@/lib/images';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  removeWishPhotoAssets,
  uploadWishPhoto,
} from './useWishlist';
import { isAmbiguousWishlistTransportError } from './wishlistFailurePolicy';
import type { ManualArchiveGiftPayload } from './wishlistArchiveMutations';
import './wishlistArchiveManualGift.css';

interface ArchiveGiftFormModalProps {
  partnerName: string;
  onClose: () => void;
  onSubmit: (payload: ManualArchiveGiftPayload) => Promise<void>;
}

function todayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function requestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-0000-4000-8000-000000000000`;
}

export function ArchiveGiftFormModal({
  partnerName,
  onClose,
  onSubmit,
}: ArchiveGiftFormModalProps) {
  const me = useCurrentUser();
  const toast = useToast();
  const requestIdRef = useRef(requestId());
  const saveLock = useRef(false);
  const [title, setTitle] = useState('');
  const [giftedOn, setGiftedOn] = useState(todayInputValue);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose, saving]);

  const pickFile = async (file: File) => {
    if (saving) return;
    try {
      const normalized = await normalizeToPreview(file);
      setPendingFile(normalized.file);
      setPreviewSrc(normalized.previewSrc);
      setImageUrl('');
    } catch (error) {
      toast.show('Не вдалося обробити фото: ' + (error as Error).message);
    }
  };

  const clearPhoto = () => {
    if (saving) return;
    setPendingFile(null);
    setImageUrl('');
    setPreviewSrc(null);
  };

  const save = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || !giftedOn || saving || saveLock.current) return;

    const normalizedLink = link.trim();
    const normalizedImageUrl = imageUrl.trim();
    if (normalizedLink && !isHttpUrl(normalizedLink)) {
      toast.show('Посилання на подарунок має починатися з http:// або https://.');
      return;
    }
    if (normalizedImageUrl && !isHttpUrl(normalizedImageUrl)) {
      toast.show('Посилання на фото має починатися з http:// або https://.');
      return;
    }

    const parsedPrice = price.trim() === '' ? null : Number(price);
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      toast.show('Вкажи коректну ціну або залиш поле порожнім.');
      return;
    }

    if (giftedOn > todayInputValue()) {
      toast.show('Дата подарунка не може бути в майбутньому.');
      return;
    }

    saveLock.current = true;
    setSaving(true);
    let uploadedPath: string | null = null;

    try {
      let resolvedImageUrl: string | null = normalizedImageUrl || null;
      if (pendingFile) {
        const uploaded = await uploadWishPhoto(pendingFile, me.id);
        uploadedPath = uploaded.path;
        resolvedImageUrl = uploaded.url;
      }

      await onSubmit({
        requestId: requestIdRef.current,
        title: normalizedTitle,
        description: description.trim() || null,
        link: normalizedLink || null,
        imageUrl: resolvedImageUrl,
        price: parsedPrice,
        giftedOn,
      });
      onClose();
    } catch (error) {
      if (uploadedPath && !isAmbiguousWishlistTransportError(error)) {
        await removeWishPhotoAssets([uploadedPath]);
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay wl-archive-gift-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="modal-sheet wm-form-modal wl-archive-gift-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-gift-modal-title"
        aria-busy={saving}
      >
        <button
          type="button"
          className="gift-memory-close"
          aria-label="Закрити"
          disabled={saving}
          onClick={onClose}
        >
          ×
        </button>

        <div className="wm-form-heading wl-archive-gift-heading">
          <span className="wm-form-eyebrow">Архів подарунків</span>
          <h2 id="archive-gift-modal-title" className="modal-title">Додати давній подарунок</h2>
          <p>Збережи подарунок, який був вручений ще до появи цього списку.</p>
        </div>

        <div className="wl-archive-gift-from">
          <span aria-hidden="true">🎁</span>
          <div>
            <small>Подарунок для тебе</small>
            <strong>Від {partnerName}</strong>
          </div>
        </div>

        <section className="wm-form-section" aria-labelledby="archive-gift-main-title">
          <div className="wm-form-section-head">
            <span className="wm-form-section-index" aria-hidden="true">1</span>
            <div>
              <h3 id="archive-gift-main-title">Основне</h3>
              <p>Назва подарунка та дата вручення.</p>
            </div>
          </div>

          <label className="form-field">
            <span>Назва *</span>
            <input
              type="text"
              value={title}
              maxLength={160}
              disabled={saving}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Дата подарунка *</span>
            <input
              type="date"
              value={giftedOn}
              max={todayInputValue()}
              disabled={saving}
              onChange={(event) => setGiftedOn(event.target.value)}
            />
            <small className="wm-field-hint">Укажи день, коли {partnerName} подарував цей подарунок.</small>
          </label>
        </section>

        <section className="wm-form-section" aria-labelledby="archive-gift-photo-title">
          <div className="wm-form-section-head">
            <span className="wm-form-section-index" aria-hidden="true">2</span>
            <div>
              <h3 id="archive-gift-photo-title">Фото</h3>
              <p>Можна додати власне фото або пряме посилання.</p>
            </div>
          </div>

          <div className="wm-photo-picker wl-archive-gift-photo-picker">
            <div className="wm-photo-preview wl-archive-gift-photo-preview">
              {previewSrc ? (
                <img src={previewSrc} alt={`Попередній перегляд: ${title || 'подарунок'}`} />
              ) : (
                <span className="wm-photo-placeholder" aria-hidden="true">♡</span>
              )}
            </div>
            <div className="wm-photo-actions">
              <FilePickerButton
                id="archive-gift-photo-file"
                disabled={saving}
                onPick={(file) => void pickFile(file)}
              >
                🖼 Обрати з пристрою
              </FilePickerButton>
              {previewSrc && (
                <button type="button" className="btn-secondary" disabled={saving} onClick={clearPhoto}>
                  ✕ Прибрати
                </button>
              )}
            </div>
          </div>

          <label className="form-field">
            <span>Посилання на фото</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={imageUrl}
              disabled={saving || pendingFile !== null}
              onChange={(event) => {
                const value = event.target.value;
                setImageUrl(value);
                setPreviewSrc(value.trim() || null);
              }}
            />
          </label>
        </section>

        <section className="wm-form-section" aria-labelledby="archive-gift-details-title">
          <div className="wm-form-section-head">
            <span className="wm-form-section-index" aria-hidden="true">3</span>
            <div>
              <h3 id="archive-gift-details-title">Деталі</h3>
              <p>Необов’язкові ціна, опис і посилання.</p>
            </div>
          </div>

          <label className="form-field">
            <span>Ціна</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="₴"
              value={price}
              disabled={saving}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Опис або спогад</span>
            <textarea
              rows={4}
              maxLength={1000}
              value={description}
              disabled={saving}
              placeholder="Що це був за подарунок або чим він запам’ятався…"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Посилання</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={link}
              disabled={saving}
              onChange={(event) => setLink(event.target.value)}
            />
          </label>
        </section>

        <div className="wl-archive-gift-actions">
          <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || !title.trim() || !giftedOn}
            onClick={() => void save()}
          >
            {saving ? 'Зберігаємо…' : 'Додати до архіву'}
          </button>
        </div>
      </div>
    </div>
  );
}
