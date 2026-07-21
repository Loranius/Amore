// ============================================================
// Composition Framework — генеричний детермінований композиційний рушій.
// ------------------------------------------------------------
// «Growth створює геологію. Composition створює красу.»
//
// Рушій НЕ вирощує тіла (крім фінального мікро-шару «пилу») і НЕ знає, що
// компонує: мінерал, корал, лід чи скелет маскота. Він працює ВИКЛЮЧНО з
// геометрією, ієрархією та напрямками росту (Stage 12 — жодних матеріалів,
// кольорів, прозорості; жодних THREE/React). Все предметне — бібліотека
// силуетів, бібліотека архетипів, пороги — приходить через CompositionConfig
// (див. mineralPreset.ts); майбутній Coral/Ice/Tree-модуль підмінює лише
// конфіг.
//
// Конвеєр (кожен прохід розв'язує одну візуальну проблему):
//   1. Hierarchy   — king / support / family / micro (tier).
//   2. Silhouette  — один впізнаваний силует (вежа/стріла/каскад/...),
//                    читабельний навіть як чорна тінь.
//   3. Archetypes  — бібліотека форм замість «усі — списи»; вибір ЛИШЕ з
//                    ознак (вік, розмір, енергія, напруга, seed) — ніколи
//                    випадково.
//   4. Age         — старші: товщі/пряміші/глибші; молодші: криві/тонші.
//   5. Competition — з двох великих, що ростуть назустріч, ПОСТУПАЄТЬСЯ
//                    МОЛОДШИЙ (гнеться/коротшає/ламається). Старші тіла не
//                    змінюються ніколи — це і зберігає append-only.
//   6. Mass        — важкий стиснутий центр: глибше поховання, більше
//                    спільного об'єму, жодних «плаваючих» тіл.
//   7. Colony      — піраміда колонії: 1 домінант → 2 середні → дрібні.
//   8. Density     — контраст щільного й порожнього (seeded-сектори),
//                    жодної рівномірної радіальної сітки.
//   9. Micro layer — мікродруза/голочки біля основ великих тіл — «продає»
//                    масштаб.
//  10. Score       — самооцінка (ієрархія/потік/силует/щільність/баланс/
//                    ритм/повітря/реалізм); нижче порога → ОДИН повторний
//                    прохід сильнішими параметрами. Максимум два проходи.
//
// ДЕТЕРМІНІЗМ І СТАБІЛЬНІСТЬ:
//   • кожен прохід — чиста функція від ОРИГІНАЛЬНИХ значень тіла +
//     фіксованих seed-осей (ніколи від data-залежних рангів), тож повторний
//     прохід не «накопичує» ефект, а перераховує його з нуля (ідемпотентна
//     форма) — і додавання нових даних не зрушує старі тіла;
//   • «поступається молодший» у конкуренції; поріг участі — абсолютний
//     об'єм, не топ-N (членство не залежить від сусідів);
//   • видалення (burial) дозволене лише decorative-тілам; shielded-тіла
//     недоторканні завжди;
//   • нові тіла (компаньйони архетипів, мікрошар) мають стабільні ключі
//     `PARENT~t/~f/~m` і параметри з keyed-потоків.
// ============================================================
import { mulberry32, hashSeedString } from '../../mulberry32';
import { type Vec3, add, scale, normalize, lerpVec, dot, v3, perpendicularBasis } from '../vec3';
import { scoreComposition, type CompositionScore } from './score';

export type CompositionTier = 'king' | 'support' | 'family' | 'micro';
export type CompositionRole = 'dominant' | 'satellite' | 'micro';

/** Генеричне тіло: звужений конус (frustum) із основою, віссю і розмірами. */
export interface CompositionBody {
  key: string;
  anchor: Vec3;
  /** Одинична вісь росту. */
  direction: Vec3;
  length: number;
  radius: number;
  /** 0..1 — нормалізований геологічний вік. */
  age: number;
  /** 0..1 — енергія росту (після конкуренції росту). */
  energy: number;
  /** Король композиції (рівно один). */
  primary: boolean;
  /** Декоративне тіло — можна ховати/видаляти. */
  decorative: boolean;
  /** Недоторканне тіло — жодних модифікацій і видалень. */
  shielded: boolean;
  colonyId: string;
  role: CompositionRole;
}

