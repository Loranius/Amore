// ============================================================
// Розбір EXIF. Файли будуються ПОБАЙТОВО прямо тут.
// ------------------------------------------------------------
// Інакше тест бінарного формату або спирається на закинутий у репозиторій
// знімок (де не видно, що саме перевіряється), або не існує. Тут кожен
// байт видно, тож можна зібрати рівно ті випадки, які ламають наївний
// парсер: обидва порядки байтів, значення довші за 4 байти (лежать за
// зміщенням), відсутній Exif-IFD, ненастроєний годинник камери, обрізаний
// файл, сміттєвий лічильник записів.
// ============================================================
import { describe, expect, it } from 'vitest';
import { exifDay, readExifLocation, readExifTakenAt } from './exif';

/** Раціональне число EXIF: чисельник і знаменник. */
type Rational = [number, number];

interface Entry {
  tag: number;
  type: number;
  count: number;
  value: number | string | Rational[];
}

/**
 * Мінімальний JPEG з одним APP1. Повертає ArrayBuffer.
 * `sub` — записи Exif-IFD; якщо порожні, Exif-IFD не додається взагалі.
 */
function jpeg(opts: {
  little?: boolean;
  ifd0?: Entry[];
  sub?: Entry[];
  gps?: Entry[];
  truncateTo?: number;
  entryCount?: number;
}): ArrayBuffer {
  const little = opts.little ?? true;
  const ifd0 = [...(opts.ifd0 ?? [])];
  const sub = opts.sub ?? [];
  const gps = opts.gps ?? [];

  // Розкладка TIFF: [header 8][IFD0][Exif-IFD][GPS-IFD][пул довгих значень]
  const ifd0Count = ifd0.length + (sub.length ? 1 : 0) + (gps.length ? 1 : 0);
  const ifd0At = 8;
  const ifd0Size = 2 + ifd0Count * 12 + 4;
  const subAt = ifd0At + ifd0Size;
  const subSize = sub.length ? 2 + sub.length * 12 + 4 : 0;
  const gpsAt = subAt + subSize;
  const gpsSize = gps.length ? 2 + gps.length * 12 + 4 : 0;
  let poolAt = gpsAt + gpsSize;

  const bytes: number[] = [];
  const pool: number[] = [];
  const put16 = (a: number[], v: number) =>
    little ? a.push(v & 0xff, (v >> 8) & 0xff) : a.push((v >> 8) & 0xff, v & 0xff);
  const put32 = (a: number[], v: number) =>
    little
      ? a.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff)
      : a.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);

  const writeEntry = (a: number[], e: Entry) => {
    put16(a, e.tag);
    put16(a, e.type);
    put32(a, e.count);
    if (Array.isArray(e.value)) {
      // Раціональні завжди довші за 4 байти, тож лежать у пулі.
      put32(a, poolAt);
      for (const [num, den] of e.value) {
        put32(pool, num);
        put32(pool, den);
      }
      poolAt += e.value.length * 8;
    } else if (typeof e.value === 'string') {
      const chars = [...e.value].map((c) => c.charCodeAt(0));
      chars.push(0);
      if (chars.length > 4) {
        // Довге ASCII живе в пулі, у записі — зміщення від TIFF.
        put32(a, poolAt);
        pool.push(...chars);
        poolAt += chars.length;
      } else {
        for (let i = 0; i < 4; i += 1) a.push(chars[i] ?? 0);
      }
    } else {
      put32(a, e.value);
    }
  };

  // TIFF header
  bytes.push(little ? 0x49 : 0x4d, little ? 0x49 : 0x4d);
  put16(bytes, 0x2a);
  put32(bytes, ifd0At);

  // IFD0
  put16(bytes, opts.entryCount ?? ifd0Count);
  for (const e of ifd0) writeEntry(bytes, e);
  if (sub.length) writeEntry(bytes, { tag: 0x8769, type: 4, count: 1, value: subAt });
  if (gps.length) writeEntry(bytes, { tag: 0x8825, type: 4, count: 1, value: gpsAt });
  put32(bytes, 0);

  // Exif-IFD
  if (sub.length) {
    put16(bytes, sub.length);
    for (const e of sub) writeEntry(bytes, e);
    put32(bytes, 0);
  }

  // GPS-IFD
  if (gps.length) {
    put16(bytes, gps.length);
    for (const e of gps) writeEntry(bytes, e);
    put32(bytes, 0);
  }

  bytes.push(...pool);

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...bytes]; // 'Exif\0\0' + TIFF
  const out = [0xff, 0xd8, 0xff, 0xe1];
  const len = app1.length + 2;
  out.push((len >> 8) & 0xff, len & 0xff, ...app1, 0xff, 0xd9);
  const arr = new Uint8Array(opts.truncateTo ? out.slice(0, opts.truncateTo) : out);
  return arr.buffer;
}

