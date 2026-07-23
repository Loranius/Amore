// ============================================================
// WishFormModal — додавання/редагування бажання
// ------------------------------------------------------------
// Фото необов'язкове: воно може бути витягнуте з товарного посилання,
// вставлене прямим URL або завантажене з пристрою.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeToPreview } from '@/lib/images';
import {
  removeWishPhotoAssets,
  uploadWishPhoto,
  type WishFormPayload,
} from './useWishlist';
import { canRemoveWishPhotoAfterSaveError } from './wishlistFailurePolicy';
import { fetchWishlistLinkPreview } from './wishlistLinkPreview';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { TabBar } from '@/components/ui/TabBar';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import type { WishlistItemRow, AppUser } from '@/types';

type Scope = 'me' | 'partner' | 'shared';
type WishlistPriorityV3 = 'dream' | 'high' | 'medium' | 'low';
type LinkPreviewStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
  const [linkPreviewStatus, setLinkPreviewStatus] = useState<LinkPreviewStatus>('idle');
  const [linkPreviewSite, setLinkPreviewSite] = useState<string | null>(null);

  const previewRequestVersion = useRef(0);
  const photoRequestVersion = useRef(0);
  const saveLock = useRef(false);
  const lastFetchedLink = useRef(item?.link?.trim() ?? '');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const pickFile = async (file: File) => {
    if (saving) return;
    previewRequestVersion.current += 1;
    setLinkPreviewStatus('idle');
    setLinkPreviewSite(null);

    const requestId = photoRequestVersion.current + 1;
    photoRequestVersion.current = requestId;
    try {
      const { file: normalized, previewSrc: src } = await normalizeToPreview(file);
      if (photoRequestVersion.current !== requestId) return;
      setPendingFile(normalized);
      setPreviewSrc(src);
      setImgUrl('');
    } catch (e) {
      if (photoRequestVersion.current === requestId) {
        toast.show('Не вдалося обробити фото: ' + (e as Error).message);
      }
    }
  };

  const clearPhoto = () => {
    previewRequestVersion.current += 1;
    photoRequestVersion.current += 1;
    setPendingFile(null);
    setImgUrl('');
    setPreviewSrc(null);
  };

  const onImageUrlChange = (value: string) => {
    previewRequestVersion.current += 1;
    photoRequestVersion.current += 1;
    if (pendingFile) setPendingFile(null);
    setImgUrl(value);
    setPreviewSrc(value.trim() || null);
  };

  const loadLinkPreview = useCallback(async (rawUrl: string, force = false) => {
    const normalizedUrl = rawUrl.trim();
    if (!isHttpUrl(normalizedUrl)) return;
    if (!force && lastFetchedLink.current === normalizedUrl) return;

    const requestId = previewRequestVersion.current + 1;
    previewRequestVersion.current = requestId;
    lastFetchedLink.current = normalizedUrl;
    setLinkPreviewStatus('loading');
    setLinkPreviewSite(null);

    try {
      const result = await fetchWishlistLinkPreview(normalizedUrl);
      if (previewRequestVersion.current !== requestId) return;

      if (!result.ok) {
        setLinkPreviewStatus(result.error === 'no_metadata' ? 'empty' : 'error');
        return;
      }

      setLinkPreviewSite(result.siteName);
      setTitle((current) => current.trim() ? current : (result.title ?? current));

      const productImageUrl = result.imageUrl;
      if (productImageUrl) {
        setImgUrl((current) => {
          if (current.trim()) return current;
          setPreviewSrc(productImageUrl);
          return productImageUrl;
        });
      }

      const currency = result.currency?.toUpperCase() ?? null;
      const isHryvnia = currency === null || currency === 'UAH' || currency === '₴' || currency === 'ГРН';
      if (result.price !== null && isHryvnia) {
        setPrice((current) => current.trim() ? current : String(result.price));
      }

      setLinkPreviewStatus('success');
    } catch {
      if (previewRequestVersion.current === requestId) setLinkPreviewStatus('error');
    }
  }, []);

  useEffect(() => {
    const normalizedUrl = link.trim();
    if (!isHttpUrl(normalizedUrl) || normalizedUrl === lastFetchedLink.current) return;

    const timer = window.setTimeout(() => {
      void loadLinkPreview(normalizedUrl);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [link, loadLinkPreview]);

  const onLinkChange = (value: string) => {
    previewRequestVersion.current += 1;
    setLink(value);
    setLinkPreviewStatus('idle');
    setLinkPreviewSite(null);
    if (!value.trim()) lastFetchedLink.current = '';
  };

  const save = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || saving || saveLock.current) return;

    const normalizedLink = link.trim();
    const normalizedImageUrl = imgUrl.trim();
    if (normalizedLink && !isHttpUrl(normalizedLink)) {
      toast.show('Посилання на товар має починатися з http:// або https://.');
      return;
    }
    if (normalizedImageUrl && !isHttpUrl(normalizedImageUrl)) {
      toast.show('Посилання на фото має починатися з http:// або https://.');
      return;
    }

    const rawPrice = price.trim();
    const parsedPrice = rawPrice === '' ? null : Number(rawPrice);
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      toast.show('Вкажи коректну ціну або залиш поле порожнім.');
      return;
    }

    saveLock.current = true;
    setSaving(true);
    let uploadedPath: string | null = null;
    let submitStarted = false;

    try {
      let imageUrl: string | null = normalizedImageUrl || null;
      if (pendingFile) {
        const uploaded = await uploadWishPhoto(pendingFile, me.id);
        uploadedPath = uploaded.path;
        imageUrl = uploaded.url;
      }

      const owner = scope === 'partner' && partner ? partner.id : me.id;
      submitStarted = true;
      await onSubmit(
        item?.id ?? null,
        {
          title: normalizedTitle,
          link: normalizedLink || null,
          image_url: imageUrl,
          price: parsedPrice,
          priority: (priority || null) as WishFormPayload['priority'],
          description: description.trim() || null,
        },
        { owner, isShared: scope === 'shared' },
      );

      onClose();
    } catch (e) {
      if (uploadedPath && canRemoveWishPhotoAfterSaveError(e)) {
        await removeWishPhotoAssets([uploadedPath]);
      }
      // save mutation already shows its domain-aware toast. Upload/processing
      // errors happen before mutation and need their own message here.
      if (!submitStarted) {
        toast.show('Не вдалося завантажити фото: ' + (e as Error).message);
      }
    } finally {
      saveLock.current = false;
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
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-modal-title"
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

        <h2 id="wish-modal-title" className="modal-title">
          {isEdit ? 'Редагувати бажання' : 'Нова мрія'}
        </h2>

        {!isEdit && (
          <div className="form-field">
            <span>Для кого</span>
            <TabBar<Scope>
              value={scope}
              onChange={(value) => {
                if (!saving) setScope(value);
              }}
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
            disabled={saving}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            maxLength={160}
          />
        </label>

        <div className="form-field">
          <span>Посилання на товар</span>
          <div className="wm-link-row">
            <input
              id="wish-link"
              name="link"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={link}
              disabled={saving}
              onChange={(event) => onLinkChange(event.target.value)}
            />
            <button
              type="button"
              className="btn-secondary wm-link-preview-button"
              disabled={!isHttpUrl(link.trim()) || linkPreviewStatus === 'loading' || saving}
              onClick={() => void loadLinkPreview(link, true)}
            >
              {linkPreviewStatus === 'loading' ? 'Шукаємо…' : 'Підтягнути'}
            </button>
          </div>

          <div role="status" aria-live="polite">
            {linkPreviewStatus === 'loading' && (
              <small className="wm-link-status">Отримуємо назву, ціну та фото…</small>
            )}
            {linkPreviewStatus === 'success' && (
              <small className="wm-link-status wm-link-status--success">
                Дані підтягнуто{linkPreviewSite ? ` з ${linkPreviewSite}` : ''}.
              </small>
            )}
            {linkPreviewStatus === 'empty' && (
              <small className="wm-link-status">
                Магазин не віддав дані. Бажання все одно можна зберегти без фото.
              </small>
            )}
            {linkPreviewStatus === 'error' && (
              <small className="wm-link-status wm-link-status--error">
                Не вдалося відкрити сторінку. Перевір посилання або заповни поля вручну.
              </small>
            )}
          </div>
        </div>

        <div className="form-field">
          <span>Фото — необов’язково</span>
          <small className="wm-field-hint">
            Спершу спробуємо взяти фото з посилання. Також можна додати власне або залишити картку без фото.
          </small>
          <div className="wm-photo-picker">
            <div className="wm-photo-preview">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={`Попередній перегляд: ${title || 'мрія'}`}
                  onClick={() => onPhotoClick(previewSrc)}
                  onError={() => {
                    if (!pendingFile) {
                      setImgUrl('');
                      setPreviewSrc(null);
                    }
                  }}
                />
              ) : (
                <span className="wm-photo-placeholder" aria-hidden="true">♡</span>
              )}
            </div>
            <div className="wm-photo-actions">
              <FilePickerButton
                id="wish-photo-file"
                disabled={saving}
                onPick={(file) => void pickFile(file)}
              >
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
            inputMode="url"
            placeholder="або встав пряме посилання на фото"
            value={imgUrl}
            disabled={saving}
            onChange={(event) => onImageUrlChange(event.target.value)}
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
            disabled={saving}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Пріоритет</span>
          <select
            id="wish-priority"
            name="priority"
            value={priority}
            disabled={saving}
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
            disabled={saving}
            onChange={(event) => setDescription(event.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        <p className="sr-only" role="status" aria-live="polite">
          {saving ? 'Зберігаємо бажання. Не закривай сторінку.' : ''}
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void save()}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Збереження…' : isEdit ? 'Зберегти' : 'Створити мрію'}
          </button>
        </div>
      </div>
    </div>
  );
}
