// ============================================================
// Люди у 32×32 (ADR-0239, власник 2026-10-06: «люди з PixelLab, решта
// кодом»). Аркуші зібрано з персонажів PixelLab (`scripts/pixellab/
// build_sheet.py`): рядки — напрям (вниз, ліворуч, праворуч, угору),
// стовпці — стоїть, далі кадри ходи. Піксель аркуша — піксель малюнка,
// тобто пів світового: людина малюється вдвічі меншою за аркуш, і на
// парному масштабі сцени жоден піксель не розпливається.
//
// Гра лише в 32×32 (власник 2026-10-31): кого малює аркуш (`hasHdSheet`),
// того ніде не малюють 16-піксельним спрайтом — поки аркуш вантажиться,
// людини ще не видно (`hasHdLook` тоді каже «ні»). 16-піксельні спрайти
// лишаються тим, для кого аркушів ще нема (мешканці, перехожі).
// ============================================================
import lenaKidUrl from './assets/hd/lena-kid.png';
import lenaTeenUrl from './assets/hd/lena-teen.png';
import lenaAdultUrl from './assets/hd/lena-adult.png';
import lenaKidFallUrl from './assets/hd/lena-kid-fall.png';
import lenaTeenFallUrl from './assets/hd/lena-teen-fall.png';
import lenaAdultFallUrl from './assets/hd/lena-adult-fall.png';
import lenaKidPosesUrl from './assets/hd/lena-kid-poses.png';
import lenaTeenPosesUrl from './assets/hd/lena-teen-poses.png';
import lenaAdultPosesUrl from './assets/hd/lena-adult-poses.png';
import dimaUrl from './assets/hd/dima.png';
import olyaKidUrl from './assets/hd/olya-kid.png';
import olyaTeenUrl from './assets/hd/olya-teen.png';
import momUrl from './assets/hd/mom.png';
import { recolorByPalette, recolorOutfit, type Garment, type OutfitColors, type Tone } from './outfitHd';
import { DIMA, LENA_ADULT, LENA_KID, LENA_TEEN, MOM, OLYA, type Dir, type HairStyle, type Look } from './people';

interface HdSheet {
  url: string;
  cell: number;
  /** Кадрів ходи (0 — лише «стоїть»). */
  frames: number;
  /** Кадрів ходи за секунду (типово 8). */
  fps?: number;
  /** Зріст у світових пікселях — над ним емоція (типово 26 дитина, 31 дорослий). */
  height?: number;
  /** Точка між стопами в клітинці аркуша. */
  footX: number;
  footY: number;
  /** Чий це аркуш. */
  match(look: Look): boolean;
  /** Одяг, що перефарбовується під речі з шафи (`outfitHd.ts`), і вбрання, яке намальоване. */
  outfit?: { base: Look; garments: readonly Garment[] };
  img?: HTMLImageElement;
  ready?: boolean;
  /** Аркуш завантажився (`true`) чи ні (`false`, причину сказано в консолі). */
  loaded?: Promise<boolean>;
  /** Силует кадру «стоїть, униз» у клітинці (для портрета). */
  box?: Box;
  /** Перефарбовані аркуші за кольорами «верх|низ|оздоблення». */
  dressed?: Map<string, HTMLCanvasElement>;
  /**
   * Падіння від Басі (лише Лєна): смуга кадрів «праворуч» на тому самому
   * полотні — `FALL_DOWN_FRAMES` падіння навзнак, далі `FALL_UP_FRAMES` підйому
   * (PixelLab, шаблони `falling-back-death` і `getting-up`).
   */
  fall?: Strip;
  /**
   * Пози з руками перед собою (лише Лєна, міні-ігри садиби): кадри
   * «праворуч» у порядку `POSE_NAMES` (PixelLab `skeleton-v3`). `hands` —
   * де долоні в кожній позі: пікселі малюнка від точки між стопами, `x`
   * уперед, `y` угору (низ долоні).
   */
  poses?: Strip & { hands: Readonly<Record<PoseName, { x: number; y: number }>> };
  /** Обличчям до нас: висота низу долонь над стопами й де вони ліворуч і праворуч від середини. */
  front?: { up: number; l: number; r: number };
}