export interface ComposedBody extends CompositionBody {
  tier: CompositionTier;
  archetype: string;
  /** Ключ тіла, на якому було «виточене» нове тіло (компаньйон/мікро). */
  parentKey?: string;
}

export interface ArchetypeFeatures {
  age: number;
  volume: number;
  energy: number;
  stress: number;
  /** 0..1 keyed-тайбрейк — детермінований, але «особистий» для тіла. */
  rnd: number;
}

export interface CompanionSpec {
  suffix: string;
  count: number;
  lengthMul: number;
  radiusMul: number;
  /** Кут віяла навколо осі батька, радіани. */
  angleSpread: number;
}

export interface ArchetypeDef {
  id: string;
  /** Вага з ознак; 0 = заборонено. Ніколи не випадково — rnd лише тайбрейк. */
  weight: (f: ArchetypeFeatures) => number;
  lengthMul?: number;
  radiusMul?: number;
  companions?: CompanionSpec;
  /** Додаткове занурення в частках довжини (intergrown-типи). */
  extraSink?: number;
}

export interface SilhouettePreset {
  id: string;
  /** Опорні осі понад віссю короля: {азимут відносно seed-бази, нахил від вертикалі}. */
  supportAxes: { azimuthOffset: number; tilt: number }[];
  /**
   * Цільовий множник довжини тіла: alignment — вирівняність із найближчою
   * опорною віссю (0..1), horiz — горизонтальна відстань від осі композиції,
   * y — висота основи. Повертає ~0.7..1.15.
   */
  envelope: (alignment: number, horiz: number, y: number) => number;
}

export interface MicroLayerConfig {
  minParentVolume: number;
  maxPerParent: number;
  globalCap: number;
  lengthRange: [number, number];
  radiusRange: [number, number];
}

export interface CompositionConfig {
  silhouettes: SilhouettePreset[];
  /** 0..1 — зміщує вибір силуету (напр. compactnessBias ДНК). */
  silhouetteBias: number;
  archetypes: ArchetypeDef[];
  /** Дозволені архетипи короля. */
  kingArchetypes: string[];
  micro: MicroLayerConfig;
  sectors: { count: number; maxSmallPerSector: number };
  scoreThreshold: number;
  /** Ін'єкція поля напруги предметного шару (для мінералу — surfaceStress). */
  stress: (p: Vec3) => number;
}

export interface CompositionResult {
  bodies: ComposedBody[];
  score: CompositionScore;
  /** Скільки проходів знадобилось (1 або 2). */
  passes: number;
}

const volumeOf = (b: { radius: number; length: number }): number => b.radius * b.radius * b.length;

/** Радіус тіла-frustum'а на частці довжини t — та сама модель, що в growthSurface. */
const bodyRadiusAt = (radius: number, t: number): number => radius * (1 - 0.7 * Math.max(0, Math.min(1, t)));

/** nlerp-«слерп» для малих кутів: досить точний і повністю детермінований. */
const bendToward = (dir: Vec3, target: Vec3, amount: number): Vec3 =>
  normalize(lerpVec(dir, target, amount));

const keyedRng = (seedNum: number, tag: string): (() => number) => mulberry32(seedNum + hashSeedString(tag));

// ── Прохід 1: ієрархія ───────────────────────────────────────────
function assignTiers(bodies: ComposedBody[]): void {
  const dominants = bodies
    .filter((b) => b.role === 'dominant' && !b.primary)
    .sort((a, b) => volumeOf(b) - volumeOf(a) || a.key.localeCompare(b.key));
  const supports = new Set(dominants.slice(0, 2).map((b) => b.key));
  for (const b of bodies) {
    b.tier = b.primary ? 'king' : b.role === 'micro' ? 'micro' : supports.has(b.key) ? 'support' : 'family';
  }
}

// ── Прохід 2: силует ─────────────────────────────────────────────
interface SilhouetteFrame {
  axes: Vec3[];
  preset: SilhouettePreset;
}

