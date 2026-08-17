import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShapeGeometry,
  Vector3,
} from 'three';
import type { Star3D } from '../constellation3d';
import { starTints, type JourneyPalette } from '../journeyPalette';
import { createStarShape } from './starSilhouette';

// ============================================================
// Зірки подій.
// ------------------------------------------------------------
// Два виклики малювання на будь-яку кількість подій: один інстансований силует
// і один інстансований ореол. Це не передчасна економія — на слабкому профілі
// сцену вже ділять з небом і променями, і сорок окремих сіток тут коштували б
// сорок викликів рівно ні за що.
//
// Обидві сітки плоскі й повертаються лицем до камери спільним кватерніоном.
// Об'ємної зірки немає свідомо: промені мають лишатись гострими з будь-якого
// ракурсу, а справжня тривимірна зірка з половини ракурсів показує ребро.
// ============================================================

/**
 * Розмір ореолу: стала частина плюс частка від зірки.
 *
 * Чиста пропорція не годиться, і це виміряно. Ядро втричі більше за звичайну
 * зірку, тож при множнику ореол ядра виходив утричі більшим — і лише він
 * показував колір, а звичайна зірка глухла в туманності. Стала частина дає
 * найдрібнішій зірці сяйво, яке ще видно.
 */
const HALO_BASE = 2.4;
const HALO_SCALE = 3.4;

export function haloSize(radius: number): number {
  return HALO_BASE + radius * HALO_SCALE;
}

/** Скільки секунд світиться кожна наступна зірка під час появи. */
const BIRTH_STEP = 0.24;
/** Скільки триває поява однієї зірки. */
const BIRTH_RISE = 0.55;

/**
 * М'яка пляма без текстури.
 *
 * Радіальний спад рахується в шейдері з координати площини: канвасова текстура
 * коштувала б 256×256 байтів пам'яті й одного розкладання на кожен профіль
 * пристрою, а тут це три рядки арифметики на фрагмент.
 */
const HALO_VERTEX = /* glsl */ `
  attribute vec3 instanceTint;
  varying vec2 vUv;
  varying vec3 vTint;
  void main() {
    vUv = uv;
    vTint = instanceTint;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vTint;
  uniform float uOpacity;
  void main() {
    float distance = length(vUv - 0.5) * 2.0;
    // Куб замість лінійного спаду: лінійний дає видиме коло, а не сяйво.
    float glow = pow(max(0.0, 1.0 - distance), 2.4);
    if (glow <= 0.001) discard;
    // Ореол несе КОЛІР події. Саме він, а не силует: силует дрібний і на
    // додатковому змішуванні поверх світлої туманності білішає, а пляма
    // вчетверо більша встигає показати відтінок. Множник — щоб той відтінок
    // пробився крізь туманність, яка вже й сама світиться.
    gl_FragColor = vec4(vTint * 1.35, glow * uOpacity);
  }
`;

/**
 * Силует зірки.
 *
 * Біле лише ОСЕРДЯ, і це виміряно: перша редакція підмішувала біле по всьому
 * силуету на 45 відсотків, і на живому екрані всі вісім зірок вийшли
 * однаково білими — рівні, які власник розрізняв кольором (бірюзова звичайна,
 * жовта важлива, неон ключова), зникли начисто. Додаткове змішування поверх
 * світлої туманності добиває залишок відтінку. Тому біле стискається в центр,
 * а промені лишаються кольором події.
 */
const BODY_VERTEX = /* glsl */ `
  attribute vec3 instanceTint;
  varying vec3 vTint;
  varying vec2 vLocal;
  void main() {
    vTint = instanceTint;
    // Силует нормований так, що верхній промінь сягає одиниці, тож локальна
    // відстань одразу читається як частка розміру зірки.
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const BODY_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying vec2 vLocal;
  void main() {
    float core = 1.0 - smoothstep(0.0, 0.34, length(vLocal));
    vec3 colour = mix(vTint * 1.25, vec3(1.0), core * 0.9);
    gl_FragColor = vec4(colour, 1.0);
  }
`;

export interface JourneyConstellationProps {
  stars: readonly Star3D[];
  palette: JourneyPalette;
  /** Секунди від початку сцени. Реф, а не значення: див. шапку `JourneyScene`. */
  clock: { current: number };
  /** Пара просила спокою: зірки з'являються всі разом. */
  reducedMotion: boolean;
  /** Подія, яка зараз розкривається. Її зірка поступається місцем сонцю. */
  focusId?: number | null;
  /** Наскільки сонце вже проявилось, 0…1. Реф — щоб не смикати дерево. */
  reveal?: { current: number };
}

