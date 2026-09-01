// ============================================================
// Час зйомки з метаданих JPEG і HEIC. Чиста функція над ArrayBuffer.
// ------------------------------------------------------------
// Живе в lib, а не в модулі: дату зйомки читають і «Спогади» (масовий
// імпорт), і карта (підказка «коли були» для фото місця), а це просто
// розбір формату файлу, без жодного знання про той чи інший модуль.
// Без бібліотеки: тягнути залежність заради одного тега — зайве, а сам
// розбір це прохід по ланцюжку APP1 → TIFF → IFD0 → Exif-IFD.
//
// HEIC ДОДАНО НЕ ЗАРАДИ ПОВНОТИ. Виміряно на робочій базі: з 61 світлини
// пари час зйомки мають 11 — 18%. Айфон пише HEIC, а цей розбір знав
// лише JPEG і мовчки віддавав `null`, тож гуртовий імпорт минулих років
// пропустив би більшість плівки. Дорога до TIFF у HEIC інша
// (ftyp → meta → iinf/iloc → Exif-item), але сам TIFF той самий, тож
// нижче з'явився лише другий ВХІД, а не другий розбір.
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
/** Вказівник на GPS-IFD в IFD0. */
const TAG_GPS_IFD = 0x8825;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;
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
/**
 * Дійти до TIFF-заголовка всередині JPEG.
 *
 * Винесено окремо, бо цей шлях (SOI → APP1 → 'Exif\0\0' → TIFF) однаковий
 * і для дати, і для координат. Читати його двічі означало б два місця, де
 * можна по-різному помилитись у межах буфера.
 */
function openTiff(buffer: ArrayBuffer): { reader: Reader; ifd0: number } | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return null;
  if (view.getUint16(0) !== SOI) return openHeicTiff(view);

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
  return tiffAt(view, app1 + 6);
}

/** TIFF-заголовок за зміщенням: спільний хвіст обох входів. */
function tiffAt(view: DataView, tiff: number): { reader: Reader; ifd0: number } | null {
  if (tiff < 0 || tiff + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiff);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
  const little = byteOrder === 0x4949;
  if (view.getUint16(tiff + 2, little) !== 0x002a) return null;
  return { reader: { view, little, base: tiff }, ifd0: view.getUint32(tiff + 4, little) };
}

// ── HEIC: ftyp → meta → iinf/iloc → Exif-item → TIFF ────────
//
// ISO/IEC 23008-12 тримає EXIF не сегментом у потоці, а ЕЛЕМЕНТОМ:
// `iinf` каже, який номер елемента має тип 'Exif', `iloc` — де він
// лежить. Це два різні місця, і жодне з них не можна пропустити.

/** Ім'я боксу чотирма літерами, або порожній рядок за межами буфера. */
function boxType(view: DataView, at: number): string {
  if (at + 8 > view.byteLength) return '';
  let out = '';
  for (let i = 4; i < 8; i += 1) out += String.fromCharCode(view.getUint8(at + i));
  return out;
}

/**
 * Знайти дочірній бокс на одному рівні.
 *
 * `limit` — скільки боксів дивитись найбільше. Не оптимізація: у
 * пошкодженому файлі розмір боксу легко читається нулем або сміттям, і
 * без стелі цикл крутився б, поки браузер не вб'є вкладку.
 */
function findBox(
  view: DataView, start: number, end: number, name: string, limit = 64,
): { start: number; end: number } | null {
  let at = start;
  for (let i = 0; i < limit && at + 8 <= end; i += 1) {
    let size = view.getUint32(at);
    let header = 8;
    if (size === 1) {
      // 64-бітний розмір. Старше слово має бути нулем: файл на 4 ГБ+
      // усередині браузера все одно не прочитається.
      if (at + 16 > end || view.getUint32(at + 8) !== 0) return null;
      size = view.getUint32(at + 12);
      header = 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < header || at + size > end) return null;
    if (boxType(view, at) === name) return { start: at + header, end: at + size };
    at += size;
  }
  return null;
}

/** Ціле big-endian завширшки 0, 4 або 8 байтів; інші ширини — `null`. */
function beInt(view: DataView, at: number, bytes: number): number | null {
  if (bytes === 0) return 0;
  if (at + bytes > view.byteLength) return null;
  if (bytes === 4) return view.getUint32(at);
  if (bytes === 8) {
    if (view.getUint32(at) !== 0) return null;
    return view.getUint32(at + 4);
  }
  return null;
}

