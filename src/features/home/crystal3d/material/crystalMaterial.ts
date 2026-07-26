// ============================================================
// crystalMaterial — прив'язка матеріалу до регіонів (Volume VI).
// ------------------------------------------------------------
// Нормативно: docs/02_VOLUMES/Volume_06_Material_Engine.md,
// CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE §7, `CAI-REQ-009..010`,
// `V6-REQ-013..015`.
//
// Профіль вимагає, щоб матеріал в'язався ЛИШЕ до зовнішньо видимих
// семантичних регіонів і до оголошеної смуги шва. Тому цей крок:
//
//  • біжить ПІСЛЯ обробки стику (Volume V), а не разом із побудовою форми.
//    Поки грані не зрізано, невідомо, які з них лишаться зовні — а §7 прямо
//    забороняє давати видиму прив'язку внутрішнім і зрізаним граням;
//  • лишає вершини, які не входять у жодну вцілілу грань, БЕЗ кольору
//    (region 'unbound'). Це не косметика: саме так вимога «removed faces
//    receive no visible material binding» стає перевіркою, а не обіцянкою;
//  • змішує колір дитини з кольором господаря ТІЛЬКИ всередині смуги
//    шириною `materialBlendWidth` навколо лінії виходу з господаря
//    (`CAI-REQ-010`). Поза смугою колір тіла не змінюється взагалі —
//    і це те, що перевіряє тест.
//
// Чому змішування взагалі потрібне. Досі там, де дитина виходить із
// господаря, стикались два незалежні градієнти — око читало «два меші
// поруч». Смуга шва робить перехід мінеральним, і робить це в межах, які
// оголосив Volume IV, а не «на скільки вийде».
// ============================================================
import * as THREE from 'three';
import { mulberry32, hashSeedString } from '../../mulberry32';
import { MATERIAL_BLEND_RATIO } from '../../artifact/composition/attachment';
import type { ClusterBranch, ClusterMaterial } from '../crystalCluster';
import { distanceOutsideHost, projectOnHost, type HostSolid } from '../geometry/hostBody';

/** Семантичний регіон вершини — власність матеріалу (`V6-REQ-013`). */
export type MaterialRegion =
  /** Зовнішня видима поверхня: чистий власний матеріал тіла. */
  | 'external'
  /** Оголошена смуга шва навколо стику: єдине місце переходу матеріалів. */
  | 'seam'
  /** Не входить у жодну вцілілу грань — матеріалу не отримує взагалі. */
  | 'unbound';

export interface MaterialRegionStats {
  key: string;
  external: number;
  seam: number;
  unbound: number;
  /** Ширина смуги шва у світових одиницях (0 — тіло без господаря). */
  blendWidth: number;
}

const WARMTH_COLOR = new THREE.Color('#ff8a3d');
const MOVIE_COLOR = new THREE.Color('#4fd1e0');

/** Домішує тон (рецепти/фільми) у колір гілки. */
export function tintBranchColors(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix'>,
): { colorA: THREE.Color; colorB: THREE.Color } {
  const a = new THREE.Color(branch.colorA);
  const b = new THREE.Color(branch.colorB);
  if (material.warmthMix > 0) {
    a.lerp(WARMTH_COLOR, material.warmthMix * 0.5);
    b.lerp(WARMTH_COLOR, material.warmthMix * 0.6);
  }
  if (material.movieMix > 0) {
    a.lerp(MOVIE_COLOR, material.movieMix * 0.35);
    b.lerp(MOVIE_COLOR, material.movieMix * 0.45);
  }
  return { colorA: a, colorB: b };
}

/**
 * Легка per-facet варіація тону: справжній мінерал не має ідеально рівного
 * забарвлення грані до грані (тонкі домішки/включення). Тон фіксований на
 * всю грань, тому разом із flatShading кожна грань читається як окрема —
 * це і прибирає «картонний» ефект гладкого суцільного градієнта. Монарх
 * оптично найчистіший: вузький розкид тону (майже однорідний самоцвіт).
 */
