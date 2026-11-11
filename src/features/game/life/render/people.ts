// ============================================================
// Персонажі «Дєвочка в городі»: Лєна в різному віці й одязі, Діма, мама,
// перехожі (ADR-0239).
// ------------------------------------------------------------
// Тут лише ВИГЛЯД: набір кольорів і зачіска кожного персонажа й перехожих
// (`townsfolkLook`). Малюють людей аркуші 32×32 з Godot-порту
// (`peopleHd.ts`, власник 2026-10-31: «повністю відмовляємось від 16×16»),
// а за кольорами вигляду `outfitHd.ts` перефарбовує куплений одяг.
// Старий код-малюнок спрайтів 16×30 (`sheetFor`, `drawFront` / `drawBack` /
// `drawSide`) не мав жодного виклику й прибраний (ADR-0263).
// ============================================================
export type HairStyle = 'long' | 'pigtails' | 'short' | 'bun' | 'ponytail' | 'bob' | 'spiky';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  dress?: boolean;
  accent?: string;
  shoes: string;
  eyes: string;
  kid?: boolean;
  beard?: boolean;
  bow?: string;
  /** Шапка-біні (колір). */
  hat?: string;
  /** Шарф (колір). */
  scarf?: string;
  glasses?: boolean;
  /** Худі: капюшон за шиєю й шнурки. */
  hoodie?: boolean;
  /** Хто це, якщо в людини власний аркуш і її не впізнати за кольорами (історія Діми). */
  who?: 'dima-kid' | 'vlad-kid' | 'dima-mom' | 'dima-dad';
}

/** 0 — до нас (вниз), 1 — вліво, 2 — вправо, 3 — від нас (вгору). */
export type Dir = 0 | 1 | 2 | 3;

const SKIN = '#f2c9a0';

// Кольори верху й низу Лєни — ті, що намальовані на аркушах порту
// (`peopleHd.ts`): річ з шафи іншого кольору перефарбовує одяг за маскою.
export const LENA_KID: Look = { skin: SKIN, hair: '#9c7a45', hairStyle: 'pigtails', top: '#e8826e', bottom: '#2f4a70', shoes: '#4a2a18', eyes: '#5a3a26', kid: true, bow: '#ff5d8f' };
export const LENA_TEEN: Look = { skin: SKIN, hair: '#9c7a45', hairStyle: 'ponytail', top: '#b79bd6', bottom: '#2f4a70', shoes: '#4a2a18', eyes: '#5a3a26' };
export const LENA_ADULT: Look = { skin: SKIN, hair: '#a5804a', hairStyle: 'long', top: '#b05f43', bottom: '#38445c', shoes: '#2a1812', eyes: '#5a3a26' };
/** Діма — за фото власника (2026-11-01): русяве волосся набік, коричнева в'язана безрукавка поверх білої сорочки, бежеві штани. */
export const DIMA: Look = { skin: SKIN, hair: '#865b3c', hairStyle: 'short', top: '#553d40', bottom: '#cca074', shoes: '#402324', eyes: '#6a8aa8', accent: '#e7e2dd' };
export const MOM: Look = { skin: SKIN, hair: '#6e4a2a', hairStyle: 'bun', top: '#b8323a', bottom: '#3a3550', dress: true, shoes: '#3a2f28', eyes: '#3a2a22', accent: '#f6f1e6' };
// Історія Діми (Вишневе, з Godot-порту): він малий, друг Влад, мама й тато.
// Аркуші впізнають їх за `who`; кольори — з їхніх аркушів.
export const DIMA_KID: Look = { skin: SKIN, hair: '#c9b48a', hairStyle: 'short', top: '#4a6a9a', bottom: '#2e3550', shoes: '#3a2f28', eyes: '#4a90d9', kid: true, who: 'dima-kid' };
export const VLAD_KID: Look = { skin: SKIN, hair: '#6e4a2a', hairStyle: 'short', top: '#c2494f', bottom: '#2e3550', shoes: '#3a2f28', eyes: '#4a90d9', kid: true, who: 'vlad-kid' };
export const DIMA_MOM: Look = { skin: SKIN, hair: '#8a2a3a', hairStyle: 'long', top: '#8fb0e0', bottom: '#8fb0e0', dress: true, shoes: '#3a2f28', eyes: '#3a2a22', who: 'dima-mom' };
export const DIMA_DAD: Look = { skin: SKIN, hair: '#5a4030', hairStyle: 'short', top: '#1f2a44', bottom: '#3d5a8c', shoes: '#3a2f28', eyes: '#3a2a22', who: 'dima-dad' };
export const OLYA: Look = { skin: SKIN, hair: '#3a2b1a', hairStyle: 'bob', top: '#7fd9c4', bottom: '#3d5a8c', shoes: '#f4f4f7', eyes: '#3a2a22' };

// ------------------------------------------------------------
// Перехожі: вигляд із костей міста.
// ------------------------------------------------------------
const HAIRS = ['#2b1d16', '#4a3020', '#6e4a2a', '#9c7a45', '#c9a46a', '#8a8a8a', '#b5651d', '#e8c26a', '#3a2a4a'];
const TOPS = ['#c2494f', '#4a7fb5', '#67a05c', '#e0a43c', '#8a5ab5', '#3a8f8f', '#d9739a', '#5d6b7a', '#f4f4f7', '#3a5ab5', '#7a4a2a'];
const BOTTOMS = ['#2e3550', '#4a3a2a', '#3d5a8c', '#5a5a64', '#7a4a6a', '#6a3a2a'];
const STYLES: HairStyle[] = ['short', 'bob', 'long', 'bun', 'ponytail', 'short', 'spiky'];
const SKINS = ['#f2c9a0', '#e8b48a', '#f6d5b5', '#d9a27a', '#c08a62'];
const EYES = ['#2b1d16', '#4a90d9', '#5a3a26', '#3a7a4a'];
const ACCENTS = ['#c2494f', '#4a7fb5', '#67a05c', '#e0a43c', '#f4f4f7', '#8a5ab5'];

export function townsfolkLook(r: () => number): Look {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const kid = r() < 0.2;
  const style = pick(STYLES);
  const male = style === 'short' || style === 'spiky';
  const look: Look = {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: kid && style === 'bun' ? 'pigtails' : style,
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    dress: !male && r() < 0.35,
    shoes: pick(['#3a2f28', '#5a3a26', '#f4f4f7', '#2e3550']),
    eyes: pick(EYES),
    kid,
    beard: male && !kid && r() < 0.25,
  };
  // Аксесуари, як у референсах: шапка, шарф, окуляри, худі.
  if (!kid && r() < 0.18) look.hat = pick(ACCENTS);
  if (r() < 0.16) look.scarf = pick(ACCENTS);
  if (!kid && r() < 0.15) look.glasses = true;
  if (male && r() < 0.3) look.hoodie = true;
  // Перехожий — не двійник Лєни. Її аркуш PixelLab упізнає Лєну за
  // волоссям, зачіскою, шкірою й очима в будь-якому одязі (`peopleHd.ts`),
  // тож такий перехожий ходив би містом другою Лєною — а з кості випадало
  // приблизно раз на 1600. Жодна Лєна не носить каре.
  if (lenaDouble(look)) look.hairStyle = 'bob';
  return look;
}

/** Волосся, зачіска, шкіра й очі — як у Лєни якогось віку. */
function lenaDouble(l: Look): boolean {
  return [LENA_KID, LENA_TEEN, LENA_ADULT].some((b) => l.hair === b.hair && l.hairStyle === b.hairStyle && l.skin === b.skin && l.eyes === b.eyes);
}
