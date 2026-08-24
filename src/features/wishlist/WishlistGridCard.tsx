// ============================================================
// Картка сітки: фото, назва, ціна.
// ------------------------------------------------------------
// Замінила дві картки — «стрічку» й «полароїд». Вони показували те саме
// різними обгортками, і жодна не робила головного: дати побачити кілька
// мрій одразу так, щоб на кожній були видні фото, назва й ціна.
//
// Зразок — галерея спогадів (`.mm-card`): квадратний кадр у сітці 2×N,
// підпис ПІД кадром на тлі сторінки, а не поверх фото. Причина не в
// повторенні чужого стилю: підпис на фото читається тільки на вдалому
// знімку, а тут знімок приходить із чужого сайту й може бути будь-яким
// (ADR-0056).
// ============================================================
import { useEffect, useState } from 'react';
import { HeartIcon } from '@/components/icons/NavIcon';
import { WishlistProductVisual } from './WishlistProductVisual';
import { normalizeWishlistCloudPriority } from './wishlistCloudLayout';
import type { WishlistImageDisplayMode } from './wishlistImageModes';
import type { WishlistImagePreference } from './wishlistImagePreference';
import type { WishlistItemRow } from '@/types';
import './wishlistGridView.css';

/** Ціна словами, які пара розуміє без підказки. */
export function formatWishlistGridPrice(price: number | null | undefined): string {
  if (price == null) return 'Ціни ще немає';
  return `${Math.round(price).toLocaleString('uk-UA')} ₴`;
}

/*
 * Картка просить рівно ті поля, які показує. Ширший тип
 * (`WishlistItemV3`) зачинив би її перед архівом: подарована мрія
 * приходить іншим рядком — без полів обробки картинки, бо обробляти
 * там уже нічого. Спільний знаменник обох рядків і є цим типом, тож
 * активні та виконані мрії справді малює ОДНА картка, а не дві схожі.
 */
export interface WishlistGridCardItem {
  id: number;
  title: string;
  price: number | null;
  priority: WishlistItemRow['priority'];
  image_url: string | null;
  processed_image_url?: string | null | undefined;
  image_mode?: WishlistImageDisplayMode | null | undefined;
  image_preference?: WishlistImagePreference | undefined;
  image_processing_revision?: number | undefined;
}

interface WishlistGridCardProps {
  item: WishlistGridCardItem;
  busy?: boolean;
  detailsOpen?: boolean;
  /** Другий рядок замість ціни — архів показує дату подарунка. */
  metaOverride?: string;
  onOpen: () => void;
}

export function WishlistGridCard({
  item,
  busy = false,
  detailsOpen = false,
  metaOverride,
  onOpen,
}: WishlistGridCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const priority = normalizeWishlistCloudPriority(item.priority);
  const hasImage = Boolean(item.image_url) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [item.image_url]);

  return (
    <button
      type="button"
      className="wl-grid-card"
      data-priority={priority}
      aria-label={`Відкрити «${item.title}»`}
      aria-haspopup="dialog"
      aria-expanded={detailsOpen}
      aria-busy={busy}
      disabled={busy}
      onClick={onOpen}
    >
      <span className="wl-grid-card-frame">
        {hasImage ? (
          <WishlistProductVisual
            src={item.image_url ?? ''}
            alt=""
            wishId={item.id}
            processedSrc={item.processed_image_url}
            modeHint={item.image_mode}
            preference={item.image_preference}
            processingRevision={item.image_processing_revision}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="wl-grid-card-blank" aria-hidden="true">
            <HeartIcon size={26} />
          </span>
        )}
      </span>

      <span className="wl-grid-card-foot">
        <b>{item.title}</b>
        <i>{metaOverride ?? formatWishlistGridPrice(item.price)}</i>
      </span>
    </button>
  );
}
