import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { DEFAULT_CRYSTAL_LIFE_CONFIG, buildCrystalLifeState, sampleCrystalLife } from '../life';
import {
  createThreeCrystalRenderBundle,
  applyCrystalLifeFrame,
  crystalSceneRadius,
} from '../renderer/three';
import { CRYSTAL_SUBSTRATE_BODY_ID, crystalVeinRadiusAt } from '../geometry/substrate';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { CONSISTENCY_WINDOW_MONTHS, consistency } from '../species/crystal/growthModel';
import { CRYSTAL_MATERIAL_QUALITY_PRESETS, DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState } from './engine';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'proposal',
    occurredAt: '2024-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 1, stability: 0.72, remembrance: 0.58 },
    portalActivity: 0.5,
  },
  {
    id: 'trip',
    occurredAt: '2024-06-10T10:00:00Z',
    source: 'plans@1',
    evidence: 'verified',
    channels: { exploration: 0.92, remembrance: 0.36 },
    portalActivity: 0.3,
  },
  ...Array.from({ length: 7 }, (_, index): EvolutionEventInput => ({
    id: `photo-day-${index + 1}`,
    occurredAt: `2025-0${(index % 7) + 1}-04T12:00:00Z`,
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.64, culture: 0.22 },
    portalActivity: 0.16,
  })),
];

function pipeline(options?: {
  reducedMotion?: boolean;
  quality?: 'high' | 'balanced' | 'low' | 'fallback';
  events?: readonly EvolutionEventInput[];
}) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'material-life-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: options?.events ?? EVENTS,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T12:00:00Z', rulesVersion: '1.0.0' },
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
  const quality = options?.quality ?? 'balanced';
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
  });
  const life = buildCrystalLifeState({
    species,
    composition,
    material,
    config: {
      ...DEFAULT_CRYSTAL_LIFE_CONFIG,
      quality,
      reducedMotion: options?.reducedMotion ?? false,
    },
  });
  return { species, growth, composition, geometry, material, life };
}

