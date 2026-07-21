// ============================================================
// crystalGeometry3d — процедурна 3D-геометрія кристала з ДНК пари
// ------------------------------------------------------------
// Перевикористовує CATEGORY_DEFS/MAX_SLOTS зі SVG-версії (crystalGeometry.ts)
// — та сама модель «7 категорій по колу», просто застосована як азимутальна
// деформація вершин ікосаедра замість плоских SVG-полігонів. Шум
// заseed-жений фіксованим числом (не Math.random()) — інакше поверхня
// «перетасовувалась» б при кожному перезавантаженні сторінки.
// ============================================================
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { CATEGORY_DEFS, MAX_SLOTS } from '../crystalGeometry';
import { mulberry32 } from '../mulberry32';
import type { CrystalDNA } from '../useCrystal';

const NOISE_SEED = 20221226; // фіксований — той самий шум-патерн щоразу.
const noise3D = createNoise3D(mulberry32(NOISE_SEED));

const ARC = 360 / CATEGORY_DEFS.length;
const DETAIL = 3; // ~1280 трикутників — достатньо гранисто, дешево для мобільного GPU.

/** 0..1 — наскільки «наповнена» категорія відносно максимуму шкали SVG-версії. */
function categoryWeight(cat: (typeof CATEGORY_DEFS)[number], dna: CrystalDNA): number {
  return cat.facetsFor(cat.metric(dna)) / MAX_SLOTS;
}

/** Загальний множник розміру кристала — росте повільно з часом стосунків. */
export function crystalScale(dna: CrystalDNA): number {
  return 1 + Math.min(dna.daysTogether / 3650, 0.4);
}

export function buildCrystalGeometry(dna: CrystalDNA): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, DETAIL);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const weights = CATEGORY_DEFS.map((cat) => categoryWeight(cat, dna));
  const colorPairs = CATEGORY_DEFS.map((cat) => [
    new THREE.Color(cat.colorA),
    new THREE.Color(cat.colorB),
  ] as const);

  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos, i);

    const azimuth = ((Math.atan2(v.z, v.x) * 180) / Math.PI + 360) % 360;
    const catIdx = Math.min(CATEGORY_DEFS.length - 1, Math.floor(azimuth / ARC));
    const weight = weights[catIdx] ?? 0;

    const n = noise3D(v.x * 1.6, v.y * 1.6, v.z * 1.6);
    const bump = 1 + weight * 0.55 + n * 0.05;
    v.multiplyScalar(bump);
    pos.setXYZ(i, v.x, v.y, v.z);

    const [colorA, colorB] = colorPairs[catIdx]!;
    c.lerpColors(colorA, colorB, Math.min(1, weight + 0.15));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
