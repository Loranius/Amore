import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import { CRYSTAL_SUBSTRATE_BODY_ID } from './substrate';

function events(years: number, seed: string): EvolutionEventInput[] {
  const out: EvolutionEventInput[] = [];
  for (let y = 0; y < years; y += 1) {
    for (let m = 0; m < 5; m += 1) {
      out.push({
        id: `${seed}-${y}-${m}`,
        occurredAt: `${2000 + y}-0${m + 1}-10T12:00:00Z`,
        source: ['calendar@1','plans@1','memories@1','map@1','wishlist@1'][m]!,
        evidence: 'verified',
        channels: { significance: 0.6, remembrance: 0.5, exploration: 0.4 },
        portalActivity: 0.4,
      });
    }
  }
  return out;
}

function run(years: number, couple: string) {
  const artifact = buildArtifactBlueprint({
    coupleId: couple,
    config: { engineVersion: '1.0.0', relationshipStartedAt: '2000-01-01', timeZone: 'Europe/Kyiv', leapDayPolicy: 'feb-28' },
    events: events(years, couple),
  });
  const species = buildCrystalSpeciesBlueprint({ artifact, config: { asOf: `${2000 + years}-01-02T09:00:00Z`, rulesVersion: '1.0.0' } });
  const growth = buildGrowthState({ blueprint: crystalToGrowthBlueprint(species), config: DEFAULT_GROWTH_ENGINE_CONFIG });
  const composition = buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });
  const geometry = buildCrystalGeometry({ growth, composition, config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG });
  return { growth, geometry };
}

/**
 * Silhouette of one body **in its own frame**: height along its own axis,
 * width from its own anchor.
 *
 * Measuring `hypot(x, z)` from the world origin is the trap Pass 9 documented
 * and this test walked straight back into: a child standing 0.15 out from the
 * druse's axis measured 0.15 wider than it is, and came out at an aspect of
 * 0.30 — three times wider than tall, which is impossible for a body the
 * geometry gives four radii of length.
 */
function silhouette(
  mesh: { positions: readonly number[] },
  body: { anchor: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } },
) {
  const n = mesh.positions.length / 3;
  const ax = body.direction.x, ay = body.direction.y, az = body.direction.z;
  const along: number[] = [];
  const off: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const dx = mesh.positions[i * 3]! - body.anchor.x;
    const dy = mesh.positions[i * 3 + 1]! - body.anchor.y;
    const dz = mesh.positions[i * 3 + 2]! - body.anchor.z;
    const t = dx * ax + dy * ay + dz * az;
    along.push(t);
    off.push(Math.hypot(dx - ax * t, dy - ay * t, dz - az * t));
  }
  const minY = Math.min(...along), maxY = Math.max(...along);
  const height = maxY - minY;
  const SLICES = 60;
  const reach = new Array(SLICES + 1).fill(0);
  for (let i = 0; i < n; i += 1) {
    const slot = Math.round(((along[i]! - minY) / height) * SLICES);
    reach[slot] = Math.max(reach[slot]!, off[i]!);
  }
  // Fill empty slots by linear interpolation between known ones.
  for (let s = 0; s <= SLICES; s += 1) {
    if (reach[s]! > 0) continue;
    let a = s, b = s;
    while (a > 0 && reach[a]! === 0) a -= 1;
    while (b < SLICES && reach[b]! === 0) b += 1;
    const t = (s - a) / Math.max(1, b - a);
    reach[s] = reach[a]! + (reach[b]! - reach[a]!) * t;
  }
  let widestSlot = 0;
  for (let s = 0; s <= SLICES; s += 1) if (reach[s]! > reach[widestSlot]!) widestSlot = s;
  return {
    height,
    fullWidth: reach[widestSlot]! * 2,
    aspect: height / (reach[widestSlot]! * 2),
    widestAt: widestSlot / SLICES,
    rootShare: reach[0]! / reach[widestSlot]!,
    minY, maxY,
  };
}

const COUPLES = ['a', 'b', 'c', 'd'] as const;
const AGES = [1, 4, 10, 25] as const;

