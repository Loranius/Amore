// ============================================================
// Земля кристала (ADR-0242): звідки він росте.
// ------------------------------------------------------------
// Кристал виглядав поставленим на підлогу. Тепер він її прорвав: плити
// серця підняті (`platform.ts`), а тут — те, що прорвалось разом із ним:
//   * сяйво в землі під піднятими плитами — світяться саме шви між ними,
//     найяскравіше біля кристала;
//   * кілька уламків-шпилів, що вийшли з тріщин, віялом від колонії;
//   * друзи спільних вихідних (ADR-0237) — тепер того самого кольору, що й
//     колонія, а не сталого рожевого.
// Окрема сітка, бо світиться: сам острів не світиться (ADR-0227), світло —
// лише від кристала пари, тож і колір тут — колір колонії (фарба `gem`
// матеріалу землі кристала).
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { PAINT, Painter, polar, type IslandMesh, type V3 } from './brushes';

/**
 * Шпиль-друза: два-три шестигранні шпилі, що виходять із щілини між
 * плитами. Вершина гостра, як у кварцу; кожен шпиль у свій бік.
 */
export function druse(p: Painter, seed: string, key: string, c: V3, size: number, glow = 0.35) {
  const spikes = 2 + Math.floor(unit(seed, `${key}:n`) * 2);
  for (let s = 0; s < spikes; s += 1) {
    const k = `${key}:s${s}`;
    const h = size * (s === 0 ? 1 : 0.55 + 0.3 * unit(seed, `${k}:h`));
    const w = h * 0.22;
    const lean = s === 0 ? 0.12 : 0.35 + 0.25 * unit(seed, `${k}:l`);
    const dir = unit(seed, `${k}:d`) * Math.PI * 2;
    const base: V3 = s === 0 ? c : [c[0] + Math.cos(dir) * w * 1.4, c[1], c[2] + Math.sin(dir) * w * 1.4];
    const axis: V3 = [Math.cos(dir) * lean, 1, Math.sin(dir) * lean];
    const ring = (t: number, r: number) => Array.from({ length: 6 }, (_, i): V3 => {
      const a = (i / 6) * Math.PI * 2 + dir;
      return [base[0] + axis[0] * h * t + Math.cos(a) * r, base[1] + axis[1] * h * t, base[2] + axis[2] * h * t + Math.sin(a) * r];
    });
    const low = ring(0, w);
    const high = ring(0.7, w);
    const tip: V3 = [base[0] + axis[0] * h, base[1] + axis[1] * h, base[2] + axis[2] * h];
    p.band(low, high, PAINT.gem, (i) => 0.85 + 0.3 * unit(seed, `${k}:f${i}`), false, false, glow);
    for (let i = 0; i < 6; i += 1) p.tri(high[i]!, high[(i + 1) % 6]!, tip, PAINT.gem, 1.05 + 0.2 * unit(seed, `${k}:t${i}`), glow + 0.15);
  }
}

/** Друз менше (власник, 2026-10-06): одна на три спільні вихідні, не більше восьми. */
export const DAYS_PER_DRUSE = 3;
export const MAX_DRUSES = 8;
export function druseCount(days: number): number {
  return Math.min(MAX_DRUSES, Math.ceil(Math.max(0, days) / DAYS_PER_DRUSE));
}
export function druseOfDay(k: number): number {
  return Math.min(MAX_DRUSES - 1, Math.floor(Math.max(0, k) / DAYS_PER_DRUSE));
}

/**
 * Де стоїть друза `k` на острові радіуса `R` (ADR-0237): одна формула на
 * острів і хроніку росту (ADR-0238), щоб камера летіла саме до неї.
 */
export function druseAt(seed: string, R: number, k: number): V3 {
  const key = `isle:druse${k}`;
  const turn = unit(seed, 'isle:turn') * Math.PI * 2;
  const a = turn + k * 2.399963 + (unit(seed, `${key}:a`) - 0.5) * 0.3;
  return polar(R * (0.5 + 0.32 * unit(seed, `${key}:r`)), a, R * 0.01);
}

export function buildCrystalGround(seed: string, R: number, druses: number): IslandMesh {
  const p = new Painter();
  // ── Сяйво в землі під серцем підлоги ───────────────────────
  // Віяло з центру: центр світиться, край гасне. Лежить ледь вище землі й
  // нижче плит, тож світять лише шви між піднятими плитами.
  const SEG = 12;
  const centre: V3 = [0, R * 0.006, 0];
  for (let j = 0; j < SEG; j += 1) {
    const a0 = (j / SEG) * Math.PI * 2;
    const a1 = ((j + 1) / SEG) * Math.PI * 2;
    const r0 = R * (0.3 + 0.05 * unit(seed, `ground:glow${j}`));
    const r1 = R * (0.3 + 0.05 * unit(seed, `ground:glow${(j + 1) % SEG}`));
    p.positions.push(...centre, ...polar(r1, a1, R * 0.006), ...polar(r0, a0, R * 0.006));
    p.paint.push(PAINT.gem, PAINT.gem, PAINT.gem);
    p.tone.push(1, 0.7, 0.7);
    p.glow.push(1, 0.05, 0.05);
  }

  // ── Уламки, що прорвались разом із кристалом ───────────────
  const turn = unit(seed, 'ground:turn') * Math.PI * 2;
  for (let k = 0; k < 6; k += 1) {
    const key = `ground:shard${k}`;
    const a = turn + (k / 6) * Math.PI * 2 + (unit(seed, `${key}:a`) - 0.5) * 0.7;
    const r = R * (0.3 + 0.18 * unit(seed, `${key}:r`));
    druse(p, seed, key, polar(r, a, 0), R * (0.07 + 0.06 * unit(seed, `${key}:s`)), 0.3);
  }

  // ── Друзи — спільні вихідні (ADR-0237) ─────────────────────
  for (let k = 0; k < druseCount(druses); k += 1) {
    const key = `isle:druse${k}`;
    druse(p, seed, key, druseAt(seed, R, k), R * (0.07 + 0.05 * unit(seed, `${key}:s`)));
  }
  return p.build();
}
