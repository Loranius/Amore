import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from './composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from './evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from './geometry';
import { CRYSTAL_SUBSTRATE_BODY_ID } from './geometry/substrate';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from './growth';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './material';
import { buildCrystalMaterialState } from './material/engine';
import type { CrystalMaterialQuality } from './material/types';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from './species/crystal';

/**
 * The regression sweep — Pass 10 of the owner's naturalization brief.
 *
 * Six passes each added an invariant and a test for it, and each of those tests
 * runs on one couple. This runs the whole pipeline over a matrix of ages and
 * histories and holds every one of those invariants across all of it, because
 * the failures worth catching are the ones that appear at one age or on one kind
 * of history: a clamp that only bites on a long relationship, a facet that only
 * collapses when a year is empty, a role that only misfires when there is a
 * single body.
 *
 * The histories are not decoration. Each is a shape a real couple's data takes,
 * and between them they exercise every growth dependency landed so far —
 * breadth, deliberate acts, places, consistency.
 */

type History = 'sparse' | 'broad' | 'bursty' | 'photos' | 'gifts';

const MODULES = ['media@1', 'memories@1', 'plans@1', 'wishlist@1', 'map@1', 'calendar@1'] as const;

function eventsFor(history: History, years: number): EvolutionEventInput[] {
  const events: EvolutionEventInput[] = [];
  const span = years * 365;
  const push = (index: number, dayFromNow: number, source: string) => {
    events.push({
      id: `${history}-${index}`,
      occurredAt: new Date(Date.UTC(2026, 6, 1) - dayFromNow * 86400000).toISOString(),
      source,
      evidence: 'verified',
      channels: { remembrance: 0.6, significance: 0.4 },
      portalActivity: 0.3,
    });
  };

  if (history === 'sparse') {
    // Four entries in the whole relationship, one module. The floor case: the
    // artifact still has to be a crystal.
    for (let index = 0; index < 4; index += 1) push(index, (index + 1) * (span / 5), 'memories@1');
    return events;
  }
  if (history === 'broad') {
    // Every module, steadily, for the whole time. The case the engine is tuned
    // for, and the one the other four are measured against.
    const count = Math.max(12, years * 24);
    for (let index = 0; index < count; index += 1) {
      push(index, (index + 1) * (span / count), MODULES[index % MODULES.length]!);
    }
    return events;
  }
  if (history === 'bursty') {
    // One weekend of uploading, then silence. This is what drives consistency
    // to its floor, which four separate mechanisms read.
    for (let index = 0; index < 200; index += 1) {
      push(index, span * 0.6 + index * 0.01, MODULES[index % MODULES.length]!);
    }
    return events;
  }
  if (history === 'photos') {
    // Almost nothing but photos. The case ADR-0004 exists for: photos earn
    // facets, and they must not also decide girth, fill or anything else.
    const count = Math.max(30, years * 60);
    for (let index = 0; index < count; index += 1) push(index, (index + 1) * (span / count), 'media@1');
    return events;
  }
  // Gifts and plans only: deliberate acts without the volume photos bring.
  const count = Math.max(10, years * 12);
  for (let index = 0; index < count; index += 1) {
    push(index, (index + 1) * (span / count), index % 2 === 0 ? 'wishlist@1' : 'plans@1');
  }
  return events;
}

function run(history: History, years: number, quality: CrystalMaterialQuality = 'high') {
  const startedAt = new Date(Date.UTC(2026, 6, 1) - years * 365.25 * 86400000)
    .toISOString()
    .slice(0, 10);
  const artifact = buildArtifactBlueprint({
    coupleId: `regression-${history}`,
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: startedAt,
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: eventsFor(history, years),
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-01T00:00:00Z', rulesVersion: '1.0.0' },
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
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
  });
  return { artifact, species, growth, composition, geometry, material };
}


/**
 * The same couple, observed later.
 *
 * `run` above builds a *different* history for each age — the event list scales
 * with the span — so comparing two of its results compares two couples, not one
 * couple ageing. The passage-of-time guarantees are about one couple, so they
 * need this instead: one fixed event list and one fixed start date, with only
 * the observation date moving. The engine excludes events after `asOf` itself.
 *
 * The first version of the tests below used `run`, and it failed — correctly,
 * for the wrong reason: `bursty` at one year and `bursty` at three put their
 * burst at different points in the relationship, so the photos cost different
 * numbers of facets. That is not a violation of anything.
 */