/** Прямокутник у пікселях малюнка. */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Смуга кадрів одного напряму («праворуч») на полотні людини. */
interface Strip {
  url: string;
  img?: HTMLImageElement;
  ready?: boolean;
  dressed?: Map<string, HTMLCanvasElement>;
}

/** Пози з руками перед собою: на рівні грудей, низько біля стегон, на рівні плечей. */
export type PoseName = 'chest' | 'low' | 'high';
export const POSE_NAMES: readonly PoseName[] = ['chest', 'low', 'high'];
/** Кадр пози в смузі. */
export const POSE_FRAME: Readonly<Record<PoseName, number>> = { chest: 0, low: 1, high: 2 };

/** Кадри смуги падіння: спершу падає (останній — лежить), потім підводиться. */
export const FALL_DOWN_FRAMES = 7;
export const FALL_UP_FRAMES = 5;

// Де лежить одяг на аркушах Лєни — заміряно за барвою по рядках силуету
// в усіх кадрах (ADR-0239). Смуги — частки зросту від маківки до стоп;
// банти, гумка, очі й взуття — поза ними.
const KID_PINK: readonly Tone[] = [{ hue: [0.88, 0.955], minS: 0.4, minV: 0.45 }, { hue: [0.88, 0.99], minS: 0.15, maxS: 0.4, minV: 0.85 }];
export const KID_DRESS: readonly Garment[] = [
  // Рожева сукня зі світлими відблисками. Черевички рожевіші (барва 0.97)
  // й насиченіші, а піднятий у ході черевичок сягає колін — тому спідниця
  // закінчується вище.
  { part: 'top', band: [0.36, 0.62], tones: KID_PINK },
  { part: 'bottom', band: [0.62, 0.84], tones: KID_PINK },
];
export const TEEN_CLOTHES: readonly Garment[] = [
  // Біла футболка: світло й сірі тіні майже без барви, тінь збоку — сіро-бузкова.
  { part: 'top', band: [0.38, 0.65], tones: [{ maxS: 0.1, minV: 0.45 }, { hue: [0.55, 0.8], maxS: 0.3, minV: 0.45 }] },
  // Блакитні комір і манжети з їхньою тінню; гумка на хвості — вище смуги.
  { part: 'accent', band: [0.36, 0.56], tones: [{ hue: [0.5, 0.64], minS: 0.3, minV: 0.4 }] },
  // Сині джинси з поясом, світлішим підворотом і темною обвідкою; кросівки — нижче.
  { part: 'bottom', band: [0.56, 0.93], tones: [{ hue: [0.55, 0.66], minS: 0.3, maxV: 0.75 }] },
];
// Блакитна сукня з найсвітлішими, майже білими відблисками (у кадрах збоку
// ними вкрита вся спина); чисто білі бретельки, поділ і туфлі — без барви,
// тож лишаються білими.
const ADULT_BLUE: readonly Tone[] = [{ hue: [0.55, 0.7], minS: 0.12, minV: 0.3 }, { hue: [0.55, 0.7], minS: 0.05, minV: 0.85 }];
export const ADULT_DRESS: readonly Garment[] = [
  { part: 'top', band: [0.4, 0.6], tones: ADULT_BLUE },
  { part: 'bottom', band: [0.6, 0.93], tones: ADULT_BLUE },
];

