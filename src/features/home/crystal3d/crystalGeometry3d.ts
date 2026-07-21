// ============================================================
// crystalGeometry3d — кластер гранованих «шипів» (як природний
// друз кристалу), що росте за стадіями (Crystal Colony).
// ------------------------------------------------------------
// Один центральний стрижень («час разом», завжди вертикальний) +
// до 6 категорій навколо — кожна категорія тепер може мати ВІД 1 ДО
// 7 дрібних шипів (не рівно один) залежно від стадії росту («Ріст» —
// по одному, «Колонія»/«Зрілий кластер»/«Нескінченний розвиток» —
// дедалі більше супутніх шипів). Кожен шип-слот (категорія, індекс)
// має ФІКСОВАНУ позицію/кут/розмір-профіль, що не залежить від
// поточної кількості видимих шипів у категорії — тому коли з'являється
// новий шип, старі не «перетасовуються» й не зсуваються.
// ============================================================
import * as THREE from 'three';
import { CATEGORY_DEFS, MAX_SLOTS, totalRichness, stageForRichness, type CrystalStage } from '../crystalGeometry';
import { mulberry32, hashSeedString } from '../mulberry32';
import type { CrystalDNA } from '../useCrystal';

export { totalRichness, stageForRichness, stageLabel, type CrystalStage } from '../crystalGeometry';

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
  /** Власна фаза й швидкість «дихання» — щоб шипи пульсували не в унісон, а органічно, хвилею. */
  breathePhase: number;
  breatheSpeed: number;
}

const CORE_COLOR_A = '#6d4fa8';
const CORE_COLOR_B = '#e9ddff';

// Скільки дрібних шипів МОЖЕ вирости в одній категорії на цій стадії.
const CAP_FOR_STAGE: Record<CrystalStage, number> = { 1: 0, 2: 1, 3: 3, 4: 5, 5: 7 };
const MAX_CAP = 7;

/**
 * Центральний стрижень («час разом») + «колонія» дрібних шипів на решту
 * категорій. seedNum — персистентна couple-«генетика» (0, якщо ще не
 * завантажена): зміщує позицію/кут кожного слота, повертає весь віночок
 * категорій і трохи нахиляє/масштабує ядро — тому дві пари з ідентичною
 * ДНК все одно ростуть у різні форми.
 */
export function buildSpikes(dna: CrystalDNA, seedNum = 0): SpikeSpec[] {
  const spikes: SpikeSpec[] = [];
  const [timeCat, ...restCats] = CATEGORY_DEFS;

  const coreRng = mulberry32(seedNum + 7);
  // «Щільність кристалу»: базово унікальна per couple (seed) + «фінанси
  // потовщують основу» — накопичені спільні заощадження додають вагу й
  // стабільність усій колонії (лог-шкала, щоб не рости необмежено).
  const financeBoost = 1 + Math.min(0.3, Math.log10(1 + dna.totalSaved) * 0.045);
  const density = (0.85 + coreRng() * 0.3) * financeBoost;
  const coreTilt = 0.03 + coreRng() * 0.05;
  const coreTiltAngle = coreRng() * Math.PI * 2;

  const timeWeight = timeCat ? categoryWeight(timeCat, dna) : 0;
  if (timeCat && timeCat.metric(dna) > 0) {
    spikes.push({
      key: 'core',
      isCore: true,
      height: (1.5 + timeWeight * 1.5) * density,
      radiusBottom: 0.4 * density,
      radiusTop: 0,
      posX: 0,
      posZ: 0,
      tiltX: Math.sin(coreTiltAngle) * coreTilt,
      tiltZ: Math.cos(coreTiltAngle) * coreTilt,
      rotY: coreRng() * Math.PI * 2,
      colorA: CORE_COLOR_A,
      colorB: CORE_COLOR_B,
      breathePhase: coreRng() * Math.PI * 2,
      breatheSpeed: 0.4 + coreRng() * 0.1,
    });
  }

  const stage = stageForRichness(totalRichness(dna));
  const cap = CAP_FOR_STAGE[stage];
  const arc = 360 / restCats.length;
  const slotArc = arc / MAX_CAP;
  const rotOffset = ((seedNum % 360) + 360) % 360;

  restCats.forEach((cat, catIdx) => {
    const weight = categoryWeight(cat, dna);
    if (weight <= 0 || cap <= 0) return;

    const count = Math.min(cap, Math.max(1, Math.round(weight * cap)));
    const arcStart = arc * catIdx + rotOffset;

    for (let i = 0; i < count; i++) {
      // Детерміновано за (seed, категорія, слот) — НЕ за count/cap, тому
      // позиція/кут/розмір слота i ніколи не змінюються, коли з'являється
      // слот i+1 (для цього ж couple-seed).
      const rng = mulberry32(seedNum + catIdx * 991 + 17 + i * 131);
      const sizeFactor = Math.max(0.35, 1 - i * 0.12);
      const angleDeg = arcStart + (i + 0.5) * slotArc + (rng() - 0.5) * slotArc * 0.4;
      const rad = (angleDeg * Math.PI) / 180;
      const dist = 0.14 + i * 0.025 + rng() * 0.03;
      const tilt = 0.2 + rng() * 0.35;

      spikes.push({
        key: `${cat.key}-${i}`,
        isCore: false,
        height: ((0.5 + weight * 1.35) * sizeFactor + rng() * 0.08) * density,
        radiusBottom: (0.17 + weight * 0.08) * sizeFactor * density,
        radiusTop: 0,
        posX: Math.cos(rad) * dist,
        posZ: Math.sin(rad) * dist,
        tiltX: Math.sin(rad) * tilt,
        tiltZ: -Math.cos(rad) * tilt,
        rotY: rng() * Math.PI * 2,
        colorA: cat.colorA,
        colorB: cat.colorB,
        breathePhase: rng() * Math.PI * 2,
        breatheSpeed: 0.5 + rng() * 0.4,
      });
    }
  });

  return spikes;
}

