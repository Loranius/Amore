import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from '../../geometry/config';
import { buildCrystalGeometry } from '../../geometry/engine';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../../growth';
import { buildCrystalLifeState } from '../../life';
import type { CrystalLifeConfig } from '../../life';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../../material';
import type { CrystalMaterialQuality } from '../../material';
import {
  CRYSTAL_MONARCH_BODY_ID,
  buildCrystalSpeciesBlueprint,
  crystalToGrowthBlueprint,
} from '../../species/crystal';
import { createThreeCrystalRenderBundle } from './bundle';
import { createThreeCrystalInnerSparks } from './innerSparks';

// The brief's section 9. One deterministic point cloud, inside the monarch and
// nowhere else, drawn additively over an opaque shell because that is the only
// way anything inside an opaque body can be seen at all.

function build(overrides: Partial<CrystalLifeConfig> = {}) {
  const events: EvolutionEventInput[] = Array.from({ length: 40 }, (_, index) => ({
    id: `spark-${index}`,
    occurredAt: `${2001 + Math.floor(index / 8)}-0${(index % 8) + 1}-14T09:00:00Z`,
    source: index % 3 === 0 ? 'memories@1' : index % 3 === 1 ? 'map@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, exploration: 0.4, achievement: 0.5 },
    portalActivity: 0.5,
  }));
  const artifact = buildArtifactBlueprint({
    coupleId: 'inner-sparks',
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
    config: { asOf: '2007-06-04T09:00:00Z', rulesVersion: '1.0.0' },
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
  const quality: CrystalMaterialQuality = overrides.quality ?? 'high';
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
      rulesVersion: '1.0.0',
      reducedMotion: false,
      quality,
      maxSparkles: 64,
      mediaFinishedCount: 40,
      ...overrides,
    },
  });
  return { geometry, material, life };
}