// Пози з руками перед собою (`poses`) — персонажі PixelLab тих самих Лєн,
// `skeleton-v3` «reaches both empty hands forward» «праворуч», 2026-10-31;
// точки долонь і `front` (долоні в кадрі «униз») заміряв `build_sheet.py`.
const SHEETS: HdSheet[] = [
  // Персонаж PixelLab «Лєна мала HD (48)» (a046bd5b-…).
  { url: lenaKidUrl, fall: { url: lenaKidFallUrl }, poses: { url: lenaKidPosesUrl, hands: { chest: { x: 11.5, y: 22 }, low: { x: 9.1, y: 13 }, high: { x: 10.2, y: 27 } } }, front: { up: 14, l: -7.5, r: 6.5 }, cell: 68, frames: 4, footX: 34, footY: 56, outfit: { base: LENA_KID, garments: KID_DRESS }, match: (l) => !!l.kid && l.bow === LENA_KID.bow && l.hairStyle === LENA_KID.hairStyle },
  // Персонаж PixelLab «Лєна підліток HD (2)» (10065427-…), власник 2026-10-11:
  // «дуже різниться між дитиною і дорослою, перемалюй» — кругле обличчя й
  // великі очі, як у малої й дорослої, світло-каштанове волосся, зріст між ними.
  { url: lenaTeenUrl, fall: { url: lenaTeenFallUrl }, poses: { url: lenaTeenPosesUrl, hands: { chest: { x: 14.9, y: 26 }, low: { x: 12, y: 15 }, high: { x: 11.1, y: 32 } } }, front: { up: 16, l: -8.5, r: 7.5 }, cell: 80, frames: 4, footX: 40, footY: 67, outfit: { base: LENA_TEEN, garments: TEEN_CLOTHES }, match: (l) => isLenaTeen(l) },
  // Персонаж PixelLab «Лєна доросла HD» (2ddf3605-…), власник 2026-10-06: «Доросла Лєна».
  { url: lenaAdultUrl, fall: { url: lenaAdultFallUrl }, poses: { url: lenaAdultPosesUrl, hands: { chest: { x: 16.1, y: 30 }, low: { x: 13.1, y: 17 }, high: { x: 13, y: 37 } } }, front: { up: 19, l: -10, r: 9 }, cell: 92, frames: 4, footX: 46, footY: 76, outfit: { base: LENA_ADULT, garments: ADULT_DRESS }, match: (l) => isLenaAdult(l) },
  // Персонаж PixelLab «Мама Лєни HD» (0a699035-…).
  { url: momUrl, cell: 92, frames: 4, footX: 46, footY: 78, match: (l) => l.hairStyle === MOM.hairStyle && l.top === MOM.top && l.accent === MOM.accent },
  // Персонаж PixelLab «Діма HD (фото)» (cd7ead7c-…), власник 2026-11-01: «Ось
  // Діма, перероби його персонажа в піксель лаб схожим на фото». Фото описано
  // словами, саме фото в PixelLab не відправлено. Упізнається за волоссям,
  // безрукавкою й штанями — таких нема ні в кого з мешканців чи перехожих.
  { url: dimaUrl, cell: 92, frames: 4, footX: 46.5, footY: 79, match: (l) => l.hair === DIMA.hair && l.top === DIMA.top && l.bottom === DIMA.bottom },
  // Оля — подружка Лєни в Жилинцях (власник 2026-10-31: «Починай з Олі»):
  // мала до 6 тижня, підліток до 11-го, дорослою в грі не буває. Персонажі
  // PixelLab «Оля мала HD (2)» (f95cea47-…) і «Оля підліток HD (50)»
  // (7dcf2e6a-…): каре з рожевою заколкою, м'ятна футболка, джинси.
  { url: olyaKidUrl, cell: 68, frames: 4, footX: 34, footY: 57, match: (l) => !!l.kid && isOlya(l) },
  { url: olyaTeenUrl, cell: 72, frames: 4, footX: 36, footY: 63, match: (l) => !l.kid && isOlya(l) },
];

/**
 * Оля — за волоссям, зачіскою й футболкою: таких нема ні в кого з мешканців
 * чи перехожих (тест у `peopleHd.test.ts`).
 */
function isOlya(l: Look): boolean {
  return l.hair === OLYA.hair && l.hairStyle === OLYA.hairStyle && l.top === OLYA.top;
}

/**
 * Лєна за її зачіскою, волоссям, шкірою й очима, хоч би який одяг з шафи
 * (`look.ts`). Перехожі без шапки, шарфа й окулярів теж бувають із хвостом
 * чи довгим волоссям — тому збіг потрібен за всіма чотирма ознаками.
 */
function isLenaAt(l: Look, base: Look): boolean {
  return !l.kid && !l.hat && !l.scarf && !l.glasses
    && l.hairStyle === base.hairStyle && l.hair === base.hair && l.skin === base.skin && l.eyes === base.eyes;
}

/** Лєна 7–11 тижня. */
export function isLenaTeen(l: Look): boolean {
  return isLenaAt(l, LENA_TEEN);
}

/** Доросла Лєна, з 12 тижня. */
export function isLenaAdult(l: Look): boolean {
  return isLenaAt(l, LENA_ADULT);
}

