import type { CrystalGeometryConfig } from './types';

export const DEFAULT_CRYSTAL_GEOMETRY_CONFIG: CrystalGeometryConfig = {
  // 1.12.0: children are cut to their own habit. A crystal that grew fast
  // develops fewer forms and more equal faces, so a juvenile carries no
  // shoulder cut, no dominant face, a narrower spread of prism offsets and a
  // minor rhombohedron retreated past closing — three broad termination faces
  // against the monarch's six alternating ones. Every child body changes shape.
  //
  // 1.11.0: the shaft is interrupted. A seeded two or three prism faces carry a
  // second plane that leans inward and only crosses the face in its upper
  // third, so a face that ran unbroken from base to shoulder now steps. Every
  // body gains one to three faces and its silhouette changes above the pin.
  //
  // 1.10.0: the termination became lattice rather than proportion. The crown
  // angle is the mineral's own 51.78° instead of an aspect-derived value
  // clamped into a 42–54° band, and alternate crown planes stand back as minor
  // rhombohedral faces instead of every plane meeting at one apex. Every
  // terminated body changes shape; the shoulder rises about 8%.
  //
  // 1.5.0: the crystal stopped being a lathe (ADR-0006). It is now the
  // intersection of a seeded set of half-spaces, so `rows` became a report of
  // the shape rather than the recipe for it and `planes` is the shape. Every
  // published mesh changes; snapshots taken before it no longer reproduce.
  //
  // 1.4.0: the substrate became a quartz vein instead of a cut plate, the
  // monarch sinks into it, and the year crystals lean.
  rulesVersion: '1.12.0',
  maxVertices: 18_000,
  maxTriangles: 30_000,
  hiddenFaceEpsilon: 0.002,
};
