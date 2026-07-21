// ============================================================
// crystalGeometry3d — кластер гранованих «шипів» (як природний
// друз кристалу), а не суцільна деформована куля.
// ------------------------------------------------------------
// Один центральний стрижень («час разом», завжди вертикальний) +
// до 6 бічних шипів навколо — по одному на кожну іншу категорію
// ДНК, що нахилені назовні під різними кутами. Висота/товщина
// шипа росте з вагою категорії; шип ще не з'являється, поки
// метрика категорії дорівнює нулю (органічний ріст — «з нічого»,
// а не крихітний пеньок). Позиція/нахил кожного шипа детерміновані
// лише індексом категорії — не «перетасовуються» при рості.
// ============================================================
import * as THREE from 'three';
import { CATEGORY_DEFS, MAX_SLOTS } from '../crystalGeometry';
import { mulberry32 } from '../mulberry32';
import type { CrystalDNA } from '../useCrystal';

function categoryWeight(cat: (typeof CATEGORY_DEFS)[number], dna: CrystalDNA): number {
  return cat.facetsFor(cat.metric(dna)) / MAX_SLOTS;
}

export interface SpikeSpec {
  key: string;
  isCore: boolean;
  height: number;
  radiusBottom: number;
  radiusTop: number;
  posX: number;
  posZ: number;
  tiltX: number;
  tiltZ: number;
  rotY: number;
  colorA: string;
  colorB: string;
}

const CORE_COLOR_A = '#6d4fa8';
const CORE_COLOR_B = '#e9ddff';

/** Центральний стрижень («час разом») + до 6 бічних шипів навколо нього. */
export function buildSpikes(dna: CrystalDNA): SpikeSpec[] {
  const spikes: SpikeSpec[] = [];
  const [timeCat, ...restCats] = CATEGORY_DEFS;

  const timeWeight = timeCat ? categoryWeight(timeCat, dna) : 0;
  if (timeCat && timeCat.metric(dna) > 0) {
    spikes.push({
      key: 'core',
      isCore: true,
      height: 1.5 + timeWeight * 1.5,
      radiusBottom: 0.4,
      radiusTop: 0.08,
      posX: 0,
      posZ: 0,
      tiltX: 0,
      tiltZ: 0,
      rotY: 0,
      colorA: CORE_COLOR_A,
      colorB: CORE_COLOR_B,
    });
  }

  const arc = 360 / restCats.length;
  restCats.forEach((cat, i) => {
    const weight = categoryWeight(cat, dna);
    if (weight <= 0) return;

    const rng = mulberry32(i * 991 + 17);
    const angleDeg = arc * i + (rng() - 0.5) * arc * 0.5;
    const rad = (angleDeg * Math.PI) / 180;
    const dist = 0.16 + rng() * 0.07;
    const tilt = 0.22 + rng() * 0.3;

    spikes.push({
      key: cat.key,
      isCore: false,
      height: 0.5 + weight * 1.35 + rng() * 0.1,
      radiusBottom: 0.17 + weight * 0.08,
      radiusTop: 0.035,
      posX: Math.cos(rad) * dist,
      posZ: Math.sin(rad) * dist,
      tiltX: Math.sin(rad) * tilt,
      tiltZ: -Math.cos(rad) * tilt,
      rotY: rng() * Math.PI * 2,
      colorA: cat.colorA,
      colorB: cat.colorB,
    });
  });

  return spikes;
}

/** Гранований шестигранний шип із вершинним градієнтом (темніша основа → світліший вістря). */
export function buildSpikeGeometry(spec: SpikeSpec): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(spec.radiusTop, spec.radiusBottom, spec.height, 6, 1);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const colorA = new THREE.Color(spec.colorA);
  const colorB = new THREE.Color(spec.colorB);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + spec.height / 2) / spec.height;
    c.lerpColors(colorA, colorB, Math.min(1, Math.max(0, t)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.translate(0, spec.height / 2, 0); // основа шипа — у локальному y=0.
  geo.computeVertexNormals();
  return geo;
}