// Мешканці й перехожі (етап 2, власник 2026-11-03: «Публікуй персонажів в
// гру») — люди Godot-порту «Дєвочки в городі»: вбрання й зачіска зведені в
// один аркуш (`scripts/folk/import_game1.py`), піксель порту — світовий
// піксель, тобто 2×2 пікселі малюнка; 8 кадрів ходи, 11 за секунду, як у
// порту. Хто кого малює — за виглядом: діти — дитячими аркушами, коротка чи
// їжаком зачіска — чоловічими (як у `townsfolkLook`), з тією самою зачіскою,
// сиві — бабусею чи сивим чоловіком, а котрий саме — за хешем кольорів, тож
// та сама людина завжди та сама.
const FOLK_URLS = import.meta.glob<string>('./assets/hd/folk/*.png', { eager: true, query: '?url', import: 'default' });
type FolkKind = 'man' | 'woman' | 'boy' | 'girl';
/** Аркуш мешканця: хто, яка зачіска й зріст із зачіскою у світових пікселях (кадр «стоїть, униз»). Підлітки — серед дорослих. */
export const FOLK: Readonly<Record<string, { kind: FolkKind; hair: HairStyle; height: number }>> = {
  'man-jeans': { kind: 'man', hair: 'short', height: 37 },
  'man-blue': { kind: 'man', hair: 'short', height: 38 },
  'man-grey': { kind: 'man', hair: 'spiky', height: 40 },
  'teen-boy': { kind: 'man', hair: 'spiky', height: 37 },
  'woman-flowers': { kind: 'woman', hair: 'long', height: 39 },
  'woman-green': { kind: 'woman', hair: 'bob', height: 38 },
  'woman-navy': { kind: 'woman', hair: 'ponytail', height: 37 },
  'woman-granny': { kind: 'woman', hair: 'bun', height: 41 },
  'woman-casual': { kind: 'woman', hair: 'long', height: 37 },
  'woman-summer': { kind: 'woman', hair: 'bob', height: 38 },
  'woman-formal': { kind: 'woman', hair: 'ponytail', height: 37 },
  'teen-girl': { kind: 'woman', hair: 'long', height: 34 },
  'kid-boy-red': { kind: 'boy', hair: 'spiky', height: 28 },
  'kid-boy-summer': { kind: 'boy', hair: 'short', height: 27 },
  'kid-boy-casual': { kind: 'boy', hair: 'short', height: 27 },
  'kid-boy-formal': { kind: 'boy', hair: 'short', height: 27 },
  'kid-girl-mustard': { kind: 'girl', hair: 'pigtails', height: 27 },
  'kid-girl-plain': { kind: 'girl', hair: 'bob', height: 27 },
  'kid-girl-summer': { kind: 'girl', hair: 'pigtails', height: 27 },
  'kid-girl-casual': { kind: 'girl', hair: 'bob', height: 27 },
};
type FolkSheet = HdSheet & { name: string };
const FOLK_SHEETS: Readonly<Record<FolkKind, readonly FolkSheet[]>> = (() => {
  const pools: Record<FolkKind, FolkSheet[]> = { man: [], woman: [], boy: [], girl: [] };
  for (const [name, f] of Object.entries(FOLK)) {
    const url = FOLK_URLS[`./assets/hd/folk/${name}.png`];
    if (!url) throw new Error(`Люди 32×32: нема аркуша мешканця ${name}`);
    pools[f.kind].push({ name, url, cell: 112, frames: 8, fps: 11, height: f.height, footX: 55, footY: 104, match: () => false });
  }
  return pools;
})();

/** Сиве волосся мешканців і перехожих (`residents.ts`, `townsfolkLook`). */
const GREY_HAIR = new Set(['#c8c4bc', '#8a8a8a']);

function folkSheet(look: Look): FolkSheet {
  const male = look.hairStyle === 'short' || look.hairStyle === 'spiky';
  const pool = FOLK_SHEETS[look.kid ? (male ? 'boy' : 'girl') : male ? 'man' : 'woman'];
  // Сиві дорослі — бабуся з гулькою чи сивий чоловік, і лише вони.
  const grey = !look.kid && GREY_HAIR.has(look.hair);
  if (grey) return pool.find((s) => s.name === (male ? 'man-grey' : 'woman-granny'))!;
  const young = pool.filter((s) => s.name !== 'man-grey' && s.name !== 'woman-granny');
  // Спершу аркуші з тією самою зачіскою; нема такої — будь-який своєї статі й віку.
  const same = young.filter((s) => FOLK[s.name]!.hair === look.hairStyle);
  const choice = same.length > 0 ? same : young;
  // FNV-1a за кольорами й зачіскою з перемішуванням бітів наприкінці:
  // без випадковості й без порядку ключів.
  let h = 0x811c9dc5;
  for (const ch of [look.skin, look.hair, look.hairStyle, look.top, look.bottom, look.shoes, look.eyes].join('|')) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return choice[h % choice.length]!;
}

