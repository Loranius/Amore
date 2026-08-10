import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../../growth';
import { buildCrystalLifeState, sampleCrystalLife } from '../../life';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../../material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../../species/crystal';
import { createThreeCrystalMaterial } from './material';

// The brief's sections 5, 7 and 8, held as assertions.
//
// One body in the colony has energy turning inside it, and it is the monarch.
// The flow is drawn in the body's own normalised frame so it is correct through
// 360°, and it stops dead under reduced motion without moving from where the
// couple's seed put it.

function events(): EvolutionEventInput[] {
  return Array.from({ length: 40 }, (_, index) => ({
    id: `flow-${index}`,
    occurredAt: `${2001 + Math.floor(index / 8)}-0${(index % 8) + 1}-14T09:00:00Z`,
    source: index % 3 === 0 ? 'memories@1' : index % 3 === 1 ? 'map@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, exploration: 0.4, achievement: 0.5 },
    portalActivity: 0.5,
  }));
}

function buildColony() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'inner-flow',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2000-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: events(),
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2007-03-04T09:00:00Z', rulesVersion: '1.0.0' },
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
  return { species, composition, geometry, material };
}

/** The compiled sources, by driving `onBeforeCompile` the way Three does. */
function compile(material: THREE.MeshPhysicalMaterial): {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
} {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader: 'void main() {\n#include <roughnessmap_fragment>\n#include <opaque_fragment>\n}',
  };
  material.onBeforeCompile(shader as never, null as never);
  return shader;
}

describe('energy turning inside the monarch (crystal cluster brief §5, §7, §8)', () => {
  it('lights exactly one body, and it is the monarch', () => {
    // The colony reads as one mineral because every body carries the couple's
    // colour; what makes the monarch the monarch is that she is the one with
    // something moving in her. Seven equal lanterns would not be a crystal and
    // its brood.
    const { composition, material } = buildColony();
    const lit = material.bodies.filter((body) => body.shader.innerFlowStrength > 0);
    expect(lit).toHaveLength(1);

    const focal = composition.bodies.filter((body) => body.role === 'focal');
    expect(focal).toHaveLength(1);
    expect(lit[0]!.bodyId).toBe(focal[0]!.sourceBodyId);

    // And the substrate, which is not in the composition's body list at all,
    // never carries it either — the ground must not compete with her.
    const substrate = material.bodies.find((body) => body.bodyId === 'crystal:substrate');
    expect(substrate?.shader.innerFlowStrength).toBe(0);
  });

  it('turns between 0.018 and 0.025 times a second, and freezes under reduced motion', () => {
    // The brief's band. A tenth of the sparkle's rate on purpose: dust catching
    // the light is a twinkle, convection inside a stone is not.
    const { species, composition, material } = buildColony();
    const common = {
      species,
      composition,
      material,
      config: {
        rulesVersion: '1.0.0',
        quality: 'high' as const,
        maxSparkles: 64,
        mediaFinishedCount: 12,
      },
    };

    const moving = buildCrystalLifeState({ ...common, config: { ...common.config, reducedMotion: false } });
    expect(moving.innerFlowSpeed).toBeGreaterThanOrEqual(0.018);
    expect(moving.innerFlowSpeed).toBeLessThanOrEqual(0.025);

    // One turn takes about fifty seconds. Sampling twice a second apart has to
    // move the phase, or the helix is standing still with a clock attached.
    const first = sampleCrystalLife({ life: moving, elapsedSeconds: 10 });
    const later = sampleCrystalLife({ life: moving, elapsedSeconds: 11 });
    expect(later.innerFlowPhase).toBeGreaterThan(first.innerFlowPhase);
    expect(later.innerFlowPhase - first.innerFlowPhase).toBeCloseTo(moving.innerFlowSpeed, 5);

    // Reduced motion stops it. Not by hiding the flow — the helix stays exactly
    // where the couple's seed puts it — but by holding the phase at zero, so a
    // viewer who asked for stillness gets a still crystal rather than none.
    const still = buildCrystalLifeState({ ...common, config: { ...common.config, reducedMotion: true } });
    expect(still.innerFlowSpeed).toBe(0);
    for (const seconds of [0, 7, 400, 9999]) {
      expect(sampleCrystalLife({ life: still, elapsedSeconds: seconds }).innerFlowPhase).toBe(0);
    }
  });

  it('compiles the flow into the monarch’s shader and into nothing else', () => {
    const { composition, material } = buildColony();
    const focalId = composition.bodies.find((body) => body.role === 'focal')!.sourceBodyId;

    for (const body of material.bodies) {
      const three = createThreeCrystalMaterial(body);
      const compiled = compile(three);
      const carries = body.bodyId === focalId;

      // The attribute the flow is drawn in. Without it the helix would have to
      // be reconstructed from `position`, which is artifact space in a batch —
      // it carries no body's own centre or height.
      expect(compiled.vertexShader.includes('attribute vec3 evolutionBodyCoord;'), body.bodyId)
        .toBe(true);
      expect(compiled.fragmentShader.includes('uEvolutionInnerFlowStrength'), body.bodyId)
        .toBe(true);

      // The strength is what switches it, so a daughter compiles the branch and
      // never enters it.
      expect(compiled.uniforms['uEvolutionInnerFlowStrength']?.value, body.bodyId)
        .toBe(body.shader.innerFlowStrength);
      expect((compiled.uniforms['uEvolutionInnerFlowStrength']?.value as number) > 0, body.bodyId)
        .toBe(carries);

      // The phase uniform is handed back so the life frame can advance it, and
      // it starts at zero: the first frame after mount must not jump.
      expect(three.userData['evolutionInnerFlowPhaseUniform'], body.bodyId).toBeDefined();
      expect(compiled.uniforms['uEvolutionInnerFlowPhase']?.value, body.bodyId).toBe(0);

      three.dispose();
    }
  });

  it('never batches the monarch with a body that has no flow', () => {
    // Bodies are grouped by material signature and a batch shares one material,
    // so a signature that ignored the flow would light the daughters with her.
    const { composition, material } = buildColony();
    const focalId = composition.bodies.find((body) => body.role === 'focal')!.sourceBodyId;
    const monarch = material.bodies.find((body) => body.bodyId === focalId)!;
    for (const body of material.bodies) {
      if (body.bodyId === focalId) continue;
      expect(body.signature, body.bodyId).not.toBe(monarch.signature);
    }
  });

  it('keeps the flow’s two colours inside the rose/amethyst family', () => {
    // §6 governs every colour in the artifact, this one included. Yellow needs
    // green high against blue; neither end of the ribbon may do that.
    const { material } = buildColony();
    for (const body of material.bodies) {
      for (const color of [body.shader.innerFlowColor, body.shader.innerFlowSecondColor]) {
        const yellowish = color.g > color.b + 0.06 && color.r > color.b + 0.06;
        expect(yellowish, `${body.bodyId} ${JSON.stringify(color)}`).toBe(false);
      }
    }
  });
});
