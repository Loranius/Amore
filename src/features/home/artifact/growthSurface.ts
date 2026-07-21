// ============================================================
// growthSurface — аналітична модель поверхні відкладеного кристала.
// ------------------------------------------------------------
// «Мінеральна маса» рушія — це НЕ мешi (artifact/ не знає про THREE), а
// набір аналітичних тіл: кожен відкладений кристал апроксимується звуженим
// конусом-призмою (frustum) із основою anchor, віссю direction, повними
// («дорослими») length/radius. Growth Site — точка на бічній поверхні
// такого тіла + аналітична нормаль; саме тут нуклеюється нова порція
// мінералу (mineralDeposition.ts), НІКОЛИ з абстрактного трансформу.
//
// Дві геометрії одного тіла:
//  • «скелетна» (повні розміри) — по ній йде ВЕСЬ вибір місць росту:
//    вона не залежить від сьогоднішньої дати, тож рулетка детермінована
//    назавжди («де закінчиться ріст, вирішено в момент відкладення»);
//  • «rendered» (розміри × поточна зрілість, ті САМІ коефіцієнти, що
//    використовує buildBranchGeometry) — по ній рахується фактична точка
//    основи на сьогодні: молодий субстрат ще короткий, і кристали, що
//    сидять на ньому, «їдуть» назовні разом із його ростом — плавна
//    геологічна еволюція без жодного збереженого стану.
// ============================================================
import { type Vec3, add, scale, sub, dot, normalize, perpendicularBasis, lengthOf } from './vec3';

/** Мінімальний опис тіла, достатній для параметризації поверхні. */
export interface SurfaceBody {
  anchor: Vec3;
  /** Одиничний напрямок росту (вісь тіла). */
  direction: Vec3;
  length: number;
  radius: number;
}

export interface SurfaceSample {
  point: Vec3;
  /** Аналітична зовнішня нормаль бічної поверхні (одинична). */
  normal: Vec3;
}

// Ті самі коефіцієнти масштабування зрілості, що в buildBranchGeometry
// (crystal3d/crystalCluster.ts) — h·(0.32+0.68m), r·(0.4+0.6m). Живуть тут,
// щоб рушій і рендерер гарантовано не розійшлися в «поточних» розмірах тіла.
export const MATURITY_HEIGHT_SCALE = (m: number): number => 0.32 + m * 0.68;
export const MATURITY_RADIUS_SCALE = (m: number): number => 0.4 + m * 0.6;

/** Лінійне звуження апроксимації: біля вістря радіус ~30% базового. */
const TAPER = 0.7;

export const radiusAtT = (radius: number, t: number): number => radius * (1 - TAPER * Math.max(0, Math.min(1, t)));

/**
 * Точка на бічній поверхні тіла: t — частка довжини вздовж осі (0=основа,
 * 1=вістря), angle — кут у локальній рамці perpendicularBasis. Нормаль —
 * радіальний напрямок, нахилений уперед на кут звуження конуса.
 */
export function sampleSurfacePoint(body: SurfaceBody, t: number, angle: number): SurfaceSample {
  const [u, w] = perpendicularBasis(body.direction);
  const radial = add(scale(u, Math.cos(angle)), scale(w, Math.sin(angle)));
  const point = add(add(body.anchor, scale(body.direction, t * body.length)), scale(radial, radiusAtT(body.radius, t)));
  // Нахил твірної конуса: на одиницю ходу вздовж осі радіус меншає на
  // TAPER·radius/length — рівно настільки нормаль «дивиться вгору».
  const slope = body.length > 1e-6 ? (TAPER * body.radius) / body.length : 0;
  const normal = normalize(add(radial, scale(body.direction, slope)));
  return { point, normal };
}

/**
 * Знакова відстань точки до бічної поверхні тіла (<0 — всередині).
 * Використовується тестами інваріанта «кожен кристал нуклеював НА поверхні
 * субстрату» — сам рушій кладе основи через sampleSurfacePoint напряму.
 */
export function distanceToSurface(body: SurfaceBody, p: Vec3): number {
  const rel = sub(p, body.anchor);
  const along = Math.max(0, Math.min(body.length, dot(rel, body.direction)));
  const axisPoint = add(body.anchor, scale(body.direction, along));
  const radialDist = lengthOf(sub(p, axisPoint));
  return radialDist - radiusAtT(body.radius, body.length > 1e-6 ? along / body.length : 0);
}
