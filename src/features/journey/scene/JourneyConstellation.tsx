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
  type ShaderMaterial,
} from 'three';
import type { Star3D } from '../constellation3d';
import { HALO_TINT_GAIN, starSeeds, starTints } from '../starPalette';
import { auraGlows, birthProgress, starAura, starBreath } from './constellationLife';
import { createStarShape } from './starSilhouette';

// ============================================================
// Зірки подій.
// ------------------------------------------------------------
// Два виклики малювання на будь-яку кількість подій: один інстансований силует
// і один інстансований ореол. Це не передчасна економія — на слабкому профілі
// сцену вже ділять з небом і шляхом, і сорок окремих сіток тут коштували б
// сорок викликів рівно ні за що.
//
// Обидві сітки плоскі й повертаються лицем до камери спільним кватерніоном.
// Об'ємної зірки немає свідомо: промені мають лишатись гострими з будь-якого
// ракурсу, а справжня тривимірна зірка з половини ракурсів показує ребро.
//
// **Рівень видно чотирма способами, не одним.** Розмір тіла задає розкладка,
// а ореол, силу сяйва й характер дихання — `constellationLife`. Так зроблено
// на прохання власника: колір тепер вибір пари, і ієрархія не може триматись
// на ньому одному.
//
// **Тут ДЕШЕВИЙ бік LOD.** Оглядова зірка на телефоні займає два десятки
// пікселів; процедурна поверхня з чотирма октавами шуму на такому розмірі —
// плата ні за що, і саме тому вона працює рівно на розкритій події
// (`stellarSurface.ts`). Замість неї тут одна синусоїда на фрагмент: кожна
// зірка мерехтить у власному ритмі, виведеному з її насіння. Двадцять
// пікселів більшого не покажуть, а різницю між «намальовано» й «горить» ця
// одна синусоїда дає.
// ============================================================

/**
 * М'яка пляма без текстури.
 *
 * Радіальний спад рахується в шейдері з координати площини: канвасова текстура
 * коштувала б 256×256 байтів пам'яті й одного розкладання на кожен профіль
 * пристрою, а тут це три рядки арифметики на фрагмент.
 */
const HALO_VERTEX = /* glsl */ `
  attribute vec3 instanceTint;
  attribute float instanceGlow;
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vGlow;
  void main() {
    vUv = uv;
    vTint = instanceTint;
    vGlow = instanceGlow;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vTint;
  varying float vGlow;
  uniform float uOpacity;
  void main() {
    float distance = length(vUv - 0.5) * 2.0;
    // Куб замість лінійного спаду: лінійний дає видиме коло, а не сяйво.
    float glow = pow(max(0.0, 1.0 - distance), 2.4);
    if (glow <= 0.001) discard;
    // Ореол несе КОЛІР події. Саме він, а не силует: силует дрібний і на
    // додатковому змішуванні поверх світлої туманності білішає, а пляма
    // вчетверо більша встигає показати відтінок. Множник — щоб той відтінок
    // пробився крізь туманність, яка вже й сама світиться; він же ставить
    // стелю світлості палітрі, і саме тому приходить звідти, а не звідси.
    //
    // Атрибут vGlow несе РІВЕНЬ події: ключова подія світить помітно сильніше
    // за звичайну навіть тоді, коли обидві однакового кольору.
    gl_FragColor = vec4(vTint * ${HALO_TINT_GAIN.toFixed(2)}, glow * uOpacity * vGlow);
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
  attribute float instanceGlow;
  attribute float instanceSeed;
  varying vec3 vTint;
  varying vec2 vLocal;
  varying float vGlow;
  varying float vSeed;
  void main() {
    vTint = instanceTint;
    vGlow = instanceGlow;
    vSeed = instanceSeed;
    // Силует нормований так, що верхній промінь сягає одиниці, тож локальна
    // відстань одразу читається як частка розміру зірки.
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const BODY_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying vec2 vLocal;
  varying float vGlow;
  varying float vSeed;
  uniform float uTime;
  void main() {
    // Осердя ширше в події, яка світить сильніше: у ключової воно читається
    // як розжарена серцевина, у звичайної — як іскра.
    float core = 1.0 - smoothstep(0.0, 0.28 + vGlow * 0.09, length(vLocal));

    // Мерехтіння: дві несумірні частоти, обидві з насіння зірки. Одна
    // синусоїда дала б рівне блимання маячка; дві дають нерівний ритм, у
    // якому око не вгадує періоду.
    float fast = sin(uTime * (2.1 + vSeed * 1.7) + vSeed * 37.0);
    float slow = sin(uTime * (0.7 + vSeed * 0.5) + vSeed * 11.0);
    float flicker = 1.0 + (fast * 0.5 + slow * 0.5) * 0.11;

    vec3 colour = mix(vTint * 1.25, vec3(1.0), core * 0.9) * flicker;
    gl_FragColor = vec4(colour, 1.0);
  }
`;

