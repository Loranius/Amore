// ============================================================
// WishFormModal — додавання/редагування бажання
// ------------------------------------------------------------
// Фото необов'язкове: воно може бути витягнуте з товарного посилання,
// вставлене прямим URL або завантажене з пристрою.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeToPreview } from '@/lib/images';
import {
  removeWishPhotoAssets,
  uploadWishPhoto,
  type WishFormPayload,
} from './useWishlist';
import { canRemoveWishPhotoAfterSaveError } from './wishlistFailurePolicy';
import { fetchWishlistLinkPreview } from './wishlistLinkPreview';
import {
  hasUnsavedWishChanges,
  type WishFormDraftSnapshot,
} from './wishFormDirtyState';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { TabBar } from '@/components/ui/TabBar';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import { WishlistPriorityPicker } from './WishlistPriorityPicker';
import { WishlistProductVisual } from './WishlistProductVisual';
import { WishlistImageModePicker } from './WishlistImageModePicker';
import {
  DEFAULT_WISHLIST_IMAGE_PREFERENCE,
  normalizeWishlistImagePreference,
  type WishlistImagePreference,
} from './wishlistImagePreference';
import { clearWishlistStoredVisual } from './wishlistProcessedImageRegistry';
import {
  setWishlistImagePreference,
  type WishlistItemV3,
} from './wishlistRpc';
import type { WishlistImageDisplayMode } from './wishlistImageModes';
import type { AppUser } from '@/types';
import './wishlistFormSections.css';
import './wishlistUnsavedChanges.css';

type Scope = 'me' | 'partner' | 'shared';
type WishlistPriorityV3 = 'high' | 'medium' | 'low';
type LinkPreviewStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
type ImageReprocessStatus = 'idle' | 'processing' | 'success' | 'error';

