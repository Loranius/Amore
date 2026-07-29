import { clamp01, round6, roundVec, seededUnit } from '../../growth/math';
import type { OrganicAttractor, OrganicAttractorFieldConfig } from './types';

/**
 * Builds a deterministic set of points inside an ellipsoid.
 *
 * The field is intentionally renderer-independent. Tree and Coral species can
 * later map relationship events to these points without importing Three.js.
 */
export function generateEllipsoidAttractors(
  config: OrganicAttractorFieldConfig,
): OrganicAttractor[] {
  const count = Math.max(0, Math.floor(config.count));
  const horizontalRadius = Math.max(0, config.horizontalRadius);
  const verticalRadius = Math.max(0, config.verticalRadius);
  const startSequence = Math.max(0, Math.floor(config.startSequence ?? 0));

  return Array.from({ length: count }, (_, index) => {
    const azimuthUnit = seededUnit(config.seed, `organic-attractor:${index}:azimuth`);
    const verticalUnit = seededUnit(config.seed, `organic-attractor:${index}:vertical`);
    const radiusUnit = seededUnit(config.seed, `organic-attractor:${index}:radius`);
    const weightUnit = seededUnit(config.seed, `organic-attractor:${index}:weight`);

    const azimuth = azimuthUnit * Math.PI * 2;
    const vertical = verticalUnit * 2 - 1;
    const radial = Math.cbrt(clamp01(radiusUnit));
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));

    return {
      id: `organic-attractor:${startSequence + index}`,
      sequence: startSequence + index,
      position: roundVec({
        x: config.center.x + Math.cos(azimuth) * horizontalRadius * radial * horizontal,
        y: config.center.y + verticalRadius * radial * vertical,
        z: config.center.z + Math.sin(azimuth) * horizontalRadius * radial * horizontal,
      }),
      weight: round6(0.45 + weightUnit * 0.55),
    };
  });
}
