// ============================================================
// referenceDruse — фінальний crystal-specific композиційний контракт.
// ------------------------------------------------------------
// Референс задає не конкретну картинку, а читабельну анатомію друзи:
//   1) один об'ємний призматичний монарх;
//   2) один високий бічний hero-spire;
//   3) решта тіл утворює щільну базальну корону, а не нарости по стовбуру.
//
// Прохід виконується ПІСЛЯ generic Composition Framework. Він не створює
// і не видаляє тіла, не читає час/камеру/renderer і не змінює їхні ключі.
// Нові тіла додаються в кінець стабільного порядку, тому не пересувають
// уже наявні slot-и корони (append-only для звичайного додавання даних).
// ============================================================
import { hashSeedString, mulberry32 } from '../../mulberry32';
import type { CrystalArchetype, DepositedCrystal } from '../artifactTypes';
import { MATURITY_HEIGHT_SCALE, MATURITY_RADIUS_SCALE, radiusAtT } from '../growthSurface';
import {
  add,
  normalize,
  perpendicularBasis,
  scale,
  v3,
  type Vec3,
} from '../vec3';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

function stableBaseAngle(seedNum: number): number {
  const rng = mulberry32(seedNum + hashSeedString('reference-druse:base-angle'));
  return rng() * TAU;
}

function chooseHero(bodies: readonly DepositedCrystal[]): DepositedCrystal | null {
  return (
    bodies.find(
      (body) =>
        !body.primary &&
        body.role === 'dominant' &&
        (body.kind === 'milestone' || body.emphasized === true),
    ) ??
    bodies.find(
      (body) => !body.primary && body.role === 'dominant' && body.tier === 'support',
    ) ??
    bodies.find((body) => !body.primary && body.role === 'dominant') ??
    null
  );
}

function crownArchetype(body: DepositedCrystal): CrystalArchetype {
  const archetype = body.archetype ?? 'spear';
  if (archetype === 'matrix' || archetype === 'blade' || archetype === 'tabular') {
    return body.role === 'micro' ? 'spear' : 'prismatic';
  }
  if (body.role === 'micro' && archetype !== 'needle' && archetype !== 'etched') {
    return 'spear';
  }
  return archetype;
}

function radialFrame(axis: Vec3, angle: number): { radial: Vec3; tangent: Vec3 } {
  const [u, w] = perpendicularBasis(axis);
  const radial = normalize(add(scale(u, Math.cos(angle)), scale(w, Math.sin(angle))));
  const tangent = normalize(add(scale(u, -Math.sin(angle)), scale(w, Math.cos(angle))));
  return { radial, tangent };
}

function placeOnBasalCrown(
  body: DepositedCrystal,
  monarch: DepositedCrystal,
  angle: number,
  hostT: number,
  outward: number,
  tangentJitter: number,
): DepositedCrystal {
  const { radial, tangent } = radialFrame(monarch.direction, angle);
  const hostHeight = monarch.length * MATURITY_HEIGHT_SCALE(monarch.maturity);
  const hostRadius = monarch.radius * MATURITY_RADIUS_SCALE(monarch.maturity);
  const radiusHere = radiusAtT(hostRadius, hostT);
  const center = add(
    monarch.renderedAnchor,
    scale(monarch.direction, hostHeight * hostT),
  );
  const contactPoint = add(center, scale(radial, radiusHere));
  const ownRenderedRadius = body.radius * MATURITY_RADIUS_SCALE(body.maturity);
  const burial = Math.min(ownRenderedRadius * 0.48, radiusHere * 0.62);
  const anchor = add(contactPoint, scale(radial, -burial));
  const direction = normalize(
    add(
      add(scale(monarch.direction, 1), scale(radial, outward)),
      scale(tangent, tangentJitter),
    ),
  );

  return {
    ...body,
    anchor,
    renderedAnchor: anchor,
    direction,
    attachment: {
      hostKey: monarch.key,
      contactPoint,
      contactNormal: radial,
      hostT,
      hostAngle: angle,
    },
  };
}

function shapeMonarch(monarch: DepositedCrystal): DepositedCrystal {
  // Референсний центральний шпиль має видиму ширину ≈40–45% висоти.
  // У 3D це slenderness близько 4.8–5.0, а не 11–13 як у тонкої голки.
  const length = Math.min(monarch.length, 2.15);
  const radius = Math.max(monarch.radius, length / 4.85);
  const direction = normalize(add(scale(monarch.direction, 0.15), v3(0, 0.85, 0)));
  return {
    ...monarch,
    length,
    radius,
    direction,
    tier: 'king',
    archetype: 'prismatic',
  };
}