/** Номер елемента, оголошеного типом 'Exif' у `iinf`. */
function exifItemId(view: DataView, meta: { start: number; end: number }): number | null {
  const iinf = findBox(view, meta.start, meta.end, 'iinf');
  if (!iinf) return null;
  const version = view.getUint8(iinf.start);
  let at = iinf.start + 4;
  let count: number;
  if (version === 0) {
    if (at + 2 > iinf.end) return null;
    count = view.getUint16(at);
    at += 2;
  } else {
    if (at + 4 > iinf.end) return null;
    count = view.getUint32(at);
    at += 4;
  }

  for (let i = 0; i < Math.min(count, 256) && at + 8 <= iinf.end; i += 1) {
    const size = view.getUint32(at);
    if (size < 8 || at + size > iinf.end) return null;
    if (boxType(view, at) === 'infe') {
      const infeVersion = view.getUint8(at + 8);
      const body = at + 12;
      // v2 тримає номер у двох байтах, v3 — у чотирьох; тип іде одразу
      // за індексом захисту. Версії 0–1 давніші за HEIC і сюди не
      // потрапляють — у них взагалі немає поля типу.
      if (infeVersion === 2 || infeVersion === 3) {
        const idBytes = infeVersion === 2 ? 2 : 4;
        const typeAt = body + idBytes + 2;
        if (typeAt + 4 <= iinf.end && boxType(view, typeAt - 4) === 'Exif') {
          return infeVersion === 2 ? view.getUint16(body) : view.getUint32(body);
        }
      }
    }
    at += size;
  }
  return null;
}

/** Де лежить елемент із цим номером, за `iloc`. */
function itemOffset(
  view: DataView, meta: { start: number; end: number }, wantedId: number,
): number | null {
  const iloc = findBox(view, meta.start, meta.end, 'iloc');
  if (!iloc || iloc.start + 8 > iloc.end) return null;

  const version = view.getUint8(iloc.start);
  let at = iloc.start + 4;
  const sizes = view.getUint8(at);
  const offsetSize = sizes >> 4;
  const lengthSize = sizes & 0xf;
  const baseAndIndex = view.getUint8(at + 1);
  const baseOffsetSize = baseAndIndex >> 4;
  const indexSize = version === 1 || version === 2 ? (baseAndIndex & 0xf) : 0;
  at += 2;

  let count: number;
  if (version < 2) {
    count = view.getUint16(at);
    at += 2;
  } else {
    count = view.getUint32(at);
    at += 4;
  }

  for (let i = 0; i < Math.min(count, 256); i += 1) {
    if (at + 2 > iloc.end) return null;
    const id = version < 2 ? view.getUint16(at) : view.getUint32(at);
    at += version < 2 ? 2 : 4;
    if (version === 1 || version === 2) at += 2; // construction_method
    at += 2; // data_reference_index
    const base = beInt(view, at, baseOffsetSize);
    if (base === null) return null;
    at += baseOffsetSize;
    if (at + 2 > iloc.end) return null;
    const extents = view.getUint16(at);
    at += 2;

    for (let e = 0; e < Math.min(extents, 64); e += 1) {
      at += indexSize;
      const offset = beInt(view, at, offsetSize);
      if (offset === null) return null;
      at += offsetSize + lengthSize;
      // Перший екстент і є початком елемента; розбитий на кілька частин
      // EXIF у знімках камери не трапляється, і склеювати їх наосліп
      // означало б читати сміття як дату.
      if (id === wantedId && e === 0) return base + offset;
    }
  }
  return null;
}

/**
 * Дійти до TIFF-заголовка всередині HEIC.
 *
 * Корисне навантаження Exif-елемента починається з чотирибайтового
 * зміщення до самого TIFF (перед ним зазвичай лежить 'Exif\0\0'), тож
 * заголовок шукається не з початку елемента.
 */
function openHeicTiff(view: DataView): { reader: Reader; ifd0: number } | null {
  if (boxType(view, 0) !== 'ftyp') return null;
  const meta = findBox(view, 0, view.byteLength, 'meta');
  if (!meta) return null;
  // `meta` — FullBox: версія й прапорці перед дочірніми боксами.
  const inside = { start: meta.start + 4, end: meta.end };

  const id = exifItemId(view, inside);
  if (id === null) return null;
  const item = itemOffset(view, inside, id);
  if (item === null || item + 4 > view.byteLength) return null;

  const skip = view.getUint32(item);
  return tiffAt(view, item + 4 + skip);
}

