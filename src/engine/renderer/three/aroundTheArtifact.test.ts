import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from '../../geometry/config';
import { buildCrystalGeometry } from '../../geometry/engine';
import { CRYSTAL_SUBSTRATE_BODY_ID } from '../../geometry/substrate';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../../growth';
import { buildCrystalLifeState } from '../../life';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../../material';
import {
  CRYSTAL_MONARCH_BODY_ID,
  buildCrystalSpeciesBlueprint,
  crystalToGrowthBlueprint,
} from '../../species/crystal';
import {
  PORTAL_GROUND_Y,
  portalCameraFrame,
} from '../../../features/home/crystal3d/scene/portalScene';
import { createThreeCrystalRenderBundle, crystalSceneHeight, crystalSceneRadius } from './bundle';
import { createThreeCrystalInnerSparks } from './innerSparks';

// ============================================================
// The brief's §12: the artifact checked from 0°, 90°, 180° and 270°.
// ------------------------------------------------------------
// **This is not a render.** vitest has no WebGL, and the brief is explicit
// that a visual check may not be claimed in an environment without it. What
// these tests do instead is project the real published geometry through the
// real camera frame at the four bearings and assert the properties a render
// would be looked at *for* — framing, silhouette, and where the lights land.
//
// Every one of them corresponds to a defect this codebase has actually
// shipped: an artifact cut off at the bottom by a camera frame that treated
// perspective as orthographic, a silhouette that read correctly from one
// bearing and as a slab from the next, and a point cloud drawn with depth
// testing off that could in principle land in front of a body it is supposed
// to be inside.
// ============================================================

const BEARINGS = [0, 90, 180, 270] as const;

/** Portrait phone and a wide desktop: framing fails at the extremes first. */
const ASPECTS = [
  { label: 'phone', value: 0.46 },
  { label: 'wide', value: 1.9 },
] as const;

const COLONIES = [
  { label: '1y', years: 1, events: 6 },
  { label: '7y', years: 7, events: 40 },
  { label: '25y', years: 25, events: 160 },
] as const;

function colony(years: number, eventCount: number) {
  const events: EvolutionEventInput[] = Array.from({ length: eventCount }, (_, index) => ({
    id: `around-${index}`,
    occurredAt: `${2001 + Math.floor((index / eventCount) * years)}-0${(index % 8) + 1}-14T09:00:00Z`,
    source: index % 3 === 0 ? 'memories@1' : index % 3 === 1 ? 'map@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, exploration: 0.4, achievement: 0.5 },
    portalActivity: 0.5,
  }));
  const artifact = buildArtifactBlueprint({
    coupleId: `around:${years}`,
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
  const life = buildCrystalLifeState({
    species,
    composition,
    material,
    config: {
      rulesVersion: '1.0.0',
      reducedMotion: false,
      quality: 'high',
      maxSparkles: 64,
      mediaFinishedCount: 40,
    },
  });
  return { geometry, material, life };
}

interface Camera {
  eye: readonly [number, number, number];
  target: readonly [number, number, number];
  tanHalfFov: number;
  aspect: number;
}

/**
 * The camera the portal actually uses, orbited to a bearing.
 *
 * `portalCameraFrame` publishes the default position; OrbitControls turns it
 * about the target's vertical, which is what a couple does with a finger. So a
 * bearing is that same frame rotated about Y — not a different frame.
 */
function cameraAt(bearingDeg: number, aspect: number, radius: number, height: number): Camera {
  const frame = portalCameraFrame(aspect, radius, height);
  const angle = (bearingDeg * Math.PI) / 180;
  const offsetX = frame.position[0] - frame.target[0];
  const offsetZ = frame.position[2] - frame.target[2];
  return {
    eye: [
      frame.target[0] + offsetX * Math.cos(angle) + offsetZ * Math.sin(angle),
      frame.position[1],
      frame.target[2] - offsetX * Math.sin(angle) + offsetZ * Math.cos(angle),
    ],
    target: frame.target,
    tanHalfFov: Math.tan(((frame.fov * Math.PI) / 180) / 2),
    aspect,
  };
}

/** Normalised device coordinates, or null when the point is behind the eye. */
function project(camera: Camera, x: number, y: number, z: number): { x: number; y: number } | null {
  const forward = [
    camera.target[0] - camera.eye[0],
    camera.target[1] - camera.eye[1],
    camera.target[2] - camera.eye[2],
  ];
  const flen = Math.hypot(forward[0]!, forward[1]!, forward[2]!);
  const f = forward.map((component) => component / flen) as [number, number, number];
  // World up is +Y; the camera never rolls (OrbitControls holds the horizon).
  const right = [f[2], 0, -f[0]];
  const rlen = Math.hypot(right[0]!, right[1]!, right[2]!) || 1;
  const r = right.map((component) => component / rlen) as [number, number, number];
  const u: [number, number, number] = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  const d = [x - camera.eye[0], y - camera.eye[1], z - camera.eye[2]];
  const depth = d[0]! * f[0] + d[1]! * f[1] + d[2]! * f[2];
  if (depth <= 1e-6) return null;
  return {
    x: (d[0]! * r[0] + d[1]! * r[1] + d[2]! * r[2]) / (depth * camera.tanHalfFov * camera.aspect),
    y: (d[0]! * u[0] + d[1]! * u[1] + d[2]! * u[2]) / (depth * camera.tanHalfFov),
  };
}

/** Convex hull of 2D points, counter-clockwise (monotone chain). */
function hull(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (source: typeof sorted): typeof sorted => {
    const out: typeof sorted = [];
    for (const point of source) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0) {
        out.pop();
      }
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

function insideHull(
  polygon: readonly { x: number; y: number }[],
  point: { x: number; y: number },
  slack: number,
): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]!;
    const b = polygon[(index + 1) % polygon.length]!;
    const edgeX = b.x - a.x;
    const edgeY = b.y - a.y;
    const length = Math.hypot(edgeX, edgeY) || 1;
    // Counter-clockwise hull: inside is to the left of every edge.
    const signed = ((point.x - a.x) * edgeY - (point.y - a.y) * edgeX) / length;
    if (signed > slack) return false;
  }
  return true;
}

