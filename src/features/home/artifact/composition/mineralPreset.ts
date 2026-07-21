// ============================================================
// Mineral Preset — кристалічна конфігурація Composition Framework.
// ------------------------------------------------------------
// Єдине місце, де генеричний framework «дізнається» про мінерал:
//   • бібліотека силуетів музейних зразків (вежа/стріла/каскад/...);
//   • бібліотека кристалічних архетипів (Stage 4) з вагами від ознак;
//   • мапінг DepositedCrystal ↔ CompositionBody: kind/domain розв'язуються
//     ТУТ у decorative/shielded — framework ніколи не читає предметні поля;
//   • поле напруги — ін'єктується surfaceStress (той самий шум, що керував
//     відкладенням: «історія напруги» тіла).
// Майбутній Coral/Ice/Tree-модуль — це інший такий файл поруч.
// ============================================================
import { mulberry32, hashSeedString } from '../../mulberry32';
import { surfaceStress } from '../growthField';
import type { CrystalArchetype, DepositedCrystal } from '../artifactTypes';
import {
  composeSpecimen,
  type ArchetypeDef,
  type CompositionBody,
  type CompositionConfig,
  type ComposedBody,
  type SilhouettePreset,
} from './framework';
import type { CompositionScore } from './score';

// ── Силуети (Stage 3): читабельні навіть як чорна тінь ───────────
// envelope(alignment 0..1, horiz, y) → цільовий множник довжини ~0.7..1.15.

const SILHOUETTES: SilhouettePreset[] = [
  {
    // Вежа: одна домінантна вертикаль, все інше — п'єдестал.
    id: 'tower',
    supportAxes: [
      { azimuthOffset: 0, tilt: 0.3 },
      { azimuthOffset: Math.PI, tilt: 0.35 },
    ],
    envelope: (a, horiz) => 0.78 + a * 0.32 - Math.min(0.12, horiz * 0.12),
  },
  {
    // Стріла: домінанта + два «пера» під нею з одного боку.
    id: 'arrow',
    supportAxes: [
      { azimuthOffset: -0.55, tilt: 0.55 },
      { azimuthOffset: 0.55, tilt: 0.55 },
    ],
    envelope: (a) => 0.8 + a * 0.3,
  },
  {
    // Діамант: маса найширша в середині висоти, звужується догори й донизу.
    id: 'diamond',
    supportAxes: [
      { azimuthOffset: 0, tilt: 0.65 },
      { azimuthOffset: (Math.PI * 2) / 3, tilt: 0.65 },
      { azimuthOffset: (Math.PI * 4) / 3, tilt: 0.65 },
    ],
    envelope: (a, _h, y) => (0.82 + a * 0.2) * (1 - Math.min(0.18, Math.abs(y - 0.15) * 0.35)),
  },
  {
    // Каскад: висоти «сходинками» спадають в один seed-бік.
    id: 'cascade',
    supportAxes: [
      { azimuthOffset: 0.5, tilt: 0.45 },
      { azimuthOffset: 1.0, tilt: 0.7 },
      { azimuthOffset: 1.5, tilt: 0.95 },
    ],
    envelope: (a, horiz) => 0.75 + a * 0.35 - Math.min(0.1, horiz * 0.08),
  },
  {
    // Собор: центральний шпиль і два фланкуючі, майже вертикальні.
    id: 'cathedral',
    supportAxes: [
      { azimuthOffset: -1.35, tilt: 0.28 },
      { azimuthOffset: 1.35, tilt: 0.28 },
    ],
    envelope: (a) => 0.76 + a * 0.36,
  },
  {
    // Друза: багато коротких, король лише трохи вищий — щільний «їжачок».
    id: 'druse',
    supportAxes: [
      { azimuthOffset: 0, tilt: 0.5 },
      { azimuthOffset: (Math.PI * 2) / 5, tilt: 0.5 },
      { azimuthOffset: (Math.PI * 4) / 5, tilt: 0.5 },
      { azimuthOffset: (Math.PI * 6) / 5, tilt: 0.5 },
      { azimuthOffset: (Math.PI * 8) / 5, tilt: 0.5 },
    ],
    envelope: (a) => 0.72 + a * 0.18,
  },
];

