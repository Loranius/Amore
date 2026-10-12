// ============================================================
// Кури й півень на подвір'ї (власник 2026-10-12: «модельки курей
// коричневих і білих і одного півня … замість тих курей-кругляшків, що
// дригаються з місця на місце»). Кожна птаха живе біля свого місця:
// стоїть, дзьобає землю, переходить на кілька кроків і знову дзьобає.
// Коли поруч Лєна чи Бася — кидається геть і біжить швидше, а потім
// повертається до свого місця.
//
// Як і Бася (`dog.ts`), — чиста функція кроку: кидки від зерна сейву й
// номера вибору (`rngFor`), тож той самий сейв дає ту саму поведінку, а
// тести стабільні.
// ============================================================
import { rngFor } from './rng';

export type BirdKind = 'white' | 'brown' | 'rooster';
export type BirdState = 'stand' | 'peck' | 'walk' | 'flee';

/** Як далеко від свого місця птаха ходить (px): уздовж — далі, ніж угору-вниз. */
export const BIRD_RANGE_X = 26;
export const BIRD_RANGE_Y = 13;
/** Хода й утеча (px/с). */
export const BIRD_SPEED = 14;
export const FLEE_SPEED = 46;
/** Ближче за стільки (px) Лєна чи Бася — птаха тікає. */
export const SCARE_PX = 22;
/** Один цикл дзьобання (с) — під кадри дзьобання на аркуші. */
export const PECK_S = 0.9;

export interface Bird {
  kind: BirdKind;
  /** Лапи (світові пікселі). */
  x: number;
  y: number;
  /** Своє місце: довкола нього птаха й ходить. */
  home: { x: number; y: number };
  /** 0 вниз, 1 ліворуч, 2 праворуч, 3 угору — як у людей. */
  dir: 0 | 1 | 2 | 3;
  state: BirdState;
  /** Скільки секунд у цьому стані — від нього кадр анімації. */
  t: number;
  /** Скільки ще стоїть чи дзьобає. */
  left: number;
  target: { x: number; y: number } | null;
  /** Скільки разів обирала, що робити далі, — від цього кидок. */
  picks: number;
  seed: number;
}

export interface BirdWorld {
  /** Хто лякає: Лєна, Бася. */
  scare: readonly { x: number; y: number }[];
  canStand(x: number, y: number): boolean;
}

export function newBird(kind: BirdKind, x: number, y: number, seed: number): Bird {
  const r = rngFor(seed, 'bird-start');
  return { kind, x, y, home: { x, y }, dir: r() < 0.5 ? 1 : 2, state: 'stand', t: 0, left: 0.3 + r() * 2, target: null, picks: 0, seed };
}

/**
 * Куди дивиться птаха, що йде (dx, dy): кури — профілем, поки рух більше
 * вбік, ніж угору-вниз. Півень іде лише профілем: його поворот «угору»
 * PixelLab намалював збоку, а в ході «вниз» хвіст перескакував з боку на
 * бік щокроку. Обличчям до глядача він лише стоїть (`stepBird`).
 */
export function birdDir(kind: BirdKind, dx: number, dy: number, was: Bird['dir']): Bird['dir'] {
  const side: Bird['dir'] = dx > 0 ? 2 : dx < 0 ? 1 : was === 1 || was === 2 ? was : 2;
  if (kind === 'rooster' || Math.abs(dx) * 1.2 >= Math.abs(dy)) return side;
  return dy > 0 ? 0 : 3;
}

/** Як часто півень, зупинившись, обертається до глядача. */
export const ROOSTER_FACES = 0.35;

/** Один крок птахи. */
export function stepBird(b: Bird, dt: number, w: BirdWorld): Bird {
  const n: Bird = { ...b, t: b.t + dt, left: b.left - dt };
  const threat = w.scare.find((s) => Math.hypot(s.x - n.x, s.y - n.y) < SCARE_PX);
  if (threat && n.state !== 'flee') {
    const away = Math.atan2(n.y - threat.y, n.x - threat.x);
    n.target = null;
    for (let k = 0; k < 5 && !n.target; k += 1) {
      const r = rngFor(n.seed, 'bird-flee', n.picks);
      n.picks += 1;
      const a = away + (r() - 0.5) * 1.4;
      const d = 24 + r() * 16;
      const tx = n.x + Math.cos(a) * d;
      const ty = n.y + Math.sin(a) * d * 0.7;
      if (w.canStand(tx, ty)) n.target = { x: tx, y: ty };
    }
    if (n.target) { n.state = 'flee'; n.t = 0; }
  }

  if (n.state === 'stand' || n.state === 'peck') {
    if (n.left > 0) return n;
    const r = rngFor(n.seed, 'bird-next', n.picks);
    n.picks += 1;
    if (n.state === 'stand' && r() < 0.55) {
      // Дзьобає завжди профілем — кадри дзьобання є лише збоку.
      n.state = 'peck';
      n.t = 0;
      n.left = PECK_S * (1 + Math.floor(r() * 2));
      if (n.dir === 0 || n.dir === 3) n.dir = r() < 0.5 ? 1 : 2;
      return n;
    }
    n.target = null;
    for (let k = 0; k < 5 && !n.target; k += 1) {
      const q = rngFor(n.seed, 'bird-walk', n.picks);
      n.picks += 1;
      const tx = n.home.x + (q() - 0.5) * 2 * BIRD_RANGE_X;
      const ty = n.home.y + (q() - 0.5) * 2 * BIRD_RANGE_Y;
      if (w.canStand(tx, ty)) n.target = { x: tx, y: ty };
    }
    if (!n.target) { n.state = 'stand'; n.t = 0; n.left = 1; return n; }
    n.state = 'walk';
    n.t = 0;
  }

  const tg = n.target;
  if (!tg) { n.state = 'stand'; n.t = 0; n.left = 0.8; return n; }
  const dx = tg.x - n.x;
  const dy = tg.y - n.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    // Дійшла. Після втечі — спершу трохи постоїть, потім піде назад до свого місця.
    const r = rngFor(n.seed, 'bird-rest', n.picks);
    n.picks += 1;
    n.target = null;
    n.state = 'stand';
    n.t = 0;
    n.left = 0.6 + r() * 1.8;
    if (n.kind === 'rooster' && r() < ROOSTER_FACES) n.dir = 0;
    return n;
  }
  const step = Math.min((n.state === 'flee' ? FLEE_SPEED : BIRD_SPEED) * dt, dist);
  const sx = (dx / dist) * step;
  const sy = (dy / dist) * step;
  let moved = false;
  if (w.canStand(n.x + sx, n.y)) { n.x += sx; moved = true; }
  if (w.canStand(n.x, n.y + sy)) { n.y += sy; moved = true; }
  n.dir = birdDir(n.kind, dx, dy, n.dir);
  if (!moved) { n.target = null; n.state = 'stand'; n.t = 0; n.left = 0.6; }
  return n;
}