export function readExifTakenAt(buffer: ArrayBuffer): string | null {
  try {
    const opened = openTiff(buffer);
    if (!opened) return null;
    const { reader: r, ifd0 } = opened;
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

// ============================================================
// Координати зйомки.
// ------------------------------------------------------------
// EXIF тримає широту й довготу трьома раціональними числами (градуси,
// хвилини, секунди) плюс окремий однобуквений напрямок ('N'/'S', 'E'/'W').
// Знак у самих числах не зберігається взагалі, тож без напрямку південна
// півкуля читалася б північною — і фото з Кейптауна опинилось би в Іспанії.
// ============================================================

/** Три раціональні числа підряд: градуси, хвилини, секунди. */
function rational3(r: Reader, offset: number): [number, number, number] | null {
  const at = r.base + offset;
  if (at < 0 || at + 24 > r.view.byteLength) return null;
  const parts: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const numerator = r.view.getUint32(at + i * 8, r.little);
    const denominator = r.view.getUint32(at + i * 8 + 4, r.little);
    // Нульовий знаменник трапляється в секундах у камер, які пишуть цілі
    // хвилини. Це не пошкодження файлу — це нуль.
    parts.push(denominator === 0 ? 0 : numerator / denominator);
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

/** Градуси-хвилини-секунди в десяткові градуси з урахуванням напрямку. */
function toDecimal(dms: [number, number, number], ref: string): number {
  const value = dms[0] + dms[1] / 60 + dms[2] / 3600;
  return ref === 'S' || ref === 'W' ? -value : value;
}

export interface ExifLocation {
  lat: number;
  lng: number;
}

/**
 * Координати зйомки з JPEG, або `null`.
 *
 * `null` повертається не лише коли GPS у файлі немає, а й коли він там є,
 * але непридатний:
 *
 *  - **рівно (0, 0)** — це точка в Гвінейській затоці, і камера пише її
 *    саме тоді, коли супутників не спіймала. Жодна пара там не була;
 *  - значення поза межами глобуса — пошкоджений файл.
 *
 * Мовчазний нуль гірший за відсутність: він поставив би спогад на карту в
 * місце, де ніхто не був, і пара мусила б це помітити сама.
 */
export function readExifLocation(buffer: ArrayBuffer): ExifLocation | null {
  try {
    const opened = openTiff(buffer);
    if (!opened) return null;
    const { reader: r, ifd0 } = opened;

    const root = scanIfd(r, ifd0, [TAG_GPS_IFD]);
    const gpsIfd = root.get(TAG_GPS_IFD);
    if (gpsIfd === undefined) return null;

    const gps = scanIfd(r, gpsIfd, [TAG_GPS_LAT_REF, TAG_GPS_LAT, TAG_GPS_LNG_REF, TAG_GPS_LNG]);

    const latAt = gps.get(TAG_GPS_LAT);
    const lngAt = gps.get(TAG_GPS_LNG);
    const latRefAt = gps.get(TAG_GPS_LAT_REF);
    const lngRefAt = gps.get(TAG_GPS_LNG_REF);
    if (latAt === undefined || lngAt === undefined) return null;
    if (latRefAt === undefined || lngRefAt === undefined) return null;

    const latDms = rational3(r, latAt);
    const lngDms = rational3(r, lngAt);
    if (!latDms || !lngDms) return null;

    const latRef = (ascii(r, latRefAt, gps.get(-TAG_GPS_LAT_REF) ?? 2) ?? '').trim().toUpperCase();
    const lngRef = (ascii(r, lngRefAt, gps.get(-TAG_GPS_LNG_REF) ?? 2) ?? '').trim().toUpperCase();
    if (!'NS'.includes(latRef) || !'EW'.includes(lngRef)) return null;

    const lat = toDecimal(latDms, latRef);
    const lng = toDecimal(lngDms, lngRef);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (lat === 0 && lng === 0) return null;

    return { lat, lng };
  } catch {
    // Той самий принцип, що й із датою: битий файл не валить імпорт сотні.
    return null;
  }
}