export interface MilestoneSpike extends SpikeSpec {
  eventId: number;
  title: string;
}

const MILESTONE_COLOR_A = '#c9971f';
const MILESTONE_COLOR_B = '#fff3c9';
/** Скільки останніх великих подій показувати окремими шпилями — щоб роками не захаращувати кристал. */
const MAX_MILESTONE_SPIKES = 6;

/**
 * Великі життєві події (заручини/весілля/переїзд тощо, events.is_milestone)
 * — на відміну від решти категорій, кожна така подія росте ВЛАСНИМ окремим
 * золотим шпилем, що стирчить далі від центру за звичайну колонію. Позиція
 * детермінована за (seed, event.id) — не за порядковим індексом, тому стара
 * подія не зсувається, коли з'являється нова.
 */
export function buildMilestoneSpikes(
  milestones: ReadonlyArray<{ id: number; title: string }>,
  seedNum = 0,
): MilestoneSpike[] {
  return milestones.slice(-MAX_MILESTONE_SPIKES).map((m) => {
    const rng = mulberry32(seedNum + 7789 + m.id * 97);
    const angleDeg = rng() * 360;
    const rad = (angleDeg * Math.PI) / 180;
    const dist = 0.5 + rng() * 0.18;
    const tilt = 0.32 + rng() * 0.28;

    return {
      key: `milestone-${m.id}`,
      eventId: m.id,
      title: m.title,
      isCore: false,
      height: 1.15 + rng() * 0.45,
      radiusBottom: 0.2 + rng() * 0.06,
      radiusTop: 0,
      posX: Math.cos(rad) * dist,
      posZ: Math.sin(rad) * dist,
      tiltX: Math.sin(rad) * tilt,
      tiltZ: -Math.cos(rad) * tilt,
      rotY: rng() * Math.PI * 2,
      colorA: MILESTONE_COLOR_A,
      colorB: MILESTONE_COLOR_B,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.3 + rng() * 0.15,
    };
  });
}

/**
 * Природна анатомія кристала: пряма гранована призма (стовбур) знизу, що
 * переходить у гранену пірамідальну верхівку — так насправді росте кварц/
 * діамант «у сирому вигляді», а не рівномірно звужений конус зі зрізаною
 * маківкою (стара CylinderGeometry-версія). LatheGeometry обертає профіль
 * (радіус, y) навколо осі Y — segments={5..7} дає гранований, не круглий,
 * переріз; вершини НЕ шаряться між гранями (як і в старій версії), тому
 * computeVertexNormals() дає тверді, «скляні» ребра, а не згладжену трубу.
 * shapeRng деталі (кількість граней, де починається вістря, лінія стовбура)
 * бере зі spec.key — стабільно для цього шипа, незалежно від DNA/seed
 * офсетів, які вже витрачені на позицію/нахил/дихання.
 */
export function buildSpikeGeometry(spec: SpikeSpec): THREE.BufferGeometry {
  const shapeRng = mulberry32(hashSeedString(spec.key));
  const segments = 5 + Math.floor(shapeRng() * 3); // 5–7 граней — не завжди ідеальний шестигранник
  const pointStart = 0.52 + shapeRng() * 0.22; // де стовбур закінчується і починається гранена верхівка
  const r = spec.radiusBottom;
  const h = spec.height;

  const profile = [
    new THREE.Vector2(Math.max(0.001, r * (0.88 + shapeRng() * 0.1)), 0),
    new THREE.Vector2(r, h * (0.08 + shapeRng() * 0.05)), // ледь помітне «плече» стовбура
    new THREE.Vector2(r * (0.94 + shapeRng() * 0.06), h * pointStart), // верх прямого стовбура
    new THREE.Vector2(Math.max(0, spec.radiusTop), h), // гранена верхівка (майже вістря)
  ];

  const geo = new THREE.LatheGeometry(profile, segments);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const colorA = new THREE.Color(spec.colorA);
  const colorB = new THREE.Color(spec.colorB);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h;
    c.lerpColors(colorA, colorB, Math.min(1, Math.max(0, t)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
