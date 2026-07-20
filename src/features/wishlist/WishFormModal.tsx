// ============================================================
// WishFormModal — додавання/редагування бажання (порт openWishModal)
// ------------------------------------------------------------
// Керована форма. Фото: або файл із пристрою (HEIC одразу нормалізуємо
// для прев'ю; стиснення й аплоад — на збереженні), або посилання.
// Файл має пріоритет над посиланням (як у старому коді).
// ============================================================
import { useState } from 'react';
import { normalizeToPreview } from '@/lib/images';
import { uploadWishPhoto, type WishFormPayload } from './useWishlist';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { TabBar } from '@/components/ui/TabBar';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import type { WishlistItemRow, WishPriority, AppUser } from '@/types';

type Scope = 'me' | 'partner' | 'shared';

interface WishFormModalProps {
  item: WishlistItemRow | null; // null → додавання
  partner: AppUser | null;
  defaultScope: Scope;
  onClose: () => void;
  onSubmit: (
    id: number | null,
    payload: WishFormPayload,
    scope: { owner: number; isShared: boolean },
  ) => void;
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
  const [priority, setPriority] = useState<WishPriority | ''>(item?.priority ?? '');
  const [description, setDescription] = useState(item?.description ?? '');

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(item?.image_url ?? null);
  const [saving, setSaving] = useState(false);

  const pickFile = async (file: File) => {
    try {
      const { file: normalized, previewSrc: src } = await normalizeToPreview(file);
      setPendingFile(normalized);
      setPreviewSrc(src);
      setImgUrl(''); // файл важливіший за посилання
    } catch (e) {
      toast.show('Не вдалося обробити HEIC-фото: ' + (e as Error).message);
    }
  };

  const clearPhoto = () => {
    setPendingFile(null);
    setImgUrl('');
    setPreviewSrc(null);
  };

  const onUrlChange = (v: string) => {
    if (pendingFile) setPendingFile(null); // ручне посилання скидає файл
    setImgUrl(v);
    setPreviewSrc(v.trim() || null);
  };

  const save = async () => {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      let image_url: string | null = imgUrl.trim() || null;
      if (pendingFile) {
        image_url = await uploadWishPhoto(pendingFile, me.id);
      }
      const owner = scope === 'partner' && partner ? partner.id : me.id;
      onSubmit(
        item?.id ?? null,
        {
          title: t,
          link: link.trim() || null,
          image_url,
          price: parseFloat(price) || null,
          priority: priority || null,
          description: description.trim() || null,
        },
        { owner, isShared: scope === 'shared' },
      );
      onClose();
    } catch (e) {
      toast.show('Помилка завантаження фото: ' + (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">{isEdit ? 'Редагувати бажання' : 'Нове бажання'}</h2>

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
          <input id="wish-title" name="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        <label className="form-field">
          <span>Посилання</span>
          <input
            id="wish-link"
            name="link"
            type="url"
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </label>

        <div className="form-field">
          <span>Фото</span>
          <div className="wm-photo-picker">
            <div className="wm-photo-preview">
              {previewSrc ? (
                <img src={previewSrc} alt="" onClick={() => onPhotoClick(previewSrc)} />
              ) : (
                <span className="wm-photo-placeholder">📷</span>
              )}
            </div>
            <div className="wm-photo-actions">
              <FilePickerButton id="wish-photo-file" onPick={(f) => void pickFile(f)}>
                🖼 Обрати з пристрою
              </FilePickerButton>
              {previewSrc && (
                <button type="button" className="btn-secondary" onClick={clearPhoto}>
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
            onChange={(e) => onUrlChange(e.target.value)}
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
            placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Пріоритет</span>
          <select
            id="wish-priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as WishPriority | '')}
          >
            <option value="">— не вказано —</option>
            <option value="high">🔥 Високий</option>
            <option value="medium">🟡 Середній</option>
            <option value="low">🟢 Низький</option>
          </select>
        </label>

        <label className="form-field">
          <span>Коментар / деталі</span>
          <textarea
            id="wish-description"
            name="description"
            rows={2}
            placeholder="Розмір, колір, деталі…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={() => void save()} disabled={!title.trim() || saving}>
            {saving ? 'Збереження…' : isEdit ? 'Зберегти' : 'Додати'}
          </button>
        </div>
      </div>
    </div>
  );
}