function facetTints(branch: ClusterBranch, segments: number): number[] {
  return Array.from({ length: segments }, (_, idx) => {
    const rng = mulberry32(hashSeedString(`${branch.key}:facet:${idx}`));
    return branch.primary ? 0.92 + rng() * 0.16 : 0.82 + rng() * 0.36;
  });
}

const _world = new THREE.Vector3();
const _c = new THREE.Color();
const _hostC = new THREE.Color();

/**
 * Прив'язує матеріал до геометрії тіла ПІСЛЯ обробки стику.
 *
 * `self` — аналітична модель тіла (профіль + світовий трансформ),
 * `host` — тіло-господар (undefined для кореневих): лише навколо НЬОГО
 * дозволена смуга переходу, сторонні перетини матеріалу не змішують.
 */
export function bindMaterialRegions(
  geometry: THREE.BufferGeometry,
  branch: ClusterBranch,
  self: HostSolid,
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix'>,
  host?: { solid: HostSolid; branch: ClusterBranch } | undefined,
): MaterialRegionStats {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const { profile } = self;
  const colors = new Float32Array(position.count * 3);
  const regions: MaterialRegion[] = new Array<MaterialRegion>(position.count).fill('unbound');

  // Тільки вершини вцілілих граней узагалі отримують матеріал (§7).
  const bound = new Uint8Array(position.count);
  if (index !== null) for (let i = 0; i < index.count; i++) bound[index.getX(i)] = 1;

  const { colorA, colorB } = tintBranchColors(branch, material);
  const tints = facetTints(branch, profile.segments);
  const profileLen = profile.points.length;
  const quaternion = self.inverseQuaternion.clone().invert();

  // `CAI-REQ-010`: ширина смуги — політика Volume IV (attachment.ts), не
  // місцева вигадка рендерера. Береться від ПОТОЧНОГО радіуса тіла, бо
  // смуга живе на екрані, а не в скелетних розмірах.
  const blendWidth = host === undefined ? 0 : profile.r * MATERIAL_BLEND_RATIO;
  const hostColors = host === undefined ? null : tintBranchColors(host.branch, material);

  const stats: MaterialRegionStats = { key: branch.key, external: 0, seam: 0, unbound: 0, blendWidth };

  for (let i = 0; i < position.count; i++) {
    if (bound[i] === 0) {
      stats.unbound++;
      continue; // колір лишається 0,0,0 — прив'язки немає
    }
    const y = position.getY(i);
    const t = profile.h > 0 ? Math.min(1, Math.max(0, y / profile.h)) : 0;
    _c.lerpColors(colorA, colorB, t);

    let region: MaterialRegion = 'external';
    if (host !== undefined && hostColors !== null && blendWidth > 0) {
      _world
        .set(position.getX(i), y, position.getZ(i))
        .applyQuaternion(quaternion)
        .add(self.position);
      const d = distanceOutsideHost(_world, host.solid);
      if (d >= 0 && d < blendWidth) {
        region = 'seam';
        // Колір господаря САМЕ в точці виходу — перехід читається як одна
        // порода, а не як градієнт у бік «загального» кольору сусіда.
        const hostT = projectOnHost(_world, host.solid);
        _hostC.lerpColors(hostColors.colorA, hostColors.colorB, hostT);
        // Вага спадає від 1 біля поверхні господаря до 0 на межі смуги —
        // за смугою множник рівно 0, тож жодного впливу поза оголошеними
        // межами не лишається (це і перевіряє тест `CAI-REQ-010`).
        _c.lerp(_hostC, 1 - d / blendWidth);
      }
    }
    regions[i] = region;
    if (region === 'seam') stats.seam++;
    else stats.external++;

    const tint = tints[Math.floor(i / profileLen) % profile.segments]!;
    colors[i * 3] = _c.r * tint;
    colors[i * 3 + 1] = _c.g * tint;
    colors[i * 3 + 2] = _c.b * tint;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.userData.materialRegions = regions;
  geometry.userData.materialStats = stats;
  return stats;
}
