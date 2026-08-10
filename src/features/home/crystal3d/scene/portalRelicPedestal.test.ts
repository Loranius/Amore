import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PORTAL_RELIC_DEPTH,
  PORTAL_RELIC_GLOW_Y,
  PORTAL_RELIC_OUTER_RADIUS,
  PORTAL_RELIC_TOP_RADIUS,
  buildPortalBrushedMetalTexture,
  buildPortalBrushedMetalNormalTexture,
  buildPortalRelicBodyGeometry,
  buildPortalRelicEngravingGeometry,
  buildPortalRelicGlowGeometry,
} from './portalRelicPedestal';

function triangles(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  return index === null
    ? geometry.getAttribute('position').count / 3
    : index.count / 3;
}

describe('portal relic pedestal', () => {
  it('keeps one solid setting exactly on the crystal ground plane', () => {
    const body = buildPortalRelicBodyGeometry();
    const position = body.getAttribute('position');
    const normal = body.getAttribute('normal');
    let centreOnGround = false;
    let topEdgeOnGround = false;
    let upwardTopVertices = 0;
    let downwardTopVertices = 0;

    for (let index = 0; index < position.count; index += 1) {
      const radius = Math.hypot(position.getX(index), position.getZ(index));
      const y = position.getY(index);
      if (radius < 1e-6 && Math.abs(y) < 1e-6) centreOnGround = true;
      if (Math.abs(radius - 1.05) < 1e-4 && Math.abs(y) < 1e-6) topEdgeOnGround = true;
      if (radius <= 1.051 && Math.abs(y) < 1e-6) {
        if (normal.getY(index) > 0.9) upwardTopVertices += 1;
        if (normal.getY(index) < -0.9) downwardTopVertices += 1;
      }
    }

    expect(centreOnGround).toBe(true);
    expect(topEdgeOnGround).toBe(true);
    expect(upwardTopVertices).toBeGreaterThan(0);
    expect(downwardTopVertices).toBe(0);
    expect(PORTAL_RELIC_TOP_RADIUS).toBeGreaterThan(1.05);
    expect(body.boundingBox!.min.y).toBeCloseTo(-PORTAL_RELIC_DEPTH, 6);
    expect(body.boundingBox!.max.x).toBeCloseTo(PORTAL_RELIC_OUTER_RADIUS, 6);
    body.dispose();
  });

  it('merges bronze, engraving, and violet glass into three bounded draw layers', () => {
    const geometries = [
      buildPortalRelicBodyGeometry(),
      buildPortalRelicEngravingGeometry(),
      buildPortalRelicGlowGeometry(),
    ];

    for (const geometry of geometries) {
      expect(geometry.groups.length).toBeLessThanOrEqual(1);
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(geometry.boundingBox!.min.toArray().every(Number.isFinite)).toBe(true);
      expect(geometry.boundingBox!.max.toArray().every(Number.isFinite)).toBe(true);
    }

    const total = geometries.reduce((sum, geometry) => sum + triangles(geometry), 0);
    expect(total).toBeGreaterThan(2_000);
    expect(total).toBeLessThan(8_000);
    geometries.forEach((geometry) => geometry.dispose());
  });

  it('places the light band below the crystal plane and the seal on top', () => {
    const glow = buildPortalRelicGlowGeometry();
    const position = glow.getAttribute('position');
    let bandVertices = 0;
    let widest = 0;

    for (let index = 0; index < position.count; index += 1) {
      const y = position.getY(index);
      if (Math.abs(y - PORTAL_RELIC_GLOW_Y) <= 0.024) bandVertices += 1;
      widest = Math.max(widest, Math.hypot(position.getX(index), position.getZ(index)));
    }

    expect(bandVertices).toBeGreaterThan(0);
    expect(PORTAL_RELIC_GLOW_Y).toBeLessThan(0);
    expect(widest).toBeGreaterThan(PORTAL_RELIC_TOP_RADIUS);
    expect(widest).toBeLessThan(PORTAL_RELIC_OUTER_RADIUS);
    glow.dispose();
  });

  it('builds the same lightweight brushed-metal map every time', () => {
    const first = buildPortalBrushedMetalTexture();
    const again = buildPortalBrushedMetalTexture();
    const firstData = first.image.data as Uint8Array;
    const againData = again.image.data as Uint8Array;

    expect(Array.from(firstData)).toEqual(Array.from(againData));
    expect(first.image.width).toBe(64);
    expect(first.image.height).toBe(64);
    expect(first.wrapS).toBe(THREE.RepeatWrapping);
    expect(first.repeat.x).toBe(3);

    first.dispose();
    again.dispose();
  });

  it('builds a deterministic tangent-space normal map for the metal grain', () => {
    const first = buildPortalBrushedMetalNormalTexture();
    const again = buildPortalBrushedMetalNormalTexture();
    const firstData = first.image.data as Uint8Array;
    const againData = again.image.data as Uint8Array;

    expect(Array.from(firstData)).toEqual(Array.from(againData));
    expect(first.image.width).toBe(64);
    expect(first.image.height).toBe(64);
    expect(firstData.some((value, index) => index % 4 < 2 && value !== 128)).toBe(true);
    expect(firstData.every((value, index) => index % 4 !== 2 || value === 255)).toBe(true);

    first.dispose();
    again.dispose();
  });
});
