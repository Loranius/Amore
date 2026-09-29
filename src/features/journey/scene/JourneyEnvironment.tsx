import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  Color,
  type Group,
  type ShaderMaterial,
} from 'three';
import {
  JOURNEY_NEBULA_HEIGHT,
  JOURNEY_NEBULA_WIDTH,
  JOURNEY_SKY_COLOURS,
  journeyHeroStars,
  journeyStarField,
} from '../journeySky';

// ============================================================
// Космос навколо пари — намальований, а не завантажений (ADR-0214).
// ------------------------------------------------------------
// Було: сфера з GLB на 8.5 МБ із панорамою 2048 px. Пара чекала на чорноті,
// а коли небо приїжджало, воно було розтягнуте втричі, і зірки ставали
// розмитими плямами.
//
// Стало два шари, і кожен робить те, що вміє:
//
//  - **туманність** — м'яка сфера з текстурою, яку малює воркер
//    (`journeySky.ts`); поки вона малюється, видно тло її ж найтемнішого
//    кольору, і вона проявляється плавно, а не вискакує;
//  - **зірки** — точки GPU з розміром у пікселях ЕКРАНА. Вони є з першого
//    кадру й гострі на будь-якій щільності, бо їх нічим не розтягнути.
//
// Обидва шари в одній групі, що повільно обертається: космос живий, але
// не тягне уваги на себе.
//
// ADR-0231: небо НЕПРОЗОРЕ й перемальоване з нуля — вуаль над світом
// (ADR-0216) і шар «зоряного пилу» в шейдері прибрано; додано третій шар —
// кілька десятків яскравих зірок із променями.
// ============================================================

/**
 * Радіус неба.
 *
 * Мусить бути помітно більшим за найдальшу зірку сузір'я і меншим за `far`
 * камери, інакше небо обріжеться площиною відсікання.
 */
export const JOURNEY_SKY_RADIUS = 600;

/** Повний оберт неба — двадцять хвилин: живе, але не крутиться. */
const SKY_TURN_SECONDS = 1200;

/** За скільки секунд туманність проявляється, коли воркер її домалював. */
const NEBULA_FADE_SECONDS = 1.2;

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColour;
  attribute float aPhase;
  uniform float uPixelRatio;
  uniform float uTime;
  varying vec3 vColour;
  void main() {
    // Мерехтіння лише в яскравих: дрібні іскри, що блимають, — це шум.
    float twinkle = 1.0 + 0.18 * smoothstep(1.8, 3.2, aSize) * sin(uTime * 1.7 + aPhase);
    vColour = aColour * twinkle;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Розмір у пікселях ЕКРАНА: зірка однаково гостра на будь-якому телефоні.
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColour;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p) * 2.0;
    if (r > 1.0) discard;
    // Гостре ядро й коротке сяйво — зірка, а не розмита пляма.
    float core = smoothstep(0.55, 0.0, r);
    float halo = exp(-r * r * 5.0) * 0.35;
    vec3 light = vColour * (core + halo);
    // Непрозорість = скільки світла, у передмноженому вигляді (матеріал
    // \`premultipliedAlpha\`). Раніше тут стояла одиниця, і на прозорому
    // полотні над світом (ADR-0216) кожен край точки ставав чорним кружком.
    gl_FragColor = vec4(light, clamp(max(light.r, max(light.g, light.b)), 0.0, 1.0));
  }
`;

/*
 * СФЕРА НЕБА — лише туманність із воркера. Поки вона малюється, видно колір
 * порожнечі, і туманність проявляється плавно. Жодного процедурного пилу
 * тут більше немає: на телефоні він читався як телевізійний шум (ADR-0231).
 */
const SKY_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uNebula;
  uniform float uNebulaMix;
  uniform vec3 uVoid;
  void main() {
    vec3 nebula = mix(uVoid, texture2D(uNebula, vUv).rgb, uNebulaMix);
    gl_FragColor = vec4(nebula, 1.0);
    #include <colorspace_fragment>
  }
`;

/*
 * ЯСКРАВІ ЗІРКИ — спрайт із ядром, ореолом і чотирма тонкими променями.
 * Промені тонші й довші горизонтально-вертикально, як дифракція в
 * телескопі: саме вони кажуть оку «це зірка», а не «це крапка».
 */