export interface JourneyConstellationProps {
  stars: readonly Star3D[];
  /** Секунди від початку сцени. Реф, а не значення: див. шапку `JourneyScene`. */
  clock: { current: number };
  /** Пара просила спокою: зірки з'являються всі разом і не дихають. */
  reducedMotion: boolean;
  /** Подія, яка зараз розкривається. Її зірка поступається місцем сонцю. */
  focusId?: number | null;
  /** Наскільки сонце вже проявилось, 0…1. Реф — щоб не смикати дерево. */
  reveal?: { current: number };
}

export function JourneyConstellation({
  stars,
  clock,
  reducedMotion,
  focusId = null,
  reveal,
}: JourneyConstellationProps) {
  const bodyRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<InstancedMesh>(null);
  const bodyMaterialRef = useRef<ShaderMaterial>(null);
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
  const tints = useMemo(() => starTints(stars), [stars]);
  const glows = useMemo(() => auraGlows(stars), [stars]);
  const seeds = useMemo(() => starSeeds(stars), [stars]);
  // Ореол, дихання й фаза — раз на зміну набору, а не щокадру.
  const auras = useMemo(() => stars.map(starAura), [stars]);

  useFrame((state) => {
    const body = bodyRef.current;
    const halo = haloRef.current;
    if (!body || !halo) return;

    // Один кватерніон камери на всі зірки: білборд — це той самий поворот для
    // кожної площини, і рахувати його по разу на зірку немає з чого.
    const facing = state.camera.quaternion;
    const { matrix, position, scale } = scratch.current;
    const now = clock.current;
    // Мерехтіння стоїть разом із рештою руху, коли пара просила спокою.
    const material = bodyMaterialRef.current;
    if (material) material.uniforms.uTime!.value = reducedMotion ? 0 : now;

    // Обрана зірка гасне рівно настільки, наскільки проявилось сонце: обидва
    // тіла стоять в одній світовій точці, і перехід читається як наближення, а
    // не як «зникло і з'явилось».
    const yielded = focusId === null ? 0 : Math.max(0, Math.min(1, reveal?.current ?? 0));

    stars.forEach((star, index) => {
      const aura = auras[index]!;
      const born = reducedMotion ? 1 : birthProgress(star.order, now);
      const grown = star.id === focusId ? born * (1 - yielded) : born;
      position.set(star.x, star.y, star.z);

      // Дихання — це і є «сузір'я живе». Амплітуда навмисно дрібна: пара має
      // побачити рух краєм ока, а не мерехтіння.
      const breath = reducedMotion ? 1 : starBreath(aura, now);
      const size = star.radius * grown * breath;
      scale.set(size, size, size);
      matrix.compose(position, facing, scale);
      body.setMatrixAt(index, matrix);

      // Ореол росте разом із появою зірки, але від СТАЛОГО розміру, а не від
      // нуля: інакше нова зірка спалахувала б точкою без сяйва. Дихає він
      // ширше за тіло — так корона читається як газ, а не як оболонка.
      const corona = reducedMotion ? 1 : 1 + (breath - 1) * 1.7;
      const glow = aura.halo * grown * corona;
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
        <instancedBufferAttribute
          attach="geometry-attributes-instanceGlow"
          args={[glows, 1]}
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
        {/*
          Свої копії масивів: `instancedBufferAttribute` віддає буфер відеокарті,
          і два меші, що поділяють один `Float32Array`, поділили б і його
          життєвий цикл.
        */}
        <instancedBufferAttribute
          attach="geometry-attributes-instanceTint"
          args={[new Float32Array(tints), 3]}
        />
        <instancedBufferAttribute
          attach="geometry-attributes-instanceGlow"
          args={[new Float32Array(glows), 1]}
        />
        <instancedBufferAttribute
          attach="geometry-attributes-instanceSeed"
          args={[seeds, 1]}
        />
        {/*
          Свій шейдер, а не `MeshBasicMaterial` із `vertexColors`: колір
          інстансу — це `instanceColor`, і він множиться на матеріал, тобто
          додатковий шлях до того самого. Тут же він читається просто.
        */}
        <shaderMaterial
          ref={bodyMaterialRef}
          vertexShader={BODY_VERTEX}
          fragmentShader={BODY_FRAGMENT}
          uniforms={{ uTime: { value: 0 } }}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
