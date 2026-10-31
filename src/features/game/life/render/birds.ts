// ============================================================
// Кури й півень (ADR-0239, власник 2026-10-12: «модельки курей коричневих
// і білих і одного півня … замість тих курей-кругляшків, що дригаються з
// місця на місце»). Аркуш зібрано з персонажів PixelLab «Курка біла»,
// «Курка коричнева» й «Півень» (`scripts/pixellab/build_birds.py`):
// рядки — птаха × напрям (вниз, ліворуч, праворуч, угору), стовпці —
// стоїть, 4 кадри ходи, далі кадри дзьобання (лише профілем).
//
// Піксель аркуша — пів світового, як у людей: гра лише в 32×32 (власник
// 2026-10-31: «повністю відмовляємось від 16×16»). Поки аркуш вантажиться,
// птахи не малюються — це мить, а не підміна.
// ============================================================
import birdsUrl from './assets/hd/birds.png';
import { PECK_S, type Bird, type BirdKind } from '../sim/birds';
import { ellipse } from './pixel';

/** Порядок птахів на аркуші. */
export const BIRD_KINDS: readonly BirdKind[] = ['white', 'brown', 'rooster'];
export const BIRD_WALK_FRAMES = 4;
export const BIRD_PECK_FRAMES = 6;
/** Клітинка аркуша (пікселі малюнка) і нижній рядок лап у ній (середина — посередині клітинки). */
export const BIRD_CELL = 40;
export const BIRD_FOOT_X = 20;
export const BIRD_FOOT_Y = 34;
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

let sheet: HTMLImageElement | null = null;
let sheetReady = false;

function birdSheet(): HTMLImageElement | null {
  if (!sheet && typeof Image !== 'undefined') {
    sheet = new Image();
    sheet.onload = () => { sheetReady = true; };
    sheet.onerror = () => console.error(`Кури: не вдалося завантажити аркуш ${birdsUrl}`);
    sheet.src = birdsUrl;
  }
  return sheetReady ? sheet : null;
}

/** Намалювати птаху лапами в її точці (світ, 32×32 на клітинку). */
export function drawBird(g: CanvasRenderingContext2D, b: Bird): void {
  const { row, col } = birdCell(b);
  ellipse(g, b.x, b.y, 4, 1, 'rgba(28,20,40,0.28)');
  const img = birdSheet();
  if (!img) return;
  const dx = Math.round((b.x - BIRD_FOOT_X / 2) * 2) / 2;
  const dy = Math.round((b.y - BIRD_FOOT_Y / 2) * 2) / 2;
  g.drawImage(img, col * BIRD_CELL, row * BIRD_CELL, BIRD_CELL, BIRD_CELL, dx, dy, BIRD_CELL / 2, BIRD_CELL / 2);
}

/**
 * Курка чи півень поза світом — у міні-грі (курник): `dir` 1 ліворуч /
 * 2 праворуч, `col` — кадр (0 стоїть, далі хода й дзьобання), лапи в
 * (x, y), `a` — одиниць полотна на піксель аркуша. Щоб нічого не
 * розпливалось, (x, y) і `a` мусять лягати на пікселі пристрою — це
 * робить той, хто кличе (`henArt` у міні-грі). Поки аркуш вантажиться —
 * нічого (мить на початку гри).
 */
export function drawBirdSprite(g: CanvasRenderingContext2D, kind: BirdKind, dir: 0 | 1 | 2, col: number, x: number, y: number, a: number): void {
  const img = birdSheet();
  if (!img) return;
  const row = BIRD_KINDS.indexOf(kind) * 4 + dir;
  g.drawImage(img, col * BIRD_CELL, row * BIRD_CELL, BIRD_CELL, BIRD_CELL, x - BIRD_FOOT_X * a, y - BIRD_FOOT_Y * a, BIRD_CELL * a, BIRD_CELL * a);
}
