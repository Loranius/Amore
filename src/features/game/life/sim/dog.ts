// ============================================================
// Бася — чорний коргі Лєни на подвір'ї (власник, 2026-10-05).
// ------------------------------------------------------------
// Жваво бігає по подвір'ю 5 секунд, потім 3 секунди бігає за Лєною, і
// знову. Кожного разу, коли Бася підбігає до Лєни, — 30% шанс, що Лєна
// перечепиться й на пів секунди впаде. Кидок — від зерна сейву й номера
// підбігу (`rngFor`), тож той самий сейв дає ті самі падіння, а тести
// стабільні.
// ============================================================
import { rngFor } from './rng';

export const DOG_ROAM_S = 5;
export const DOG_CHASE_S = 3;
export const DOG_TRIP_CHANCE = 0.3;
export const LENA_FALL_S = 0.5;

/** Відстань (px), на якій Бася «підбігла» до Лєни. */
const ARRIVE_PX = 18;
const ROAM_SPEED = 95;
const CHASE_SPEED = 118;

export type DogMode = 'roam' | 'chase';

export interface Dog {
  x: number;
  y: number;
  /** 0 вниз, 1 ліворуч, 2 праворуч, 3 угору — як у людей. */
  dir: 0 | 1 | 2 | 3;
  moving: boolean;
  t: number;
  mode: DogMode;
  /** Скільки секунд лишилось у поточному режимі. */
  left: number;
  target: { x: number; y: number } | null;
  /** Номер підбігу до Лєни — від нього кидок на падіння. */
  approach: number;
  /** Чи вже підбігла в цьому підбігу (кидок — один раз). */
  arrived: boolean;
  /** Скільки разів обирала нову мету — від цього кидок на мету. */
  picks: number;
  seed: number;
}

export interface DogWorld {
  lena: { x: number; y: number };
  canStand(x: number, y: number): boolean;
}

export function newDog(x: number, y: number, seed: number): Dog {
  return { x, y, dir: 0, moving: false, t: 0, mode: 'roam', left: DOG_ROAM_S, target: null, approach: 0, arrived: false, picks: 0, seed };
}

/** Один крок Басі. `trip` — Лєна щойно перечепилась. */
export function stepDog(d: Dog, dt: number, w: DogWorld): { dog: Dog; trip: boolean } {
  const n: Dog = { ...d, t: d.t + dt, left: d.left - dt };
  let trip = false;
  if (n.left <= 0) {
    if (n.mode === 'roam') {
      n.mode = 'chase';
      n.left += DOG_CHASE_S;
      n.approach += 1;
      n.arrived = false;
    } else {
      n.mode = 'roam';
      n.left += DOG_ROAM_S;
    }
    n.target = null;
  }

  if (n.mode === 'chase') {
    const dl = Math.hypot(w.lena.x - n.x, w.lena.y - n.y);
    if (!n.arrived && dl < ARRIVE_PX) {
      n.arrived = true;
      trip = rngFor(n.seed, 'basia-trip', n.approach)() < DOG_TRIP_CHANCE;
    }
    // Підбігла — крутиться довкола ніг; ні — біжить до Лєни.
    const a = n.t * 5;
    n.target = n.arrived ? { x: w.lena.x + Math.cos(a) * 16, y: w.lena.y + Math.sin(a) * 7 } : { x: w.lena.x, y: w.lena.y + 2 };
  } else if (!n.target || Math.hypot(n.target.x - n.x, n.target.y - n.y) < 4) {
    n.target = null;
    for (let k = 0; k < 6 && !n.target; k += 1) {
      const r = rngFor(n.seed, 'basia-roam', n.picks);
      n.picks += 1;
      const tx = n.x + (r() - 0.5) * 220;
      const ty = n.y + (r() - 0.5) * 150;
      if (w.canStand(tx, ty)) n.target = { x: tx, y: ty };
    }
  }

  if (!n.target) { n.moving = false; return { dog: n, trip }; }
  const dx = n.target.x - n.x;
  const dy = n.target.y - n.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.min((n.mode === 'chase' ? CHASE_SPEED : ROAM_SPEED) * dt, dist);
  if (dist < 0.5 || step <= 0) { n.moving = false; return { dog: n, trip }; }
  const sx = (dx / dist) * step;
  const sy = (dy / dist) * step;
  let moved = false;
  if (w.canStand(n.x + sx, n.y)) { n.x += sx; moved = true; }
  if (w.canStand(n.x, n.y + sy)) { n.y += sy; moved = true; }
  if (!moved && n.mode === 'roam') n.target = null;
  n.moving = moved;
  n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
  return { dog: n, trip };
}