const dto = (v: string): Entry => ({ tag: 0x9003, type: 2, count: v.length + 1, value: v });

describe('readExifTakenAt', () => {
  it('читає DateTimeOriginal (little-endian)', () => {
    expect(readExifTakenAt(jpeg({ sub: [dto('2026:07:14 06:12:33')] })))
      .toBe('2026-07-14T06:12:33Z');
  });

  it('читає DateTimeOriginal (big-endian)', () => {
    // Обидва порядки байтів реальні: Canon пише II, деякі Nikon — MM.
    expect(readExifTakenAt(jpeg({ little: false, sub: [dto('2019:11:30 21:05:00')] })))
      .toBe('2019-11-30T21:05:00Z');
  });

  it('падає на DateTimeDigitized, коли Original немає', () => {
    const digitized: Entry = { tag: 0x9004, type: 2, count: 20, value: '2024:05:17 13:00:00' };
    expect(readExifTakenAt(jpeg({ sub: [digitized] }))).toBe('2024-05-17T13:00:00Z');
  });

  it('падає на DateTime з IFD0, коли Exif-IFD немає взагалі', () => {
    const dt: Entry = { tag: 0x0132, type: 2, count: 20, value: '2023:01:02 08:30:00' };
    expect(readExifTakenAt(jpeg({ ifd0: [dt] }))).toBe('2023-01-02T08:30:00Z');
  });

  it('віддає перевагу часу зйомки над часом зміни файлу', () => {
    const dt: Entry = { tag: 0x0132, type: 2, count: 20, value: '2025:01:01 00:00:00' };
    expect(readExifTakenAt(jpeg({ ifd0: [dt], sub: [dto('2026:07:14 06:12:33')] })))
      .toBe('2026-07-14T06:12:33Z');
  });
});