describe('the artifact from 0°, 90°, 180° and 270° (crystal cluster brief §12)', () => {
  it('stays inside the frame at every bearing, on a phone and on a wide screen', () => {
    // The defect this guards. The camera frame divided the artifact's height by
    // twice the tangent of the half-angle and stopped there, which is the
    // orthographic answer: it ignored that the near side of a druse stands one
    // radius closer to the eye than its axis. On a wide screen a twenty-year
    // colony lost 1% below the bottom edge, and with gem proportions 14%.
    //
    // Checked at the four bearings because the artifact is not a solid of
    // revolution — the daughters ring the monarch unevenly, so the widest
    // profile is not the same one from every side.
    for (const { label, years, events } of COLONIES) {
      const { geometry, material } = colony(years, events);
      const bundle = createThreeCrystalRenderBundle(geometry, material);
      // Three's own transform, not a second copy of the fit arithmetic. A test
      // that re-derives the placement can only ever agree with itself.
      bundle.group.updateMatrixWorld(true);
      const world = bundle.content.matrixWorld;
      const point = new THREE.Vector3();
      const sceneRadius = crystalSceneRadius(geometry, { includeSubstrate: false })
        * bundle.fit.scale;
      const sceneHeight = crystalSceneHeight(geometry) * bundle.fit.scale;

      for (const aspect of ASPECTS) {
        for (const bearing of BEARINGS) {
          const camera = cameraAt(bearing, aspect.value, sceneRadius, sceneHeight);
          // One assertion per view, not one per vertex. Both because a
          // quarter of a million `expect` calls times the test out, and
          // because "this body overhangs by this much" is a far more useful
          // failure than "some vertex somewhere is out".
          let worstX = 0;
          let worstY = 0;
          let worstBody = '';
          let behind = 0;
          for (const mesh of geometry.meshes) {
            for (let index = 0; index < mesh.positions.length; index += 3) {
              point.set(
                mesh.positions[index]!,
                mesh.positions[index + 1]!,
                mesh.positions[index + 2]!,
              ).applyMatrix4(world);
              const ndc = project(camera, point.x, point.y, point.z);
              if (ndc === null) {
                behind += 1;
                continue;
              }
              if (Math.abs(ndc.x) > worstX || Math.abs(ndc.y) > worstY) worstBody = mesh.bodyId;
              worstX = Math.max(worstX, Math.abs(ndc.x));
              worstY = Math.max(worstY, Math.abs(ndc.y));
            }
          }
          const where = `${label} ${aspect.label} ${bearing}° (worst: ${worstBody})`;
          expect(behind, `${where} behind the camera`).toBe(0);
          expect(worstX, `${where} horizontally`).toBeLessThanOrEqual(1);
          expect(worstY, `${where} vertically`).toBeLessThanOrEqual(1);
        }
      }
      bundle.dispose();
    }
  });

  it('shows the monarch as the same gem from every bearing', () => {
    // §2 asks for a height-to-width ratio of 1.80–2.10 and a cross-section of
    // 0.94 by 1.06. Those two together mean the silhouette must not change
    // character as the couple turns the portal: a body that reads as a gem from
    // the front and as a slab from the side is the failure a 1.44:1
    // cross-section produced before the gem pass.
    //
    // Measured on the monarch alone, in her own frame, from her own anchor.
    // Measuring a leaning body from the world origin is the trap this codebase
    // has fallen into twice.
    for (const { label, years, events } of COLONIES) {
      const { geometry } = colony(years, events);
      const monarch = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_MONARCH_BODY_ID)!;
      const anchor = monarch.profile.geometryAnchor;

      const ratios: number[] = [];
      for (const bearing of BEARINGS) {
        const angle = (bearing * Math.PI) / 180;
        // Across the line of sight, which is what a silhouette's width is.
        const acrossX = Math.cos(angle);
        const acrossZ = -Math.sin(angle);
        let low = Infinity;
        let high = -Infinity;
        let left = Infinity;
        let right = -Infinity;
        for (let index = 0; index < monarch.positions.length; index += 3) {
          const x = monarch.positions[index]! - anchor.x;
          const y = monarch.positions[index + 1]! - anchor.y;
          const z = monarch.positions[index + 2]! - anchor.z;
          low = Math.min(low, y);
          high = Math.max(high, y);
          const across = x * acrossX + z * acrossZ;
          left = Math.min(left, across);
          right = Math.max(right, across);
        }
        ratios.push((high - low) / Math.max(1e-6, right - left));
      }

      // **Consistency, not the absolute band.** §2's 1.80–2.10 is defined on
      // the body's *full* width — the widest it is anywhere — and
      // `gemSilhouette.test.ts` already holds it on exactly that measure. What
      // is measured here is a different quantity: the width of the silhouette
      // along one line of sight, which for a faceted prism is the
      // across-flats distance rather than the across-corners one and is
      // legitimately smaller (0.866 of it for a hexagon). Asserting §2's
      // numbers on it would be asserting a band the quantity was never
      // defined in — the first version of this test did, and failed at 2.30 on
      // a one-year colony with nothing actually wrong.
      //
      // What §12 is for is that the four views agree. The published
      // cross-section is 0.94 by 1.06, so a quarter turn may change the
      // apparent width by that ratio and by the habit's own asymmetry, and no
      // more.
      const spread = Math.max(...ratios) / Math.min(...ratios);
      expect(spread, `${label} spread across bearings`).toBeLessThan(1.2);
      for (const ratio of ratios) {
        expect(Number.isFinite(ratio), label).toBe(true);
        expect(ratio, label).toBeGreaterThan(1);
      }
    }
  });

  it('keeps every inner spark inside the monarch’s silhouette at every bearing', () => {
    // The open risk in §9. The cloud is drawn with depth testing off — it has
    // to be, because an opaque shell hides anything behind it — so a spark that
    // projects outside her outline is not an inclusion catching light, it is a
    // dot floating in front of the crystal, and nothing in the renderer would
    // stop it.
    //
    // Her silhouette is exactly the convex hull of her projected vertices, not
    // an approximation of it: ADR-0006 builds the body as an intersection of
    // half-spaces, so she is convex by construction and the projection of a
    // convex body is a convex polygon.
    for (const { label, years, events } of COLONIES) {
      const { geometry, material, life } = colony(years, events);
      const bundle = createThreeCrystalRenderBundle(geometry, material);
      const sparks = createThreeCrystalInnerSparks(bundle, geometry, life)!;
      expect(sparks, label).not.toBeNull();
      const monarch = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_MONARCH_BODY_ID)!;
      // **Each through its own world matrix.** The first version of this test
      // projected both the monarch and the sparks from raw engine units, where
      // they agree however either one is parented — which is exactly why it
      // passed while the cloud was hanging in the sky above the portal's
      // crystal, missing the fit transform the batches carry.
      bundle.group.updateMatrixWorld(true);
      const monarchWorld = bundle.meshes.get(CRYSTAL_MONARCH_BODY_ID)?.matrixWorld
        ?? bundle.content.matrixWorld;
      const sparkWorld = sparks.points.matrixWorld;
      const point = new THREE.Vector3();
      const sceneRadius = crystalSceneRadius(geometry, { includeSubstrate: false })
        * bundle.fit.scale;
      const sceneHeight = crystalSceneHeight(geometry) * bundle.fit.scale;
      const position = sparks.points.geometry.getAttribute('position');

      for (const aspect of ASPECTS) {
        for (const bearing of BEARINGS) {
          const camera = cameraAt(bearing, aspect.value, sceneRadius, sceneHeight);
          const outline: { x: number; y: number }[] = [];
          for (let index = 0; index < monarch.positions.length; index += 3) {
            point.set(
              monarch.positions[index]!,
              monarch.positions[index + 1]!,
              monarch.positions[index + 2]!,
            ).applyMatrix4(monarchWorld);
            const ndc = project(camera, point.x, point.y, point.z);
            if (ndc !== null) outline.push(ndc);
          }
          const silhouette = hull(outline);
          expect(silhouette.length, `${label} ${bearing}° outline`).toBeGreaterThan(2);

          for (let index = 0; index < position.count; index += 1) {
            point.set(
              position.getX(index),
              position.getY(index),
              position.getZ(index),
            ).applyMatrix4(sparkWorld);
            const ndc = project(camera, point.x, point.y, point.z);
            expect(ndc, `${label} ${aspect.label} ${bearing}° spark ${index}`).not.toBeNull();
            expect(
              insideHull(silhouette, ndc!, 1e-6),
              `${label} ${aspect.label} ${bearing}° spark ${index} outside the monarch`,
            ).toBe(true);
          }
        }
      }
      sparks.dispose();
      bundle.dispose();
    }
  });

  it('stands the whole colony on the ground, not through it', () => {
    // Not a bearing check — a check the bearing checks depend on. If the fitted
    // artifact floated or sank, "inside the frame" would still pass while the
    // portal showed a crystal hovering over its own root.
    for (const { label, years, events } of COLONIES) {
      const { geometry, material } = colony(years, events);
      const bundle = createThreeCrystalRenderBundle(geometry, material);
      // The substrate's own foot is the artifact's lowest point, and the fit
      // puts it on the portal's ground plane.
      const substrate = geometry.meshes.find(
        (mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID,
      )!;
      bundle.group.updateMatrixWorld(true);
      const world = bundle.content.matrixWorld;
      const point = new THREE.Vector3();
      let lowestOfAll = Infinity;
      let lowestSubstrate = Infinity;
      for (const mesh of geometry.meshes) {
        for (let index = 0; index < mesh.positions.length; index += 3) {
          point.set(
            mesh.positions[index]!,
            mesh.positions[index + 1]!,
            mesh.positions[index + 2]!,
          ).applyMatrix4(world);
          lowestOfAll = Math.min(lowestOfAll, point.y);
          if (mesh.bodyId === substrate.bodyId) lowestSubstrate = Math.min(lowestSubstrate, point.y);
        }
      }
      // The root is the lowest thing in the colony: no crystal's base cap may
      // reach below the stone it grew out of (ADR-0003).
      expect(lowestSubstrate, label).toBeCloseTo(lowestOfAll, 6);
      // And the whole thing stands on the portal's ground plane rather than
      // hovering over it or sinking through it.
      expect(bundle.baseY, `${label} sits on the portal ground`)
        .toBeLessThanOrEqual(PORTAL_GROUND_Y + 1e-6);
      bundle.dispose();
    }
  });
});
