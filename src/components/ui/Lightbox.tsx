// ============================================================
// Lightbox — перегляд фото на весь екран (порт openPhotoLightbox)
// ------------------------------------------------------------
// Спільний UI-компонент: клік по підкладці/хрестику або свайп вниз —
// закриває. Керується батьком через src|null.
// ============================================================
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
      if (e.key === 'Escape') onClose();
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
        ✕
      </button>
      <img className="wl-lb-img" src={src} alt="" />
    </div>
  );
}
