// ============================================================
// portalScene — числа й геометрія порталу, без React і без стану.
// ------------------------------------------------------------
// Сцена навколо артефакта раніше жила в CSS: пласкі шари неба, диск
// підлоги в perspective() і два прямокутники-колони. Вони ніколи не
// могли зійтися з кристалом, бо кристал живе в іншій системі координат
// — у WebGL-камері. Тут та сама сцена перенесена в 3D і стоїть на тій
// самій площині, що й артефакт (CRYSTAL_GROUND_BASELINE).
//
// Модуль навмисно чистий: кадрування камери, розкладка колон і поле
// зір — це арифметика, яку можна перевірити тестом без WebGL.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import { mulberry32 } from '../../mulberry32';

/** Площина, на якій стоїть артефакт; уся сцена відраховується від неї. */
export const PORTAL_GROUND_Y = CRYSTAL_GROUND_BASELINE;

/**
 * Скільки draw call'ів додає оточення. Приймальний тест перевіряє, що
 * кристал лишається збатчений (draw call'и ≈ кількість матеріалів, а не
 * тіл), тож він мусить знати внесок сцени — інакше довелось би просто
 * послабити межу й перевірка втратила б сенс.
 *
 * Земля + подіум + інкрустація + колони (один InstancedMesh) + зорі.
 */
export const PORTAL_ENVIRONMENT_DRAW_CALLS = 5;

/**
 * Скільки трикутників додає оточення. Той самий привід, що й у draw
 * call'ах: приймальний тест звіряє намальовані трикутники з бюджетом
 * геометрії кристала, і без цього числа сцена мовчки з'їла б перевірку.
 *
 * Значення прибите свідомо — рахувати його в рантаймі означало б
 * будувати геометрію двічі. За тим, щоб воно не розійшлось із реальними
 * буферами, стежить portalScene.test.ts.
 */
export const PORTAL_ENVIRONMENT_TRIANGLES = 1984;

/** Сегментів у диску поля; єдине місце, що задає його вартість. */
const FIELD_SEGMENTS = 64;

/** Реальна вартість оточення — джерело правди для константи вище. */
export function measurePortalEnvironmentTriangles(): number {
  const dais = buildPortalDaisGeometry();
  const inlay = buildPortalInlayGeometry();
  const pillar = buildPortalPillarGeometry();
  const triangles = (geometry: THREE.BufferGeometry): number => {
    const index = geometry.getIndex();
    return index === null
      ? geometry.getAttribute('position').count / 3
      : index.count / 3;
  };

  const total = FIELD_SEGMENTS
    + triangles(dais)
    + triangles(inlay)
    + triangles(pillar) * PORTAL_PILLARS.length * 2;

  dais.dispose();
  inlay.dispose();
  pillar.dispose();
  return total;
}

const FOV = 42;
const DEG = Math.PI / 180;

/**
 * Скільки світових одиниць мусить бути видно. Висота — головна: вона
 * задає, яку частину екрана займає кристал (зрілий — близько половини).
 * Ширина рятує вузькі екрани: на аспекті нижче ~0.44 кадр по висоті вже
 * не гарантує, що подіум влізе, і камера відходить.
 */
const FIT_HEIGHT = 5.5;
const FIT_WIDTH = 2.4;

/** Камера над площиною підлоги. Дає кут ≈17° — підлога читається як
 *  поверхня, що йде вглиб, а не як лінія. */
const EYE_ABOVE_GROUND = 2.25;
/** Куди дивиться камера: трохи нижче середини кристала, щоб над ним
 *  лишалось небо, а під ним — подіум. */
const TARGET_ABOVE_GROUND = 1.25;

export interface PortalCameraFrame {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  /** Відстань від камери до точки прицілу. */
  distance: number;
  fogNear: number;
  fogFar: number;
}

function halfHeightTangent(): number {
  return Math.tan((FOV / 2) * DEG);
}

/**
 * Половина видимої ширини на заданій глибині. Колони спираються саме на
 * це: у 3D їх не можна прибити до краю кадру, як CSS-шар, — на широкому
 * екрані фіксовані позиції з'їхали б до центру й затиснули кристал.
 */
export function portalHalfWidthAt(depth: number, aspect: number): number {
  return depth * halfHeightTangent() * Math.max(aspect, 0.1);
}