function observedAt(history: History, years: number) {
  const startedAt = '2001-07-01';
  const artifact = buildArtifactBlueprint({
    coupleId: `regression-${history}`,
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: startedAt,
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    // Twenty-five years of history, laid down once. Each observation sees the
    // prefix of it that had happened by then.
    events: eventsFor(history, 25).map((event, index) => ({
      ...event,
      occurredAt: new Date(Date.UTC(2001, 6, 1) + (index + 1) * (25 * 365 / 200) * 86400000)
        .toISOString(),
    })),
  });
  const asOf = new Date(Date.UTC(2001, 6, 1) + years * 365.25 * 86400000).toISOString();
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  return { species, growth };
}

const HISTORIES: History[] = ['sparse', 'broad', 'bursty', 'photos', 'gifts'];
const AGES = [1, 3, 6, 12, 25];

const cases = HISTORIES.flatMap((history) => AGES.map((years) => ({ history, years })));

describe('Crystal regression sweep — the artifact is always an artifact', () => {
  it.each(cases)('builds a whole crystal for $history at $years years', ({ history, years }) => {
    const { growth, geometry, material } = run(history, years);
    const label = `${history}/${years}y`;

    // Nothing silently dropped anywhere in the chain.
    expect(geometry.diagnostics.nonFiniteBodyIds, label).toEqual([]);
    expect(geometry.diagnostics.missingHostBodyIds, label).toEqual([]);
    expect(geometry.diagnostics.unsealedJunctionIds, label).toEqual([]);
    expect(geometry.diagnostics.meshesWithoutVisibleTriangles, label).toEqual([]);
    expect(geometry.diagnostics.budgetOmittedBodyIds, label).toEqual([]);
    expect(material.diagnostics.missingCompositionBodyIds, label).toEqual([]);
    expect(material.diagnostics.missingGeometryBodyIds, label).toEqual([]);

    // ADR-0004: bodies follow years, never the row count. `photos` at any age
    // carries between two and sixty times the events of `gifts` at the same
    // age, and must not carry more bodies for it.
    expect(growth.bodies.length, label).toBeGreaterThan(1);
    expect(growth.bodies.length, label).toBeLessThan(60);

    // Every published number is a number.
    for (const mesh of geometry.meshes) {
      expect(mesh.positions.every(Number.isFinite), `${label} ${mesh.bodyId}`).toBe(true);
      expect(mesh.normals.every(Number.isFinite), `${label} ${mesh.bodyId}`).toBe(true);
      expect(mesh.indices.every(Number.isInteger), `${label} ${mesh.bodyId}`).toBe(true);
    }
  });

  it.each(cases)('is deterministic for $history at $years years', ({ history, years }) => {
    // The whole contract in one line: identical inputs, identical published
    // state, byte for byte through JSON.
    const first = run(history, years);
    const second = run(history, years);
    expect(JSON.stringify(second.geometry)).toBe(JSON.stringify(first.geometry));
    expect(JSON.stringify(second.material)).toBe(JSON.stringify(first.material));
    expect(JSON.stringify(second.composition)).toBe(JSON.stringify(first.composition));
  });
});