// ── Архетипи (Stage 4): вік/розмір/енергія/напруга/seed — ніколи випадково ──

const ramp = (v: number, from: number, to: number): number => Math.max(0, Math.min(1, (v - from) / (to - from)));

const ARCHETYPES: ArchetypeDef[] = [
  { id: 'spear', weight: () => 0.32 }, // базовий — перемагає, лише коли ніщо інше не виражене
  { id: 'massive', weight: (f) => ramp(f.volume, 0.02, 0.12) * ramp(f.age, 0.5, 1) * 0.9, lengthMul: 0.78, radiusMul: 1.35 },
  { id: 'prismatic', weight: (f) => ramp(f.age, 0.6, 1) * ramp(f.energy, 0.6, 1) * 0.75, lengthMul: 0.95, radiusMul: 1.1 },
  { id: 'needle', weight: (f) => (1 - ramp(f.volume, 0.002, 0.02)) * (1 - ramp(f.energy, 0.4, 0.9)) * 0.7, lengthMul: 1.3, radiusMul: 0.6 },
  { id: 'stub', weight: (f) => (1 - ramp(f.age, 0.2, 0.7)) * (1 - ramp(f.energy, 0.3, 0.8)) * 0.6, lengthMul: 0.5, radiusMul: 1.15 },
  { id: 'broken', weight: (f) => ramp(f.stress, 1.1, 1.7) * ramp(f.age, 0.3, 0.8) * 0.65, lengthMul: 0.72 },
  { id: 'twin', weight: (f) => f.rnd * ramp(f.volume, 0.008, 0.05) * 0.75, companions: { suffix: 't', count: 1, lengthMul: 0.6, radiusMul: 0.7, angleSpread: 0.25 } },
  { id: 'blade', weight: (f) => ramp(f.stress, 0.9, 1.5) * f.rnd * 0.6, radiusMul: 1.15 },
  { id: 'tabular', weight: (f) => ramp(f.age, 0.7, 1) * ramp(f.volume, 0.01, 0.06) * (1 - f.rnd) * 0.55, lengthMul: 0.6, radiusMul: 1.3 },
  { id: 'fan', weight: (f) => f.rnd * ramp(f.energy, 0.6, 1) * 0.55, companions: { suffix: 'f', count: 2, lengthMul: 0.7, radiusMul: 0.6, angleSpread: 0.5 } },
  { id: 'split', weight: (f) => ramp(f.stress, 1.2, 1.8) * f.rnd * 0.5, companions: { suffix: 's', count: 1, lengthMul: 0.85, radiusMul: 0.8, angleSpread: 0.12 } },
  { id: 'intergrown', weight: (f) => ramp(f.stress, 1.0, 1.6) * ramp(f.volume, 0.005, 0.04) * 0.45, extraSink: 0.12 },
  { id: 'etched', weight: (f) => ramp(f.age, 0.75, 1) * ramp(f.stress, 1.0, 1.5) * 0.4 },
];

// ── Мапінг предметних полів у генеричні прапорці ─────────────────

/** Декоративні тіла (можна ховати/видаляти): супутники колоній, амбіентний
 *  baseline-трикл і все «виточене» композитором. Тіла, що представляють
 *  реальні дані пари (країни/віхи/бажання/...), — ніколи. */
const isDecorative = (c: DepositedCrystal): boolean =>
  c.role !== 'dominant' || c.key.startsWith('baseline-') || c.key.includes('~');

const toBody = (c: DepositedCrystal): CompositionBody => ({
  key: c.key,
  anchor: c.renderedAnchor,
  direction: c.direction,
  length: c.length,
  radius: c.radius,
  age: c.maturity,
  energy: c.growthEnergy,
  primary: c.primary,
  decorative: isDecorative(c),
  shielded: c.emphasized === true, // золоті віхи — недоторканні
  colonyId: c.colonyId,
  role: c.role,
});

/** Ліміт тіл усього зразка (перф мобільних GPU). */
const TOTAL_BODY_CAP = 120;