function buildSilhouetteFrame(seedNum: number, config: CompositionConfig, king: ComposedBody | null): SilhouetteFrame {
  const rng = keyedRng(seedNum, 'silhouette');
  const pickDraw = rng();
  const baseAzimuth = rng() * Math.PI * 2;
  // Зміщення вибору конфігом (compactness тягне до перших, «тісних» пресетів).
  const idx = Math.min(
    config.silhouettes.length - 1,
    Math.floor(((pickDraw + config.silhouetteBias) / 2) * config.silhouettes.length),
  );
  const preset = config.silhouettes[idx]!;
  const kingAxis = king ? king.direction : v3(0, 1, 0);
  const axes = [kingAxis];
  for (const { azimuthOffset, tilt } of preset.supportAxes) {
    const az = baseAzimuth + azimuthOffset;
    axes.push(normalize(v3(Math.cos(az) * Math.sin(tilt), Math.cos(tilt), Math.sin(az) * Math.sin(tilt))));
  }
  return { axes, preset };
}

function silhouettePass(bodies: ComposedBody[], original: Map<string, CompositionBody>, frame: SilhouetteFrame, strength: number): void {
  for (const b of bodies) {
    if (b.primary || b.shielded || b.role === 'micro') continue;
    const base = original.get(b.key)!;
    let bestAxis = frame.axes[0]!;
    let bestDot = -2;
    for (const axis of frame.axes) {
      const d = dot(base.direction, axis);
      if (d > bestDot) {
        bestDot = d;
        bestAxis = axis;
      }
    }
    const alignment = Math.max(0, bestDot);
    // Далеко від усіх осей → гнемо до найближчої (сильніше в другому проході).
    const bend = (1 - alignment) * 0.3 * strength;
    b.direction = bendToward(base.direction, bestAxis, Math.min(0.45, bend));
    const horiz = Math.hypot(base.anchor.x, base.anchor.z);
    const target = frame.preset.envelope(alignment, horiz, base.anchor.y);
    // Ідемпотентно: множник застосовується до ОРИГІНАЛЬНОЇ довжини. Стеля
    // 1.1 — нижча за монарший запас висоти (÷0.9), тож король лишається
    // найвищим після будь-якої композиції.
    b.length = base.length * Math.max(0.7, Math.min(1.1, 1 + (target - 1) * strength));
  }
}

// ── Прохід 3: архетипи ───────────────────────────────────────────
function archetypePass(bodies: ComposedBody[], original: Map<string, CompositionBody>, seedNum: number, config: CompositionConfig): ComposedBody[] {
  const spawned: ComposedBody[] = [];
  for (const b of bodies) {
    if (b.role === 'micro') continue;
    const base = original.get(b.key)!;
    const features: ArchetypeFeatures = {
      age: b.age,
      volume: volumeOf(base),
      energy: b.energy,
      stress: config.stress(base.anchor),
      rnd: keyedRng(seedNum, `archetype:${b.key}`)(),
    };
    const allowed = b.primary ? config.archetypes.filter((a) => config.kingArchetypes.includes(a.id)) : config.archetypes;
    let best = allowed[0]!;
    let bestW = -1;
    for (const def of allowed) {
      const w = def.weight(features);
      if (w > bestW) {
        bestW = w;
        best = def;
      }
    }
    b.archetype = best.id;
    // Король ніколи не втрачає висоту від власного архетипу — лише набирає
    // масу: домінанта силуету недоторканна.
    if (best.lengthMul !== undefined && !b.primary) b.length *= best.lengthMul;
    if (best.radiusMul !== undefined) b.radius = base.radius * best.radiusMul;
    if (best.extraSink !== undefined) b.anchor = add(b.anchor, scale(b.direction, -best.extraSink * b.length));

    // Компаньйони архетипу (twin/fan/split) — «виточені» з того самого тіла.
    if (best.companions && !b.shielded) {
      const spec = best.companions;
      const crng = keyedRng(seedNum, `companion:${b.key}`);
      const [u, w] = perpendicularBasis(b.direction);
      for (let i = 0; i < spec.count; i++) {
        const az = crng() * Math.PI * 2;
        const tiltAmt = spec.angleSpread * (0.5 + crng() * 0.5);
        const side = add(scale(u, Math.cos(az)), scale(w, Math.sin(az)));
        spawned.push({
          ...b,
          key: `${b.key}~${spec.suffix}${i}`,
          parentKey: b.key,
          anchor: add(add(b.anchor, scale(side, b.radius * 0.55)), scale(b.direction, b.length * 0.06)),
          direction: bendToward(b.direction, side, tiltAmt),
          length: b.length * spec.lengthMul * (0.85 + crng() * 0.3),
          radius: b.radius * spec.radiusMul,
          primary: false,
          decorative: true,
          shielded: false,
          role: 'satellite',
          tier: b.tier === 'king' ? 'support' : 'family',
          archetype: 'spear',
        });
      }
    }
  }
  return spawned;
}

