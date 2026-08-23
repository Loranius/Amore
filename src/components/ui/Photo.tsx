// ============================================================
// <Photo> — знімок, який просить у сховища свій розмір.
// ------------------------------------------------------------
// Обгортка над `<img>`, і вона існує заради двох рядків: запасного шляху,
// коли мініатюри немає, і рятівного стиснення цього запасного шляху.
//
// **Знайдено виміром на живому порталі.** Supabase відмовляється
// трансформувати надто великі оригінали:
//
//   {"error":"InvalidRequest","message":"The source image resolution is
//    too large to process"}
//
// В архіві пари такий знімок є — 6144×8160, тобто 50 мегапікселів і
// 11.4 МБ. Без запасного шляху мініатюра для нього віддає 400, і фото
// зникає з галереї ЗОВСІМ: до мініатюр воно принаймні показувалось.
//
// **Другий вимір, знайдений так само виміром.** Сам запасний шлях —
// `<img src="…оригінал">` — коштує не мережі, а декодуванню: браузер
// розпаковує всі 50 мегапікселів у пам'ять, щоб намалювати кадр 96×96.
// На живому екрані це один головний потік довжиною 554 мс, і саме він —
// причина «заскоків» під час скролу галереї: картка з таким фото
// потрапляє у в'юпорт, лінива загрузка стартує decode, і кадр застигає.
// `createImageBitmap` із `resizeWidth`/`resizeHeight` просить браузер
// декодувати ОДРАЗУ в потрібний розмір, не тримаючи повний растр —
// це і є рятівне стиснення нижче.
//
// Запасний шлях спрацьовує один раз. Якщо не завантажився вже оригінал —
// це справді бита адреса, і повторна спроба дала б нескінченний цикл
// запитів.
// ============================================================
import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { pixelRatio, thumbUrl, type ThumbOptions } from '@/lib/imageCdn';

interface PhotoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Адреса оригіналу з бази. */
  src: string | null | undefined;
  /** Ширина, з якою кадр ляже на екран, у CSS-пікселях. */
  cssWidth: number;
  /** Якість; занижується там, де кадр іде під затемненням. */
  quality?: ThumbOptions['quality'];
}

/**
 * Оригінал → маленький blob, декодований одразу в потрібний розмір.
 *
 * `null`, коли рятувати нічим (немає `createImageBitmap`, мережа
 * підвела чи файл узагалі не зображення) — тоді компонент показує
 * порожню рамку, а не застигає на повному оригіналі вдруге.
 */
async function rescueOversizedOriginal(url: string, targetPx: number): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const source = await response.blob();
  const bitmap = await createImageBitmap(source, {
    resizeWidth: targetPx,
    resizeHeight: targetPx,
    resizeQuality: 'medium',
  });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });
  } finally {
    bitmap.close();
  }
}

export function Photo({ src, cssWidth, quality, ...rest }: PhotoProps) {
  const original = src ?? '';
  const [failed, setFailed] = useState(false);
  const [rescued, setRescued] = useState<string | null>(null);
  // Рятунок не вдався (старий браузер без `createImageBitmap`, мережа
  // підвела) — тоді краще повний оригінал, ніж вічно порожня рамка.
  const [rescueFailed, setRescueFailed] = useState(false);

  // Нова адреса — нова спроба. Без цього скидання картка, яка колись
  // впала, лишалась би на оригіналі й після заміни фотографії.
  useEffect(() => {
    setFailed(false);
    setRescued(null);
    setRescueFailed(false);
  }, [original]);

  // Рятуємо ЛИШЕ після падіння мініатюри — для звичайного фото цей ефект
  // не робить нічого зайвого, `fetch` тут не заводиться взагалі.
  //
  // Створений URL належить рівно цьому запуску ефекту: приберається він
  // сам, своїм закриттям, а не спільним полем — інакше друге фото встигло
  // б відкликати щойно створений URL першого до того, як `<img>` його
  // намалює.
  useEffect(() => {
    if (!failed || !original) return undefined;
    let cancelled = false;
    let createdUrl: string | null = null;
    const targetPx = Math.max(1, Math.round(cssWidth * pixelRatio()));
    void rescueOversizedOriginal(original, targetPx)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) { setRescueFailed(true); return; }
        createdUrl = URL.createObjectURL(blob);
        setRescued(createdUrl);
      })
      .catch((e: unknown) => {
        console.warn('[Photo] не вдалось стиснути завеликий оригінал:', e);
        if (!cancelled) setRescueFailed(true);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [failed, original, cssWidth]);

  // Поки рятівне стиснення не готове, показувати сирий оригінал напряму
  // не можна — це та сама вада, яку рятунок і лагодить. Відсутній `src`
  // чесніший за секундний застиг (і, на відміну від порожнього рядка, не
  // змушує React попереджати про можливе перезавантаження сторінки). Але
  // якщо рятунок сам не зміг (старий браузер, обірвана мережа) — краще
  // показати оригінал, ніж лишити фото порожнім назавжди.
  const wanted: string | undefined = rescued ?? (
    failed
      ? (rescueFailed ? original : undefined)
      : thumbUrl(original, cssWidth, quality === undefined ? {} : { quality })
  );

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