describe('readExifTakenAt не валиться на поганому вході', () => {
  it('не JPEG', () => {
    expect(readExifTakenAt(new Uint8Array([1, 2, 3, 4, 5, 6]).buffer)).toBeNull();
  });

  it('порожній буфер', () => {
    expect(readExifTakenAt(new ArrayBuffer(0))).toBeNull();
  });

  it('JPEG без APP1', () => {
    expect(readExifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeNull();
  });

  it('обрізаний посеред EXIF', () => {
    expect(readExifTakenAt(jpeg({ sub: [dto('2026:07:14 06:12:33')], truncateTo: 24 })))
      .toBeNull();
  });

  it('сміттєвий лічильник записів не зациклює розбір', () => {
    // IFD заявляє 60000 записів у файлі на кілька сотень байтів. Перевірка
    // не в тому, що результат порожній, — навпаки: обхід має обірватись на
    // межі буфера, але встигнути прочитати справжній запис, який лежить
    // на початку. Тобто битий заголовок не коштує вже знайдених даних.
    const started = Date.now();
    expect(readExifTakenAt(jpeg({ sub: [dto('2026:07:14 06:12:33')], entryCount: 60000 })))
      .toBe('2026-07-14T06:12:33Z');
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('ненастроєний годинник камери', () => {
    expect(readExifTakenAt(jpeg({ sub: [dto('0000:00:00 00:00:00')] }))).toBeNull();
  });

  it('неможлива дата', () => {
    expect(readExifTakenAt(jpeg({ sub: [dto('2026:13:40 25:70:99')] }))).toBeNull();
  });
});

describe('exifDay', () => {
  it('бере календарний день без перетворення зон', () => {
    // Ключове: 23:50 лишається тим самим днем. Якби час прогнали через
    // локальну зону, у частині світу він поїхав би на добу.
    expect(exifDay('2026-07-14T23:50:00Z')).toBe('2026-07-14');
    expect(exifDay('2026-07-14T00:10:00Z')).toBe('2026-07-14');
    expect(exifDay(null)).toBeNull();
  });
});

// ============================================================
// Координати зйомки.
// ============================================================

/** Градуси-хвилини-секунди як три раціональні числа EXIF. */
const dms = (d: number, m: number, sec: number): Rational[] =>
  [[d, 1], [m, 1], [Math.round(sec * 100), 100]];

const gpsOf = (
  lat: Rational[], latRef: string, lng: Rational[], lngRef: string,
): Entry[] => [
  { tag: 0x0001, type: 2, count: 2, value: latRef },
  { tag: 0x0002, type: 5, count: 3, value: lat },
  { tag: 0x0003, type: 2, count: 2, value: lngRef },
  { tag: 0x0004, type: 5, count: 3, value: lng },
];

describe('readExifLocation', () => {
  it('читає північ і схід', () => {
    // Хмельницький, приблизно 49.4229 / 26.9871.
    const buffer = jpeg({ gps: gpsOf(dms(49, 25, 22.4), 'N', dms(26, 59, 13.6), 'E') });
    const at = readExifLocation(buffer);
    expect(at?.lat).toBeCloseTo(49.4229, 3);
    expect(at?.lng).toBeCloseTo(26.9871, 3);
  });

  it('напрямок вирішує знак, бо в числах його немає', () => {
    /*
     * Головна пастка формату. EXIF зберігає лише модуль координати, а
     * півкулю — окремою літерою. Парсер, який її не читає, поставив би фото
     * з Кейптауна десь в Іспанію.
     */
    const buffer = jpeg({ gps: gpsOf(dms(33, 55, 29.0), 'S', dms(18, 25, 26.0), 'E') });
    const at = readExifLocation(buffer);
    expect(at?.lat).toBeLessThan(0);
    expect(at?.lat).toBeCloseTo(-33.9247, 3);
    expect(at?.lng).toBeGreaterThan(0);
  });

  it('західна довгота теж від\'ємна', () => {
    const buffer = jpeg({ gps: gpsOf(dms(40, 42, 46.0), 'N', dms(74, 0, 21.0), 'W') });
    expect(readExifLocation(buffer)?.lng).toBeCloseTo(-74.0058, 3);
  });

  it('працює в обох порядках байтів', () => {
    const big = jpeg({ little: false, gps: gpsOf(dms(49, 25, 22.4), 'N', dms(26, 59, 13.6), 'E') });
    expect(readExifLocation(big)?.lat).toBeCloseTo(49.4229, 3);
  });

  it('дата й координати читаються з одного файлу', () => {
    const buffer = jpeg({
      sub: [dto('2026:07:14 06:12:33')],
      gps: gpsOf(dms(49, 25, 22.4), 'N', dms(26, 59, 13.6), 'E'),
    });
    expect(readExifTakenAt(buffer)).toBe('2026-07-14T06:12:33Z');
    expect(readExifLocation(buffer)?.lat).toBeCloseTo(49.4229, 3);
  });
});

describe('readExifLocation відкидає непридатне', () => {
  it('рівно нуль-нуль — це «супутників не спіймав», а не Гвінейська затока', () => {
    /*
     * Камера пише (0, 0) саме тоді, коли фіксу немає. Мовчазний нуль гірший
     * за відсутність: він поставив би спогад на карту в місце, де ніхто не
     * був, і пара мусила б помітити це сама.
     */
    expect(readExifLocation(jpeg({ gps: gpsOf(dms(0, 0, 0), 'N', dms(0, 0, 0), 'E') }))).toBeNull();
  });

  it('координати поза глобусом', () => {
    expect(readExifLocation(jpeg({ gps: gpsOf(dms(120, 0, 0), 'N', dms(10, 0, 0), 'E') }))).toBeNull();
  });

  it('напрямок не з тієї осі', () => {
    // 'E' у полі широти означає пошкоджені метадані, а не східну широту.
    expect(readExifLocation(jpeg({ gps: gpsOf(dms(49, 0, 0), 'E', dms(26, 0, 0), 'E') }))).toBeNull();
  });

  it('GPS без напрямків не вгадується', () => {
    const partial: Entry[] = [
      { tag: 0x0002, type: 5, count: 3, value: dms(49, 25, 22.4) },
      { tag: 0x0004, type: 5, count: 3, value: dms(26, 59, 13.6) },
    ];
    expect(readExifLocation(jpeg({ gps: partial }))).toBeNull();
  });

  it('файл без GPS, порожній і не-JPEG', () => {
    expect(readExifLocation(jpeg({ sub: [dto('2026:07:14 06:12:33')] }))).toBeNull();
    expect(readExifLocation(new ArrayBuffer(0))).toBeNull();
    expect(readExifLocation(new Uint8Array([1, 2, 3, 4, 5, 6]).buffer)).toBeNull();
  });

  it('обрізаний файл не валить розбір', () => {
    const full = jpeg({ gps: gpsOf(dms(49, 25, 22.4), 'N', dms(26, 59, 13.6), 'E') });
    expect(readExifLocation(full.slice(0, 40))).toBeNull();
  });
});
