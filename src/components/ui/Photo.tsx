// ============================================================
// <Photo> — знімок, який просить у сховища свій розмір.
// ------------------------------------------------------------
// Обгортка над `<img>`, і вона існує рівно заради одного рядка: запасного
// шляху, коли мініатюри немає.
//
// **Знайдено виміром на живому порталі.** Supabase відмовляється
// трансформувати надто великі оригінали:
//
//   {"error":"InvalidRequest","message":"The source image resolution is
//    too large to process"}
//
// В архіві пари такий знімок є — 6144×8160, тобто 50 мегапікселів і
// 10.9 МБ. Без запасного шляху мініатюра для нього віддає 400, і фото
// зникає з галереї ЗОВСІМ: до мініатюр воно принаймні показувалось.
// Тобто оптимізація без цього фолбека була б регресією, а не покращенням.
//
// Запасний шлях спрацьовує один раз. Якщо не завантажився вже оригінал —
// це справді бита адреса, і повторна спроба дала б нескінченний цикл
// запитів.
// ============================================================
import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { thumbUrl, type ThumbOptions } from '@/lib/imageCdn';

interface PhotoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Адреса оригіналу з бази. */
  src: string | null | undefined;
  /** Ширина, з якою кадр ляже на екран, у CSS-пікселях. */
  cssWidth: number;
  /** Якість; занижується там, де кадр іде під затемненням. */
  quality?: ThumbOptions['quality'];
}

export function Photo({ src, cssWidth, quality, ...rest }: PhotoProps) {
  const original = src ?? '';
  const [failed, setFailed] = useState(false);

  // Нова адреса — нова спроба. Без цього скидання картка, яка колись
  // впала, лишалась би на оригіналі й після заміни фотографії.
  useEffect(() => { setFailed(false); }, [original]);

  const wanted = failed
    ? original
    : thumbUrl(original, cssWidth, quality === undefined ? {} : { quality });

  return (
    <img
      {...rest}
      src={wanted}
      onError={(event) => {
        if (!failed && wanted !== original) setFailed(true);
        rest.onError?.(event);
      }}
    />
  );
}