interface WishFormModalProps {
  item: WishlistItemV3 | null;
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

function normalizeWishlistPriority(value: unknown): WishlistPriorityV3 | '' {
  if (value === 'dream') return 'high';
  return value === 'high' || value === 'medium' || value === 'low' ? value : '';
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
  const queryClient = useQueryClient();
  const initialImagePreference = normalizeWishlistImagePreference(item?.image_preference);
  const [scope, setScope] = useState<Scope>(defaultScope);

  const [title, setTitle] = useState(item?.title ?? '');
  const [link, setLink] = useState(item?.link ?? '');
  const [imgUrl, setImgUrl] = useState(item?.image_url ?? '');
  const [imagePreference, setImagePreference] = useState<WishlistImagePreference>(
    initialImagePreference,
  );
  const [serverImagePreference, setServerImagePreference] = useState<WishlistImagePreference>(
    initialImagePreference,
  );
  const [imageProcessingRevision, setImageProcessingRevision] = useState(
    item?.image_processing_revision ?? 0,
  );
  const [processedPreviewSrc, setProcessedPreviewSrc] = useState<string | null>(
    item?.processed_image_url ?? null,
  );
  const [processedPreviewMode, setProcessedPreviewMode] = useState<WishlistImageDisplayMode | null>(
    item?.image_mode ?? null,
  );
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : '');
  const [priority, setPriority] = useState<WishlistPriorityV3 | ''>(
    normalizeWishlistPriority(item?.priority),
  );
  const [description, setDescription] = useState(item?.description ?? '');

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(item?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageReprocessStatus, setImageReprocessStatus] = useState<ImageReprocessStatus>('idle');
  const [linkPreviewStatus, setLinkPreviewStatus] = useState<LinkPreviewStatus>('idle');
  const [linkPreviewSite, setLinkPreviewSite] = useState<string | null>(null);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);

  const previewRequestVersion = useRef(0);
  const photoRequestVersion = useRef(0);
  const saveLock = useRef(false);
  const lastFetchedLink = useRef(item?.link?.trim() ?? '');
  const lastFocusedBeforeClose = useRef<HTMLElement | null>(null);
  const initialSnapshot = useRef<WishFormDraftSnapshot>({
    scope: defaultScope,
    title: item?.title ?? '',
    link: item?.link ?? '',
    imageUrl: item?.image_url ?? '',
    imagePreference: initialImagePreference,
    price: item?.price != null ? String(item.price) : '',
    priority: normalizeWishlistPriority(item?.priority),
    description: item?.description ?? '',
  });

  const savedImageUrl = item?.image_url?.trim() ?? '';
  const currentImageUrl = pendingFile ? '' : imgUrl.trim();
  const imageChanged = pendingFile !== null || currentImageUrl !== savedImageUrl;
  const hasSavedImage = Boolean(item?.id && savedImageUrl && !imageChanged);
  const canPersistPreview = Boolean(
    item?.id
      && hasSavedImage
      && imagePreference === serverImagePreference,
  );
  const canUseSavedProcessed = Boolean(
    hasSavedImage
      && imagePreference === serverImagePreference,
  );

  const isDirty = hasUnsavedWishChanges(
    initialSnapshot.current,
    {
      scope,
      title,
      link,
      imageUrl: imgUrl,
      imagePreference,
      price,
      priority,
      description,
    },
    pendingFile !== null,
  );

  const restoreCloseFocus = useCallback(() => {
    window.requestAnimationFrame(() => lastFocusedBeforeClose.current?.focus());
  }, []);

  const cancelDiscard = useCallback(() => {
    setDiscardPromptOpen(false);
    restoreCloseFocus();
  }, [restoreCloseFocus]);

  const confirmDiscard = useCallback(() => {
    setDiscardPromptOpen(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (saving || discardPromptOpen) return;

    if (!isDirty) {
      onClose();
      return;
    }

    lastFocusedBeforeClose.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDiscardPromptOpen(true);
  }, [discardPromptOpen, isDirty, onClose, saving]);

  const handleImageProcessingChange = useCallback((processing: boolean) => {
    setImageProcessing(processing);
  }, []);

  const handleImagePersisted = useCallback((visual: {
    src: string;
    mode: WishlistImageDisplayMode;
  }) => {
    setProcessedPreviewSrc(visual.mode === 'photo-cover' ? null : visual.src);
    setProcessedPreviewMode(visual.mode);
    setImageReprocessStatus('success');
    void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
  }, [queryClient]);

  const handleImagePersistenceError = useCallback(() => {
    setImageReprocessStatus('error');
  }, []);

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
      if (discardPromptOpen) cancelDiscard();
      else requestClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelDiscard, discardPromptOpen, requestClose, saving]);

  useEffect(() => {
    if (!isDirty || saving) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, saving]);

  const resetProcessedPreview = () => {
    setProcessedPreviewSrc(null);
    setProcessedPreviewMode(null);
    setImageReprocessStatus('idle');
  };

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
      resetProcessedPreview();
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
    setImagePreference(DEFAULT_WISHLIST_IMAGE_PREFERENCE);
    resetProcessedPreview();
  };

  const onImageUrlChange = (value: string) => {
    previewRequestVersion.current += 1;
    photoRequestVersion.current += 1;
    if (pendingFile) setPendingFile(null);
    setImgUrl(value);
    setPreviewSrc(value.trim() || null);
    resetProcessedPreview();
  };

  const onImagePreferenceChange = (value: WishlistImagePreference) => {
    setImagePreference(value);
    setImageReprocessStatus('idle');
    if (value === serverImagePreference && !imageChanged) {
      setProcessedPreviewSrc(item?.processed_image_url ?? null);
      setProcessedPreviewMode(item?.image_mode ?? null);
      setImageProcessingRevision(item?.image_processing_revision ?? imageProcessingRevision);
      return;
    }
    setProcessedPreviewMode(null);
  };

  const reprocessSavedImage = async () => {
    if (
      !item?.id
      || !savedImageUrl
      || imageChanged
      || saving
      || imageProcessing
      || imageReprocessStatus === 'processing'
    ) return;

    setImageReprocessStatus('processing');
    try {
      const revision = await setWishlistImagePreference({
        wishId: item.id,
        sourceImageUrl: savedImageUrl,
        imagePreference,
        forceReprocess: true,
      });
      clearWishlistStoredVisual(item.id, savedImageUrl, imagePreference, revision);
      setServerImagePreference(imagePreference);
      setImageProcessingRevision(revision);
      setProcessedPreviewMode(null);
      initialSnapshot.current.imagePreference = imagePreference;
      void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    } catch {
      setImageReprocessStatus('error');
    }
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
          resetProcessedPreview();
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
          image_preference: imageUrl
            ? imagePreference
            : DEFAULT_WISHLIST_IMAGE_PREFERENCE,
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
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        className="modal-sheet wm-form-modal"
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
          onClick={requestClose}
        >
          ×
        </button>

        <div className="wm-form-heading">
          <span className="wm-form-eyebrow">Wishlist</span>
          <h2 id="wish-modal-title" className="modal-title">
            {isEdit ? 'Редагувати бажання' : 'Нова мрія'}
          </h2>
          <p>
            {isEdit
              ? 'Онови головні деталі — решту можна залишити без змін.'
              : 'Додай лише назву або заповни картку детальніше.'}
          </p>
        </div>

        <section className="wm-form-section" aria-labelledby="wish-section-main">
          <div className="wm-form-section-head">
            <span className="wm-form-section-index" aria-hidden="true">1</span>
            <div>
              <h3 id="wish-section-main">Основне</h3>
              <p>Назва та сторінка товару.</p>
            </div>
          </div>

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
        </section>

        <section className="wm-form-section" aria-labelledby="wish-section-photo">
          <div className="wm-form-section-head">
            <span className="wm-form-section-index" aria-hidden="true">2</span>
            <div>
              <h3 id="wish-section-photo">Фото</h3>
              <p>Необов’язкове — картка працює і без нього.</p>
            </div>
          </div>

          <div className="form-field">
            <span>Зображення мрії</span>
            <small className="wm-field-hint">
              Спершу спробуємо взяти фото з посилання. Також можна додати власне або залишити картку без фото.
            </small>
            <div className="wm-photo-picker">
              <div className="wm-photo-preview">
                {previewSrc ? (
                  <WishlistProductVisual
                    src={previewSrc}
                    alt={`Попередній перегляд: ${title || 'мрія'}`}
                    wishId={canPersistPreview ? item?.id : undefined}
                    processedSrc={canUseSavedProcessed ? processedPreviewSrc : null}
                    modeHint={canUseSavedProcessed ? processedPreviewMode : null}
                    preference={imagePreference}
                    processingRevision={imageProcessingRevision}
                    persistenceEnabled={canPersistPreview}
                    onActivate={() => onPhotoClick(previewSrc)}
                    onProcessingChange={canPersistPreview ? handleImageProcessingChange : undefined}
                    onPersisted={canPersistPreview ? handleImagePersisted : undefined}
                    onPersistenceError={canPersistPreview ? handleImagePersistenceError : undefined}
                    onError={() => {
                      if (!pendingFile) {
                        setImgUrl('');
                        setPreviewSrc(null);
                        resetProcessedPreview();
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

            {previewSrc && (
              <WishlistImageModePicker
                value={imagePreference}
                disabled={saving}
                hasSavedImage={hasSavedImage}
                imageChanged={imageChanged}
                processing={imageProcessing || imageReprocessStatus === 'processing'}
                status={imageReprocessStatus}
                onChange={onImagePreferenceChange}
                onReprocess={() => void reprocessSavedImage()}
              />
            )}
          </div>
        </section>

        <section className="wm-form-section" aria-labelledby="wish-section-details">
          <div className="wm-form-section-head">
            <span className="wm-form-section-index" aria-hidden="true">3</span>
            <div>
              <h3 id="wish-section-details">Деталі</h3>
              <p>Ціна, важливість і уточнення.</p>
            </div>
          </div>

          <div className="wm-form-detail-grid">
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

            <div className="form-field">
              <span>Пріоритет</span>
              <WishlistPriorityPicker
                value={priority}
                disabled={saving}
                onChange={setPriority}
              />
            </div>
          </div>

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
        </section>

        <p className="sr-only" role="status" aria-live="polite">
          {saving ? 'Зберігаємо бажання. Не закривай сторінку.' : ''}
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={saving}>
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

      {discardPromptOpen && (
        <div
          className="wm-unsaved-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) cancelDiscard();
          }}
        >
          <div
            className="wm-unsaved-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wm-unsaved-title"
            aria-describedby="wm-unsaved-description"
          >
            <span className="wm-unsaved-icon" aria-hidden="true">!</span>
            <h3 id="wm-unsaved-title">Не зберігати зміни?</h3>
            <p id="wm-unsaved-description">
              У формі є незбережені зміни. Після виходу вони будуть втрачені.
            </p>
            <div className="wm-unsaved-actions">
              <button type="button" className="btn btn-ghost" onClick={cancelDiscard}>
                Продовжити редагування
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDiscard} autoFocus>
                Вийти без збереження
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
