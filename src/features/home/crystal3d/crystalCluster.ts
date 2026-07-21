// ============================================================
// crystalCluster — Crystal-специфічний рендер-шар «Artifact Engine».
// ------------------------------------------------------------
// Уся процедурна логіка (де росте вузол, з якою датою, скільки їх) тепер
// живе в ../artifact/ і не знає про THREE/Lathe-геометрію взагалі. Цей файл
// — єдиний адаптер: deriveClusterBranch перекладає абстрактний ArtifactNode
// (theta/phi/distance/verticalJitter) у Crystal-конкретні Euler-кути та
// позицію, deriveClusterMaterial перекладає EvolutionPressures у PBR-
// параметри матеріалу. Навмисно функція-адаптер, а не `extends`/успадкування
// — так ClusterBranch не може непомітно "просочити" crystal-специфічні поля
// назад у спільний ArtifactNode-контракт.
// ============================================================
import * as THREE from 'three';
import { mulberry32, hashSeedString } from '../mulberry32';
import type { ArtifactDNA, ArtifactNode, DominantSystem, EvolutionPressures, GrowthDomainId, NodeKind } from '../artifact';

export interface ClusterBranch {
  key: string;
  kind: NodeKind;
  domain: GrowthDomainId | null;
  label?: string;
  /** «Доросла» довжина/товщина (до масштабування maturity в buildBranchGeometry). */
  height: number;
  radiusBottom: number;
  posX: number;
  posY: number;
  posZ: number;
  tiltX: number;
  tiltZ: number;
  rotY: number;
  colorA: string;
  colorB: string;
  breathePhase: number;
  breatheSpeed: number;
  /** 0 (щойно з'явився) .. ~1 (давно росте) — див. maturityCurve(). */
  maturity: number;
  /** Золоте світіння для milestone-вузлів. */
  emissive?: boolean;
}

type CreationSourceLabel = 'recipe' | 'movie' | 'book';

const BASE_PALETTE: Record<Exclude<NodeKind, 'creation'>, [string, string]> = {
  core: ['#6d4fa8', '#e9ddff'],
  country: ['#1f8f82', '#8fe0d6'],
  city: ['#4a7fc9', '#b9d8ff'],
  milestone: ['#c9971f', '#fff3c9'],
  goal: ['#3f9142', '#b9e8b0'],
  anniversary: ['#c76a8f', '#f6c9dc'],
  memory: ['#d98a4f', '#ffd9a8'],
  wish: ['#e0527a', '#f6a8c0'],
};

const CREATION_PALETTE: Record<CreationSourceLabel, [string, string]> = {
  recipe: ['#d9702e', '#ffcf9e'],
  movie: ['#2f8fa3', '#a8ecf6'],
  book: ['#6b4fa8', '#cbb8f0'],
};

/** Об'ємний розкид по висоті (verticalJitter → posY) — per-kind, «core» лишається
 *  компактним центром маси, доменні супутники розкидані ширше (не плаский диск). */
const VERTICAL_SPREAD: Record<NodeKind, number> = {
  core: 0.5,
  country: 0.9,
  city: 0.85,
  milestone: 0.8,
  goal: 0.85,
  anniversary: 0.85,
  creation: 0.9,
  memory: 0.9,
  wish: 0.9,
};

function basePalette(node: ArtifactNode): [string, string] {
  if (node.kind === 'creation') {
    const source = (node.label as CreationSourceLabel | undefined) ?? 'recipe';
    return CREATION_PALETTE[source];
  }
  return BASE_PALETTE[node.kind];
}

/** Обертає відтінок (H у HSL) на hueRotationDeg — «вид» цієї пари. */
export function applyFamilyHue(hex: string, hueRotationDeg: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + hueRotationDeg / 360) % 1, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

/**
 * Переклад абстрактного вузла в Crystal-конкретну гілку: theta/phi/distance
 * (сферичні, "куди росте") → posX/posY/posZ + tiltX/tiltZ (Euler, "як лежить
 * Lathe-меш"). Golden milestone-колір НЕ обертається hueRotation — це
 * навмисно фіксований, впізнаваний бейдж «великої події» для будь-якої пари.
 */
