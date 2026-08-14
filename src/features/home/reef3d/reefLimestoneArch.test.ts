import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ReefGrowthArchPlacement } from '@/engine/species/reef';
import {
  buildReefLimestoneArchGeometry,
  reefArchFootPoints,
  REEF_LIMESTONE_ARCH_PASS,
  REEF_LIMESTONE_ARCH_VERSION,
  type ReefArchCoralAttachmentSlot,
} from './reefLimestoneArch';
import {
  createReefTerracedFoundationProfile,
  sampleReefTerracedFoundation,
} from './reefTerracedFoundation';
import {
  collectReefSupportSlotCandidates,
  raycastReefSupport,
} from './reefSupportPlacement';

const ARCH: ReefGrowthArchPlacement = {
  id: 'reef:growth-arch:2',
  sourceEntityId: 'reef:year-arch:2',
  yearIndex: 2,
  center: { x: 0.72, y: 0.05, z: -0.54 },
  rotationY: 0.68,
  span: 1.52,
  height: 1.84,
  thickness: 0.205,
  curveDepth: 0.16,
  footprintRadius: 0.654,
  seed: 918_273,
};

const PROFILE = createReefTerracedFoundationProfile({
  radius: 3,
  verticalScale: 1.12,
  seed: 26_122_022,
});

function rounded(values: ArrayLike<number>): number[] {
  return Array.from(values, (value) => Number(value.toFixed(6)));
}

function attachmentSlots(geometry: THREE.BufferGeometry): ReefArchCoralAttachmentSlot[] {
  return geometry.userData.reefCoralAttachmentSlots as ReefArchCoralAttachmentSlot[];
}

describe('reef limestone year arch', () => {
  it('builds one bounded faceted mesh with variable thickness and readable limestone color', () => {
    const geometry = buildReefLimestoneArchGeometry({ arch: ARCH, profile: PROFILE });
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const color = geometry.getAttribute('color');
    const uv = geometry.getAttribute('uv');

    expect(geometry.index).toBeNull();
    expect(position.count).toBeGreaterThan(900);
    expect(position.count).toBeLessThan(2_500);
    expect(position.count / 3).toBeLessThan(800);
    expect(normal.count).toBe(position.count);
    expect(color.count).toBe(position.count);
    expect(uv.count).toBe(position.count);
    expect(geometry.userData.reefLimestoneArchVersion).toBe(REEF_LIMESTONE_ARCH_VERSION);
    expect(geometry.userData.reefLimestoneArchPass).toBe(REEF_LIMESTONE_ARCH_PASS);
    expect(geometry.userData.reefArchDrawCalls).toBe(1);
    expect(geometry.userData.reefArchProtrusionCount).toBe(7);
    expect(geometry.userData.reefArchAttachmentCount).toBe(3);
    expect(
      geometry.userData.reefArchMaximumRadius / geometry.userData.reefArchMinimumRadius,
    ).toBeGreaterThan(1.35);
    expect(geometry.boundingBox?.max.y).toBeGreaterThan(
      geometry.userData.reefArchApexHeight,
    );

    for (let index = 0; index < normal.count; index += 1) {
      const length = Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index));
      expect(Number.isFinite(length)).toBe(true);
      expect(length).toBeCloseTo(1, 4);
    }

    geometry.dispose();
  });

  it('plants both feet into their sampled terraces and publishes three raycastable shelves', () => {
    const geometry = buildReefLimestoneArchGeometry({ arch: ARCH, profile: PROFILE });
    const [leftFoot, rightFoot] = reefArchFootPoints(ARCH);
    const expectedFootHeights = [
      sampleReefTerracedFoundation(PROFILE, leftFoot.x, leftFoot.z).height,
      sampleReefTerracedFoundation(PROFILE, rightFoot.x, rightFoot.z).height,
    ];
    expect(geometry.userData.reefArchFootHeights).toEqual(expectedFootHeights);

    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
    mesh.position.set(ARCH.center.x, 0, ARCH.center.z);
    mesh.rotation.y = ARCH.rotationY;
    mesh.updateMatrixWorld(true);
    const slots = attachmentSlots(geometry);
    const candidates = collectReefSupportSlotCandidates([mesh]);

    expect(slots).toHaveLength(3);
    expect(new Set(slots.map((slot) => slot.id)).size).toBe(3);
    expect(slots.every((slot) => slot.availableFromEpoch === ARCH.yearIndex)).toBe(true);
    expect(candidates).toHaveLength(3);
    expect(candidates.every((candidate) => candidate.availableFromEpoch === ARCH.yearIndex))
      .toBe(true);
    for (const candidate of candidates) {
      expect(raycastReefSupport([mesh], candidate.x, candidate.z, 0.2)).not.toBeNull();
    }

    geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('is deterministic while different year seeds retain different erosion', () => {
    const first = buildReefLimestoneArchGeometry({ arch: ARCH, profile: PROFILE });
    const repeated = buildReefLimestoneArchGeometry({ arch: ARCH, profile: PROFILE });
    const changed = buildReefLimestoneArchGeometry({
      arch: { ...ARCH, id: 'reef:growth-arch:3', yearIndex: 3, seed: ARCH.seed + 1 },
      profile: PROFILE,
    });

    expect(rounded(repeated.getAttribute('position').array))
      .toEqual(rounded(first.getAttribute('position').array));
    expect(attachmentSlots(repeated)).toEqual(attachmentSlots(first));
    expect(rounded(changed.getAttribute('position').array))
      .not.toEqual(rounded(first.getAttribute('position').array));

    first.dispose();
    repeated.dispose();
    changed.dispose();
  });
});