/** Наскільки зірка вже народилась, 0…1. */
export function birthProgress(order: number, clock: number): number {
  const start = order * BIRTH_STEP;
  if (clock <= start) return 0;
  return Math.min(1, (clock - start) / BIRTH_RISE);
}

/** Скільки секунд триває поява всього сузір'я. */
export function birthDuration(count: number): number {
  return count === 0 ? 0 : (count - 1) * BIRTH_STEP + BIRTH_RISE;
}

export function JourneyConstellation({
  stars,
  palette,
  clock,
  reducedMotion,
  focusId = null,
  reveal,
}: JourneyConstellationProps) {
  const bodyRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<InstancedMesh>(null);
  const scratch = useRef({ matrix: new Matrix4(), position: new Vector3(), scale: new Vector3() });

  const bodyGeometry = useMemo(() => new ShapeGeometry(createStarShape()), []);
  const haloGeometry = useMemo(() => new PlaneGeometry(1, 1), []);

  useEffect(() => () => {
    bodyGeometry.dispose();
    haloGeometry.dispose();
  }, [bodyGeometry, haloGeometry]);

  // Кольори рахує `starTints`, а НЕ `THREE.Color.set()`: його розбірник знає
  // лише старий синтаксис `hsl(h, s%, l%)` з комами, а на нашому — сучасному,
  // через пробіли — мовчки лишає білий. На живому екрані це зробило всі вісім
  // зірок однаковим нейтральним світінням.
  const tints = useMemo(() => starTints(stars, palette), [stars, palette]);

  useFrame((state) => {
    const body = bodyRef.current;
    const halo = haloRef.current;
    if (!body || !halo) return;

    // Один кватерніон камери на всі зірки: білборд — це той самий поворот для
    // кожної площини, і рахувати його по разу на зірку немає з чого.
    const facing = state.camera.quaternion;
    const { matrix, position, scale } = scratch.current;

    // Обрана зірка гасне рівно настільки, наскільки проявилось сонце: обидва
    // тіла стоять в одній світовій точці, і перехід читається як наближення, а
    // не як «зникло і з'явилось».
    const yielded = focusId === null ? 0 : Math.max(0, Math.min(1, reveal?.current ?? 0));

    stars.forEach((star, index) => {
      const born = reducedMotion ? 1 : birthProgress(star.order, clock.current);
      const grown = star.id === focusId ? born * (1 - yielded) : born;
      position.set(star.x, star.y, star.z);

      const size = star.radius * grown;
      scale.set(size, size, size);
      matrix.compose(position, facing, scale);
      body.setMatrixAt(index, matrix);

      // Ореол росте разом із появою зірки, але від СТАЛОГО розміру, а не від
      // нуля: інакше нова зірка спалахувала б точкою без сяйва.
      const glow = haloSize(star.radius) * grown;
      scale.set(glow, glow, glow);
      matrix.compose(position, facing, scale);
      halo.setMatrixAt(index, matrix);
    });

    body.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
  });

  if (stars.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={haloRef}
        args={[haloGeometry, undefined, stars.length]}
        frustumCulled={false}
        renderOrder={2}
      >
        <instancedBufferAttribute
          attach="geometry-attributes-instanceTint"
          args={[tints, 3]}
        />
        <shaderMaterial
          vertexShader={HALO_VERTEX}
          fragmentShader={HALO_FRAGMENT}
          uniforms={{ uOpacity: { value: 0.85 } }}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </instancedMesh>

      <instancedMesh
        ref={bodyRef}
        args={[bodyGeometry, undefined, stars.length]}
        frustumCulled={false}
        renderOrder={3}
      >
        <instancedBufferAttribute
          attach="geometry-attributes-instanceTint"
          args={[new Float32Array(tints), 3]}
        />
        {/*
          Свій шейдер, а не `MeshBasicMaterial` із `vertexColors`: колір
          інстансу — це `instanceColor`, і він множиться на матеріал, тобто
          додатковий шлях до того самого. Тут же він читається просто.
        */}
        <shaderMaterial
          vertexShader={BODY_VERTEX}
          fragmentShader={BODY_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