describe('lights inside the monarch (crystal cluster brief §9)', () => {
  it('is one point cloud, drawn additively over the shell', () => {
    // Every flag here has a reason and none of them is taste. Additive because
    // a light inside a stone adds to what is already there; `depthWrite` off so
    // the cloud never occludes the crystal it lives in; and `depthTest` off
    // because the shell is opaque by contract (ADR-0007) — with the test on,
    // every spark inside the monarch is behind her surface and nothing is
    // drawn at all.
    const { geometry, material, life } = build();
    const bundle = createThreeCrystalRenderBundle(geometry, material);
    const sparks = createThreeCrystalInnerSparks(bundle, geometry, life)!;
    expect(sparks).not.toBeNull();

    expect(sparks.points).toBeInstanceOf(THREE.Points);
    const pointsMaterial = sparks.points.material as THREE.ShaderMaterial;
    expect(pointsMaterial.blending).toBe(THREE.AdditiveBlending);
    expect(pointsMaterial.depthWrite).toBe(false);
    expect(pointsMaterial.depthTest).toBe(false);
    expect(pointsMaterial.transparent).toBe(true);
    // After the crystal batches, so the additive pass lands on a finished shell.
    expect(sparks.points.renderOrder).toBeGreaterThan(0);

    const position = sparks.points.geometry.getAttribute('position');
    expect(position.count).toBe(life.innerSparks.length);
    for (const name of ['sparkPhase', 'sparkSpeed', 'sparkSize']) {
      expect(sparks.points.geometry.getAttribute(name).count, name).toBe(position.count);
    }
    sparks.dispose();
  });

  it('hangs the cloud under the same fit transform as the crystal', () => {
    // **The defect this is here for, and it only ever showed in a render.**
    // The bundle is two nested groups: `group` carries the life frame's
    // breathing, `content` inside it carries the fit — a scale of about 2.3 and
    // an offset that take the artifact from engine units to the size it is
    // drawn at. The batches live in `content`. The cloud was added to `group`,
    // so it missed the fit entirely and rendered in raw engine coordinates: on
    // the portal the lights hung in the sky above the crystal.
    //
    // The other tests here compare spark positions against monarch positions in
    // engine units, where the two agree no matter how either is parented. This
    // one asserts the scene graph.
    const { geometry, material, life } = build();
    const bundle = createThreeCrystalRenderBundle(geometry, material);
    const sparks = createThreeCrystalInnerSparks(bundle, geometry, life)!;

    expect(sparks.points.parent, 'the cloud is parented at all').not.toBeNull();
    expect(sparks.points.parent).toBe(bundle.content);
    // And so is every crystal batch — the same parent, so the same transform.
    for (const batch of bundle.batches) {
      expect(batch.mesh.parent, batch.signature.slice(0, 16)).toBe(sparks.points.parent);
    }

    // Disposing takes it back out rather than leaving a dead cloud in the scene.
    sparks.dispose();
    expect(sparks.points.parent).toBeNull();
  });

  it('puts every light inside the monarch’s own bounds', () => {
    // A spark that strays outside her silhouette stops reading as an inclusion
    // and starts reading as dust in front of the crystal — which, since the
    // cloud is drawn over everything, is exactly what it would look like.
    const { geometry, material, life } = build();
    const bundle = createThreeCrystalRenderBundle(geometry, material);
    const sparks = createThreeCrystalInnerSparks(bundle, geometry, life)!;
    const monarch = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_MONARCH_BODY_ID)!;
    const bounds = monarch.bounds;
    const position = sparks.points.geometry.getAttribute('position');

    for (let index = 0; index < position.count; index += 1) {
      const label = `spark ${index}`;
      expect(position.getY(index), `${label} above the foot`)
        .toBeGreaterThanOrEqual(bounds.min.y);
      expect(position.getY(index), `${label} below the tip`)
        .toBeLessThanOrEqual(bounds.max.y);
      const radius = Math.hypot(position.getX(index), position.getZ(index));
      const widest = Math.max(
        Math.abs(bounds.max.x),
        Math.abs(bounds.min.x),
        Math.abs(bounds.max.z),
        Math.abs(bounds.min.z),
      );
      expect(radius, `${label} inside the widest slice`).toBeLessThanOrEqual(widest);
    }
    sparks.dispose();
  });

  it('is the same cloud every time the same couple’s crystal is drawn', () => {
    // The whole reason this exists. It replaces drei's `<Sparkles>`, which
    // draws its sizes from `Math.random()` — so two mounts of one couple's
    // artifact produced two different artifacts, which the determinism standard
    // forbids outright.
    const first = build();
    const second = build();
    const firstBundle = createThreeCrystalRenderBundle(first.geometry, first.material);
    const secondBundle = createThreeCrystalRenderBundle(second.geometry, second.material);
    const left = createThreeCrystalInnerSparks(firstBundle, first.geometry, first.life)!;
    const right = createThreeCrystalInnerSparks(secondBundle, second.geometry, second.life)!;

    for (const name of ['position', 'sparkPhase', 'sparkSpeed', 'sparkSize']) {
      expect(
        Array.from(left.points.geometry.getAttribute(name).array),
        name,
      ).toEqual(Array.from(right.points.geometry.getAttribute(name).array));
    }
    left.dispose();
    right.dispose();
  });

  it('draws nothing at all on the two weakest tiers', () => {
    // A decision rather than a saving: a scatter of additive points over a
    // crystal drawn small on a weak phone reads as noise on the screen rather
    // than as light caught in a stone. Better absent than misread.
    for (const quality of ['low', 'fallback'] as const) {
      const { geometry, material, life } = build({ quality });
      const bundle = createThreeCrystalRenderBundle(geometry, material);
      expect(life.innerSparks, quality).toHaveLength(0);
      expect(createThreeCrystalInnerSparks(bundle, geometry, life), quality).toBeNull();
    }
  });

  it('freezes the twinkle under reduced motion without moving a light', () => {
    // Stillness was asked for, not emptiness — the same treatment the inner
    // flow gets. Every speed goes to zero, so the phase uniform advances and
    // nothing changes; the positions are untouched.
    const moving = build({ reducedMotion: false });
    const still = build({ reducedMotion: true });
    const movingBundle = createThreeCrystalRenderBundle(moving.geometry, moving.material);
    const stillBundle = createThreeCrystalRenderBundle(still.geometry, still.material);
    expect(still.life.innerSparks.length).toBe(moving.life.innerSparks.length);

    const frozen = createThreeCrystalInnerSparks(stillBundle, still.geometry, still.life)!;
    const speeds = Array.from(frozen.points.geometry.getAttribute('sparkSpeed').array);
    expect(speeds.every((speed) => speed === 0)).toBe(true);
    expect(
      Array.from(frozen.points.geometry.getAttribute('position').array),
    ).toEqual(
      Array.from(
        createThreeCrystalInnerSparks(movingBundle, moving.geometry, moving.life)!.points.geometry
          .getAttribute('position').array,
      ),
    );
    frozen.dispose();
  });
});