function shapeHero(body: DepositedCrystal, monarch: DepositedCrystal): DepositedCrystal {
  const length = clamp(body.length, monarch.length * 0.62, monarch.length * 0.78);
  const radius = Math.max(body.radius, length / 6.1);
  return {
    ...body,
    length,
    radius: Math.min(radius, monarch.radius * 0.72),
    tier: 'support',
    archetype: 'prismatic',
  };
}

function shapeDominant(
  body: DepositedCrystal,
  monarch: DepositedCrystal,
  originalMonarchLength: number,
): DepositedCrystal {
  const originalRatio = originalMonarchLength > 0 ? body.length / originalMonarchLength : 0;
  const support = body.tier === 'support';
  const ratio = support
    ? clamp(originalRatio, 0.3, 0.52)
    : clamp(originalRatio, 0.17, 0.38);
  const length = monarch.length * ratio;
  const radius = Math.max(body.radius, length / (support ? 6.2 : 5.6));
  return {
    ...body,
    length,
    radius: Math.min(radius, monarch.radius * (support ? 0.62 : 0.48)),
    archetype: crownArchetype(body),
  };
}

function shapeSmall(
  body: DepositedCrystal,
  monarch: DepositedCrystal,
  originalMonarchLength: number,
): DepositedCrystal {
  const originalRatio = originalMonarchLength > 0 ? body.length / originalMonarchLength : 0;
  const micro = body.role === 'micro';
  const ratio = micro
    ? clamp(originalRatio, 0.045, 0.115)
    : clamp(originalRatio, 0.09, 0.23);
  const length = monarch.length * ratio;
  const radius = Math.max(body.radius, length / (micro ? 4.25 : 5.0));
  return {
    ...body,
    length,
    radius: Math.min(radius, monarch.radius * (micro ? 0.2 : 0.32)),
    archetype: crownArchetype(body),
  };
}

/**
 * Перетворює generic mineral composition на референсну друзу, не змінюючи
 * набір тіл або їхні стабільні ключі.
 */
export function applyReferenceDruseComposition(
  bodies: readonly DepositedCrystal[],
  seedNum: number,
): DepositedCrystal[] {
  const originalMonarch = bodies.find((body) => body.primary);
  if (originalMonarch === undefined) return [...bodies];

  const monarch = shapeMonarch(originalMonarch);
  const hero = chooseHero(bodies);
  const heroKey = hero?.key ?? null;
  const baseAngle = stableBaseAngle(seedNum);
  let dominantIndex = 0;
  let smallIndex = 0;

  return bodies.map((body) => {
    if (body.primary) return monarch;

    const keyed = mulberry32(seedNum + hashSeedString(`reference-druse:${body.key}`));
    const tangentJitter = (keyed() - 0.5) * 0.18;

    if (body.key === heroKey) {
      const shaped = shapeHero(body, monarch);
      return placeOnBasalCrown(
        shaped,
        monarch,
        baseAngle + 2.35,
        0.065,
        0.32,
        tangentJitter * 0.35,
      );
    }

    if (body.role === 'dominant') {
      const slot = dominantIndex;
      dominantIndex += 1;
      const shaped = shapeDominant(body, monarch, originalMonarch.length);
      const hostT = 0.035 + (slot % 3) * 0.035;
      const outward = shaped.tier === 'support' ? 0.42 : 0.62 + (slot % 2) * 0.12;
      return placeOnBasalCrown(
        shaped,
        monarch,
        baseAngle + 0.55 + slot * GOLDEN_ANGLE,
        hostT,
        outward,
        tangentJitter,
      );
    }

    const slot = smallIndex;
    smallIndex += 1;
    const shaped = shapeSmall(body, monarch, originalMonarch.length);
    const micro = shaped.role === 'micro';
    const hostT = micro
      ? 0.015 + (slot % 4) * 0.016
      : 0.025 + (slot % 4) * 0.022;
    const outward = micro ? 1.02 : 0.82 + (slot % 3) * 0.08;
    return placeOnBasalCrown(
      shaped,
      monarch,
      baseAngle + 1.05 + slot * GOLDEN_ANGLE,
      hostT,
      outward,
      tangentJitter,
    );
  });
}
