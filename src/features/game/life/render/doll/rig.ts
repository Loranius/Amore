// ============================================================
// Один скелет на всіх (ADR-0239, поправка 2026-11-01). Клітинка кадру —
// 32×48 пікселів малюнка (піксель малюнка — пів світового, як в усій грі),
// точка між стопами — `FOOT`. Поза каже, де суглоби (шия, плечі, кульші),
// а частини (`parts.ts`) кріпляться до них своїми точками — тож одяг і
// зачіски, прив'язані до тих самих частин, рухатимуться разом із тілом.
//
// Шари кожного кадру в однакових координатах, накладаються в порядку
// `LAYERS`. «Ліворуч» — дзеркало «праворуч».
// ============================================================
import { EYES_FRONT, EYES_SIDE, FACE_FRONT, FACE_SIDE, type FaceKind } from './faces';
import { HAIR, type HairName } from './hair';
import { ARM, HEAD_FRONT, HEAD_SIDE, LEG_FRONT, LEG_SIDE, TORSO_BACK, TORSO_FRONT, TORSO_SIDE, mirrorPart, type Part } from './parts';

export const CELL = { w: 32, h: 48 } as const;
/** Точка між стопами в клітинці: середина між x 15 і 16, під нижнім рядом. */
export const FOOT = { x: 16, y: 47 } as const;

/** 0 — до нас, 1 — ліворуч, 2 — праворуч, 3 — від нас (як `Dir` у `people.ts`). */
export type DollDir = 0 | 1 | 2 | 3;
export const DOLL_DIRS: readonly DollDir[] = [0, 1, 2, 3];

/**
 * Шари знизу вгору (власник 2026-11-01). Намальовано тіло, голову, очі,
 * обличчя й зачіски; одяг і аксесуари з'являться в цьому ж порядку.
 */
export const LAYERS = ['hairBack', 'body', 'head', 'eyes', 'face', 'pants', 'shoes', 'shirt', 'hairFront', 'accessory'] as const;
export type LayerName = (typeof LAYERS)[number];
/** Шари, які вже намальовано, — у порядку накладання. */
export const DRAWN_LAYERS: readonly LayerName[] = ['hairBack', 'body', 'head', 'eyes', 'face', 'hairFront'];

