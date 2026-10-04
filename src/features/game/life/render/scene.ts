// ============================================================
// Сцена «Життя Лєни» (ADR-0239): земля → тіні → усе, що стоїть,
// відсортоване за глибиною → світло доби → погода → підписи.
// ------------------------------------------------------------
// Вночі темрява — окреме полотно, в якому світло вирізає дірки: вікна,
// ліхтарі, маяк, піч удома, ліхтарик біля самої Лєни. Так ніч темна, а
// місто — живе.
// ============================================================
import type { Season } from '../sim/calendar';
import { TILE, type GameMap, type Zone } from '../world/types';
import { buildingSprite, drawBuildingShadow } from './buildings';
import { drawLeafLitter, drawTreeShadow, treeSprite, TREE_BASE } from './nature';
import { ambientAt, lightsOn } from './palette';
import { sheetFor, walkFrame, type Dir, type Look } from './people';
import { cellHash, ellipse, type Ctx } from './pixel';
import { drawProp, propBase, propLight } from './props';
import { drawWater, groundCanvas } from './tiles';
import { drawBitmap } from './icons';

export type Weather = 'clear' | 'rain' | 'snow' | 'leaves' | 'petals';

export interface Actor {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  t: number;
  look: Look;
  /** Серце чи нотка над головою. */
  emote?: 'heart' | 'note' | 'sleep' | null;
}

export interface SceneEnv {
  season: Season;
  minute: number;
  time: number;
  weather: Weather;
}

export interface View {
  /** Розмір полотна в пікселях пристрою. */
  w: number;
  h: number;
  /** Пікселів пристрою на піксель світу (ціле). */
  scale: number;
  camX: number;
  camY: number;
  /** Пікселів пристрою на CSS-піксель — для підписів. */
  dpr: number;
}

export interface SceneOptions {
  /** Зона, до якої веде стрілка (мета дня). */
  target: Zone | null;
  /** Зона, в якій стоїть Лєна — підсвічується. */
  near: Zone | null;
}

let lightCanvas: HTMLCanvasElement | null = null;

function darknessLayer(w: number, h: number): CanvasRenderingContext2D {
  if (!lightCanvas) lightCanvas = document.createElement('canvas');
  if (lightCanvas.width !== w || lightCanvas.height !== h) {
    lightCanvas.width = w;
    lightCanvas.height = h;
  }
  const g = lightCanvas.getContext('2d')!;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  return g;
}

