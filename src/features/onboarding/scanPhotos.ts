// ============================================================
// Прочитати дату зйомки з вибраних файлів.
// ------------------------------------------------------------
// Половина з введенням-виведенням: `photoImport.ts` лишається чистим і
// нічого не знає про файли, а тут немає жодного правила про роки.
//
// ЧОМУ НЕ ЧИТАТИ ФАЙЛ ЦІЛКОМ. Пара вибирає плівку телефона — це легко
// двісті знімків по 3–5 МБ. `file.arrayBuffer()` на кожному означав би
// близько гігабайта в пам'яті вкладки заради тега, який лежить у перших
// кілобайтах. Тому спершу читається початок, і лише якщо дати там не
// виявилось — файл цілком.
//
// Другий прохід не марна робота: без нього знімок, у якого EXIF лежить
// далі за поріг, тихо порахувався б «без дати», а таких у пари вже 82%
// з інших причин. Платимо повним читанням лише за ті файли, які інакше
// однаково були б пропущені.
// ============================================================
import { readExifTakenAt } from '@/lib/exif';
import type { DatedPhoto } from './photoImport';

/**
 * Скільки читати першим проходом.
 *
 * 256 КБ із запасом покривають і APP1 у JPEG, і бокс `meta` з елементом
 * EXIF у HEIC: обидва стоять на початку файлу.
 */
export const EXIF_PREFIX_BYTES = 256 * 1024;

/** Час зйомки з файлу, або `null`. Не кидає: битий кадр не валить імпорт. */
export async function readTakenAt(file: Blob): Promise<string | null> {
  try {
    const head = await file.slice(0, EXIF_PREFIX_BYTES).arrayBuffer();
    const early = readExifTakenAt(head);
    if (early !== null) return early;
    if (file.size <= EXIF_PREFIX_BYTES) return null;
    return readExifTakenAt(await file.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Прочитати всі вибрані файли, повідомляючи про поступ.
 *
 * Послідовно, а не `Promise.all`: двісті одночасних читань дають пік
 * пам'яті, який на телефоні закінчується вкладкою, що зникла. Швидкість
 * тут і не потрібна — це не кадр анімації, а разова робота, яку пара
 * бачить смужкою.
 */
export async function scanPhotos(
  files: readonly File[],
  onProgress?: (done: number, total: number) => void,
): Promise<DatedPhoto<File>[]> {
  const out: DatedPhoto<File>[] = [];
  for (const [index, file] of files.entries()) {
    out.push({ file, takenAt: await readTakenAt(file) });
    onProgress?.(index + 1, files.length);
  }
  return out;
}