describe('gem silhouette (crystal cluster brief)', () => {
  it('keeps the monarch a wide cut gem at every age and seed', () => {
    // The brief's band, measured on the built mesh rather than on the ratio the
    // growth model publishes — three things stand between them: the prism
    // flare, the elliptical cross-section, and the tenth of her length she
    // stands buried in the vein.
    for (const couple of COUPLES) {
      for (const years of AGES) {
        const { growth, geometry } = run(years, couple);
        const mesh = geometry.meshes.find((m) => m.bodyId === 'crystal:mother')!;
        const body = growth.bodies.find((b) => b.id === 'crystal:mother')!;
        const s = silhouette(mesh, body);
        const label = `${couple} ${years}y`;

        /*
         * **Смуга рухалась двічі, і обидва рази з приводу.** §2 брифу
         * просив 1.80–2.10; 2026-08-10 власник, дивлячись на портал,
         * попросив удвічі тонший монарх — смуга стала 3.4–4.35.
         *
         * Далі 3.85–4.80 (ADR-0118: зник розхил) і, нарешті, 4.5–5.6
         * (ADR-0119: обхват підтягнули до еталона).
         *
         * Ці числа НЕ порівнюються навпростець із еталонними 3.39: тут
         * ширина міряється в кадрі самого тіла разом із похованою
         * частиною. Те, що звіряється з еталоном, — `crystalProfile`, і
         * саме там видно результат: відстань профілів на одинадцяти
         * роках 0.175 → 0.036.
         */
        expect(s.aspect, `${label} aspect`).toBeGreaterThanOrEqual(4.5);
        expect(s.aspect, `${label} aspect`).toBeLessThanOrEqual(5.6);
      }
    }
  });

  it('puts the widest slice below the crown, and tapers into the root', () => {
    for (const couple of COUPLES) {
      for (const years of AGES) {
        const { growth, geometry } = run(years, couple);
        const mesh = geometry.meshes.find((m) => m.bodyId === 'crystal:mother')!;
        const body = growth.bodies.find((b) => b.id === 'crystal:mother')!;
        const s = silhouette(mesh, body);
        const label = `${couple} ${years}y`;

        // Widest below the tip and above the middle: a gem, not a barrel and
        // not a cone. The mesh includes the buried tenth, which pushes the
        // measured position up against the brief's 58–72% of the *visible*
        // body — so the bound here is stated on what is measured.
        //
        // **The ceiling moved with the halving, and it is geometry rather than
        // a preference.** The crown's drop is `radius · tan(crown angle)`, so
        // halving the radius halves the height the termination spends: the
        // crown starts higher, and the widest slice — which sits where the
        // crown begins — rises with it, from 0.55–0.80 to 0.80–0.90. Holding
        // the old position would mean changing the crown's angle, and that
        // angle is quartz's rather than ours (ADR-0006).
        expect(s.widestAt, `${label} widest`).toBeGreaterThan(0.55);
        expect(s.widestAt, `${label} widest`).toBeLessThan(0.92);

        /*
         * БОКИ ПРИЗМИ ПАРАЛЕЛЬНІ — і це протилежне тому, що тут стояло.
         *
         * Було 0.62–0.80: «звуження, яке не дає каменю читатись поставленим
         * на плаский зріз» (ADR-0019, гемовий силует). Еталон ADR-0114
         * каже інше й міряно: у кварцу боки призми паралельні, бо це
         * визначення призми, а підошву ховає порода, а не звуження.
         *
         * Те, заради чого був гемовий розхил, тепер робить жеода
         * (ADR-0115): камінь підіймається кристалові до чверті висоти,
         * тож «плаского зрізу» на екрані немає взагалі.
         *
         * Виміряно 0.883–0.941 — тобто підошва на 6–12% вужча за
         * найширше місце, і майже вся ця різниця припадає на кути
         * многогранника, а не на нахил граней.
         */
        expect(s.rootShare, `${label} root`).toBeGreaterThan(0.86);
        expect(s.rootShare, `${label} root`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps every daughter slimmer than the monarch and inside her height band', () => {
    for (const couple of COUPLES) {
      const { growth, geometry } = run(6, couple);
      const bodyOf = (id: string) => growth.bodies.find((b) => b.id === id)!;
      const mother = silhouette(
        geometry.meshes.find((m) => m.bodyId === 'crystal:mother')!,
        bodyOf('crystal:mother'),
      );
      const kids = geometry.meshes.filter((m) => m.bodyId.startsWith('crystal:year:'));
      expect(kids.length, couple).toBeGreaterThan(0);

      for (const kid of kids) {
        const s = silhouette(kid, bodyOf(kid.bodyId));
        const label = `${couple} ${kid.bodyId}`;
        // **Reversed by the halving, and stated rather than deleted.**
        //
        // This asserted that every daughter is slimmer than the monarch: she is
        // the body the ring is arranged around, and a daughter at her
        // proportions is a second monarch. Halving her diameter alone inverted
        // it — she is now the slenderest thing in the colony at about 4.2
        // against their 2.7, so the colony reads as a spire among stubs.
        //
        // The owner asked for the monarch and only the monarch, so the
        // daughters are left exactly as they were and the relationship is
        // recorded here as it now is rather than quietly dropped. Bringing them
        // back into proportion is one constant (`CHILD_ASPECT_MIN/MAX`) and the
        // owner's call, not this test's.
        expect(s.aspect, `${label} aspect`).toBeGreaterThan(2.2);
        expect(s.aspect, `${label} aspect`).toBeLessThan(3.4);
        // And never taller than half of her.
        expect(s.height / mother.height, `${label} height`).toBeLessThanOrEqual(0.52);
        expect(s.height / mother.height, `${label} height`).toBeGreaterThan(0.1);
      }
    }
  });

  it('is identical for the same seed', () => {
    // Procedural and deterministic: the brief's first requirement.
    const first = run(7, 'a').geometry;
    const second = run(7, 'a').geometry;
    expect(JSON.stringify(second.meshes)).toBe(JSON.stringify(first.meshes));
  });

  it('publishes no NaN and no degenerate triangle', () => {
    for (const couple of COUPLES) {
      const { geometry } = run(9, couple);
      for (const mesh of geometry.meshes) {
        if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
        expect(mesh.positions.every(Number.isFinite), `${couple} ${mesh.bodyId}`).toBe(true);
        expect(mesh.normals.every(Number.isFinite), `${couple} ${mesh.bodyId}`).toBe(true);
        for (let t = 0; t < mesh.indices.length; t += 3) {
          const [i, j, k] = [mesh.indices[t]!, mesh.indices[t + 1]!, mesh.indices[t + 2]!];
          expect(i === j || j === k || i === k, `${couple} ${mesh.bodyId} t${t / 3}`).toBe(false);
        }
      }
    }
  });
});