export function renderScene(g: Ctx, map: GameMap, actors: readonly Actor[], env: SceneEnv, view: View, opts: SceneOptions): void {
  const { scale, camX, camY } = view;
  const season = env.season;
  const lit = map.interior ? true : lightsOn(env.minute);
  g.imageSmoothingEnabled = false;
  g.fillStyle = map.interior ? '#1b1420' : '#2a3a2a';
  g.fillRect(0, 0, view.w, view.h);

  g.save();
  g.scale(scale, scale);
  g.translate(-Math.round(camX), -Math.round(camY));

  // Земля.
  const ground = groundCanvas(map, season);
  const vw = view.w / scale;
  const vh = view.h / scale;
  g.drawImage(ground, 0, 0);
  const i0 = Math.max(0, Math.floor(camX / TILE));
  const j0 = Math.max(0, Math.floor(camY / TILE));
  const i1 = Math.min(map.w - 1, Math.ceil((camX + vw) / TILE));
  const j1 = Math.min(map.h - 1, Math.ceil((camY + vh) / TILE));
  drawWater(g, map, season, env.time, i0, j0, i1, j1);

  // Тіні й опале листя — на землі, під усім.
  for (const b of map.buildings) drawBuildingShadow(g, b);
  for (const t of map.trees) {
    const bx = t.x * TILE + 8;
    const by = t.y * TILE + 14;
    drawTreeShadow(g, bx, by, t.kind);
    drawLeafLitter(g, bx, by, season, t.kind, cellHash(t.x, t.y));
  }

  // Підсвітка зони, де стоїть Лєна.
  if (opts.near) {
    const z = opts.near;
    const pulse = 0.18 + Math.sin(env.time * 4) * 0.08;
    g.fillStyle = `rgba(255,236,160,${pulse})`;
    g.fillRect(z.x * TILE, z.y * TILE, z.w * TILE, z.h * TILE);
  }

  // Усе, що стоїть, — за глибиною.
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  const windowsLit: { x: number; y: number; w: number; h: number }[] = [];
  const smokes: { x: number; y: number }[] = [];
  for (const b of map.buildings) {
    const s = buildingSprite(b, season);
    const x = b.x * TILE + s.ox;
    const y = b.y * TILE + s.oy;
    if (x > camX + vw + 40 || x + s.img.width < camX - 40 || y > camY + vh + 40 || y + s.img.height < camY - 60) continue;
    items.push({
      y: (b.y + b.h) * TILE,
      draw: () => {
        g.drawImage(s.img, x, y);
        if (lit && !map.interior) {
          g.fillStyle = 'rgba(255,214,120,0.82)';
          for (const w of s.windows) g.fillRect(x + w.x, y + w.y, w.w, w.h);
        }
      },
    });
    if (lit) for (const w of s.windows) windowsLit.push({ x: x + w.x, y: y + w.y, w: w.w, h: w.h });
    if (s.smoke && (season === 'winter' || season === 'autumn' || lit)) smokes.push({ x: x + s.smoke.x, y: y + s.smoke.y });
  }
  for (const t of map.trees) {
    const img = treeSprite(t, season);
    const x = t.x * TILE + 8 - TREE_BASE.x - 1;
    const y = t.y * TILE + 15 - TREE_BASE.y - 1;
    if (x > camX + vw || x + img.width < camX || y > camY + vh || y + img.height < camY) continue;
    // Легке погойдування крони вітром.
    const sway = Math.sin(env.time * 1.3 + t.x * 0.7) > 0.85 ? 1 : 0;
    items.push({ y: t.y * TILE + 14, draw: () => g.drawImage(img, x + sway, y) });
  }
  for (const p of map.props) {
    if (p.type === 'gull') continue;
    if ((p.x + 4) * TILE < camX || (p.x - 4) * TILE > camX + vw || (p.y + 4) * TILE < camY || (p.y - 4) * TILE > camY + vh) continue;
    items.push({ y: propBase(p), draw: () => drawProp(g, p, season, env.time) });
  }
  for (const a of actors) {
    const sheet = sheetFor(a.look);
    const img = sheet[a.dir]![walkFrame(a.moving, a.t)]!;
    items.push({
      y: a.y,
      draw: () => {
        ellipse(g, a.x, a.y, a.look.kid ? 4 : 5, 2, 'rgba(28,20,40,0.28)');
        g.drawImage(img, Math.round(a.x - img.width / 2), Math.round(a.y - img.height + 2));
        if (a.emote) {
          const bob = Math.round(Math.sin(env.time * 5) * 1.5);
          drawBitmap(g, a.emote === 'heart' ? 'heart' : a.emote === 'sleep' ? 'sleep' : 'star', Math.round(a.x - 3), Math.round(a.y - img.height - 8 + bob));
        }
      },
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // Чайки — над усім.
  for (const p of map.props) if (p.type === 'gull') drawProp(g, p, season, env.time);

  // Дим із комина.
  for (const s of smokes) {
    for (let k = 0; k < 6; k += 1) {
      const ph = (env.time * 0.35 + k / 6) % 1;
      const r = 1.5 + ph * 3;
      g.fillStyle = `rgba(235,235,240,${0.55 * (1 - ph)})`;
      g.beginPath();
      g.arc(s.x + Math.sin(ph * 5 + k) * 3 + ph * 6, s.y - ph * 26, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Стрілка до мети.
  if (opts.target && (!opts.near || opts.near.id !== opts.target.id)) {
    const z = opts.target;
    const ax = z.x * TILE + (z.w * TILE) / 2 - 3;
    const ay = z.y * TILE - 12 + Math.round(Math.sin(env.time * 5) * 2.5);
    drawBitmap(g, 'arrow', ax, ay);
  }
  g.restore();

  // Світло доби.
  if (!map.interior) {
    const amb = ambientAt(env.minute);
    if (amb.alpha > 0.01) {
      const d = darknessLayer(view.w, view.h);
      d.fillStyle = amb.color;
      d.globalAlpha = amb.alpha;
      d.fillRect(0, 0, view.w, view.h);
      d.globalAlpha = 1;
      if (lit) {
        d.globalCompositeOperation = 'destination-out';
        const hole = (wx: number, wy: number, r: number, strength: number) => {
          const sx = (wx - camX) * scale;
          const sy = (wy - camY) * scale;
          const rr = r * scale;
          if (sx < -rr || sy < -rr || sx > view.w + rr || sy > view.h + rr) return;
          const grd = d.createRadialGradient(sx, sy, 0, sx, sy, rr);
          grd.addColorStop(0, `rgba(0,0,0,${strength})`);
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          d.fillStyle = grd;
          d.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
        };
        for (const w of windowsLit) hole(w.x + w.w / 2, w.y + w.h / 2 + 4, 16, 0.75);
        for (const p of map.props) {
          const l = propLight(p);
          if (l) hole(l.x, l.y, l.r, 0.9);
        }
        for (const a of actors) if (a.id === 'lena') hole(a.x, a.y - 8, 30, 0.45);
        d.globalCompositeOperation = 'source-over';
      }
      g.drawImage(lightCanvas!, 0, 0);
      if (lit) {
        // Тепле сяйво ліхтарів поверх темряви.
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (const p of map.props) {
          const l = propLight(p);
          if (!l) continue;
          const sx = (l.x - camX) * scale;
          const sy = (l.y - camY) * scale;
          const rr = l.r * 0.6 * scale;
          const grd = g.createRadialGradient(sx, sy, 0, sx, sy, rr);
          grd.addColorStop(0, 'rgba(255,190,90,0.22)');
          grd.addColorStop(1, 'rgba(255,190,90,0)');
          g.fillStyle = grd;
          g.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
        }
        g.restore();
      }
    }
    drawWeather(g, env, view);
  } else if (env.minute >= 21 * 60 || env.minute < 7 * 60) {
    // Удома вночі — тепла напівтемрява.
    g.fillStyle = 'rgba(40,30,70,0.32)';
    g.fillRect(0, 0, view.w, view.h);
  }

  drawLabels(g, map, actors, view, opts);
}

function drawWeather(g: Ctx, env: SceneEnv, view: View): void {
  const { w, h, scale } = view;
  const t = env.time;
  if (env.weather === 'clear') return;
  const n = env.weather === 'rain' ? 120 : env.weather === 'snow' ? 90 : 26;
  for (let k = 0; k < n; k += 1) {
    const hx = cellHash(k, 1, 77) / 4294967296;
    const hy = cellHash(k, 2, 77) / 4294967296;
    const sp = 0.6 + (cellHash(k, 3, 77) % 100) / 120;
    if (env.weather === 'rain') {
      const x = ((hx * w + t * 60 * scale * 0.3) % w + w) % w;
      const y = ((hy * h + t * 420 * scale * sp) % h + h) % h;
      g.fillStyle = 'rgba(190,210,240,0.55)';
      g.fillRect(x, y, Math.max(1, scale / 2), 7 * scale);
    } else if (env.weather === 'snow') {
      const y = ((hy * h + t * 26 * scale * sp) % h + h) % h;
      const x = ((hx * w + Math.sin(t * 0.9 + k) * 14 * scale) % w + w) % w;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      const s = (k % 3 === 0 ? 2 : 1) * scale;
      g.fillRect(x, y, s, s);
    } else {
      const y = ((hy * h + t * 30 * scale * sp) % h + h) % h;
      const x = ((hx * w + t * 18 * scale + Math.sin(t * 2 + k) * 10 * scale) % w + w) % w;
      g.fillStyle = env.weather === 'leaves' ? ['#e08a2e', '#f2b44a', '#b85a24'][k % 3]! : '#ffc4dc';
      g.fillRect(x, y, 2 * scale, scale);
      g.fillRect(x + scale, y + scale, scale, scale);
    }
  }
  if (env.weather === 'rain') {
    g.fillStyle = 'rgba(40,50,80,0.16)';
    g.fillRect(0, 0, w, h);
  }
}

/** Підписи — чіткі, у пікселях екрана, а не світу. */
function drawLabels(g: Ctx, map: GameMap, actors: readonly Actor[], view: View, opts: SceneOptions): void {
  const lena = actors.find((a) => a.id === 'lena');
  if (!lena) return;
  const fs = Math.round(12 * view.dpr);
  g.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  const label = (text: string, wx: number, wy: number, strong: boolean) => {
    const sx = (wx - view.camX) * view.scale;
    const sy = (wy - view.camY) * view.scale;
    if (sx < -100 || sx > view.w + 100 || sy < 0 || sy > view.h + 20) return;
    const tw = g.measureText(text).width;
    const padX = 7 * view.dpr;
    const bh = fs + 8 * view.dpr;
    g.fillStyle = strong ? 'rgba(74,44,26,0.92)' : 'rgba(44,30,40,0.62)';
    const r = 6 * view.dpr;
    const x0 = sx - tw / 2 - padX;
    const y0 = sy - bh;
    g.beginPath();
    g.roundRect(x0, y0, tw + padX * 2, bh, r);
    g.fill();
    if (strong) {
      g.strokeStyle = '#f2c46a';
      g.lineWidth = 1.5 * view.dpr;
      g.stroke();
    }
    g.fillStyle = strong ? '#fff2cf' : '#f4ecf4';
    g.fillText(text, sx, sy - 4 * view.dpr);
  };
  for (const b of map.buildings) {
    const dx = b.doorX * TILE + 8 - lena.x;
    const dy = (b.y + b.h) * TILE - lena.y;
    if (Math.hypot(dx, dy) > 120 || !b.action) continue;
    label(b.label, b.doorX * TILE + 8, b.y * TILE - 22, false);
  }
  if (opts.near && !map.buildings.some((b) => b.id === opts.near!.id)) {
    label(opts.near.label, (opts.near.x + opts.near.w / 2) * TILE, opts.near.y * TILE - 4, true);
  }
}