function mineralConfig(seedNum: number, compactnessBias: number): CompositionConfig {
  return {
    silhouettes: SILHOUETTES,
    silhouetteBias: compactnessBias,
    archetypes: ARCHETYPES,
    kingArchetypes: ['massive', 'prismatic'],
    micro: { minParentVolume: 0.02, maxPerParent: 3, globalCap: 30, lengthRange: [0.05, 0.16], radiusRange: [0.02, 0.045] },
    sectors: { count: 8, maxSmallPerSector: 4 },
    scoreThreshold: 0.62,
    stress: (p) => surfaceStress(seedNum, p),
  };
}

export interface MineralComposition {
  crystals: DepositedCrystal[];
  score: CompositionScore;
  passes: number;
}

/** Синтез DepositedCrystal для тіл, «виточених» композитором (компаньйони,
 *  мікрошар): предметні поля успадковуються від батька, дихання — keyed. */
function synthesizeCrystal(body: ComposedBody, parent: DepositedCrystal, seedNum: number): DepositedCrystal {
  const rng = mulberry32(seedNum + hashSeedString(`composed:${body.key}`));
  return {
    ...parent,
    key: body.key,
    anchor: body.anchor,
    renderedAnchor: body.anchor,
    direction: body.direction,
    length: body.length,
    radius: body.radius,
    growthEnergy: body.energy,
    role: body.role === 'micro' ? 'micro' : 'satellite',
    primary: false,
    tier: body.tier,
    archetype: body.archetype as CrystalArchetype,
    breathePhase: rng() * Math.PI * 2,
    breatheSpeed: 0.35 + rng() * 0.3,
    spin: rng() * Math.PI * 2,
  };
}

/**
 * Головний вхід предметного шару: компонує вже відкладену мінеральну масу.
 * Growth Engine недоторканний — це суто пост-обробка його результату.
 */
export function composeMineralCluster(
  crystals: readonly DepositedCrystal[],
  seedNum: number,
  compactnessBias: number,
): MineralComposition {
  if (crystals.length === 0) {
    return { crystals: [], score: { hierarchy: 0, flow: 0, silhouette: 0, density: 0, balance: 0, rhythm: 0, negativeSpace: 0, realism: 0, total: 0 }, passes: 1 };
  }
  const byKey = new Map(crystals.map((c) => [c.key, c]));
  const { bodies, score, passes } = composeSpecimen(crystals.map(toBody), seedNum, mineralConfig(seedNum, compactnessBias));

  let composed: DepositedCrystal[] = bodies.map((body) => {
    const source = byKey.get(body.key);
    if (source) {
      return {
        ...source,
        renderedAnchor: body.anchor,
        direction: body.direction,
        length: body.length,
        radius: body.radius,
        tier: body.tier,
        archetype: body.archetype as CrystalArchetype,
      };
    }
    const parent = byKey.get(body.parentKey ?? '') ?? crystals[0]!;
    return synthesizeCrystal(body, parent, seedNum);
  });

  // Перф-стеля: зайве зрізається з найдрібніших декоративних (детерміновано);
  // каскадом ховаються й «виточені» з викинутого тіла (`X~...` від X).
  if (composed.length > TOTAL_BODY_CAP) {
    const sorted = [...composed].sort(
      (a, b) => a.radius * a.radius * a.length - b.radius * b.radius * b.length || a.key.localeCompare(b.key),
    );
    const toDrop = new Set<string>();
    for (const c of sorted) {
      if (composed.length - toDrop.size <= TOTAL_BODY_CAP) break;
      if (isDecorative(c) && c.emphasized !== true) toDrop.add(c.key);
    }
    let cascaded = true;
    while (cascaded) {
      cascaded = false;
      for (const c of composed) {
        const parentKey = c.key.includes('~') ? c.key.slice(0, c.key.lastIndexOf('~')) : null;
        if (parentKey !== null && toDrop.has(parentKey) && !toDrop.has(c.key)) {
          toDrop.add(c.key);
          cascaded = true;
        }
      }
    }
    composed = composed.filter((c) => !toDrop.has(c.key));
  }

  return { crystals: composed, score, passes };
}
