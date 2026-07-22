// ============================================================
// WishFormModal — додавання/редагування бажання
// ------------------------------------------------------------
// Фото необов'язкове: воно може бути витягнуте з товарного посилання,
// вставлене прямим URL або завантажене з пристрою.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeToPreview } from '@/lib/images';
import { uploadWishPhoto, type WishFormPayload } from './useWishlist';
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
  const lastFetchedLink = useRef(item?.link?.trim() ?? '');

  const pickFile = async (file: File) => {
    previewRequestVersion.current += 1;
    setLinkPreviewStatus('idle');
    setLinkPreviewSite(null);

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
    previewRequestVersion.current += 1;
    setPendingFile(null);
    setImgUrl('');
    setPreviewSrc(null);
  };

  const onImageUrlChange = (value: string) => {
    previewRequestVersion.current += 1;
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

      if (result.imageUrl) {
        setImgUrl((current) => {
          if (current.trim()) return current;
          setPreviewSrc(result.imageUrl);
          return result.imageUrl;
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
    if (!normalizedTitle || saving) return;

    setSaving(true);
    try {
      let imageUrl: string | null = imgUrl.trim() || null;
      if (pendingFile) imageUrl = await uploadWishPhoto(pendingFile, me.id);

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
            inputMode="url"
            placeholder="або встав пряме посилання на фото"
            value={imgUrl}
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
            disabled={!title.trim() || saving}
          >
            {saving ? 'Збереження…' : isEdit ? 'Зберегти' : 'Створити мрію'}
          </button>
        </div>
      </div>
    </div>
  );
}