export function deriveClusterBranch(node: ArtifactNode, dna: ArtifactDNA): ClusterBranch {
  const [baseA, baseB] = basePalette(node);
  const keepFixed = node.kind === 'milestone';
  const colorA = keepFixed ? baseA : applyFamilyHue(baseA, dna.hueRotation);
  const colorB = keepFixed ? baseB : applyFamilyHue(baseB, dna.hueRotation);
  const spread = VERTICAL_SPREAD[node.kind];

  return {
    key: node.key,
    kind: node.kind,
    domain: node.domain,
    ...(node.label !== undefined ? { label: node.label } : {}),
    height: node.growthScale,
    radiusBottom: node.massScale,
    posX: Math.cos(node.theta) * node.distance,
    posY: node.verticalJitter * spread,
    posZ: Math.sin(node.theta) * node.distance,
    tiltX: Math.sin(node.theta) * node.phi,
    tiltZ: -Math.cos(node.theta) * node.phi,
    rotY: node.spin,
    colorA,
    colorB,
    breathePhase: node.breathePhase,
    breatheSpeed: node.breatheSpeed,
    maturity: node.maturity,
    ...(node.emphasized !== undefined ? { emissive: node.emphasized } : {}),
  };
}

// ── Матеріал: фото/фільми/рецепти/книги/спогади = НЕ форма ───────
export interface ClusterMaterial {
  /** Фото → полірування/прозорість (Refinement Pressure). */
  roughness: number;
  clearcoat: number;
  transmission: number;
  /** Рецепти → теплий відтінок (Warmth Pressure). */
  warmthMix: number;
  /** Фільми → внутрішні кольорові переливи. */
  movieMix: number;
  /** Спогади → внутрішнє світіння (Luminosity Pressure). */
  glow: number;
  /** Книги → складність поверхні (більше/менш регулярні грані). */
  surfaceComplexity: number;
  /** Фінанси → щільність/маса. */
  density: number;
  dominant: DominantSystem;
  dominance: number;
}

const WARMTH_COLOR = new THREE.Color('#ff8a3d');
const MOVIE_COLOR = new THREE.Color('#4fd1e0');

/** Переклад іменованих Evolution Pressures у PBR-параметри матеріалу кристала. */
export function deriveClusterMaterial(pressures: EvolutionPressures): ClusterMaterial {
  return {
    roughness: Math.max(0.06, 0.32 - pressures.refinement * 0.216),
    clearcoat: Math.min(0.95, 0.55 + pressures.refinement * 0.36),
    transmission: Math.min(0.75, 0.3 + pressures.refinement * 0.36),
    warmthMix: pressures.warmth,
    movieMix: pressures.movieMix,
    glow: pressures.luminosity,
    surfaceComplexity: pressures.surfaceComplexity,
    density: pressures.density,
    dominant: pressures.dominant,
    dominance: pressures.dominance,
  };
}

/** Домішує тон (рецепти/фільми) у колір гілки — застосовується один раз при побудові геометрії. */
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

// ── Геометрія гілки: гранована призма → гранена гостра верхівка ──
// (той самий принцип, що v1, але тепер параметризований maturity:
// молода гілка — тупіша/тонша/коротша, зріла — гостра/товста/повна).
export function buildBranchGeometry(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix' | 'surfaceComplexity'>,
): THREE.BufferGeometry {
  const shapeRng = mulberry32(hashSeedString(branch.key));
  // Книги («складність поверхні») додають шанс на зайву грань понад базові 5–7.
  const segments = 5 + Math.floor(shapeRng() * 3) + (shapeRng() < material.surfaceComplexity ? 1 : 0);
  const m = branch.maturity;

  const h = branch.height * (0.32 + m * 0.68);
  const r = branch.radiusBottom * (0.4 + m * 0.6);
  const tipR = r * (0.14 - m * 0.12); // молоді — тупіші вістря, зрілі — майже гострі
  const pointStart = 0.72 - m * 0.2 + shapeRng() * 0.08;

  const profile = [
    new THREE.Vector2(Math.max(0.001, r * (0.88 + shapeRng() * 0.1)), 0),
    new THREE.Vector2(r, h * (0.08 + shapeRng() * 0.05)),
    new THREE.Vector2(r * (0.94 + shapeRng() * 0.06), h * pointStart),
    new THREE.Vector2(Math.max(0.001, tipR), h),
  ];

  const geo = new THREE.LatheGeometry(profile, segments);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const { colorA, colorB } = tintBranchColors(branch, material);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const t = h > 0 ? pos.getY(i) / h : 0;
    c.lerpColors(colorA, colorB, Math.min(1, Math.max(0, t)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
