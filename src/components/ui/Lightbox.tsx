// ============================================================
// Lightbox — перегляд фото на весь екран (порт openPhotoLightbox)
// ------------------------------------------------------------
// Спільний UI-компонент: клік по підкладці/хрестику або свайп вниз —
// закриває. Керується батьком через src|null.
// ============================================================
import { ModalClose } from '@/components/ui/ModalClose';
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
      {/*
        ХРЕСТИК ЖИВЕ НА ФОТО, А НЕ В КУТКУ ЕКРАНА.
        ------------------------------------------------------------
        Він стояв `position: absolute` від самої підкладки, тобто в куті
        В'ЮПОРТА. Фото ж лежить по центру, і на телефоні між ними
        лишалась половина екрана: хрестик опинявся над вкладками
        сторінки під підкладкою й читався як щось чуже, що «з'їхало
        набік». Власник це й побачив.

        Рамка навколо знімка стискається рівно до нього, тож кут рамки —
        це кут ФОТОГРАФІЇ, хай яка вона за пропорціями.
      */}
      <div className="wl-lb-frame">
        {/*
          НА ВЕСЬ ЕКРАН — ЦЕ НЕ «ОРИГІНАЛ».
          ----------------------------------------------------------
          Тут стояв сирий `src`, тобто повний файл зі сховища: в архіві
          пари є знімок 6144×8160 на 11.4 МБ, і саме він приїжджав, щоб
          лягти на екран завширшки 412 CSS px. Просимо ширину екрана —
          сходинка (1080 або 1600) покриває навіть DPR 2 на планшеті.
        */}
        <img
          className="wl-lb-img"
          src={thumbUrl(src, typeof window === 'undefined' ? 512 : window.innerWidth)}
          alt=""
          decoding="async"
        />
        {/*
          ТОЙ САМИЙ ХРЕСТИК, ЩО В УСЬОГО ПОРТАЛУ (ADR-0051), а не
          тринадцятий власний. Лайтбокс був єдиним місцем, яке лишилось із
          власним виглядом — квадрат 40px із напівпрозорою білою заливкою.
          Колір тут перевизначений на рівні CSS, і це названий виняток:
          під кнопкою не поверхня порталу, а ЧУЖА ФОТОГРАФІЯ, тож токени
          теми не можуть обіцяти контраст.
        */}
        <ModalClose onClose={onClose} label="Закрити фото" />
      </div>
    </div>
  );
}