/** Котрий аркуш мешканця чи перехожого малює цей вигляд (`FOLK`), або `null` для Лєни, мами, Діми й Олі. */
export function folkSheetName(look: Look): string | null {
  return SHEETS.some((x) => x.match(look)) ? null : folkSheet(look).name;
}

function sheetOf(look: Look): HdSheet | null {
  const s = SHEETS.find((x) => x.match(look)) ?? folkSheet(look);
  if (!s) return null;
  if (!s.img && typeof Image !== 'undefined') {
    const img = new Image();
    s.img = img;
    s.loaded = new Promise((resolve) => {
      img.onload = () => { s.ready = true; resolve(true); };
      img.onerror = () => { console.error(`Люди 32×32: не вдалося завантажити аркуш ${s.url}`); resolve(false); };
    });
    img.src = s.url;
    // Падіння й пози вантажаться разом з аркушем, щоб бути готовими до першого ж падіння чи міні-гри.
    if (s.fall) loadStrip(s.fall, 'падіння');
    if (s.poses) loadStrip(s.poses, 'пози');
  }
  return s;
}

function loadStrip(st: Strip, what: string): void {
  st.img = new Image();
  st.img.onload = () => { st.ready = true; };
  st.img.onerror = () => console.error(`Люди 32×32: не вдалося завантажити ${what} ${st.url}`);
  st.img.src = st.url;
}

/**
 * Почати вантажити аркуш людини з падінням і позами наперед — перед
 * міні-грою, щоб Лєна з кошиком була готова до першого ж кадру.
 */
export function preloadHd(look: Look): void {
  sheetOf(look);
}

/**
 * Чи малюється ця людина аркушем PixelLab (Лєна, мама, Діма) — навіть якщо
 * він іще вантажиться. Таких 16-піксельним спрайтом не малюють ніколи
 * (власник 2026-10-31: «повністю відмовляємось від 16×16»).
 */
export function hasHdSheet(look: Look): boolean {
  return sheetOf(look) != null;
}

/**
 * Дочекатися аркуша цієї людини: `true` — готовий, `false` — аркуша нема
 * чи він не завантажився (причину вже сказано в консолі).
 */
export function hdReady(look: Look): Promise<boolean> {
  return sheetOf(look)?.loaded ?? Promise.resolve(false);
}

/** Частка зросту, яку показує портрет «голова й плечі»: у дитини голова більша. */
export const PORTRAIT_CROP = { kid: 0.6, grown: 0.52 } as const;

/**
 * Портрет з аркуша: кадр «стоїть, униз» у теперішньому одязі, обрізаний до
 * силуету, а з `crop` — до голови й плечей (`PORTRAIT_CROP`). Межі — у
 * пікселях малюнка. `null`, поки аркуш вантажиться чи якщо його нема.
 */
export function hdPortrait(look: Look, crop: boolean): { src: CanvasImageSource } & Box | null {
  const s = sheetOf(look);
  if (!s?.img || !s.ready) return null;
  s.box ??= silhouette(pixelsOf(s.img), s.cell);
  const b = s.box;
  const h = crop ? Math.round(b.h * (look.kid ? PORTRAIT_CROP.kid : PORTRAIT_CROP.grown)) : b.h;
  return { src: dressedSheet(s, look), x: b.x, y: b.y, w: b.w, h };
}

