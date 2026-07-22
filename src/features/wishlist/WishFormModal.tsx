// ============================================================
// WishFormModal — додавання/редагування бажання
// ------------------------------------------------------------
// Керована форма. Фото: або файл із пристрою, або посилання.
// Форма закривається лише після успішного підтвердження сервера.
// ============================================================
import { useState } from 'react';
import { normalizeToPreview } from '@/lib/images';
import { uploadWishPhoto, type WishFormPayload } from './useWishlist';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { TabBar } from '@/components/ui/TabBar';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import type { WishlistItemRow, AppUser } from '@/types';

type Scope = 'me' | 'partner' | 'shared';
type WishlistPriorityV3 = 'dream' | 'high' | 'medium' | 'low';

interface WishFormModalProps {
  item: WishlistItemRow | null;
  partner: AppUser | null;
  defaultScope: Scope;
  onClose: () => void;
  onSubmit: (
    id: number | null,
    payload: WishFormPayload,
    scope: { owner: number; isShared: boolean },
  ) => Promise<void>;
  onPhotoClick: (src: string) => void;
}

export function WishFormModal({
  item,
  partner,
  defaultScope,
  onClose,
  onSubmit,
  onPhotoClick,
}: WishFormModalProps) {
  const isEdit = item !== null;
  const me = useCurrentUser();
  const toast = useToast();
  const [scope, setScope] = useState<Scope>(defaultScope);

  const [title, setTitle] = useState(item?.title ?? '');
  const [link, setLink] = useState(item?.link ?? '');
  const [imgUrl, setImgUrl] = useState(item?.image_url ?? '');
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '');
  const [priority, setPriority] = useState<WishlistPriorityV3 | ''>(
    (item?.priority as WishlistPriorityV3 | null) ?? '',
  );
  const [description, setDescription] = useState(item?.description ?? '');

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(item?.image_url ?? null);
  const [saving, setSaving] = useState(false);

  const pickFile = async (file: File) => {
    try {
      const { file: normalized, previewSrc: src } = await normalizeToPreview(file);
      setPendingFile(normalized);
      setPreviewSrc(src);
      setImgUrl('');
    } catch (e) {
      toast.show('Не вдалося обробити фото: ' + (e as Error).message);
    }
  };

  const clearPhoto = () => {
    setPendingFile(null);
    setImgUrl('');
    setPreviewSrc(null);
  };

  const onUrlChange = (value: string) => {
    if (pendingFile) setPendingFile(null);
    setImgUrl(value);
    setPreviewSrc(value.trim() || null);
  };

  const save = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || saving) return;

    setSaving(true);
    try {
      let imageUrl: string | null = imgUrl.trim() || null;
      if (pendingFile) imageUrl = await uploadWishPhoto(pendingFile, me.id);

      if (!imageUrl) {
        toast.show('Додай фото мрії — воно допоможе партнеру не помилитися.');
        return;
      }

      const rawPrice = price.trim();
      const parsedPrice = rawPrice === '' ? null : Number(rawPrice);
      if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
        toast.show('Вкажи коректну ціну або залиш поле порожнім.');
        return;
      }

      const owner = scope === 'partner' && partner ? partner.id : me.id;
      await onSubmit(
        item?.id ?? null,
        {
          title: normalizedTitle,
          link: link.trim() || null,
          image_url: imageUrl,
          price: parsedPrice,
          priority: (priority || null) as WishFormPayload['priority'],
          description: description.trim() || null,
        },
        { owner, isShared: scope === 'shared' },
      );

      onClose();
    } catch (e) {
      toast.show('Не вдалося зберегти бажання: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="wish-modal-title">
        <h2 id="wish-modal-title" className="modal-title">
          {isEdit ? 'Редагувати бажання' : 'Нова мрія'}
        </h2>

        {!isEdit && (
          <div className="form-field">
            <span>Для кого</span>
            <TabBar<Scope>
              value={scope}
              onChange={setScope}
              items={[
                { value: 'me', label: 'Моє' },
                { value: 'partner', label: `Для ${partner?.name ?? 'партнера'}`, disabled: !partner },
                { value: 'shared', label: 'Спільне', icon: '🎁' },
              ]}
            />
          </div>
        )}

        <label className="form-field">
          <span>Назва *</span>
          <input
            id="wish-title"
            name="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            maxLength={160}
          />
        </label>

        <label className="form-field">
          <span>Посилання</span>
          <input
            id="wish-link"
            name="link"
            type="url"
            placeholder="https://…"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
        </label>

        <div className="form-field">
          <span>Фото *</span>
          <div className="wm-photo-picker">
            <div className="wm-photo-preview">
              {previewSrc ? (
                <img src={previewSrc} alt={`Попередній перегляд: ${title || 'мрія'}`} onClick={() => onPhotoClick(previewSrc)} />
              ) : (
                <span className="wm-photo-placeholder" aria-hidden="true">📷</span>
              )}
            </div>
            <div className="wm-photo-actions">
              <FilePickerButton id="wish-photo-file" onPick={(file) => void pickFile(file)}>
                🖼 Обрати з пристрою
              </FilePickerButton>
              {previewSrc && (
                <button type="button" className="btn-secondary" onClick={clearPhoto} disabled={saving}>
                  ✕ Прибрати
                </button>
              )}
            </div>
          </div>
          <input
            id="wish-image-url"
            name="imageUrl"
            type="url"
            placeholder="або встав посилання на фото"
            value={imgUrl}
            onChange={(event) => onUrlChange(event.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <label className="form-field">
          <span>Орієнтовна ціна, ₴</span>
          <input
            id="wish-price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ціна невідома"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Пріоритет</span>
          <select
            id="wish-priority"
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as WishlistPriorityV3 | '')}
          >
            <option value="">— не вказано —</option>
            <option value="dream">❤️ Dream</option>
            <option value="high">🔥 Високий</option>
            <option value="medium">⭐ Середній</option>
            <option value="low">○ Низький</option>
          </select>
        </label>

        <label className="form-field">
          <span>Коментар / деталі</span>
          <textarea
            id="wish-description"
            name="description"
            rows={2}
            maxLength={1000}
            placeholder="Модель, розмір, колір або інші важливі деталі…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void save()}
            disabled={!title.trim() || !previewSrc || saving}
          >
            {saving ? 'Збереження…' : isEdit ? 'Зберегти' : 'Створити мрію'}
          </button>
        </div>
      </div>
    </div>
  );
}
