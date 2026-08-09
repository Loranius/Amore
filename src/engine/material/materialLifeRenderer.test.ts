import * as THREE from 'three';
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
  /** Overrides the monarch's earned tint, to vary gifts without inventing data. */
  wishTint?: readonly [number, number, number];
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
  const built = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T12:00:00Z', rulesVersion: '1.0.0' },
  });
  const species = options?.wishTint === undefined
    ? built
    : { ...built, mother: { ...built.mother, tintRgb: options.wishTint } };
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
  it('is deterministic and never enables transmission, whatever the shell`s alpha', () => {
    // The two are not the same prohibition, and only one of them is permanent.
    //
    // Transmission samples a render target that the CSS sky behind the alpha
    // canvas is not in, so a transmissive shell renders black over the sky. No
    // material setting fixes that, so it stays at zero.
    //
    // Alpha does not have the problem: a semi-transparent pixel over an empty
    // region of the canvas carries its own alpha out to the compositor, which
    // lays it over the CSS gradient correctly. The shell is see-through since
    // ADR-0007 — and still writes depth, because each body is convex and back
    // faces are culled, so it covers each of its own pixels exactly once.
    const first = pipeline();
    const second = pipeline();

    expect(second.material).toEqual(first.material);
    expect(second.life).toEqual(first.life);
    expect(first.material.diagnostics.transmissionForcedOff).toBe(true);
    expect(first.material.bodies).toHaveLength(first.geometry.meshes.length);
    expect(first.material.diagnostics.uniqueMaterialCount).toBeLessThan(first.material.bodies.length);
    for (const body of first.material.bodies) {
      expect(body.transmission).toBe(0);
      expect(body.depthWrite).toBe(true);
      expect(body.signature.length).toBeGreaterThan(20);
      // Opaque, every body of it. Four stylized crystal references the owner
      // supplied are opaque without exception and read as crystal better than
      // ours did see-through: what carries a gem is its facets — their rims and
      // how differently each catches light — and transparency was never doing
      // that work. While the shell was open the far facets showed through the
      // near ones and the two sets of edges cancelled into a wireframe.
      //
      // The earned light does not need alpha either. The core term adds it to
      // the outgoing colour rather than letting the background through, so a
      // sealed shell still glows.
      expect(body.opacity).toBe(1);
      expect(body.transparent).toBe(false);
    }

    // And with nothing transparent left, the standing sort hazard is retired
    // rather than merely unlikely: alpha blending needs back-to-front ordering,
    // batching groups bodies by material signature, and within one batch there
    // was no ordering at all. The depth buffer answers it now.
    expect(first.material.bodies.every((body) => !body.transparent)).toBe(true);
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
  });

  it('freezes continuous motion under reduced-motion while preserving a subtle glow response', () => {
    const { life } = pipeline({ reducedMotion: true });
    const first = sampleCrystalLife({ life, elapsedSeconds: 0, interactionPulse: 0 });
    const later = sampleCrystalLife({ life, elapsedSeconds: 100, interactionPulse: 0 });
    const touched = sampleCrystalLife({ life, elapsedSeconds: 100, interactionPulse: 1 });

    expect(later).toEqual(first);
    expect(first.groupScale).toBe(1);
    expect(touched.groupScale).toBe(1);
    expect(Object.values(touched.bodyGlowMultiplier).some((value) => value > 1)).toBe(true);
  });

  it('never moves the artifact vertically, however long it has been alive', () => {
    // The artifact is rooted: a druse standing on the ground (ADR-0003) that
    // grows out of a fissure in it (ADR-0007). Any vertical motion at all makes
    // the seam rise out of the stone and sink back into it.
    //
    // It did exactly that, twice reported. Levitation swung the whole group
    // ±0.095 and a tilt of ±0.018/±0.014 rad swung the vein's far rim another
    // ±0.06, against a seam standing only ~0.047 proud of the platform — so it
    // buried itself twice a cycle, and the turn about Y that used to sit in the
    // frame carried the low side around once per revolution, which is what "it
    // spirals down" was.
    //
    // Measured on the built bundle rather than on the frame, because the defect
    // was never in one number: the pieces were individually modest and only the
    // composed transform was wrong. This checks the thing the eye checks — how
    // high off the ground the lowest point of the artifact actually sits.
    const { material, geometry, life } = pipeline();
    const bundle = createThreeCrystalRenderBundle(geometry, material);
    const floorOf = (seconds: number, pulse = 0) => {
      applyCrystalLifeFrame(bundle, sampleCrystalLife({
        life,
        elapsedSeconds: seconds,
        interactionPulse: pulse,
      }));
      bundle.group.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(bundle.group).min.y;
    };

    const rest = floorOf(0);
    // A full turn and then some, sampled off any period the motion might have.
    for (const seconds of [0.5, 3.7, 11.3, 29, 42.6, 84, 137.2, 300]) {
      expect(floorOf(seconds)).toBeCloseTo(rest, 5);
    }
    // Including while the couple is touching it — the pulse feeds the scale.
    expect(floorOf(42.6, 1)).toBeCloseTo(rest, 5);

    // And the reason it holds: the only transform left is a scale anchored at
    // the foot. Not one axis of rotation either — the self-spin is gone, so the
    // artifact stands still and the viewer's finger moves the camera instead.
    expect(bundle.group.rotation.x).toBe(0);
    expect(bundle.group.rotation.y).toBe(0);
    expect(bundle.group.rotation.z).toBe(0);
    bundle.dispose();
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
    // A live frame with a pulse in it still leaves the artifact facing the way
    // it was built facing: the frame carries no rotation to apply.
    expect(bundle.group.rotation.y).toBe(0);
    expect(bundle.group.scale.x).toBeCloseTo(frame.groupScale, 6);

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

  it('makes the inner light grow with the wishes that were granted', () => {
    // ADR-0004 gives a year its colour from the gifts the couple exchanged, and
    // the colour belongs to the light inside rather than to the shell. What was
    // missing is that the *amount* of light did not follow: a flat step said
    // "some tint" or "none", so one gift read the same as twenty.
    const { material, species } = pipeline({ quality: 'high' });
    const instructions = [species.mother, ...species.formations];
    const withTint = material.bodies.filter((body) => {
      const tint = instructions.find((item) => item.id === body.bodyId)?.tintRgb;
      return tint !== undefined && Math.min(...tint) < 1;
    });
    const withoutTint = material.bodies.filter((body) => {
      if (body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) return false;
      const tint = instructions.find((item) => item.id === body.bodyId)?.tintRgb;
      return tint === undefined || Math.min(...tint) >= 1;
    });

    // The fixture couple grants no wishes, so every body is at the floor — the
    // monotonic claim is checked directly on the derivation below instead.
    for (const body of [...withTint, ...withoutTint]) {
      expect(body.shader.coreStrength).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(body.shader.coreStrength)).toBe(true);
    }

    // Same couple, same body, more gifts granted: strictly more inner light,
    // and the colour is the one the gifts earned rather than the shell's.
    const stronger = [0, 0.4, 0.75].map((pull) => {
      const tinted = pipeline({
        quality: 'high',
        wishTint: [1, 1 - pull, 1 - pull * 0.6] as const,
      });
      const focal = tinted.material.bodies.find(
        (body) => body.bodyId === 'crystal:mother',
      )!;
      return focal.shader.coreStrength;
    });
    expect(stronger[1]!).toBeGreaterThan(stronger[0]!);
    expect(stronger[2]!).toBeGreaterThan(stronger[1]!);
  });

  it('textures the stone in object space, and clouds the vein hardest', () => {
    // The field has to be *in* the crystal. It was keyed on the view position,
    // so the inclusions slid through the stone as the camera orbited — which is
    // a screen effect wearing a texture's name. Object space is the fix, and it
    // is a property of the shader rather than of the recipe, so what is checked
    // here is the recipe that drives it.
    const { material } = pipeline({ quality: 'high' });
    const rock = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
    const crystals = material.bodies.filter((body) => body.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);

    // The vein is milkier than any crystal on it — that cloud is what makes it
    // read as quartz rather than as polished stone.
    expect(rock.shader.veilStrength)
      .toBeGreaterThan(Math.max(...crystals.map((body) => body.shader.veilStrength)));

    for (const body of material.bodies) {
      expect(body.shader.veilScale).toBeGreaterThan(0);
      expect(Number.isFinite(body.shader.veilStrength)).toBe(true);
    }
  });

  it('makes the shell read as glass rather than as fog', () => {
    // Flat alpha is fog: a body evenly see-through everywhere, which real glass
    // never is. What makes it glass is that reflectance climbs toward the
    // silhouette — so the shader closes the alpha at the edge, lights that edge
    // up, and deepens the colour along the longer path. All three ride on one
    // published number, which is what this checks.
    const { material } = pipeline({ quality: 'high' });
    const crystals = material.bodies.filter((body) => body.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);
    const rock = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;

    expect(crystals.some((body) => body.shader.glassStrength > 0)).toBe(true);
    for (const body of crystals) {
      expect(body.shader.glassStrength).toBeGreaterThanOrEqual(0);
      expect(body.shader.glassStrength).toBeLessThanOrEqual(1);
    }
    // The vein is quartz in stone, not a pane set into the floor.
    expect(rock.shader.glassStrength).toBe(0);
    expect(rock.opacity).toBe(1);

    // Refraction stays impossible, and that is what the glass term exists to
    // work around rather than to hide.
    for (const body of material.bodies) expect(body.transmission).toBe(0);
  });

  it('lights the fissure with the wishes the couple granted, and only the fissure', () => {
    // The seam is a crack the crystals came out of. A crack with nothing in it
    // is a groove — what makes it read as their source is that something is lit
    // down there, and ADR-0004 says what colour that light is.
    const { material } = pipeline({ quality: 'high' });
    const rock = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
    const crystals = material.bodies.filter((body) => body.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);

    expect(rock.shader.auroraStrength).toBeGreaterThan(0);
    for (const body of crystals) expect(body.shader.auroraStrength).toBe(0);

    // Two colours, never the same one twice: a single hue at a single
    // brightness is a lamp in a slot, however slowly it drifts.
    const { auroraColor: first, auroraSecondColor: second } = rock.shader;
    expect([first.r, first.g, first.b].every((channel) => channel >= 0 && channel <= 1)).toBe(true);
    expect([second.r, second.g, second.b].every((channel) => channel >= 0 && channel <= 1)).toBe(true);
    expect(`${first.r},${first.g},${first.b}`).not.toBe(`${second.r},${second.g},${second.b}`);

    // More wishes granted, more light. A couple who has granted none still gets
    // a lit crack — the artifact never punishes a couple for not having done a
    // thing yet — but it is the floor rather than the whole range.
    const granted = pipeline({ quality: 'high', wishTint: [1, 0.35, 0.6] as const });
    const grantedRock = granted.material.bodies.find(
      (body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID,
    )!;
    expect(grantedRock.shader.auroraStrength).toBeGreaterThan(rock.shader.auroraStrength);
  });

  it('turns every texture off at the fallback tier', () => {
    // Procedural texture is noise per pixel, so it follows the same quality
    // ladder as the other optics rather than staying on when they are off.
    const { material } = pipeline({ quality: 'fallback' });
    for (const body of material.bodies) {
      expect(body.shader.veilStrength).toBe(0);
      expect(body.shader.surfaceTextureScale).toBe(0);
    }
  });

  it('keeps the surface map on the rock and off the crystals', () => {
    // A grown crystal face is clean — that is what makes it a face rather than a
    // fracture — and every stylized reference the owner supplied shows exactly
    // that: flat planes, a painted rim, and whatever structure there is living
    // inside the body rather than on it.
    //
    // Wrapping a cellular map over the outside did two things wrong at once. At
    // the size the portal draws a crystal it read as hide; and because the
    // pattern crossed facet edges it told the eye the planes either side were
    // one surface, which is the opposite of what the rim exists to say.
    //
    // Broken rock is the other case entirely. It has no grown faces to keep
    // clean, and grain is most of what separates stone from plastic — so the
    // map stays there, at its own much coarser density.
    const { material } = pipeline({ quality: 'high' });
    const rock = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
    const crystals = material.bodies.filter((body) => body.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);

    expect(rock.shader.surfaceTextureScale).toBeGreaterThan(0);
    expect(rock.shader.surfaceReliefStrength).toBeGreaterThan(0);
    for (const body of crystals) {
      expect(body.shader.surfaceTextureScale).toBe(0);
      // A normal map with no albedo to agree with is a rippled plane, and a lit
      // vein pattern on a clean face is the same mistake in another channel.
      expect(body.shader.surfaceReliefStrength).toBe(0);
      expect(body.shader.surfaceVeinStrength).toBe(0);
    }

    // What the map was for is still there, and now it is where it belongs:
    // inside the stone, as a 3D field that cannot cross a facet edge.
    expect(crystals.some((body) => body.shader.veilStrength > 0)).toBe(true);

    // No glowing veins on the rock either — the light down there is the aurora,
    // and two lit patterns in one crack would fight.
    expect(rock.shader.surfaceVeinStrength).toBe(0);
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
