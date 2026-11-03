// ============================================================
// Люди гри (ADR-0239). Усі — аркуші Godot-порту «Дєвочки в городі»
// (власник 2026-11-03: «адаптувати в новому стилі Лєну, маму, Діму й Олю»),
// їх збирає `scripts/port/import_game1.py`: рядки — напрям (вниз, ліворуч,
// праворуч, угору), стовпці — стоїть і 8 кадрів ходи. Піксель порту —
// 2×2 пікселі малюнка, тобто світовий піксель (власник 2026-11-03: «вдвічі
// збільш людей, вони тепер дуже дрібні»): дорослий — 74 пікселі малюнка,
// трохи більше за дві клітинки мапи; Бася й кури PixelLab — під цей зріст.
//
// Поки аркуш вантажиться, людини ще не видно (`hasHdLook` тоді каже «ні»);
// 16-піксельних людей у грі нема (власник 2026-10-31).
// ============================================================
import lenaKidUrl from './assets/hd/lena-kid.png';
import lenaTeenUrl from './assets/hd/lena-teen.png';
import lenaAdultUrl from './assets/hd/lena-adult.png';
import lenaKidMaskUrl from './assets/hd/lena-kid-mask.png';
import lenaTeenMaskUrl from './assets/hd/lena-teen-mask.png';
import lenaAdultMaskUrl from './assets/hd/lena-adult-mask.png';
import lenaKidFallUrl from './assets/hd/lena-kid-fall.png';
import lenaTeenFallUrl from './assets/hd/lena-teen-fall.png';
import lenaAdultFallUrl from './assets/hd/lena-adult-fall.png';
import lenaKidFallMaskUrl from './assets/hd/lena-kid-fall-mask.png';
import lenaTeenFallMaskUrl from './assets/hd/lena-teen-fall-mask.png';
import lenaAdultFallMaskUrl from './assets/hd/lena-adult-fall-mask.png';
import lenaKidPosesUrl from './assets/hd/lena-kid-poses.png';
import lenaTeenPosesUrl from './assets/hd/lena-teen-poses.png';
import lenaAdultPosesUrl from './assets/hd/lena-adult-poses.png';
import lenaKidPosesMaskUrl from './assets/hd/lena-kid-poses-mask.png';
import lenaTeenPosesMaskUrl from './assets/hd/lena-teen-poses-mask.png';
import lenaAdultPosesMaskUrl from './assets/hd/lena-adult-poses-mask.png';
import dimaUrl from './assets/hd/dima.png';
import olyaKidUrl from './assets/hd/olya-kid.png';
import olyaTeenUrl from './assets/hd/olya-teen.png';
import momUrl from './assets/hd/mom.png';
import dimaKidUrl from './assets/hd/dima-kid.png';
import vladKidUrl from './assets/hd/vlad-kid.png';
import dimaMomUrl from './assets/hd/dima-mom.png';
import dimaDadUrl from './assets/hd/dima-dad.png';
import PORT from './assets/hd/port.json';
import { maskReference, recolorByMask, type OutfitColors } from './outfitHd';
import { DIMA, LENA_ADULT, LENA_KID, LENA_TEEN, MOM, OLYA, type Dir, type HairStyle, type Look } from './people';

/** Скільки пікселів малюнка на піксель порту (`scripts/port/import_game1.py`, `SCALE`). */
export const PORT_SCALE = 2;
/** Клітинка аркуша порту, точка між стопами в ній (пікселі малюнка), кадри ходи й їхня частота (як у порту). */
export const PORT_CELL = 56 * PORT_SCALE;
const PORT_FOOT = { footX: 27.5 * PORT_SCALE, footY: 52 * PORT_SCALE } as const;
const PORT_WALK = { frames: 8, fps: 11 } as const;