const HERO_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColour;
  attribute float aPhase;
  uniform float uPixelRatio;
  uniform float uTime;
  varying vec3 vColour;
  varying float vTwinkle;
  void main() {
    vColour = aColour;
    vTwinkle = 0.88 + 0.12 * sin(uTime * 1.3 + aPhase);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const HERO_FRAGMENT = /* glsl */ `
  varying vec3 vColour;
  varying float vTwinkle;
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float core = exp(-r * r * 90.0);
    float halo = exp(-r * r * 9.0) * 0.28;
    float spikeX = exp(-abs(p.y) * 70.0) * (1.0 - smoothstep(0.0, 1.0, abs(p.x)));
    float spikeY = exp(-abs(p.x) * 70.0) * (1.0 - smoothstep(0.0, 1.0, abs(p.y)));
    float light = (core * 1.6 + halo + (spikeX + spikeY) * 0.55) * vTwinkle;
    vec3 colour = mix(vColour, vec3(1.0), core * 0.7) * light;
    gl_FragColor = vec4(colour, 1.0);
  }
`;

const nebulaCache: { pixels: Uint8Array | null; pending: Promise<Uint8Array | null> | null } = {
  pixels: null,
  pending: null,
};

/** Туманність один раз на сесію: модуль відкривають не раз. */
function paintNebula(): Promise<Uint8Array | null> {
  if (nebulaCache.pixels !== null) return Promise.resolve(nebulaCache.pixels);
  if (nebulaCache.pending !== null) return nebulaCache.pending;
  nebulaCache.pending = new Promise<Uint8Array | null>((resolve) => {
    if (typeof Worker === 'undefined') {
      resolve(null);
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL('../journeyNebula.worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      console.warn('journey sky: worker unavailable, stars only', error);
      resolve(null);
      return;
    }
    worker.onmessage = (event: MessageEvent<{ pixels: Uint8Array }>) => {
      worker.terminate();
      nebulaCache.pixels = event.data.pixels;
      resolve(event.data.pixels);
    };
    worker.onerror = (error) => {
      worker.terminate();
      console.warn('journey sky: nebula worker failed, stars only', error);
      resolve(null);
    };
    worker.postMessage(null);
  });
  void nebulaCache.pending.finally(() => { nebulaCache.pending = null; });
  return nebulaCache.pending;
}

export interface JourneyEnvironmentProps {
  /** Пара просила спокою: небо стоїть, зірки не мерехтять. */
  reducedMotion?: boolean;
}

export function JourneyEnvironment({ reducedMotion = false }: JourneyEnvironmentProps) {
  const groupRef = useRef<Group>(null);
  const skyMaterial = useRef<ShaderMaterial>(null);
  const starMaterial = useRef<ShaderMaterial>(null);
  const heroMaterial = useRef<ShaderMaterial>(null);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const [pixels, setPixels] = useState<Uint8Array | null>(nebulaCache.pixels);
  const shown = useRef(nebulaCache.pixels !== null ? 1 : 0);

  useEffect(() => {
    if (pixels !== null) return undefined;
    let alive = true;
    void paintNebula().then((next) => { if (alive && next !== null) setPixels(next); });
    return () => { alive = false; };
  }, [pixels]);

  const texture = useMemo(() => {
    if (pixels === null) return null;
    const next = new DataTexture(pixels, JOURNEY_NEBULA_WIDTH, JOURNEY_NEBULA_HEIGHT, RGBAFormat);
    next.colorSpace = SRGBColorSpace;
    next.magFilter = LinearFilter;
    next.minFilter = LinearFilter;
    next.needsUpdate = true;
    return next;
  }, [pixels]);
  useEffect(() => () => texture?.dispose(), [texture]);

  /*
   * Уніформи — лише ПОЧАТКОВІ значення. R3F копіює їх у матеріал, тож
   * зміна цього об'єкта шейдера не досягає: перша редакція підставляла сюди
   * текстуру туманності, і небо лишалось чорним. Живі значення пише
   * `useFrame` прямо в `material.uniforms`, як і для зірок.
   * Колір порожнечі — лінійний, бо шейдер наприкінці сам переводить у sRGB.
   */
  const skyUniforms = useMemo(() => {
    const placeholder = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
    placeholder.needsUpdate = true;
    return {
      uNebula: { value: placeholder as DataTexture },
      uNebulaMix: { value: 0 },
      uVoid: { value: new Color(JOURNEY_SKY_COLOURS.void) },
    };
  }, []);
  useEffect(() => () => skyUniforms.uNebula.value.dispose(), [skyUniforms]);


  const stars = useMemo(() => {
    const field = journeyStarField();
    const geometry = new BufferGeometry();
    const positions = new Float32Array(field.positions.length);
    for (let index = 0; index < positions.length; index += 1) {
      // Трохи ближче за туманність, щоб точки ніколи не ховались за нею.
      positions[index] = field.positions[index]! * JOURNEY_SKY_RADIUS * 0.96;
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(field.sizes, 1));
    geometry.setAttribute('aColour', new BufferAttribute(field.colours, 3));
    geometry.setAttribute('aPhase', new BufferAttribute(field.phases, 1));
    return geometry;
  }, []);
  useEffect(() => () => stars.dispose(), [stars]);

  const heroes = useMemo(() => {
    const field = journeyHeroStars();
    const geometry = new BufferGeometry();
    const positions = new Float32Array(field.positions.length);
    for (let index = 0; index < positions.length; index += 1) {
      positions[index] = field.positions[index]! * JOURNEY_SKY_RADIUS * 0.95;
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(field.sizes, 1));
    geometry.setAttribute('aColour', new BufferAttribute(field.colours, 3));
    geometry.setAttribute('aPhase', new BufferAttribute(field.phases, 1));
    return geometry;
  }, []);
  useEffect(() => () => heroes.dispose(), [heroes]);

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05);
    const sky = skyMaterial.current;
    if (sky && texture) {
      shown.current = reducedMotion ? 1 : Math.min(1, shown.current + step / NEBULA_FADE_SECONDS);
      sky.uniforms.uNebula!.value = texture;
      sky.uniforms.uNebulaMix!.value = shown.current;
    }
    const starShader = starMaterial.current;
    if (starShader) {
      starShader.uniforms.uTime!.value = reducedMotion ? 0 : state.clock.elapsedTime;
      starShader.uniforms.uPixelRatio!.value = pixelRatio;
    }
    const heroShader = heroMaterial.current;
    if (heroShader) {
      heroShader.uniforms.uTime!.value = reducedMotion ? 0 : state.clock.elapsedTime;
      heroShader.uniforms.uPixelRatio!.value = pixelRatio;
    }
    const group = groupRef.current;
    if (group && !reducedMotion) group.rotation.y += ((2 * Math.PI) / SKY_TURN_SECONDS) * step;
  });

  return (
    <>
    {/* Тло — найтемніший колір туманності, тож її поява не блимає. Поза
        групою: `attach` чіпляє до БАТЬКА, і всередині групи тло сіло б на неї. */}
    <color attach="background" args={[JOURNEY_SKY_COLOURS.void]} />
    <group ref={groupRef}>
      <mesh scale={JOURNEY_SKY_RADIUS} renderOrder={-2} frustumCulled={false}>
        <sphereGeometry args={[1, 48, 24]} />
        <shaderMaterial
          ref={skyMaterial}
          vertexShader={SKY_VERTEX}
          fragmentShader={SKY_FRAGMENT}
          uniforms={skyUniforms}
          side={BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <points geometry={stars} renderOrder={-1} frustumCulled={false}>
        <shaderMaterial
          ref={starMaterial}
          vertexShader={STAR_VERTEX}
          fragmentShader={STAR_FRAGMENT}
          uniforms={{ uPixelRatio: { value: pixelRatio }, uTime: { value: 0 } }}
          premultipliedAlpha
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <points geometry={heroes} renderOrder={-1} frustumCulled={false}>
        <shaderMaterial
          ref={heroMaterial}
          vertexShader={HERO_VERTEX}
          fragmentShader={HERO_FRAGMENT}
          uniforms={{ uPixelRatio: { value: pixelRatio }, uTime: { value: 0 } }}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
    </>
  );
}