describe('Crystal regression sweep — the invariants each pass added', () => {
  it.each(cases)('keeps one focal body and a real ladder for $history at $years years', ({ history, years }) => {
    // Pass 4. The bug this replaces returned `focal` for every body in the
    // colony, on every couple, because it read generation instead of tier.
    const { composition, material } = run(history, years);
    const label = `${history}/${years}y`;

    const focal = composition.bodies.filter((body) => body.role === 'focal');
    expect(focal, label).toHaveLength(1);

    const roleOf = new Map(composition.bodies.map((body) => [body.sourceBodyId, body.role]));
    const luma = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const monarch = material.bodies.find((body) => roleOf.get(body.bodyId) === 'focal')!;
    for (const body of material.bodies) {
      const role = roleOf.get(body.bodyId);
      if (role === undefined || role === 'focal') continue;
      expect(luma(body.baseColor), `${label} ${body.bodyId}`)
        .toBeLessThan(luma(monarch.baseColor));
    }
  });

  it.each(cases)('never collapses a crown facet for $history at $years years', ({ history, years }) => {
    // Pass 2 and Pass 3. The termination's drop is read from the shaft beneath
    // each crown face, and a shoulder cut narrows that shaft locally — the two
    // together are what put a facet at 1/368th of its neighbour twice.
    const { geometry } = run(history, years);
    const label = `${history}/${years}y`;

    for (const mesh of geometry.meshes) {
      if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
      const width = Math.max(
        mesh.bounds.max.x - mesh.bounds.min.x,
        mesh.bounds.max.z - mesh.bounds.min.z,
      );
      if (width <= 0) continue;
      const areas = new Map<number, number>();
      for (let triangle = 0; triangle < mesh.indices.length / 3; triangle += 1) {
        const face = mesh.faceIds![triangle]!;
        const corner = (slot: number) => {
          const index = mesh.indices[triangle * 3 + slot]! * 3;
          return [mesh.positions[index]!, mesh.positions[index + 1]!, mesh.positions[index + 2]!];
        };
        const [a, b, c] = [corner(0), corner(1), corner(2)];
        const u = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!];
        const v = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!];
        const area = Math.hypot(
          u[1]! * v[2]! - u[2]! * v[1]!,
          u[2]! * v[0]! - u[0]! * v[2]!,
          u[0]! * v[1]! - u[1]! * v[0]!,
        ) / 2;
        areas.set(face, (areas.get(face) ?? 0) + area);
      }
      // Measured floor over forty seeds of the monarch is 0.036 of the body's
      // width; child bodies run smaller and this is the sweep's own floor.
      for (const [face, area] of areas) {
        expect(Math.sqrt(2 * area) / width, `${label} ${mesh.bodyId} face ${face}`)
          .toBeGreaterThan(0.002);
      }
    }
  });

  it.each(cases)('keeps the zoning a derivation for $history at $years years', ({ history, years }) => {
    // Pass 6. The amplitude must stay inside its range on every history, or it
    // is a constant with a derivation's name on it.
    const { composition, material } = run(history, years);
    const roleOf = new Map(composition.bodies.map((body) => [body.sourceBodyId, body.role]));
    for (const body of material.bodies) {
      const role = roleOf.get(body.bodyId);
      if (role === undefined || role === 'micro') continue;
      expect(body.shader.inclusionDensity, `${history}/${years}y ${body.bodyId}`)
        .toBeGreaterThan(0.45);
      expect(body.shader.inclusionDensity, `${history}/${years}y ${body.bodyId}`)
        .toBeLessThan(1);
    }
  });

  it.each(cases)('stays inside the draw budget for $history at $years years', ({ history, years }) => {
    // The acceptance criterion the portal reports: one material per optical
    // identity, plus the substrate.
    const { geometry, material } = run(history, years);
    const label = `${history}/${years}y`;
    expect(material.diagnostics.uniqueMaterialCount, label)
      .toBeLessThanOrEqual(material.bodies.length);
    const triangles = geometry.meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0);
    expect(triangles, label).toBeLessThan(DEFAULT_CRYSTAL_GEOMETRY_CONFIG.maxTriangles);
  });
});