// ── Прохід 4: геологічний вік ────────────────────────────────────
function agePass(bodies: ComposedBody[], seedNum: number): void {
  for (const b of bodies) {
    if (b.shielded || b.role === 'micro') continue;
    // Старші — товщі й глибше вкорінені; молодші — криві.
    b.radius *= 1 + 0.15 * b.age;
    b.anchor = add(b.anchor, scale(b.direction, -0.04 * b.length * b.age));
    if (b.age < 0.75 && !b.primary) {
      // Легка «кривизна молодості» — делікатна, щоб не ламати вертикальну
      // друзу референсу (молоді ледь похилені, не лежачі).
      const crookRng = keyedRng(seedNum, `crook:${b.key}`);
      const [u, w] = perpendicularBasis(b.direction);
      const az = crookRng() * Math.PI * 2;
      const side = add(scale(u, Math.cos(az)), scale(w, Math.sin(az)));
      b.direction = bendToward(b.direction, side, 0.1 * (1 - b.age) * (0.5 + crookRng() * 0.5));
    }
  }
}

// ── Прохід 5: конкуренція ────────────────────────────────────────
const MIN_COMPETITOR_VOLUME = 0.012;

function competitionPass(bodies: ComposedBody[], strength: number): void {
  // Абсолютний поріг об'єму (НЕ топ-N): участь тіла не залежить від сусідів.
  const large = bodies
    .filter((b) => !b.shielded && b.role !== 'micro' && volumeOf(b) > MIN_COMPETITOR_VOLUME)
    .sort((a, b) => a.key.localeCompare(b.key));
  for (let i = 0; i < large.length; i++) {
    for (let j = i + 1; j < large.length; j++) {
      const a = large[i]!;
      const b = large[j]!;
      const dx = a.anchor.x - b.anchor.x;
      const dy = a.anchor.y - b.anchor.y;
      const dz = a.anchor.z - b.anchor.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      // У вертикальній друзі паралельність — норма, тож конкуренцію вмикає
      // лише ТІСНЕ сусідство двох великих майже-паралельних тіл.
      if (distSq > 0.05 || dot(a.direction, b.direction) < 0.9) continue;
      // Поступається МОЛОДШИЙ (старші тіла не змінюються ніколи — append-only);
      // король не поступається нікому.
      let loser = a.age < b.age ? a : b.age < a.age ? b : a.key > b.key ? a : b;
      if (loser.primary) loser = loser === a ? b : a;
      if (loser.primary) continue;
      const winner = loser === a ? b : a;
      loser.length *= strength > 1 ? 0.68 : 0.76; // сильніший другий прохід
      loser.direction = normalize(add(loser.direction, scale(winner.direction, -0.18)));
      if (distSq < 0.02) loser.archetype = loser.length > loser.radius * 6 ? 'broken' : 'stub';
    }
  }
}

// ── Прохід 6: геологічна маса ────────────────────────────────────
function massPass(bodies: ComposedBody[], original: Map<string, CompositionBody>): void {
  for (const b of bodies) {
    if (b.shielded || b.role === 'micro') continue;
    const base = original.get(b.key);
    const refAnchor = base ? base.anchor : b.anchor;
    const horiz = Math.hypot(refAnchor.x, refAnchor.z);
    if (horiz < 0.5) {
      // Центр — важкий: глибше занурення, більше спільного об'єму.
      b.anchor = add(b.anchor, scale(b.direction, -0.06 * b.length));
      b.radius *= 1.12;
    }
    if (volumeOf(b) < 0.004 && horiz > 0.2) {
      // Дрібнота підтягується до осі — жодних самотніх «плавців».
      b.anchor = v3(b.anchor.x * 0.88, b.anchor.y, b.anchor.z * 0.88);
    }
  }
}