/** Що в людини своє поверх спільного скелета: обличчя й зачіска. */
export interface DollShape {
  readonly face: FaceKind;
  readonly hairStyle: HairName;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Суглоби пози в клітинці. */
interface Joints {
  readonly neck: Point;
  readonly shoulderL: Point;
  readonly shoulderR: Point;
  readonly hipL: Point;
  readonly hipR: Point;
}

/** Стоїть (етап 1). Анімації — інші набори суглобів того самого скелета. */
const IDLE: Readonly<Record<'front' | 'side', Joints>> = {
  front: { neck: { x: 16, y: 20 }, shoulderL: { x: 9, y: 23 }, shoulderR: { x: 22, y: 23 }, hipL: { x: 12, y: 33 }, hipR: { x: 19, y: 33 } },
  // Профіль: L — дальні рука й нога, R — ближні.
  side: { neck: { x: 16, y: 20 }, shoulderL: { x: 15, y: 23 }, shoulderR: { x: 16, y: 23 }, hipL: { x: 15, y: 33 }, hipR: { x: 16, y: 33 } },
};

/**
 * Частина на суглобі. `dim` — дальня (на тон темніша), `outline` — обвести,
 * `ink` — чим: `o` обвідка шкіри (типово), `O` обвідка волосся.
 */
export interface Placement {
  readonly part: Part;
  readonly at: Point;
  readonly dim?: boolean;
  readonly outline: boolean;
  readonly ink?: 'o' | 'O';
}

/** Що малює шар у кадрі «праворуч», «до нас» чи «від нас» (ліворуч — дзеркало «праворуч»). */
export function placements(layer: LayerName, dir: DollDir, who: DollShape): Placement[] {
  if (dir === 1) throw new Error('Люди: «ліворуч» — дзеркало «праворуч», окремих частин нема');
  const side = dir === 2;
  const j = side ? IDLE.side : IDLE.front;
  switch (layer) {
    case 'body':
      if (side) {
        return [
          { part: ARM, at: j.shoulderL, dim: true, outline: true },
          { part: LEG_SIDE, at: j.hipL, dim: true, outline: true },
          { part: LEG_SIDE, at: j.hipR, outline: true },
          { part: TORSO_SIDE, at: j.neck, outline: true },
          { part: ARM, at: j.shoulderR, outline: true },
        ];
      }
      return [
        { part: LEG_FRONT, at: j.hipL, outline: true },
        { part: mirrorPart(LEG_FRONT), at: j.hipR, outline: true },
        { part: dir === 3 ? TORSO_BACK : TORSO_FRONT, at: j.neck, outline: true },
        { part: ARM, at: j.shoulderL, outline: true },
        { part: mirrorPart(ARM), at: j.shoulderR, outline: true },
      ];
    case 'head':
      if (side) return [{ part: HEAD_SIDE, at: j.neck, outline: true }];
      return [{ part: HEAD_FRONT, at: j.neck, outline: true }];
    case 'eyes':
      if (dir === 3) return [];
      return [{ part: side ? EYES_SIDE : EYES_FRONT, at: j.neck, outline: false }];
    case 'face':
      if (dir === 3) return [];
      return [{ part: side ? FACE_SIDE[who.face] : FACE_FRONT[who.face], at: j.neck, outline: false }];
    case 'hairFront':
      return [{ part: HAIR[who.hairStyle].front[dir], at: j.neck, outline: true, ink: 'O' }];
    case 'hairBack': {
      const back = HAIR[who.hairStyle].back?.[dir];
      return back ? [{ part: back, at: j.neck, outline: true, ink: 'O' }] : [];
    }
    default:
      return [];
  }
}

const DIM: Readonly<Record<string, string>> = { h: 's', s: 'S', S: 'D', D: 'D' };

/**
 * Кадр шару — ряди ключів клітинки (`.` порожньо, `o`/`O` обвідка шкіри й
 * волосся, `i`/`I` вона ж усередині силуету, решта —
 * ключі частин). Обвідка — 4-сусідство довкола кожної обведеної частини:
 * вона лягає й поверх нижчих частин, тож рука відділяється від тулуба.
 */
export function renderLayer(layer: LayerName, dir: DollDir, who: DollShape): string[] {
  if (dir === 1) return renderLayer(layer, 2, who).map((r) => [...r].reverse().join(''));
  const px: string[][] = Array.from({ length: CELL.h }, () => Array<string>(CELL.w).fill('.'));
  for (const pl of placements(layer, dir, who)) {
    const { rows, pivot } = pl.part;
    const x0 = pl.at.x - pivot.x;
    const y0 = pl.at.y - pivot.y;
    const filled = (x: number, y: number): boolean => {
      const r = rows[y - y0];
      return r !== undefined && x >= x0 && r[x - x0] !== undefined && r[x - x0] !== '.';
    };
    for (let y = 0; y < rows.length; y += 1) {
      const r = rows[y]!;
      for (let x = 0; x < r.length; x += 1) {
        const k = r[x]!;
        if (k === '.') continue;
        const cx = x0 + x;
        const cy = y0 + y;
        if (cx < 0 || cy < 0 || cx >= CELL.w || cy >= CELL.h) throw new Error(`Люди: частина шару ${layer} виходить за клітинку (${cx}, ${cy})`);
        px[cy]![cx] = pl.dim ? (DIM[k] ?? k) : k;
      }
    }
    if (!pl.outline) continue;
    for (let cy = y0 - 1; cy <= y0 + rows.length; cy += 1) {
      for (let cx = x0 - 1; cx <= x0 + rows[0]!.length; cx += 1) {
        if (filled(cx, cy)) continue;
        if (!(filled(cx - 1, cy) || filled(cx + 1, cy) || filled(cx, cy - 1) || filled(cx, cy + 1))) continue;
        if (cx < 0 || cy < 0 || cx >= CELL.w || cy >= CELL.h) throw new Error(`Люди: обвідка шару ${layer} виходить за клітинку (${cx}, ${cy})`);
        px[cy]![cx] = pl.ink ?? 'o';
      }
    }
  }
  // Обвідка всередині силуету (рука на тлі тулуба, між ногами) — світліша:
  // темною лишається лише та, що межує з порожнечею (вибірковий контур).
  const empty = (x: number, y: number): boolean => (px[y]?.[x] ?? '.') === '.';
  const inner: Readonly<Record<string, string>> = { o: 'i', O: 'I' };
  const out = px.map((r, y) => r.map((k, x) => (inner[k] && !(empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) ? inner[k]! : k)));
  return out.map((r) => r.join(''));
}
