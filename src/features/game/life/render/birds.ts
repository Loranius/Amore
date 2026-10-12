// ============================================================
// Кури й півень (ADR-0239, власник 2026-10-12: «модельки курей коричневих
// і білих і одного півня … замість тих курей-кругляшків, що дригаються з
// місця на місце»). Аркуші зібрано з персонажів PixelLab «Курка біла»,
// «Курка коричнева» й «Півень» (`scripts/pixellab/build_birds.py`):
// рядки — птаха × напрям (вниз, ліворуч, праворуч, угору), стовпці —
// стоїть, 4 кадри ходи, далі кадри дзьобання (лише профілем).
//
// 32×32: піксель аркуша — пів світового, як у людей. 16×16: той самий
// малюнок, зменшений удвічі, з обвідкою як у решти піксельного світу.
// Поки аркуш вантажиться, птахи не малюються — це мить, а не підміна.
// ============================================================
import birdsUrl from './assets/birds.png';
import birdsHdUrl from './assets/hd/birds.png';
import { PECK_S, type Bird, type BirdKind } from '../sim/birds';
import { densityOf, ellipse } from './pixel';

/** Порядок птахів на аркуші. */
export const BIRD_KINDS: readonly BirdKind[] = ['white', 'brown', 'rooster'];
export const BIRD_WALK_FRAMES = 4;
export const BIRD_PECK_FRAMES = 6;
/** Клітинка 32×32 і нижній рядок лап у ній (середина — посередині клітинки). */
export const BIRD_HD_CELL = 40;
const HD_FOOT_X = 20;
const HD_FOOT_Y = 34;
/** Клітинка 16×16 — удвічі менша. */
export const BIRD_CELL = 20;
const FOOT_X = 10;
const FOOT_Y = 17;
/** Кадрів на секунду: хода, втеча. */
const WALK_FPS = 8;
const FLEE_FPS = 16;

/** Клітинка аркуша для птахи в її теперішньому стані. */
export function birdCell(b: Bird): { row: number; col: number } {
  const row = BIRD_KINDS.indexOf(b.kind) * 4 + b.dir;
  if (b.state === 'walk' || b.state === 'flee') return { row, col: 1 + (Math.floor(b.t * (b.state === 'flee' ? FLEE_FPS : WALK_FPS)) % BIRD_WALK_FRAMES) };
  if (b.state === 'peck') return { row, col: 1 + BIRD_WALK_FRAMES + Math.min(BIRD_PECK_FRAMES - 1, Math.floor(((b.t % PECK_S) / PECK_S) * BIRD_PECK_FRAMES)) };
  return { row, col: 0 };
}

interface Sheet { img: HTMLImageElement | null; ready: boolean }
const sheets: Record<'hd' | 'pixel', Sheet> = { hd: { img: null, ready: false }, pixel: { img: null, ready: false } };

function sheet(which: 'hd' | 'pixel'): HTMLImageElement | null {
  const s = sheets[which];
  if (!s.img && typeof Image !== 'undefined') {
    const url = which === 'hd' ? birdsHdUrl : birdsUrl;
    s.img = new Image();
    s.img.onload = () => { s.ready = true; };
    s.img.onerror = () => console.error(`Кури: не вдалося завантажити аркуш ${url}`);
    s.img.src = url;
  }
  return s.ready ? s.img : null;
}

/** Намалювати птаху лапами в її точці. */
export function drawBird(g: CanvasRenderingContext2D, b: Bird): void {
  const { row, col } = birdCell(b);
  ellipse(g, b.x, b.y, 4, 1, 'rgba(28,20,40,0.28)');
  if (densityOf(g) > 1) {
    const img = sheet('hd');
    if (!img) return;
    const dx = Math.round((b.x - HD_FOOT_X / 2) * 2) / 2;
    const dy = Math.round((b.y - HD_FOOT_Y / 2) * 2) / 2;
    g.drawImage(img, col * BIRD_HD_CELL, row * BIRD_HD_CELL, BIRD_HD_CELL, BIRD_HD_CELL, dx, dy, BIRD_HD_CELL / 2, BIRD_HD_CELL / 2);
    return;
  }
  const img = sheet('pixel');
  if (!img) return;
  g.drawImage(img, col * BIRD_CELL, row * BIRD_CELL, BIRD_CELL, BIRD_CELL, Math.round(b.x - FOOT_X), Math.round(b.y - FOOT_Y), BIRD_CELL, BIRD_CELL);
}