// ── Прохід 7: піраміда колоній ───────────────────────────────────
function colonyPass(bodies: ComposedBody[]): void {
  const dominants = new Map<string, ComposedBody>();
  for (const b of bodies) if (b.role === 'dominant') dominants.set(b.colonyId, b);
  const satRank = new Map<string, number>();
  for (const b of bodies) {
    if (b.role !== 'satellite' || b.parentKey !== undefined) continue;
    const dom = dominants.get(b.colonyId);
    if (!dom) continue;
    const rank = satRank.get(b.colonyId) ?? 0;
    satRank.set(b.colonyId, rank + 1);
    // 1 домінант → 2 середні → дрібні (як справжня друза).
    const lengthFactor = [0.5, 0.34, 0.22][Math.min(rank, 2)]!;
    const radiusFactor = [0.55, 0.42, 0.32][Math.min(rank, 2)]!;
    b.length = dom.length * lengthFactor;
    b.radius = dom.radius * radiusFactor;
    b.anchor = lerpVec(b.anchor, dom.anchor, 0.3);
  }
}

// ── Прохід 8: оптимізатор щільності ──────────────────────────────
function densityPass(bodies: ComposedBody[], seedNum: number, config: CompositionConfig, strength: number): Set<string> {
  const rng = keyedRng(seedNum, 'sectors');
  const { count, maxSmallPerSector } = config.sectors;
  // Seeded-багатство секторів: щільне й порожнє мають бути КОНТРАСТНІ.
  const richness = Array.from({ length: count }, () => rng());
  const sectorOf = (b: ComposedBody): number => {
    const az = Math.atan2(b.anchor.z, b.anchor.x) + Math.PI;
    return Math.min(count - 1, Math.floor((az / (Math.PI * 2)) * count));
  };
  const removed = new Set<string>();
  const perSector = new Map<number, ComposedBody[]>();
  for (const b of bodies) {
    if (!b.decorative || b.shielded) continue;
    const s = sectorOf(b);
    if (!perSector.has(s)) perSector.set(s, []);
    perSector.get(s)!.push(b);
  }
  for (const [s, list] of perSector) {
    const allowance = Math.max(1, Math.round(maxSmallPerSector * (0.5 + richness[s]!) * (2 - strength)));
    if (list.length <= allowance) continue;
    const surplus = list
      .sort((a, b) => volumeOf(a) - volumeOf(b) || a.key.localeCompare(b.key))
      .slice(0, list.length - allowance);
    for (const b of surplus) removed.add(b.key);
  }
  return removed;
}

/** Багатство сектора — читається і мікрошаром: бідні сектори лишаються порожніми. */
function sectorRichness(seedNum: number, config: CompositionConfig): number[] {
  const rng = keyedRng(seedNum, 'sectors');
  return Array.from({ length: config.sectors.count }, () => rng());
}

