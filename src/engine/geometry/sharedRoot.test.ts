import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import { CRYSTAL_SUBSTRATE_BODY_ID } from './substrate';
import type { CrystalMeshData } from './types';

// The brief's section 4, and the last line of section 3, held as assertions.
//
// One shared root the whole colony grows out of: 4–8% of the monarch's height,
// reaching past the ring of daughters, the same colour as the crystals standing
// in it but darker. And the daughters sunk into it by 8–14% of their own
// length — enough that they grow out of the root, not so much that they are
// stubs set into it.

const MONARCH_ID = 'crystal:mother';

function colony(years: number, eventCount: number) {
  const events: EvolutionEventInput[] = Array.from({ length: eventCount }, (_, index) => ({
    id: `root-${index}`,
    occurredAt: `${2001 + Math.floor((index / eventCount) * years)}-0${(index % 8) + 1}-14T09:00:00Z`,
    source: index % 3 === 0 ? 'memories@1' : index % 3 === 1 ? 'map@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, exploration: 0.4, achievement: 0.5 },
    portalActivity: 0.5,
  }));
  const artifact = buildArtifactBlueprint({
    coupleId: `shared-root:${years}:${eventCount}`,
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2000-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: `${2000 + years}-06-04T09:00:00Z`, rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({
    growth,
    config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
  });
  return { growth, geometry, material };
}

/** Colony sizes from the first month to well past the thirty-year term. */
const SIZES: readonly (readonly [number, number])[] = [
  [1, 6],
  [3, 24],
  [7, 40],
  [14, 90],
  [25, 160],
];

function verticalSpan(mesh: CrystalMeshData): { low: number; high: number } {
  let low = Infinity;
  let high = -Infinity;
  for (let index = 1; index < mesh.positions.length; index += 3) {
    const y = mesh.positions[index]!;
    if (y < low) low = y;
    if (y > high) high = y;
  }
  return { low, high };
}

function widestRadius(mesh: CrystalMeshData): number {
  let radius = 0;
  for (let index = 0; index < mesh.positions.length; index += 3) {
    radius = Math.max(radius, Math.hypot(mesh.positions[index]!, mesh.positions[index + 2]!));
  }
  return radius;
}

describe('the root the whole colony grows out of (crystal cluster brief §4)', () => {
  it('stands 4–8% of the monarch’s height above the stone', () => {
    // The band the brief names. It is a seam, not a plinth: much lower and the
    // crystals read as set down on the floor, much higher and the root becomes
    // a step they stand on — which is the shape the vein exists to be rid of.
    for (const [years, count] of SIZES) {
      const { geometry } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const monarch = geometry.meshes.find((mesh) => mesh.bodyId === MONARCH_ID)!;
      const monarchSpan = verticalSpan(monarch);
      // **The seam, not the mesh's highest point.** Broken rock stands on the
      // root — that is what stops the seam reading as a plinth — so the mesh's
      // top is a boulder, and measuring it answers "how tall is the tallest
      // stone" rather than "how much root is showing". This test measured the
      // bounding box and passed for as long as the two happened to be close;
      // it failed the moment the rubble was allowed to sit further out and
      // grew taller. Geometry publishes `seamTriangleCount` for exactly this.
      /*
       * Губа береться з профілю, а не з найвищої точки шва.
       *
       * Той самий крок, який цей тест уже робив раніше: коли на шов
       * поклали брили, «найвища точка меша» перестала означати «шов», і
       * вимір звузили до `seamTriangleCount`. Тепер повторилось на
       * рівень глибше — у жеоди з'явилась СТІНКА по периметру, тож
       * найвища точка самого шва це стінка, а не губа.
       *
       * Смуга 4–8% боронить від «сходинки, на якій стоять кристали», а
       * це властивість шва ПІД КРИСТАЛАМИ. Стінка встає осторонь від
       * них і на цю властивість не впливає — за те, щоб вона не
       * поглинула дітей, відповідає наступний тест.
       */
      const seamTop = root.profile.seamRimHeight;
      expect(seamTop, `${years}y публікує губу`).toBeGreaterThan(0);
      const share = seamTop! / (monarchSpan.high - monarchSpan.low);
      expect(share, `${years}y`).toBeGreaterThanOrEqual(0.04);
      expect(share, `${years}y`).toBeLessThanOrEqual(0.08);
    }
  });

  it('стінка жеоди не поглинає жодного кристала', () => {
    /*
     * Обіцянка, яку дає попередній тест, коли бере губу з профілю
     * замість найвищої точки шва: стінка законно стоїть вище губи, але
     * лише ОСТОРОНЬ від кристалів.
     *
     * Перевіряється на всіх розмірах колонії, а не лише на трьох роках,
     * бо ризик росте саме з кількістю дітей: що їх більше, то ближче
     * зовнішнє кільце підходить до контуру жили — і то ймовірніше, що
     * порода встане просто на дитині. Виміряний випадок: 0.057 при губі
     * 0.0246, тобто камінь удвічі вищий за губу на самому кристалі.
     */
    for (const [years, count] of SIZES) {
      const { geometry, growth } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const rim = root.profile.seamRimHeight;
      expect(rim, `${years}y публікує губу`).toBeGreaterThan(0);
      const seamTriangles = root.profile.seamTriangleCount!;
      for (let slot = 0; slot < seamTriangles * 3; slot += 1) {
        const index = root.indices[slot]!;
        const x = root.positions[index * 3]!;
        const y = root.positions[index * 3 + 1]!;
        const z = root.positions[index * 3 + 2]!;
        for (const body of growth.bodies) {
          const reach = Math.hypot(x - body.anchor.x, z - body.anchor.z);
          if (reach > body.renderedRadius) continue;
          expect(y, `${years}y ${body.id}: порода піднялась усередині сліду`)
            .toBeLessThanOrEqual(rim! + 1e-6);
        }
      }
    }
  });

  it('reaches past the outermost daughter, and covers every base', () => {
    // "Reaches the daughter ring" is a floor, not a target: a root that stopped
    // short would leave a crystal standing on bare stone, and ADR-0003's
    // guarantee — no base cap ever visible, including from underneath — would
    // go with it.
    for (const [years, count] of SIZES) {
      const { geometry } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const rootSpan = verticalSpan(root);
      const rootRadius = widestRadius(root);

      for (const mesh of geometry.meshes) {
        if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
        expect(rootRadius, `${years}y ${mesh.bodyId} reach`).toBeGreaterThan(widestRadius(mesh));
        expect(rootSpan.low, `${years}y ${mesh.bodyId} depth`)
          .toBeLessThanOrEqual(verticalSpan(mesh).low);
      }
    }
  });

  it('is the crystals’ own colour, darker — not a colour of its own', () => {
    // The defect this replaces: the root was built from three hand-set
    // constants (0.245 / 0.238 / 0.283, blue highest) chosen when it only had
    // to read as "not the slab". Measured against a real colony that put its
    // red-to-blue ratio at 0.885 against the monarch's 1.267 — darker, but 43%
    // bluer, which is a different colour rather than a deeper one.
    for (const [years, count] of SIZES) {
      const { material } = colony(years, count);
      const root = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const monarch = material.bodies.find((body) => body.bodyId === MONARCH_ID)!;

      const hue = (color: { r: number; g: number; b: number }) => color.r / Math.max(1e-6, color.b);
      const value = (color: { r: number; g: number; b: number }) => (color.r + color.g + color.b) / 3;

      // Same hue, measured as a ratio so a change of *value* — which is the one
      // difference the root is allowed — cannot register as a change of colour.
      expect(hue(root.baseColor) / hue(monarch.baseColor), `${years}y hue`).toBeCloseTo(1, 3);
      // And darker: enough that the crystals read against it, never so dark
      // that the root becomes a shadow.
      const darkness = value(root.baseColor) / value(monarch.baseColor);
      expect(darkness, `${years}y value`).toBeGreaterThan(0.4);
      expect(darkness, `${years}y value`).toBeLessThan(0.7);
    }
  });
});

describe('daughters sunk into the root (crystal cluster brief §3)', () => {
  it('buries every daughter 8–14% of her own length', () => {
    // The rule this replaces was `radialScale * 0.9` — a fixed multiple of the
    // body's *radius* — so how deep a crystal sat depended on how fat it was
    // rather than how tall. Measured across these same five colonies it buried
    // the slender year crystals 10.5–13.2% of their length and the stout skirt
    // bodies 26.9%, the same 26.9% at every colony size: a constant that never
    // knew what it was measuring. A quarter of a body underground is a stub set
    // into a root, not a crystal grown out of one.
    //
    // Measured along each body's own axis, which is the axis it was buried
    // along. The first version of this test divided the anchor's *vertical*
    // drop by the body's length and failed at 0.0775 on a fourteen-year colony:
    // a crystal leaning θ drops by `burial · cos θ`, so the vertical reading
    // understates the burial by its own cos θ and a body at the floor of the
    // band reads as below it. The body's own frame is the only frame this
    // quantity is defined in — the same lesson the silhouette pass learned by
    // measuring a leaning body's width from the world origin.
    for (const [years, count] of SIZES) {
      const { growth } = colony(years, count);
      for (const body of growth.bodies) {
        if (body.id === MONARCH_ID) continue;
        // Recovered exactly rather than approximated. A ground body is anchored
        // at `surfacePoint - direction · burial` with the surface point on
        // y = 0, so dividing the anchor's depth by the axis's own vertical
        // component undoes the projection and gives back the burial along the
        // axis — no small-angle assumption anywhere in it.
        const burial = -body.anchor.y / Math.max(1e-6, body.direction.y);
        expect(burial, `${years}y ${body.id} has a burial at all`).toBeGreaterThan(0);
        const share = burial / body.renderedLength;
        expect(share, `${years}y ${body.id}`).toBeGreaterThanOrEqual(0.08);
        expect(share, `${years}y ${body.id}`).toBeLessThanOrEqual(0.14);
      }
    }
  });
});