/** Межі непрозорих пікселів першої клітинки аркуша (кадр «стоїть, униз»): RGBA-пікселі аркуша. */
export function silhouette(px: { data: ArrayLike<number>; width: number }, cell: number): Box {
  let x0 = cell;
  let y0 = cell;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < cell; y += 1) {
    for (let x = 0; x < cell; x += 1) {
      if (px.data[(y * px.width + x) * 4 + 3]! === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('Люди 32×32: кадр «стоїть, униз» порожній');
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Чи є для цієї людини готовий аркуш 32×32. */
export function hasHdLook(look: Look): boolean {
  const s = sheetOf(look);
  return !!s?.ready;
}

/** Людина з аркуша: `x, y` — точка між стопами (світові пікселі). */
export function drawPersonHd(g: CanvasRenderingContext2D, look: Look, x: number, y: number, dir: Dir, moving: boolean, t: number): void {
  const s = sheetOf(look);
  if (!s) return;
  drawPersonHdFrame(g, look, x, y, dir, moving && s.frames > 0 ? 1 + (Math.floor(t * (s.fps ?? 8)) % s.frames) : 0);
}

/**
 * Кадр аркуша людини: `col` 0 — стоїть, далі кадри ходи (`HdSheet.frames`);
 * `x, y` — точка між стопами (світові пікселі).
 */
export function drawPersonHdFrame(g: CanvasRenderingContext2D, look: Look, x: number, y: number, dir: Dir, col: number): void {
  const s = sheetOf(look);
  if (!s?.img || !s.ready) return;
  if (col < 0 || col > s.frames) throw new Error(`Люди 32×32: кадру ${col} нема (є 0…${s.frames})`);
  const src = dressedSheet(s, look);
  const half = s.cell / 2;
  // Точка опори — на сітці пікселів малюнка (пів світового).
  const dx = Math.round((x - s.footX / 2) * 2) / 2;
  const dy = Math.round((y - s.footY / 2) * 2) / 2;
  g.drawImage(src, col * s.cell, dir * s.cell, s.cell, s.cell, dx, dy, half, half);
}

/** Чи є для цієї людини готова смуга падіння 32×32 (лише Лєна). */
export function hasHdFall(look: Look): boolean {
  const s = sheetOf(look);
  return !!s?.ready && !!s.fall?.ready;
}

/**
 * Кадр падіння: `x, y` — де Лєна стояла (точка між стопами), `mirror` —
 * дзеркально (обличчям ліворуч, падає праворуч). Кадри намальовані
 * «праворуч»: Лєна дивиться праворуч і падає навзнак — ліворуч.
 */
export function drawFallHd(g: CanvasRenderingContext2D, look: Look, x: number, y: number, mirror: boolean, frame: number): void {
  const s = sheetOf(look);
  if (!s?.img || !s.ready || !s.fall?.img || !s.fall.ready) return;
  drawStrip(g, s, dressedStrip(s, s.fall, look), x, y, mirror, frame);
}

/** Чи готова смуга поз з руками перед собою (лише Лєна). */
export function hasHdPoses(look: Look): boolean {
  const s = sheetOf(look);
  return !!s?.ready && !!s.poses?.ready;
}

/** Де долоні в позі: пікселі малюнка від точки між стопами (`x` уперед, `y` угору), або `null`, якщо поз нема. */
export function poseHand(look: Look, pose: PoseName): { x: number; y: number } | null {
  return sheetOf(look)?.poses?.hands[pose] ?? null;
}

/** Точка між стопами в клітинці аркуша (пікселі малюнка), або `null`, якщо аркуша нема. */
export function hdFoot(look: Look): { x: number; y: number } | null {
  const s = sheetOf(look);
  return s ? { x: s.footX, y: s.footY } : null;
}

/** Обличчям до нас: де долоні (`HdSheet.front`), або `null`. */
export function frontHands(look: Look): { up: number; l: number; r: number } | null {
  return sheetOf(look)?.front ?? null;
}

/**
 * Поза з руками перед собою (`POSE_FRAME`): `x, y` — точка між стопами,
 * `mirror` — обличчям ліворуч. Кадри намальовані «праворуч».
 */
export function drawPoseHd(g: CanvasRenderingContext2D, look: Look, x: number, y: number, mirror: boolean, frame: number): void {
  const s = sheetOf(look);
  if (!s?.img || !s.ready || !s.poses?.img || !s.poses.ready) return;
  drawStrip(g, s, dressedStrip(s, s.poses, look), x, y, mirror, frame);
}

/** Кадр смуги (падіння чи пози) на місці людини; «ліворуч» — дзеркало. */
function drawStrip(g: CanvasRenderingContext2D, s: HdSheet, src: CanvasImageSource, x: number, y: number, mirror: boolean, frame: number): void {
  const half = s.cell / 2;
  const xs = Math.round(x * 2) / 2;
  const dy = Math.round((y - s.footY / 2) * 2) / 2;
  if (!mirror) {
    g.drawImage(src, frame * s.cell, 0, s.cell, s.cell, xs - s.footX / 2, dy, half, half);
    return;
  }
  g.save();
  g.translate(xs, 0);
  g.scale(-1, 1);
  g.drawImage(src, frame * s.cell, 0, s.cell, s.cell, -s.footX / 2, dy, half, half);
  g.restore();
}

/** Зріст людини з аркуша у світових пікселях, якщо аркуш його знає. */
export function hdHeight(look: Look): number | undefined {
  return sheetOf(look)?.height;
}

/**
 * Кадр ходи міні-ігор (`Kit.person`: 0 стоїть, далі кадри 4-кадрового кроку)
 * у стовпець аркуша: у 4-кадрових аркушах той самий, у 8-кадрових людей
 * порту — кожен другий.
 */
export function hdWalkCol(look: Look, frame: number): number {
  const s = sheetOf(look);
  if (!s || frame <= 0 || s.frames === 0) return 0;
  return 1 + Math.floor(((frame - 1) * s.frames) / 4);
}

/** Розмір клітинки аркуша цієї людини (пікселі малюнка), або 0, якщо аркуша нема. */
export function hdCell(look: Look): number {
  return sheetOf(look)?.cell ?? 0;
}

/** Пікселі зображення (для перефарбування падіння за кольорами основного аркуша). */
function pixelsOf(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  if (!g) throw new Error('Люди 32×32: немає 2D-контексту для перевдягання');
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}

/**
 * Смуга (падіння чи пози) в теперішньому одязі. Лежачи й з піднятими
 * руками смуги висоти не діють, тож одяг упізнається за кольором основного
 * аркуша (`recolorByPalette`).
 */
function dressedStrip(s: HdSheet, f: Strip, look: Look): CanvasImageSource {
  const img = f.img!;
  if (!s.outfit) return img;
  const colors = outfitColors(s.outfit.base, look);
  if (!colors.top && !colors.bottom && !colors.accent) return img;
  const key = `${colors.top ?? ''}|${colors.bottom ?? ''}|${colors.accent ?? ''}`;
  f.dressed ??= new Map();
  let c = f.dressed.get(key);
  if (!c) {
    const frames = pixelsOf(img);
    const base = pixelsOf(s.img!);
    recolorByPalette(
      { data: frames.data, width: frames.width, height: frames.height, cell: s.cell },
      { data: base.data, width: base.width, height: base.height, cell: s.cell },
      s.outfit.garments,
      colors,
    );
    c = document.createElement('canvas');
    c.width = frames.width;
    c.height = frames.height;
    const g = c.getContext('2d');
    if (!g) throw new Error('Люди 32×32: немає 2D-контексту для перевдягання');
    g.putImageData(frames, 0, 0);
    f.dressed.set(key, c);
  }
  return c;
}

/**
 * Кольори, якими перефарбувати намальоване вбрання `base`, щоб вийшло `look`:
 * лише ті частини, що відрізняються. Оздоблення без власного кольору бере
 * колір верху — у 16×16 річ без оздоблення його просто не має.
 */
export function outfitColors(base: Look, look: Look): OutfitColors {
  return {
    top: look.top !== base.top ? look.top : undefined,
    bottom: look.bottom !== base.bottom ? look.bottom : undefined,
    accent: look.accent !== base.accent ? (look.accent ?? look.top) : undefined,
  };
}

/** Аркуш у теперішньому одязі: власний, якщо вбрання те, що намальоване. */
function dressedSheet(s: HdSheet, look: Look): CanvasImageSource {
  const img = s.img!;
  if (!s.outfit) return img;
  const colors = outfitColors(s.outfit.base, look);
  if (!colors.top && !colors.bottom && !colors.accent) return img;
  const key = `${colors.top ?? ''}|${colors.bottom ?? ''}|${colors.accent ?? ''}`;
  s.dressed ??= new Map();
  let c = s.dressed.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    if (!g) throw new Error('Люди 32×32: немає 2D-контексту для перевдягання');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height);
    recolorOutfit(data.data, c.width, c.height, s.cell, s.outfit.garments, colors);
    g.putImageData(data, 0, 0);
    s.dressed.set(key, c);
  }
  return c;
}
