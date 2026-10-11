// ============================================================
// Люди у 32×32 (ADR-0239, власник 2026-10-06: «люди з PixelLab, решта
// кодом»). Аркуші зібрано з персонажів PixelLab (`scripts/pixellab/
// build_sheet.py`): рядки — напрям (вниз, ліворуч, праворуч, угору),
// стовпці — стоїть, далі кадри ходи. Піксель аркуша — піксель малюнка,
// тобто пів світового: людина малюється вдвічі меншою за аркуш, і на
// парному масштабі сцени жоден піксель не розпливається.
//
// Поки аркуш вантажиться (чи для когось аркуша ще немає), людину малює
// піксельний стиль — `hasHdLook` тоді каже «ні».
// ============================================================
import lenaKidUrl from './assets/hd/lena-kid.png';
import lenaTeenUrl from './assets/hd/lena-teen.png';
import lenaAdultUrl from './assets/hd/lena-adult.png';
import dimaUrl from './assets/hd/dima.png';
import momUrl from './assets/hd/mom.png';
import { recolorOutfit, type Garment, type OutfitColors, type Tone } from './outfitHd';
import { DIMA, LENA_ADULT, LENA_KID, LENA_TEEN, MOM, type Dir, type Look } from './people';

interface HdSheet {
  url: string;
  cell: number;
  /** Кадрів ходи (0 — лише «стоїть»). */
  frames: number;
  /** Точка між стопами в клітинці аркуша. */
  footX: number;
  footY: number;
  /** Чий це аркуш. */
  match(look: Look): boolean;
  /** Одяг, що перефарбовується під речі з шафи (`outfitHd.ts`), і вбрання, яке намальоване. */
  outfit?: { base: Look; garments: readonly Garment[] };
  img?: HTMLImageElement;
  ready?: boolean;
  /** Перефарбовані аркуші за кольорами «верх|низ|оздоблення». */
  dressed?: Map<string, HTMLCanvasElement>;
}

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
  // Біла футболка: світло й темна обвідка майже без барви, тінь — сіро-бузкова.
  { part: 'top', band: [0.36, 0.68], tones: [{ maxS: 0.1, minV: 0.4 }, { hue: [0.55, 0.8], maxS: 0.3, minV: 0.45 }] },
  // Блакитні комір і манжети з їхньою тінню; пояс джинсів — нижче смуги.
  { part: 'accent', band: [0.36, 0.56], tones: [{ hue: [0.5, 0.64], minS: 0.3, minV: 0.4 }] },
  // Сині джинси з поясом і темною обвідкою.
  { part: 'bottom', band: [0.56, 0.97], tones: [{ hue: [0.58, 0.78], minS: 0.3, maxV: 0.65 }] },
];
// Блакитна сукня з найсвітлішими, майже білими відблисками (у кадрах збоку
// ними вкрита вся спина); чисто білі бретельки, поділ і туфлі — без барви,
// тож лишаються білими.
const ADULT_BLUE: readonly Tone[] = [{ hue: [0.55, 0.7], minS: 0.12, minV: 0.3 }, { hue: [0.55, 0.7], minS: 0.05, minV: 0.85 }];
export const ADULT_DRESS: readonly Garment[] = [
  { part: 'top', band: [0.4, 0.6], tones: ADULT_BLUE },
  { part: 'bottom', band: [0.6, 0.93], tones: ADULT_BLUE },
];

const SHEETS: HdSheet[] = [
  // Персонаж PixelLab «Лєна мала HD (48)» (a046bd5b-…).
  { url: lenaKidUrl, cell: 68, frames: 4, footX: 34, footY: 56, outfit: { base: LENA_KID, garments: KID_DRESS }, match: (l) => !!l.kid && l.bow === LENA_KID.bow && l.hairStyle === LENA_KID.hairStyle },
  // Персонаж PixelLab «Лєна підліток HD» (e7e9f230-…), власник 2026-10-06: «Лєна підліток».
  { url: lenaTeenUrl, cell: 84, frames: 4, footX: 42, footY: 70, outfit: { base: LENA_TEEN, garments: TEEN_CLOTHES }, match: (l) => isLenaTeen(l) },
  // Персонаж PixelLab «Лєна доросла HD» (2ddf3605-…), власник 2026-10-06: «Доросла Лєна».
  { url: lenaAdultUrl, cell: 92, frames: 4, footX: 46, footY: 76, outfit: { base: LENA_ADULT, garments: ADULT_DRESS }, match: (l) => isLenaAdult(l) },
  // Персонаж PixelLab «Мама Лєни HD» (0a699035-…).
  { url: momUrl, cell: 92, frames: 4, footX: 46, footY: 78, match: (l) => l.hairStyle === MOM.hairStyle && l.top === MOM.top && l.accent === MOM.accent },
  // Персонаж PixelLab «Діма HD» (ff0178ab-…), власник 2026-10-06: «Діму давай далі».
  { url: dimaUrl, cell: 92, frames: 4, footX: 46, footY: 75, match: (l) => l.hairStyle === DIMA.hairStyle && l.top === DIMA.top && !!l.hoodie },
];

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

function sheetOf(look: Look): HdSheet | null {
  const s = SHEETS.find((x) => x.match(look));
  if (!s) return null;
  if (!s.img && typeof Image !== 'undefined') {
    s.img = new Image();
    s.img.onload = () => { s.ready = true; };
    s.img.onerror = () => console.error(`Люди 32×32: не вдалося завантажити аркуш ${s.url}`);
    s.img.src = s.url;
  }
  return s;
}

/** Чи є для цієї людини готовий аркуш 32×32. */
export function hasHdLook(look: Look): boolean {
  const s = sheetOf(look);
  return !!s?.ready;
}

/** Людина з аркуша: `x, y` — точка між стопами (світові пікселі). */
export function drawPersonHd(g: CanvasRenderingContext2D, look: Look, x: number, y: number, dir: Dir, moving: boolean, t: number): void {
  const s = sheetOf(look);
  if (!s?.img || !s.ready) return;
  const src = dressedSheet(s, look);
  const col = moving && s.frames > 0 ? 1 + (Math.floor(t * 8) % s.frames) : 0;
  const half = s.cell / 2;
  // Точка опори — на сітці пікселів малюнка (пів світового).
  const dx = Math.round((x - s.footX / 2) * 2) / 2;
  const dy = Math.round((y - s.footY / 2) * 2) / 2;
  g.drawImage(src, col * s.cell, dir * s.cell, s.cell, s.cell, dx, dy, half, half);
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
