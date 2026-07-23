import { useEffect, useState } from 'react';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import { normalizeToPreview } from '@/lib/images';
import { useToast } from '@/providers/ToastProvider';
import type { WishlistItemV3 } from './wishlistRpc';
import {
  validateGiftMemoryPhoto,
  validateGiftMemoryVideo,
  type GiftMemoryFiles,
} from './giftMemory';

export interface GiftCompletionDraft extends GiftMemoryFiles {
  comment: string;
}

interface GiftCompletionModalProps {
  item: WishlistItemV3;
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: GiftCompletionDraft) => Promise<void>;
}

function fileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

export function GiftCompletionModal({
  item,
  saving,
  onClose,
  onSubmit,
}: GiftCompletionModalProps) {
  const toast = useToast();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  const pickPhoto = async (file: File) => {
    try {
      validateGiftMemoryPhoto(file);
      const normalized = await normalizeToPreview(file);
      setPhoto(normalized.file);
      setPhotoPreview(normalized.previewSrc);
    } catch (error) {
      toast.show((error as Error).message);
    }
  };

  const pickVideo = (file: File) => {
    try {
      validateGiftMemoryVideo(file);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      setVideo(file);
      setVideoPreview(URL.createObjectURL(file));
    } catch (error) {
      toast.show((error as Error).message);
    }
  };

  const clearVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideo(null);
    setVideoPreview(null);
  };

  const submit = async () => {
    if (saving) return;
    try {
      await onSubmit({ photo, video, comment: comment.trim() });
    } catch {
      // useMutation already shows the grounded error toast. Keep the modal open
      // so the user can retry without losing the selected files and comment.
    }
  };

  return (
    <div
      className="modal-overlay gift-memory-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="modal-sheet gift-memory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-memory-title"
      >
        <div className="gift-memory-heading">
          <div className="gift-memory-icon" aria-hidden="true">🎁</div>
          <div>
            <h2 id="gift-memory-title" className="modal-title">Подарунок вручено</h2>
            <p>Збережемо цей момент у Gift Archive?</p>
          </div>
        </div>

        <div className="gift-memory-wish">
          {item.image_url ? <img src={item.image_url} alt="" /> : <span aria-hidden="true">♡</span>}
          <div>
            <strong>{item.title}</strong>
            <small>Фото, відео й коментар необов’язкові.</small>
          </div>
        </div>

        <div className="gift-memory-assets">
          <section className="gift-memory-asset">
            <div className="gift-memory-asset-head">
              <strong>Фото реакції</strong>
              <small>до 15 МБ</small>
            </div>
            <div className="gift-memory-preview gift-memory-preview--photo">
              {photoPreview ? (
                <img src={photoPreview} alt="Попередній перегляд реакції" />
              ) : (
                <span aria-hidden="true">📸</span>
              )}
            </div>
            <div className="gift-memory-file-actions">
              <FilePickerButton id="gift-memory-photo" onPick={(file) => void pickPhoto(file)}>
                {photo ? 'Замінити фото' : 'Додати фото'}
              </FilePickerButton>
              {photo && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                >
                  Прибрати
                </button>
              )}
            </div>
            {photo && <small className="gift-memory-file-name">{photo.name} · {fileSize(photo.size)}</small>}
          </section>

          <section className="gift-memory-asset">
            <div className="gift-memory-asset-head">
              <strong>Коротке відео</strong>
              <small>MP4, WebM або MOV · до 50 МБ</small>
            </div>
            <div className="gift-memory-preview gift-memory-preview--video">
              {videoPreview ? (
                <video src={videoPreview} controls preload="metadata" />
              ) : (
                <span aria-hidden="true">🎬</span>
              )}
            </div>
            <div className="gift-memory-file-actions">
              <FilePickerButton
                id="gift-memory-video"
                accept="video/mp4,video/webm,video/quicktime,.mov"
                onPick={pickVideo}
              >
                {video ? 'Замінити відео' : 'Додати відео'}
              </FilePickerButton>
              {video && (
                <button type="button" className="btn-secondary" disabled={saving} onClick={clearVideo}>
                  Прибрати
                </button>
              )}
            </div>
            {video && <small className="gift-memory-file-name">{video.name} · {fileSize(video.size)}</small>}
          </section>
        </div>

        <label className="form-field gift-memory-comment">
          <span>Кілька слів про момент</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={comment}
            disabled={saving}
            placeholder="Наприклад: вона зовсім не очікувала і дуже зраділа ❤️"
            onChange={(event) => setComment(event.target.value)}
          />
          <small>{comment.length}/1000</small>
        </label>

        <div className="gift-memory-note">
          <span aria-hidden="true">🔒</span>
          Медіа зберігаються у приватному bucket, а в архіві відкриваються через тимчасові посилання.
        </div>

        <div className="modal-actions gift-memory-actions">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose}>
            Назад
          </button>
          <button type="button" className="btn" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Зберігаємо спогад…' : 'Завершити й зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