export function portalCameraFrame(aspect: number): PortalCameraFrame {
  const tangent = halfHeightTangent();
  // Аспект приходить із viewport'а; на нульовій висоті контейнера він
  // вироджується, тож тримаємо його в межах реальних екранів.
  const safeAspect = Math.min(Math.max(Number.isFinite(aspect) ? aspect : 1, 0.3), 3.2);
  const byHeight = FIT_HEIGHT / (2 * tangent);
  const byWidth = FIT_WIDTH / (2 * tangent * safeAspect);
  const distance = Math.max(byHeight, byWidth);

  const eyeY = PORTAL_GROUND_Y + EYE_ABOVE_GROUND;
  const targetY = PORTAL_GROUND_Y + TARGET_ABOVE_GROUND;
  // Камера трохи вище за ціль, тож пряма відстань більша за z-виніс.
  const rise = eyeY - targetY;
  const z = Math.sqrt(Math.max(0, distance * distance - rise * rise));

  return {
    position: [0, eyeY, z],
    target: [0, targetY, 0],
    fov: FOV,
    distance,
    // Туман починається одразу за артефактом: він мусить з'їдати далеку
    // підлогу й задні колони, але не мити сам кристал.
    fogNear: distance * 0.96,
    fogFar: distance + 26,
  };
}

// ── Подіум ──────────────────────────────────────────────────
// Профіль обертання, y відраховується від PORTAL_GROUND_Y. Верхня
// площина — рівно 0: саме на ній стоїть субстрат кристала, і будь-яке
// відхилення або підвісило б його в повітрі, або втопило.
const DAIS_PROFILE: readonly (readonly [number, number])[] = [
  [0, -0.62],
  [1.9, -0.62],
  [1.9, -0.44],
  [1.66, -0.44],
  [1.66, -0.26],
  [1.44, -0.26],
  [1.44, -0.1],
  [1.3, -0.1],
  [1.3, 0],
  [0, 0],
];

/** Радіус верхньої площини подіуму. */
export const PORTAL_DAIS_TOP_RADIUS = 1.3;
/** Наскільки навколишнє поле нижче за верх подіуму. */
export const PORTAL_FIELD_DROP = 0.3;