// ── Прохід 9: мікрошар ───────────────────────────────────────────
function microPass(bodies: ComposedBody[], seedNum: number, config: CompositionConfig): ComposedBody[] {
  const richness = sectorRichness(seedNum, config);
  const sectorCount = config.sectors.count;
  const parents = bodies
    .filter((b) => b.role === 'dominant' && volumeOf(b) > config.micro.minParentVolume)
    .sort((a, b) => volumeOf(b) - volumeOf(a) || a.key.localeCompare(b.key));
  const micro: ComposedBody[] = [];
  for (const parent of parents) {
    if (micro.length >= config.micro.globalCap) break;
    const az = Math.atan2(parent.anchor.z, parent.anchor.x) + Math.PI;
    const sector = Math.min(sectorCount - 1, Math.floor((az / (Math.PI * 2)) * sectorCount));
    if (richness[sector]! < 0.35) continue; // бідний сектор — лишаємо повітря
    const mrng = keyedRng(seedNum, `micro:${parent.key}`);
    const n = 1 + Math.floor(mrng() * config.micro.maxPerParent);
    const [u, w] = perpendicularBasis(parent.direction);
    for (let i = 0; i < n && micro.length < config.micro.globalCap; i++) {
      // Строго біля основи батька — мікродруза «обліплює» підніжжя.
      const t = 0.03 + mrng() * 0.12;
      const angle = mrng() * Math.PI * 2;
      const side = add(scale(u, Math.cos(angle)), scale(w, Math.sin(angle)));
      const surface = add(add(parent.anchor, scale(parent.direction, t * parent.length)), scale(side, bodyRadiusAt(parent.radius, t)));
      const [lenMin, lenMax] = config.micro.lengthRange;
      const [radMin, radMax] = config.micro.radiusRange;
      const radius = radMin + mrng() * (radMax - radMin);
      // Мікро завжди відчутно менше за батька — навіть якщо той сам крихітний.
      const length = Math.min(lenMin + mrng() * (lenMax - lenMin), parent.length * 0.55);
      micro.push({
        key: `${parent.key}~m${i}`,
        parentKey: parent.key,
        anchor: add(surface, scale(side, -radius * 0.6)),
        direction: bendToward(parent.direction, side, 0.35 + mrng() * 0.4),
        length,
        radius,
        age: parent.age,
        energy: parent.energy,
        primary: false,
        decorative: true,
        shielded: false,
        colonyId: parent.colonyId,
        role: 'micro',
        tier: 'micro',
        archetype: mrng() < 0.35 ? 'needle' : 'spear',
      });
    }
  }
  return micro;
}

// ── Конвеєр ──────────────────────────────────────────────────────

function runPipeline(input: readonly CompositionBody[], seedNum: number, config: CompositionConfig, strength: number): ComposedBody[] {
  // Робочі копії; всі проходи «ідемпотентної форми» читають original.
  const original = new Map<string, CompositionBody>(input.map((b) => [b.key, { ...b, anchor: { ...b.anchor }, direction: { ...b.direction } }]));
  let bodies: ComposedBody[] = input.map((b) => ({ ...b, anchor: { ...b.anchor }, direction: { ...b.direction }, tier: 'family' as CompositionTier, archetype: 'spear' }));

  assignTiers(bodies);
  const king = bodies.find((b) => b.primary) ?? null;
  const frame = buildSilhouetteFrame(seedNum, config, king);
  silhouettePass(bodies, original, frame, strength);
  const companions = archetypePass(bodies, original, seedNum, config);
  bodies = bodies.concat(companions);
  agePass(bodies, seedNum);
  competitionPass(bodies, strength);
  massPass(bodies, original);
  colonyPass(bodies);
  const removed = densityPass(bodies, seedNum, config, strength);
  // Каскад поховання: тіло, «виточене» з похованого (компаньйон/мікро),
  // ховається разом із батьком — жодних осиротілих плавунів.
  let cascaded = true;
  while (cascaded) {
    cascaded = false;
    for (const b of bodies) {
      if (b.parentKey !== undefined && removed.has(b.parentKey) && !removed.has(b.key)) {
        removed.add(b.key);
        cascaded = true;
      }
    }
  }
  bodies = bodies.filter((b) => !removed.has(b.key));
  bodies = bodies.concat(microPass(bodies, seedNum, config));
  assignTiers(bodies); // фінальні tier'и з урахуванням доданих/видалених
  return bodies;
}

/**
 * Головний вхід: компонує зразок. Якщо самооцінка нижча за поріг —
 * ОДИН повторний прохід сильнішими параметрами від тих САМИХ оригіналів
 * (не випадкова регенерація). Максимум два проходи.
 */
export function composeSpecimen(input: readonly CompositionBody[], seedNum: number, config: CompositionConfig): CompositionResult {
  let bodies = runPipeline(input, seedNum, config, 1);
  let score = scoreComposition(bodies, config.sectors.count);
  let passes = 1;
  if (score.total < config.scoreThreshold) {
    bodies = runPipeline(input, seedNum, config, 1.35);
    score = scoreComposition(bodies, config.sectors.count);
    passes = 2;
  }
  return { bodies, score, passes };
}
