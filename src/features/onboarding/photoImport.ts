// ============================================================
// Гуртовий імпорт світлин: із купи файлів — спогади по днях.
// ------------------------------------------------------------
// ЧОМУ НЕ ТЕ, ЩО ВЖЕ Є. Композер спогадів уміє взяти багато файлів
// одразу, але кладе їх в ОДИН спогад і датує його EXIF-ом ПЕРШОГО. Для
// сьогоднішнього дня це правильно: пара знімає одну подію. Для минулого
// це рівно те, що ламає задачу — двісті світлин за вісім років стали б
// одним спогадом одного дня, і роки лишились би порожніми.
//
// Тому тут ГРУПУВАННЯ: день зйомки — один спогад. Це не вигадана
// одиниця, а та сама, якою портал уже міряє галерею (`memory_days`).
//
// ЧОМУ ЧИСТА ФУНКЦІЯ. Усе, що можна зробити не так, робиться тут:
// пропустити фото без дати, не пропустити фото з датою, покласти день у
// той рік, у який треба, і не покласти в майбутнє. Жодне з цього не
// видно з екрана, поки не стане пізно, — а на вході в цю функцію стоять
// файли, які тестом не підробиш, тож підроблювати треба лише дати.
// ============================================================
import { exifDay } from '@/lib/exif';
import { yearContaining } from './sweepModel';
import type { RelationshipYearFill } from './yearFills';

/** Файл із тим, що вдалось прочитати з його метаданих. */
export interface DatedPhoto<T = unknown> {
  file: T;
  /** Час зйомки з EXIF; `null`, коли метаданих немає або годинник збитий. */
  takenAt: string | null;
}

export interface PhotoDay<T = unknown> {
  /** `YYYY-MM-DD` — день зйомки. */
  day: string;
  /** Номер року стосунків, якому цей день належить. */
  yearIndex: number;
  photos: DatedPhoto<T>[];
}

export interface PhotoImportPlan<T = unknown> {
  /** Дні, які стануть спогадами, за зростанням дати. */
  days: PhotoDay<T>[];
  /** Скільки світлин потрапить у спогади. */
  photoCount: number;
  /** Без дати в метаданих — імпортувати нема куди. */
  undated: number;
  /** Дата є, але поза історією пари: до початку або в майбутньому. */
  outside: number;
  /** Скільки днів припало на кожен рік стосунків, за номером року. */
  daysByYear: Map<number, number>;
}

/**
 * Розкласти вибрані файли по днях і роках.
 *
 * Три причини, з яких світлина не потрапляє в імпорт, і кожна рахується
 * окремо — бо «209 з 300» без пояснення виглядає як збій:
 *
 *  1. **немає дати.** EXIF може бути стертий редактором, месенджером або
 *     не записаний зовсім. Вигадати дату не можна: спогад із вигаданим
 *     днем гірший за відсутній;
 *  2. **дата до початку стосунків.** Це справжні світлини, але не
 *     «наша історія»: рушій рахує роки від дати початку, і такий день не
 *     належить жодному з них. Мовчки заводити їх у портал теж не можна —
 *     пара легко вибирає всю плівку телефона;
 *  3. **дата в майбутньому.** `readExifTakenAt` відкидає ненастроєний
 *     годинник і неможливі дати, але не збитий на рік уперед. Спогад,
 *     датований наступним місяцем, зіпсував би поточний рік тихо.
 *
 * @param asOf сьогодні, `YYYY-MM-DD` — параметром, бо в порталі немає
 *   жодного місця, де час беруть з повітря, і тест не має чекати завтра
 */
export function planPhotoImport<T>(
  photos: readonly DatedPhoto<T>[],
  years: readonly RelationshipYearFill[],
  asOf: string,
): PhotoImportPlan<T> {
  const byDay = new Map<string, { yearIndex: number; photos: DatedPhoto<T>[] }>();
  let undated = 0;
  let outside = 0;

  for (const photo of photos) {
    const day = photo.takenAt === null ? null : exifDay(photo.takenAt);
    if (day === null) { undated += 1; continue; }
    if (day > asOf) { outside += 1; continue; }

    const year = yearContaining(years, day);
    if (year === null) { outside += 1; continue; }

    const bucket = byDay.get(day);
    if (bucket) bucket.photos.push(photo);
    else byDay.set(day, { yearIndex: year.index, photos: [photo] });
  }

  /*
   * Порядок — по зростанню дати, і всередині дня теж. Не косметика:
   * перше фото дня стає обкладинкою спогаду (`create` бере `saved[0]`),
   * тож без сортування обкладинка залежала б від того, у якому порядку
   * файловий діалог віддав файли.
   */
  const days = [...byDay.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([day, bucket]): PhotoDay<T> => ({
      day,
      yearIndex: bucket.yearIndex,
      photos: [...bucket.photos].sort((a, b) => (
        (a.takenAt ?? '') < (b.takenAt ?? '') ? -1 : (a.takenAt ?? '') > (b.takenAt ?? '') ? 1 : 0
      )),
    }));

  const daysByYear = new Map<number, number>();
  for (const entry of days) {
    daysByYear.set(entry.yearIndex, (daysByYear.get(entry.yearIndex) ?? 0) + 1);
  }

  return {
    days,
    photoCount: days.reduce((sum, entry) => sum + entry.photos.length, 0),
    undated,
    outside,
    daysByYear,
  };
}
