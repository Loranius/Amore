// ============================================================
// Повний екран одного знімка, зі свайпом між сусідніми.
// ------------------------------------------------------------
// Ніякої бібліотеки: жест тут рівно один, і він займає менше коду, ніж
// коштувала б залежність.
//
// Умови жесту названі числами, бо саме вони визначають, чи вважається
// смикання свайпом. Занизький поріг перегортає кадр, коли пара просто
// хотіла роздивитись; зависокий змушує тягти пів екрана.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Photo } from '@/components/ui/Photo';
import { CloseIcon } from '@/components/icons/UiIcon';
import type { MemoryRow } from '@/types';

/** Скільки пікселів по горизонталі роблять рух свайпом. */
const SWIPE_MIN_PX = 56;
/**
 * У скільки разів рух має бути горизонтальнішим за вертикальний.
 *
 * Без цієї перевірки прокрутка пальцем угору перегортала б кадри: на
 * телефоні майже жоден жест не буває строго по одній осі.
 */
const SWIPE_AXIS_RATIO = 1.4;

/**
 * Ширина кадру на повному екрані, у CSS-пікселях.
 *
 * Тут єдине місце модуля, де фото дивляться впритул, тож просимо стільки,
 * скільки може показати найширший телефон. Менше було б видно — саме на
 * цьому екрані пара й помітила б економію.
 */
const FULL_CSS_WIDTH = 540;

interface PhotoLightboxProps {
  photos: readonly MemoryRow[];
  startId: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, startId, onClose }: PhotoLightboxProps) {
  const startIndex = Math.max(0, photos.findIndex((p) => p.id === startId));
  const [index, setIndex] = useState(startIndex);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const go = (delta: number) =>
    setIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const photo = photos[index];
  if (!photo || typeof document === 'undefined') return null;

  /*
   * Портал у `document.body` — та сама причина, що й у композера:
   * сторінка спогаду лежить усередині `.page-fade`, а той створює власний
   * stacking context через анімацію opacity. Без порталу нижня навігація
   * (z-index 50, поза цим контекстом) перекривала б повний екран фото.
   */
  return createPortal(
    <div
      className="mm-light"
      role="dialog"
      aria-modal="true"
      aria-label="Фото на повний екран"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        const t = e.changedTouches[0];
        touch.current = null;
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) < SWIPE_MIN_PX) return;
        if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      <button type="button" className="mm-light-x" onClick={onClose} aria-label="Закрити">
        <CloseIcon size={24} />
      </button>

      <Photo key={photo.id} src={photo.photo_url} cssWidth={FULL_CSS_WIDTH} alt="" decoding="async" />

      {photos.length > 1 && (
        <div className="mm-light-dots" aria-hidden="true">
          {photos.map((p, i) => (
            <span key={p.id} className={i === index ? 'is-now' : ''} />
          ))}
        </div>
      )}

      {/* Стрілки для миші й клавіатури. На телефоні їх перекриває свайп, і
          вони не заважають: висота в них нульова, ширина — вздовж краю. */}
      {photos.length > 1 && (
        <>
          <button
            type="button" className="mm-light-nav mm-light-nav--prev"
            onClick={() => go(-1)} disabled={index === 0} aria-label="Попереднє фото"
          />
          <button
            type="button" className="mm-light-nav mm-light-nav--next"
            onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Наступне фото"
          />
        </>
      )}
    </div>,
    document.body,
  );
}