describe('Crystal regression sweep — growth stays coherent', () => {
  it.each(HISTORIES)('adds to %s rather than relaying it out', (history) => {
    // The property Pass 1 identified as the one every later pass had to
    // preserve: a couple who has been together longer gets *more* crystal, not
    // a different one. The monarch grows monotonically and the children keep
    // the azimuths they were given.
    let previousHeight = 0;
    let previousAzimuths: string[] = [];
    let carried = 0;
    for (const years of AGES) {
      const { growth } = observedAt(history, years);
      const monarch = growth.bodies.find((body) => body.id === 'crystal:mother')!;
      expect(monarch.renderedLength, `${history} ${years}y`).toBeGreaterThan(previousHeight);
      previousHeight = monarch.renderedLength;

      const azimuths = growth.bodies
        .filter((body) => body.id.startsWith('crystal:year:'))
        .map((body) => `${body.id}:${Math.round(Math.atan2(body.anchor.z, body.anchor.x) * 100)}`);
      // Every year that had already closed is still exactly where it was. The
      // year in progress is excluded: it is still growing, so its distance from
      // the axis moves with it (ADR-0004), and only its bearing is frozen.
      const closed = new Set(azimuths.map((entry) => entry.split(':').slice(0, 3).join(':')));
      for (const previous of previousAzimuths) {
        const id = previous.split(':').slice(0, 3).join(':');
        if (!closed.has(id)) continue;
        carried += 1;
        expect(azimuths, `${history} ${years}y`).toContain(previous);
      }
      previousAzimuths = azimuths;
    }
    // The assertion above skips years that had not closed yet, and a filter
    // that skipped everything would leave this test green while checking
    // nothing at all — which is the failure mode six passes of this work have
    // now turned up five times.
    expect(carried, `${history}: nothing was carried forward`).toBeGreaterThan(8);
  });

  it.each(HISTORIES)('never lets %s lose a facet to the passage of time', (history) => {
    // ADR-0004's hardest guarantee, and the one that needs the same couple
    // rather than two: a facet is earned at the cost in force when the photo
    // arrived, so a threshold that rises later cannot take it away. Dividing
    // the current photo count by the current threshold would break this — a
    // couple with 100 photos at eleven months has 20 facets, and two months
    // later the divisor changes and they would have 10.
    let previous = 0;
    for (const years of AGES) {
      const { species } = observedAt(history, years);
      const facets = species.mother.facetCount ?? 0;
      expect(facets, `${history} ${years}y`).toBeGreaterThanOrEqual(previous);
      previous = facets;
    }
  });

  it.each(HISTORIES)('never shrinks a closed year of %s as the colony fills', (history) => {
    // The invariant ADR-0018 put at risk. A child's share of the monarch now
    // falls as the colony crowds — twenty bodies of a given width cannot fit a
    // circle narrower than twenty of them — and each new year both takes a
    // share away and grows the monarch. If the share fell faster than the
    // monarch rose, a couple would watch their early years get *smaller* every
    // anniversary. The bound is stated in `CHILD_SHARE_FALLOFF`; this is the
    // same claim measured on the built bodies.
    const previous = new Map<string, number>();
    let compared = 0;
    for (const years of AGES) {
      const { growth } = observedAt(history, years);
      for (const body of growth.bodies) {
        if (!body.id.startsWith('crystal:year:')) continue;
        const was = previous.get(body.id);
        if (was !== undefined) {
          compared += 1;
          expect(body.renderedLength, `${history} ${body.id} at ${years}y`)
            .toBeGreaterThanOrEqual(was - 1e-6);
        }
        previous.set(body.id, body.renderedLength);
      }
    }
    expect(compared, `${history}: nothing was compared`).toBeGreaterThan(8);
  });

  it.each(HISTORIES)('never shrinks %s and never loses a body', (history) => {
    // Bodies follow years, so the count can only climb.
    let previous = 0;
    for (const years of AGES) {
      const { growth } = observedAt(history, years);
      expect(growth.bodies.length, `${history} ${years}y`).toBeGreaterThanOrEqual(previous);
      previous = growth.bodies.length;
    }
  });
});

describe('Crystal regression sweep — every quality tier', () => {
  it.each(['high', 'balanced', 'low', 'fallback'] as const)('builds on %s', (quality) => {
    // A weaker device gets a simpler crystal, never a broken one.
    for (const history of HISTORIES) {
      const { geometry, material } = run(history, 6, quality);
      expect(geometry.diagnostics.nonFiniteBodyIds, `${history}/${quality}`).toEqual([]);
      expect(material.bodies.length, `${history}/${quality}`).toBeGreaterThan(0);
      for (const body of material.bodies) {
        expect(Number.isFinite(body.baseColor.r), `${history}/${quality}`).toBe(true);
        expect(Number.isFinite(body.shader.inclusionDensity), `${history}/${quality}`).toBe(true);
      }
    }
  });
});