describe('Crystal Material, Life and Three renderer bridge', () => {
  it('is deterministic and never enables transmission or transparent shells', () => {
    const first = pipeline();
    const second = pipeline();

    expect(second.material).toEqual(first.material);
    expect(second.life).toEqual(first.life);
    expect(first.material.diagnostics.transmissionForcedOff).toBe(true);
    expect(first.material.bodies).toHaveLength(first.geometry.meshes.length);
    expect(first.material.diagnostics.uniqueMaterialCount).toBeLessThan(first.material.bodies.length);
    for (const body of first.material.bodies) {
      expect(body.transmission).toBe(0);
      expect(body.opacity).toBe(1);
      expect(body.transparent).toBe(false);
      expect(body.depthWrite).toBe(true);
      expect(body.signature.length).toBeGreaterThan(20);
    }
  });

  it('degrades expensive optics and ambient motion through quality tiers', () => {
    const high = pipeline({ quality: 'high' });
    const fallback = pipeline({ quality: 'fallback' });

    expect(high.material.bodies.some((body) => body.iridescence > 0)).toBe(true);
    expect(high.life.sparkleCount).toBeGreaterThan(0);
    for (const body of fallback.material.bodies) {
      expect(body.iridescence).toBe(0);
      expect(body.shader.rimStrength).toBe(0);
      expect(body.shader.skyStrength).toBe(0);
      expect(body.shader.inclusionDensity).toBe(0);
    }
    expect(fallback.life.sparkleCount).toBe(0);
    expect(fallback.life.rotationSpeed).toBe(0);
  });

  it('freezes continuous motion under reduced-motion while preserving a subtle glow response', () => {
    const { life } = pipeline({ reducedMotion: true });
    const first = sampleCrystalLife({ life, elapsedSeconds: 0, interactionPulse: 0 });
    const later = sampleCrystalLife({ life, elapsedSeconds: 100, interactionPulse: 0 });
    const touched = sampleCrystalLife({ life, elapsedSeconds: 100, interactionPulse: 1 });

    expect(later).toEqual(first);
    expect(first.rotationY).toBe(0);
    expect(first.positionY).toBe(0);
    expect(first.groupScale).toBe(1);
    expect(touched.rotationY).toBe(0);
    expect(touched.positionY).toBe(0);
    expect(touched.groupScale).toBe(1);
    expect(Object.values(touched.bodyGlowMultiplier).some((value) => value > 1)).toBe(true);
  });

  it('batches different geometries and fits them without mutating domain coordinates', () => {
    const { geometry, material, life } = pipeline();
    const geometryBefore = JSON.stringify(geometry);
    const bundle = createThreeCrystalRenderBundle(geometry, material);
    const frame = sampleCrystalLife({ life, elapsedSeconds: 12.5, interactionPulse: 0.4 });
    applyCrystalLifeFrame(bundle, frame);

    expect(bundle.meshes.size).toBe(geometry.meshes.length);
    expect(bundle.materials.size).toBe(material.bodies.length);
    expect(bundle.drawCallCount).toBe(material.diagnostics.uniqueMaterialCount);
    expect(bundle.drawCallCount).toBe(bundle.batches.length);
    expect(bundle.drawCallCount).toBeLessThan(geometry.meshes.length);
    expect(bundle.group.children).toEqual([bundle.content]);
    expect(bundle.content.children).toHaveLength(bundle.drawCallCount);
    expect(bundle.group.rotation.y).toBeCloseTo(frame.rotationY, 6);
    expect(bundle.group.position.y).toBeCloseTo(frame.positionY, 6);

    expect(bundle.fit.sourceSize.x).toBeGreaterThan(0);
    expect(bundle.fit.sourceSize.y).toBeGreaterThan(0);
    expect(bundle.fit.sourceSize.z).toBeGreaterThan(0);
    expect(bundle.fit.scale).toBeGreaterThan(0);
    expect(bundle.fit.sourceSize.y * bundle.fit.scale).toBeLessThanOrEqual(bundle.fit.targetHeight + 1e-6);
    expect(Math.max(bundle.fit.sourceSize.x, bundle.fit.sourceSize.z) * bundle.fit.scale)
      .toBeLessThanOrEqual(bundle.fit.targetWidth + 1e-6);
    expect(JSON.stringify(geometry)).toBe(geometryBefore);

    const uniqueMeshes = new Set(bundle.meshes.values());
    const uniqueMaterials = new Set(bundle.materials.values());
    expect(uniqueMeshes.size).toBe(bundle.drawCallCount);
    expect(uniqueMaterials.size).toBe(bundle.drawCallCount);

    for (const batch of bundle.batches) {
      expect(batch.bodyIds.length).toBeGreaterThan(0);
      expect(batch.material.transmission).toBe(0);
      expect(batch.material.transparent).toBe(false);
      expect(batch.mesh.userData['evolutionBodyIds']).toEqual(batch.bodyIds);
    }

    bundle.dispose();
    expect(bundle.group.children).toHaveLength(0);
  });

  it('clears the stone for a couple who shows up regularly (ADR-0004)', () => {
    // Regularity, not volume, drives clarity. Both couples below are handed the
    // identical artifact — same events, same pressures, same geometry — and
    // differ only in the consistency their species state published, so a
    // difference in inclusions can have come from nothing else.
    const base = pipeline({ quality: 'high' });
    const withConsistency = (monthsTouched: number) => {
      const species = {
        ...base.species,
        state: {
          ...base.species.state,
          consistency: consistency(monthsTouched, CONSISTENCY_WINDOW_MONTHS),
        },
      };
      return buildCrystalMaterialState({
        species,
        composition: base.composition,
        geometry: base.geometry,
        config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
      });
    };
    const inclusionsOf = (state: ReturnType<typeof withConsistency>) => state.bodies
      .filter((body) => body.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID)
      .map((body) => body.shader.inclusionDensity);

    const regular = inclusionsOf(withConsistency(10));
    const occasional = inclusionsOf(withConsistency(1));

    expect(regular).toHaveLength(occasional.length);
    expect(regular.some((density) => density > 0)).toBe(true);
    for (let index = 0; index < regular.length; index += 1) {
      const clear = regular[index]!;
      const cloudy = occasional[index]!;
      // Micro bodies publish 0 inclusions at any consistency, so the assertion
      // is "never cloudier", with at least one body actually clearing.
      expect(clear).toBeLessThanOrEqual(cloudy);
    }
    expect(regular.some((density, index) => density < occasional[index]!)).toBe(true);
  });

  it('keeps clarity inside the quality presets at every consistency', () => {
    const base = pipeline({ quality: 'high' });
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      const ceiling = CRYSTAL_MATERIAL_QUALITY_PRESETS[quality].inclusionScale;
      for (const monthsTouched of [0, 1, 6, 12, 99]) {
        const material = buildCrystalMaterialState({
          species: {
            ...base.species,
            state: {
              ...base.species.state,
              consistency: consistency(monthsTouched, CONSISTENCY_WINDOW_MONTHS),
            },
          },
          composition: base.composition,
          geometry: base.geometry,
          config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
        });
        for (const body of material.bodies) {
          expect(body.shader.inclusionDensity).toBeGreaterThanOrEqual(0);
          expect(body.shader.inclusionDensity).toBeLessThanOrEqual(ceiling + 1e-6);
          expect(Number.isFinite(body.shader.inclusionDensity)).toBe(true);
        }
      }
    }
  });

  it('reports the same scene footprint the bundle actually applies', () => {
    // The portal sizes its podium and its camera from crystalSceneRadius
    // without building a bundle. If that answer drifted from the fit the
    // renderer really applies, the podium would be built for one artifact and
    // the artifact drawn at another size — so the two are pinned together.
    const { geometry, material } = pipeline();
    const bundle = createThreeCrystalRenderBundle(geometry, material);
    const half = Math.max(bundle.fit.sourceSize.x, bundle.fit.sourceSize.z) * 0.5;

    expect(crystalSceneRadius(geometry)).toBeCloseTo(half * bundle.fit.scale, 5);
    bundle.dispose();
  });

  it('measures the crystals apart from the rock they stand in', () => {
    // Two different questions with two different answers: the podium has to
    // cover the rock, the camera only has to frame the crystals.
    //
    // The rock used to be strictly the wider of the two, and that stopped being
    // true when the year crystals started leaning outward: a crystal's tip now
    // overhangs the seam it grew out of. That is correct — ADR-0003 asks the
    // substrate to occlude every buried *base*, and a tip in the air has no
    // base cap to hide. What the two measurements must still agree on is every
    // body's footprint at the ground, which is checked in substrate.test.ts.
    const { geometry, growth } = pipeline();
    const withRock = crystalSceneRadius(geometry);
    const crystalsOnly = crystalSceneRadius(geometry, { includeSubstrate: false });

    expect(crystalsOnly).toBeGreaterThan(0);
    expect(withRock).toBeGreaterThanOrEqual(crystalsOnly);
    expect(crystalSceneRadius(geometry, { includeSubstrate: true })).toBe(withRock);

    // And the rock is genuinely wider than where the crystals meet it, which is
    // the half of the old assertion that still carries ADR-0003. Measured along
    // each crystal's own bearing, because the vein is not radially symmetric and
    // a single bounding radius says nothing about it.
    for (const body of growth.bodies) {
      const bearing = Math.atan2(body.anchor.x, body.anchor.z);
      const reach = crystalVeinRadiusAt(growth.bodies, growth.artifactSeed, bearing);
      expect(reach, body.id)
        .toBeGreaterThan(Math.hypot(body.anchor.x, body.anchor.z) + body.renderedRadius);
    }
  });

  it('widens with the ground the couple earned, not with the mesh count', () => {
    // Places visited reach the podium only through the substrate's width
    // (ADR-0004); nothing else about the artifact changes.
    const { geometry } = pipeline();
    const substrate = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
    const travelled = {
      ...geometry,
      meshes: geometry.meshes.map((mesh) => (
        mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID
          ? {
              ...mesh,
              bounds: {
                ...mesh.bounds,
                min: { ...mesh.bounds.min, x: mesh.bounds.min.x * 1.4, z: mesh.bounds.min.z * 1.4 },
                max: { ...mesh.bounds.max, x: mesh.bounds.max.x * 1.4, z: mesh.bounds.max.z * 1.4 },
              },
            }
          : mesh
      )),
    };

    expect(substrate.bounds.max.x).toBeGreaterThan(0);
    expect(crystalSceneRadius(travelled)).toBeGreaterThan(crystalSceneRadius(geometry));
  });

  it('keeps every crystal inside the optical band that reads as crystal', () => {
    // The values are a contract, not a derivation: outside them a facet stops
    // reading as mineral. Rougher than ~0.16 with clearcoat under ~0.75 is
    // matte plastic; the couple's pressures choose where in the band a body
    // sits, never whether it is in one.
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      const { material, geometry } = pipeline({ quality });
      const crystals = material.bodies.filter(
        (body) => body.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID,
      );

      expect(crystals.length).toBe(geometry.meshes.length - 1);
      for (const body of crystals) {
        expect(body.roughness, quality).toBeGreaterThanOrEqual(0.1);
        expect(body.roughness, quality).toBeLessThanOrEqual(0.16);
        expect(body.clearcoat, quality).toBeGreaterThanOrEqual(0.75);
        expect(body.clearcoat, quality).toBeLessThanOrEqual(0.95);
        expect(body.clearcoatRoughness, quality).toBeGreaterThanOrEqual(0.03);
        expect(body.clearcoatRoughness, quality).toBeLessThanOrEqual(0.07);
        expect(body.ior, quality).toBeGreaterThanOrEqual(1.52);
        expect(body.ior, quality).toBeLessThanOrEqual(1.58);
        expect(body.metalness, quality).toBe(0);
        expect(body.transmission, quality).toBe(0);
      }
    }
  });

  it('keeps the shell from lighting its own facets', () => {
    // Emissive ran as high as 0.32, which glows the body evenly from within and
    // brightens every plane by the same amount — the one thing that erases the
    // relief the geometry was just given. Glow belongs to the inner core.
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      for (const body of pipeline({ quality }).material.bodies) {
        if (body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
        expect(body.emissiveIntensity, quality).toBeGreaterThanOrEqual(0.02);
        expect(body.emissiveIntensity, quality).toBeLessThanOrEqual(0.06);
      }
    }
  });

  it('still lets a couple sit somewhere of their own inside the band', () => {
    // A band every couple sat at the same point in would be a constant, and the
    // artifact would stop saying anything with its optics. Compared across
    // couples rather than across bodies: bodies sharing a composition role are
    // *supposed* to share optics, which is what lets them share a draw call.
    const polished = pipeline({
      quality: 'high',
      events: Array.from({ length: 30 }, (_, index): EvolutionEventInput => ({
        id: `kept-${index}`,
        occurredAt: `2025-${String((index % 12) + 1).padStart(2, '0')}-08T12:00:00Z`,
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 1, significance: 0.8 },
        portalActivity: 0.9,
      })),
    }).material;
    const raw = pipeline({
      quality: 'high',
      events: [{
        id: 'one',
        occurredAt: '2025-03-02T12:00:00Z',
        source: 'shopping@1',
        evidence: 'historical-estimate',
        channels: { stability: 0.2 },
        portalActivity: 0.05,
      }],
    }).material;

    const shellOf = (state: typeof polished) => state.bodies.find(
      (body) => body.bodyId === 'crystal:mother',
    )!;

    expect(shellOf(polished).roughness).toBeLessThan(shellOf(raw).roughness);
    expect(shellOf(polished).clearcoat).toBeGreaterThan(shellOf(raw).clearcoat);
    // And both are still crystals.
    for (const state of [polished, raw]) {
      expect(shellOf(state).roughness).toBeGreaterThanOrEqual(0.1);
      expect(shellOf(state).roughness).toBeLessThanOrEqual(0.16);
      expect(shellOf(state).clearcoat).toBeGreaterThanOrEqual(0.75);
      expect(shellOf(state).clearcoat).toBeLessThanOrEqual(0.95);
    }
  });

  it('lights the crystal from inside, and the vein an order of magnitude less', () => {
    // The requested "inner crystal at 70% size" cannot be a second mesh: the
    // shell is opaque by contract (the canvas is alpha-composited over a CSS
    // sky, so a transmissive shell would show black where it overlaps the sky
    // rather than the sky itself), and a core behind an opaque shell is simply
    // invisible. Depth-weighted core light in the shader is the same effect,
    // and unlike shell emission it varies face to face.
    const { material } = pipeline({ quality: 'high' });
    const crystals = material.bodies.filter(
      (body) => body.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID,
    );
    const rock = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;

    expect(crystals.some((body) => body.shader.coreStrength > 0)).toBe(true);
    for (const body of crystals) {
      expect(body.shader.coreStrength).toBeGreaterThanOrEqual(0);
      // Core light supplements the surface; past this it washes the facets out
      // exactly the way shell emission used to.
      expect(body.shader.coreStrength).toBeLessThan(0.6);
      expect(Number.isFinite(body.shader.coreStrength)).toBe(true);
    }

    // The substrate used to be rock and carried no inner light at all. It is a
    // quartz vein now (2026-08-03), so it does — but barely, and the ratio is
    // the point: a seam that glowed like the crystals would turn the base into
    // the brightest thing in the frame, which is the "glowing inlay" look review
    // rejected. It also stays a non-uniform lift: the term is view-weighted, and
    // the vein publishes `emissiveIntensity: 0`.
    const brightestCrystal = Math.max(...crystals.map((body) => body.shader.coreStrength));
    expect(rock.shader.coreStrength).toBeGreaterThan(0);
    expect(rock.shader.coreStrength).toBeLessThan(brightestCrystal * 0.2);
    expect(rock.emissiveIntensity).toBe(0);
    expect(rock.transmission).toBe(0);
    expect(rock.transparent).toBe(false);
  });

  it('carries the core into the material signature', () => {
    // Two bodies that glow differently must not share a draw call — the core is
    // a uniform, not a vertex attribute, so a shared batch would give one of
    // them the other's light.
    const { material } = pipeline({ quality: 'high' });
    const byStrength = new Map<number, Set<string>>();
    for (const body of material.bodies) {
      const bucket = byStrength.get(body.shader.coreStrength) ?? new Set<string>();
      bucket.add(body.signature);
      byStrength.set(body.shader.coreStrength, bucket);
    }

    const signatures = new Set(material.bodies.map((body) => body.signature));
    const strengths = new Set(material.bodies.map((body) => body.shader.coreStrength));
    expect(signatures.size).toBeGreaterThanOrEqual(strengths.size);
  });

  it('puts the colour a year earned inside it, not on it', () => {
    // ADR-0004 gives an annual crystal a colour from the gifts exchanged that
    // year. Multiplying it into the shell made the whole body that colour — the
    // solid rainbow shell the reference pass rejected. Outside, every crystal
    // keeps the colony's one mineral nature; inside, each year carries its own
    // light.
    const base = pipeline({ quality: 'high' });
    const yearId = base.species.formations.find((f) => f.kind === 'annual')!.id;
    const withGift = (rgb: readonly [number, number, number]) => buildCrystalMaterialState({
      species: {
        ...base.species,
        formations: base.species.formations.map((formation) => (
          formation.id === yearId ? { ...formation, tintRgb: rgb } : formation
        )),
      },
      composition: base.composition,
      geometry: base.geometry,
      config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
    }).bodies.find((body) => body.bodyId === yearId)!;

    const plain = withGift([1, 1, 1]);
    const red = withGift([1, 0.35, 0.4]);
    const blue = withGift([0.38, 0.42, 1]);

    // The shell does not move at all.
    expect(red.baseColor).toEqual(plain.baseColor);
    expect(blue.baseColor).toEqual(plain.baseColor);

    // The core does, and in the direction the gifts point.
    expect(red.shader.coreColor).not.toEqual(plain.shader.coreColor);
    expect(red.shader.coreColor.r / red.shader.coreColor.b)
      .toBeGreaterThan(blue.shader.coreColor.r / blue.shader.coreColor.b);
  });

  it('lets the core go further toward the hue than the shell was allowed to', () => {
    // wishTint stops short of a pure colour because a crystal is translucent
    // stone, not stained glass — right for a surface. A core is seen *through*
    // that stone, so the same restraint reads as no colour at all.
    const base = pipeline({ quality: 'high' });
    const yearId = base.species.formations.find((f) => f.kind === 'annual')!.id;
    const tint: readonly [number, number, number] = [1, 0.4, 0.45];
    const body = buildCrystalMaterialState({
      species: {
        ...base.species,
        formations: base.species.formations.map((formation) => (
          formation.id === yearId ? { ...formation, tintRgb: tint } : formation
        )),
      },
      composition: base.composition,
      geometry: base.geometry,
      config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
    }).bodies.find((candidate) => candidate.bodyId === yearId)!;

    const core = body.shader.coreColor;
    const spread = (colour: { r: number; g: number; b: number }) =>
      Math.max(colour.r, colour.g, colour.b) - Math.min(colour.r, colour.g, colour.b);

    expect(spread(core)).toBeGreaterThan(1 - Math.min(...tint));
    for (const channel of [core.r, core.g, core.b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    // And a year that earned a colour shows it a little harder, or the colour
    // is the one thing about that year nobody can see.
    const plain = base.material.bodies.find((candidate) => candidate.bodyId === yearId)!;
    expect(body.shader.coreStrength).toBeGreaterThan(plain.shader.coreStrength);
  });

  it('keeps one mineral nature across the whole colony', () => {
    // Stated over the whole druse rather than over two bodies: no gift, in any
    // year, may move any shell anywhere. The shell colour still varies with
    // composition role and with emphasis — the year in progress is deliberately
    // picked out — and both of those are untouched here.
    const base = pipeline({ quality: 'high' });
    const gifted = buildCrystalMaterialState({
      species: {
        ...base.species,
        formations: base.species.formations.map((formation, index) => ({
          ...formation,
          tintRgb: [
            index % 3 === 0 ? 1 : 0.3,
            index % 3 === 1 ? 1 : 0.3,
            index % 3 === 2 ? 1 : 0.3,
          ] as [number, number, number],
        })),
      },
      composition: base.composition,
      geometry: base.geometry,
      config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
    });

    expect(gifted.bodies.map((body) => body.baseColor))
      .toEqual(base.material.bodies.map((body) => body.baseColor));
    // And the cores did move, or the fixture would be proving nothing.
    expect(gifted.bodies.map((body) => body.shader.coreColor))
      .not.toEqual(base.material.bodies.map((body) => body.shader.coreColor));
  });

  it('does not mutate species, composition or geometry states', () => {
    const current = pipeline();
    const speciesBefore = JSON.stringify(current.species);
    const compositionBefore = JSON.stringify(current.composition);
    const geometryBefore = JSON.stringify(current.geometry);

    buildCrystalMaterialState({
      species: current.species,
      composition: current.composition,
      geometry: current.geometry,
      config: DEFAULT_CRYSTAL_MATERIAL_CONFIG,
    });

    expect(JSON.stringify(current.species)).toBe(speciesBefore);
    expect(JSON.stringify(current.composition)).toBe(compositionBefore);
    expect(JSON.stringify(current.geometry)).toBe(geometryBefore);
  });
});
