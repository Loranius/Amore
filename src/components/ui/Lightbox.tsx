// ============================================================
// Lightbox — перегляд фото на весь екран (порт openPhotoLightbox)
// ------------------------------------------------------------
// Спільний UI-компонент: клік по підкладці/хрестику або свайп вниз —
// закриває. Керується батьком через src|null.
// ============================================================
import { CloseIcon } from '@/components/icons/UiIcon';
import { thumbUrl } from '@/lib/imageCdn';
import { useEffect, useRef } from 'react';

interface LightboxProps {
  src: string | null;
  onClose: () => void;
}

export function Lightbox({ src, onClose }: LightboxProps) {
  const startY = useRef(0);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="wl-lightbox"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => {
        startY.current = e.touches[0]?.clientY ?? 0;
      }}
      onTouchEnd={(e) => {
        const endY = e.changedTouches[0]?.clientY ?? 0;
        if (endY - startY.current > 80) onClose();
      }}
    >
      <button type="button" className="wl-lb-close" aria-label="Закрити" onClick={onClose}>
        <CloseIcon size={18} />
      </button>
      {/*
        НА ВЕСЬ ЕКРАН — ЦЕ НЕ «ОРИГІНАЛ».
        ------------------------------------------------------------
        Тут стояв сирий `src`, тобто повний файл зі сховища: в архіві пари
        є знімок 6144×8160 на 11.4 МБ, і саме він приїжджав, щоб лягти на
        екран завширшки 412 CSS px. Просимо ширину екрана — сходинка
        (1080 або 1600) покриває навіть DPR 2 на планшеті.
      */}
      <img
        className="wl-lb-img"
        src={thumbUrl(src, typeof window === 'undefined' ? 512 : window.innerWidth)}
        alt=""
        decoding="async"
      />
    </div>
  );
}
