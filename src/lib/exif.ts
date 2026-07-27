// ============================================================
// Час зйомки з метаданих JPEG. Чиста функція над ArrayBuffer.
// ------------------------------------------------------------
// Живе в lib, а не в модулі: дату зйомки читають і «Спогади» (масовий
// імпорт), і карта (підказка «коли були» для фото місця), а це просто
// розбір формату файлу, без жодного знання про той чи інший модуль.
// Без бібліотеки: тягнути залежність заради одного тега — зайве, а сам
// розбір це прохід по ланцюжку APP1 → TIFF → IFD0 → Exif-IFD.
//
// КОНВЕНЦІЯ ЧАСУ, і вона тут головна. EXIF зберігає НАСТІННИЙ час камери
// без зони: «06:12» означає, що на годиннику було 06:12 там, де знімали.
// Колонка `taken_at` має тип timestamptz, тож зберегти «06:12» без зони
// означало б віддати його на відкуп зоні сервера, і в Києві він читався б
// як 09:12.
//
// Тому настінний час записується так, НІБИ він UTC ('…Z'), а читається
// виключно UTC-геттерами (memoriesDate.ts). Тоді «06:12» лишається
// «06:12» у будь-якій зоні й у будь-якій подорожі — а саме це й потрібно
// для поділу дня на ранок/день/вечір.
//
// Будь-який пошкоджений чи чужий файл дає null, а не виняток: користувач
// вибирає сотню фото одним махом, і один битий кадр не має валити імпорт.
// ============================================================

const SOI = 0xffd8;
const APP1 = 0xffe1;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME_DIGITIZED = 0x9004;
/** DateTime в IFD0 — час останньої зміни файлу; запасний варіант. */
const TAG_DATE_TIME = 0x0132;
const TYPE_ASCII = 2;

/** 'YYYY:MM:DD HH:MM:SS' → 'YYYY-MM-DDTHH:MM:SSZ' або null. */
function toIsoZ(raw: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  // Камери інколи пишуть '0000:00:00 00:00:00' у ненастроєному годиннику.
  if (y === '0000' || mo === '00' || d === '00') return null;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

interface Reader {
  view: DataView;
  little: boolean;
  /** Початок TIFF-заголовка: усі зміщення в EXIF рахуються від нього. */
  base: number;
}

function ascii(r: Reader, offset: number, length: number): string | null {
  if (offset < 0 || offset + length > r.view.byteLength) return null;
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const c = r.view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/** Перебирає записи IFD і повертає перше знайдене зі списку тегів. */
function scanIfd(
  r: Reader,
  ifdOffset: number,
  wanted: readonly number[],
): Map<number, number> {
  const found = new Map<number, number>();
  const at = r.base + ifdOffset;
  if (at + 2 > r.view.byteLength) return found;
  const count = r.view.getUint16(at, r.little);
  // 12 байтів на запис. Обмеження зверху — захист від сміттєвого count у
  // пошкодженому файлі, який інакше змусив би крутити мільйони ітерацій.
  const safeCount = Math.min(count, 512);
  for (let i = 0; i < safeCount; i += 1) {
    const entry = at + 2 + i * 12;
    if (entry + 12 > r.view.byteLength) break;
    const tag = r.view.getUint16(entry, r.little);
    if (!wanted.includes(tag)) continue;
    const type = r.view.getUint16(entry + 2, r.little);
    const valueCount = r.view.getUint32(entry + 4, r.little);
    if (type === TYPE_ASCII) {
      // ASCII довші за 4 байти лежать за зміщенням, коротші — на місці.
      const valueOffset =
        valueCount > 4 ? r.base + r.view.getUint32(entry + 8, r.little) : entry + 8;
      // Зміщення під ключем тега, довжина — під від'ємним: обидва
      // потрібні, щоб прочитати рядок, а зайвої структури тут не варте.
      found.set(tag, valueOffset);
      found.set(-tag, valueCount);
    } else {
      found.set(tag, r.view.getUint32(entry + 8, r.little));
    }
  }
  return found;
}

/**
 * Час зйомки з JPEG у вигляді '…Z' (настінний час камери, див. шапку).
 * `null`, якщо файл не JPEG, без EXIF або з непридатною датою.
 */
export function readExifTakenAt(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== SOI) return null;

    // Шукаємо сегмент APP1 серед маркерів JPEG.
    let offset = 2;
    let app1 = -1;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      const length = view.getUint16(offset + 2);
      if (length < 2) break;
      if (marker === APP1) {
        app1 = offset + 4;
        break;
      }
      // FFDA — початок стисненого потоку, далі метаданих немає.
      if (marker === 0xffda) break;
      offset += 2 + length;
    }
    if (app1 < 0 || app1 + 6 > view.byteLength) return null;

    if (ascii({ view, little: true, base: 0 }, app1, 4) !== 'Exif') return null;
    const tiff = app1 + 6;
    if (tiff + 8 > view.byteLength) return null;

    const byteOrder = view.getUint16(tiff);
    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
    const little = byteOrder === 0x4949;
    if (view.getUint16(tiff + 2, little) !== 0x002a) return null;

    const r: Reader = { view, little, base: tiff };
    const ifd0 = view.getUint32(tiff + 4, little);
    const root = scanIfd(r, ifd0, [TAG_EXIF_IFD, TAG_DATE_TIME]);

    // Пріоритет: коли знято → коли оцифровано → коли змінено файл.
    const exifIfd = root.get(TAG_EXIF_IFD);
    if (exifIfd !== undefined) {
      const sub = scanIfd(r, exifIfd, [TAG_DATE_TIME_ORIGINAL, TAG_DATE_TIME_DIGITIZED]);
      for (const tag of [TAG_DATE_TIME_ORIGINAL, TAG_DATE_TIME_DIGITIZED]) {
        const at = sub.get(tag);
        const len = sub.get(-tag);
        if (at === undefined || len === undefined) continue;
        const parsed = toIsoZ(ascii(r, at, len) ?? '');
        if (parsed) return parsed;
      }
    }

    const at = root.get(TAG_DATE_TIME);
    const len = root.get(-TAG_DATE_TIME);
    if (at !== undefined && len !== undefined) {
      return toIsoZ(ascii(r, at, len) ?? '');
    }
    return null;
  } catch {
    // Пошкоджений файл не має валити імпорт сотні знімків.
    return null;
  }
}

/** Календарний день зі часу зйомки ('YYYY-MM-DD'), або null. */
export function exifDay(takenAt: string | null): string | null {
  return takenAt ? takenAt.slice(0, 10) : null;
}