interface HdSheet {
  url: string;
  cell: number;
  /** Кадрів ходи (0 — лише «стоїть»). */
  frames: number;
  /** Кадрів ходи за секунду (типово 8). */
  fps?: number;
  /** Зріст із зачіскою, пікселі малюнка (кадр «стоїть, униз») — над ним емоція. */
  height: number;
  /** Точка між стопами в клітинці аркуша. */
  footX: number;
  footY: number;
  /** Чий це аркуш. */
  match(look: Look): boolean;
  /**
   * Одяг з шафи (лише Лєна): вбрання, яке намальоване, і маска одягу поруч
   * з аркушем (`outfitHd.ts`).
   */
  outfit?: { base: Look; mask: string; maskImg?: HTMLImageElement };
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
   * полотні — `FALL_DOWN_FRAMES` падіння навзнак, далі `FALL_UP_FRAMES`
   * підйому (кадр «праворуч», повернутий навколо стоп, `import_game1.py`).
   */
  fall?: Strip;
  /**
   * Пози з руками перед собою (лише Лєна, міні-ігри садиби): кадри
   * «праворуч» у порядку `POSE_NAMES` з домальованим передпліччям. `hands` —
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

/** Смуга кадрів одного напряму («праворуч») на полотні людини з маскою одягу. */
interface Strip {
  url: string;
  mask: string;
  img?: HTMLImageElement;
  maskImg?: HTMLImageElement;
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

/** Аркуш порту з точкою опори й ходою порту; `height` — зріст у пікселях порту. */
function port(url: string, height: number, match: (l: Look) => boolean): HdSheet {
  return { url, cell: PORT_CELL, ...PORT_FOOT, ...PORT_WALK, height: height * PORT_SCALE, match };
}

/** Лєна: аркуш, маска одягу, падіння й пози з точками долонь (`port.json`). */
function lena(
  name: keyof typeof PORT,
  urls: { sheet: string; mask: string; fall: string; fallMask: string; poses: string; posesMask: string },
  base: Look,
  height: number,
  match: (l: Look) => boolean,
): HdSheet {
  const meta = PORT[name];
  return {
    ...port(urls.sheet, height, match),
    outfit: { base, mask: urls.mask },
    fall: { url: urls.fall, mask: urls.fallMask },
    poses: { url: urls.poses, mask: urls.posesMask, hands: meta.hands },
    front: meta.front,
  };
}

const SHEETS: HdSheet[] = [
  lena('lena-kid', { sheet: lenaKidUrl, mask: lenaKidMaskUrl, fall: lenaKidFallUrl, fallMask: lenaKidFallMaskUrl, poses: lenaKidPosesUrl, posesMask: lenaKidPosesMaskUrl }, LENA_KID, 27,
    (l) => !!l.kid && l.bow === LENA_KID.bow && l.hairStyle === LENA_KID.hairStyle),
  lena('lena-teen', { sheet: lenaTeenUrl, mask: lenaTeenMaskUrl, fall: lenaTeenFallUrl, fallMask: lenaTeenFallMaskUrl, poses: lenaTeenPosesUrl, posesMask: lenaTeenPosesMaskUrl }, LENA_TEEN, 34,
    (l) => isLenaTeen(l)),
  lena('lena-adult', { sheet: lenaAdultUrl, mask: lenaAdultMaskUrl, fall: lenaAdultFallUrl, fallMask: lenaAdultFallMaskUrl, poses: lenaAdultPosesUrl, posesMask: lenaAdultPosesMaskUrl }, LENA_ADULT, 37,
    (l) => isLenaAdult(l)),
  port(momUrl, 41, (l) => l.hairStyle === MOM.hairStyle && l.top === MOM.top && l.accent === MOM.accent),
  // Діма впізнається за волоссям, верхом і штанями — таких нема ні в кого з
  // мешканців чи перехожих.
  port(dimaUrl, 38, (l) => !l.kid && l.hair === DIMA.hair && l.top === DIMA.top && l.bottom === DIMA.bottom),
  // Оля — подружка Лєни в Жилинцях: мала до 6 тижня, підліток до 11-го.
  port(olyaKidUrl, 27, (l) => !!l.kid && isOlya(l)),
  port(olyaTeenUrl, 34, (l) => !l.kid && isOlya(l)),
  // Історія Діми (Вишневе): він малий, його друг Влад, мама й тато.
  port(dimaKidUrl, 27, (l) => l.who === 'dima-kid'),
  port(vladKidUrl, 27, (l) => l.who === 'vlad-kid'),
  port(dimaMomUrl, 39, (l) => l.who === 'dima-mom'),
  port(dimaDadUrl, 37, (l) => l.who === 'dima-dad'),
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

// Мешканці й перехожі — люди Godot-порту (етап 2): вбрання й зачіска одним
// аркушем (`scripts/port/import_game1.py`), жоден не носить вбрання Лєни,
// Олі чи батьків Діми. Хто кого малює — за виглядом: діти — дитячими
// аркушами, коротка чи їжаком зачіска — чоловічими (як у `townsfolkLook`),
// з тією самою зачіскою, сиві — бабусею чи сивим чоловіком, а котрий саме —
// за хешем кольорів, тож та сама людина завжди та сама.
const FOLK_URLS = import.meta.glob<string>('./assets/hd/folk/*.png', { eager: true, query: '?url', import: 'default' });
type FolkKind = 'man' | 'woman' | 'boy' | 'girl';
/** Аркуш мешканця: хто, яка зачіска й зріст із зачіскою в пікселях порту (кадр «стоїть, униз»). Підлітки — серед дорослих. */
export const FOLK: Readonly<Record<string, { kind: FolkKind; hair: HairStyle; height: number }>> = {
  'man-blue': { kind: 'man', hair: 'short', height: 38 },
  'man-brown': { kind: 'man', hair: 'short', height: 38 },
  'man-grey': { kind: 'man', hair: 'spiky', height: 40 },
  'teen-boy': { kind: 'man', hair: 'spiky', height: 37 },
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
  'kid-girl-green': { kind: 'girl', hair: 'pigtails', height: 27 },
  'kid-girl-summer': { kind: 'girl', hair: 'pigtails', height: 27 },
  'kid-girl-casual': { kind: 'girl', hair: 'bob', height: 27 },
  'kid-girl-formal': { kind: 'girl', hair: 'long', height: 27 },
};
type FolkSheet = HdSheet & { name: string };
const FOLK_SHEETS: Readonly<Record<FolkKind, readonly FolkSheet[]>> = (() => {
  const pools: Record<FolkKind, FolkSheet[]> = { man: [], woman: [], boy: [], girl: [] };
  for (const [name, f] of Object.entries(FOLK)) {
    const url = FOLK_URLS[`./assets/hd/folk/${name}.png`];
    if (!url) throw new Error(`Люди: нема аркуша мешканця ${name}`);
    pools[f.kind].push({ name, ...port(url, f.height, () => false) });
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
  if (!s.img && typeof Image !== 'undefined') {
    const img = new Image();
    s.img = img;
    const mask = s.outfit ? loadImage(s.outfit.mask, 'маску одягу') : Promise.resolve(null);
    s.loaded = Promise.all([loadImage(s.url, 'аркуш', img), mask]).then(([sheet, m]) => {
      if (!sheet || (s.outfit && !m)) return false;
      if (s.outfit && m) s.outfit.maskImg = m;
      s.ready = true;
      return true;
    });
    // Падіння й пози вантажаться разом з аркушем, щоб бути готовими до першого ж падіння чи міні-гри.
    if (s.fall) loadStrip(s.fall, 'падіння');
    if (s.poses) loadStrip(s.poses, 'пози');
  }
  return s;
}

/** Завантажити зображення; `null` — не вдалося (причину сказано в консолі). */
function loadImage(url: string, what: string, img = new Image()): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => { console.error(`Люди: не вдалося завантажити ${what} ${url}`); resolve(null); };
    img.src = url;
  });
}

function loadStrip(st: Strip, what: string): void {
  st.img = new Image();
  void Promise.all([loadImage(st.url, what, st.img), loadImage(st.mask, `маску (${what})`)]).then(([img, mask]) => {
    if (!img || !mask) return;
    st.maskImg = mask;
    st.ready = true;
  });
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

/** Зріст людини з аркуша у світових пікселях (пів зросту в пікселях малюнка), або `undefined`, якщо аркуша нема. */
export function hdHeight(look: Look): number | undefined {
  const s = sheetOf(look);
  return s ? s.height / 2 : undefined;
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
    // Основні тони — з аркуша ходи: лежачи й у позах одягу видно менше.
    const ref = maskReference(pixelsOf(s.img!).data, pixelsOf(s.outfit.maskImg!).data);
    c = recolored(img, f.maskImg!, colors, ref);
    f.dressed.set(key, c);
  }
  return c;
}

/** Копія зображення з одягом, перефарбованим за маскою. */
function recolored(img: HTMLImageElement, mask: HTMLImageElement, colors: OutfitColors, ref?: readonly number[]): HTMLCanvasElement {
  const data = pixelsOf(img);
  recolorByMask(data.data, pixelsOf(mask).data, colors, ref);
  const c = document.createElement('canvas');
  c.width = data.width;
  c.height = data.height;
  const g = c.getContext('2d');
  if (!g) throw new Error('Люди: немає 2D-контексту для перевдягання');
  g.putImageData(data, 0, 0);
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
    c = recolored(img, s.outfit.maskImg!, colors);
    s.dressed.set(key, c);
  }
  return c;
}
