// ============================================================
// Діорама — острівець під артефактом (ADR-0220).
// ------------------------------------------------------------
// Власник: «адаптувати всі три сцени кристала/дерева/рифу в стилі лоуполі
// гри, візьми за приклад мобільну гру Tap Tap Fish AbyssRium». У неї
// предмет стоїть на маленькому гранчастому острівці, що висить у порожнечі,
// а не в розлогому світі до обрію. Це він: пласка верхівка з нерівним
// краєм і гранчаста «сталактитова» підошва, що звужується донизу.
//
// Модуль чистий: лише масиви, без three; форма — з хешу дати початку.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';

export interface DioramaBaseMesh {
  positions: Float32Array;
  tone: Float32Array;
  /** 1 — верхівка (трава, пісок, камінь), 0 — підошва. */
  top: Float32Array;
}

const SEGMENTS = 18;

/** Радіус краю верхівки під кутом сегмента `j`: нерівний, але замкнений. */
export function dioramaRimRadius(seed: string, radius: number, j: number): number {
  return radius * (0.9 + 0.2 * unit(seed, `diorama:rim${j % SEGMENTS}`));
}

export function buildDioramaBase(seed: string, radius: number): DioramaBaseMesh {
  const out: number[] = [];
  const tone: number[] = [];
  const top: number[] = [];
  const face = (a: number[], b: number[], c: number[], t: number, isTop: number) => {
    out.push(...a, ...b, ...c);
    tone.push(t, t, t);
    top.push(isTop, isTop, isTop);
  };
  const angle = (j: number, shift = 0) => ((j + shift) / SEGMENTS) * Math.PI * 2;
  const rim = (j: number) => {
    const r = dioramaRimRadius(seed, radius, j);
    return [Math.cos(angle(j)) * r, 0, Math.sin(angle(j)) * r];
  };
  // Верхівка: центр трохи вище за край — ледь опуклий пагорб.
  const inner = (j: number) => {
    const r = radius * 0.5 * (0.9 + 0.2 * unit(seed, `diorama:in${j}`));
    return [Math.cos(angle(j, 0.5)) * r, radius * 0.035, Math.sin(angle(j, 0.5)) * r];
  };
  const centre = [0, radius * 0.05, 0];
  for (let j = 0; j < SEGMENTS; j += 1) {
    const k = (j + 1) % SEGMENTS;
    const t = () => 0.93 + 0.14 * unit(seed, `diorama:top${j}:${out.length}`);
    face(centre, inner(k), inner(j), t(), 1);
    face(inner(j), inner(k), rim(k), t(), 1);
    face(inner(j), rim(k), rim(j), t(), 1);
  }
  // Підошва: три кільця, що стискаються донизу, і вістря — гранчаста скеля.
  const layers = [
    { depth: 0.16, scale: 0.95 },
    { depth: 0.45, scale: 0.72 },
    { depth: 0.8, scale: 0.4 },
  ];
  let prev = Array.from({ length: SEGMENTS }, (_, j) => rim(j));
  layers.forEach((layer, li) => {
    const ring = Array.from({ length: SEGMENTS }, (_, j) => {
      const r = dioramaRimRadius(seed, radius, j) * layer.scale * (0.85 + 0.3 * unit(seed, `diorama:l${li}:${j}`));
      const a = angle(j, li % 2 ? 0.5 : 0);
      return [Math.cos(a) * r, -radius * layer.depth * (0.9 + 0.2 * unit(seed, `diorama:d${li}:${j}`)), Math.sin(a) * r];
    });
    for (let j = 0; j < SEGMENTS; j += 1) {
      const k = (j + 1) % SEGMENTS;
      const shade = 0.95 - 0.15 * li;
      face(prev[j]!, prev[k]!, ring[k]!, shade * (0.9 + 0.2 * unit(seed, `diorama:s${li}:${j}a`)), 0);
      face(prev[j]!, ring[k]!, ring[j]!, shade * (0.9 + 0.2 * unit(seed, `diorama:s${li}:${j}b`)), 0);
    }
    prev = ring;
  });
  const tip = [0, -radius * 1.25, 0];
  for (let j = 0; j < SEGMENTS; j += 1) {
    face(prev[j]!, prev[(j + 1) % SEGMENTS]!, tip, 0.5 + 0.15 * unit(seed, `diorama:tip${j}`), 0);
  }
  return { positions: new Float32Array(out), tone: new Float32Array(tone), top: new Float32Array(top) };
}