export function buildPortalDaisGeometry(): THREE.LatheGeometry {
  const points = DAIS_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(points, 64);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Золоті кільця по обводу верхньої площини. Два кільця одним buffer'ом —
 * інкрустація не варта другого draw call'а.
 */
export function buildPortalInlayGeometry(): THREE.BufferGeometry {
  const inner = new THREE.RingGeometry(0.99, 1.05, 96);
  const outer = new THREE.RingGeometry(1.16, 1.19, 96);
  const merged = mergeGeometries([inner, outer]);
  inner.dispose();
  outer.dispose();
  if (merged === null) throw new Error('Portal inlay geometry could not be merged.');
  merged.rotateX(-Math.PI / 2);
  return merged;
}

// ── Колони ──────────────────────────────────────────────────

export interface PortalPillarPlacement {
  /** Глибина за площиною артефакта (від'ємна = вглиб кадру). */
  z: number;
  /** Частка півширини кадру, на якій стоїть колона: 1 = точно на краю. */
  edgeFraction: number;
  height: number;
  radius: number;
}

/**
 * Дві пари: ближча обрамляє кристал, дальша дає глибину. Обидві
 * прив'язані до краю кадру, а не до фіксованого x, — див.
 * portalHalfWidthAt.
 */
export const PORTAL_PILLARS: readonly PortalPillarPlacement[] = [
  { z: -2.6, edgeFraction: 0.94, height: 5.2, radius: 0.42 },
  { z: -7.4, edgeFraction: 0.86, height: 6.4, radius: 0.5 },
];

export interface PortalPillarInstance {
  position: readonly [number, number, number];
  /** Множник до базової геометрії висотою 1 і радіусом 1. */
  scale: readonly [number, number, number];
  rotationY: number;
}

/**
 * Розкладка колон для конкретного кадру. Камера дивиться вздовж -Z, тож
 * глибина колони — це distance + |z|.
 */
export function portalPillarInstances(
  frame: PortalCameraFrame,
  aspect: number,
): PortalPillarInstance[] {
  const instances: PortalPillarInstance[] = [];
  for (let index = 0; index < PORTAL_PILLARS.length; index += 1) {
    const placement = PORTAL_PILLARS[index]!;
    const depth = frame.distance + Math.abs(placement.z);
    const x = portalHalfWidthAt(depth, aspect) * placement.edgeFraction;
    for (const side of [-1, 1]) {
      instances.push({
        position: [x * side, PORTAL_GROUND_Y - PORTAL_FIELD_DROP, placement.z],
        scale: [placement.radius, placement.height, placement.radius],
        // Розвертаємо грані так, щоб дві колони пари не були дзеркальними
        // копіями кадр-у-кадр — інакше пара читається як декаль.
        rotationY: side > 0 ? Math.PI / 8 : -Math.PI / 5,
      });
    }
  }
  return instances;
}

/**
 * Колона висотою 1 і найбільшим радіусом 1 з цоколем і капітеллю — усе
 * одним buffer'ом, щоб чотири колони пішли одним InstancedMesh.
 * Нормалізація потрібна, щоб `radius` у PORTAL_PILLARS означав саме
 * габарит колони, а не радіус якоїсь її частини.
 */
export function buildPortalPillarGeometry(): THREE.BufferGeometry {
  const plinth = new THREE.CylinderGeometry(0.88, 1, 0.06, 8, 1);
  plinth.translate(0, 0.03, 0);
  const shaft = new THREE.CylinderGeometry(0.55, 0.67, 0.88, 8, 1);
  shaft.translate(0, 0.5, 0);
  const capital = new THREE.CylinderGeometry(0.83, 0.6, 0.06, 8, 1);
  capital.translate(0, 0.97, 0);

  const merged = mergeGeometries([plinth, shaft, capital]);
  plinth.dispose();
  shaft.dispose();
  capital.dispose();
  if (merged === null) throw new Error('Portal pillar geometry could not be merged.');
  merged.computeVertexNormals();
  return merged;
}

// ── Зорі ────────────────────────────────────────────────────

export interface PortalStarField {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}

const STAR_SHELL_RADIUS = 34;

/**
 * Зорі на сферичній оболонці, лише над горизонтом. Насіння — artifactSeed
 * пари: небо в кожної пари своє, але однакове при кожному відкритті.
 */
export function buildPortalStarField(seed: number, count: number): PortalStarField {
  const random = mulberry32(seed ^ 0x5f37);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const azimuth = random() * Math.PI * 2;
    // Зміщення в бік зеніту: біля горизонту зорі майже не видно крізь
    // туман, і рівномірний розподіл витратив би на них половину поля.
    const elevation = Math.asin(0.06 + random() * 0.94);
    const radius = STAR_SHELL_RADIUS * (0.86 + random() * 0.14);
    positions[index * 3] = Math.cos(elevation) * Math.cos(azimuth) * radius;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.cos(elevation) * Math.sin(azimuth) * radius;

    // Розкид яскравості важливіший за кількість: рівні зорі читаються як
    // шум, нерівні — як глибина.
    const brightness = 0.24 + random() * 0.76;
    const warmth = random();
    colors[index * 3] = brightness;
    colors[index * 3 + 1] = brightness * (0.9 + warmth * 0.1);
    colors[index * 3 + 2] = brightness * (0.94 + (1 - warmth) * 0.06);
  }

  return { positions, colors, count };
}

// ── Палітра ─────────────────────────────────────────────────

export interface PortalPalette {
  fog: string;
  field: string;
  dais: string;
  daisEmissive: string;
  inlay: string;
  pillar: string;
  starOpacity: number;
  daisLight: string;
  daisLightIntensity: number;
}

/**
 * Портал — нічна сцена в обох темах: це декорація, всередині якої
 * світиться артефакт, а не «темний режим». Світла тема лише тепліша.
 * Ті самі ролі, що й у --portal-* токенах CSS, тільки для WebGL.
 */
export const PORTAL_PALETTES: Record<'light' | 'dark', PortalPalette> = {
  light: {
    fog: '#3b2b57',
    field: '#2e2244',
    dais: '#6d5f8a',
    daisEmissive: '#20182f',
    inlay: '#e2be80',
    pillar: '#6a5c8f',
    starOpacity: 0.85,
    daisLight: '#d7b7f2',
    daisLightIntensity: 2.6,
  },
  dark: {
    fog: '#221a33',
    field: '#1b1428',
    dais: '#544a6d',
    daisEmissive: '#161022',
    inlay: '#cea86e',
    pillar: '#4b4070',
    starOpacity: 1,
    daisLight: '#b891dd',
    daisLightIntensity: 2.2,
  },
};
