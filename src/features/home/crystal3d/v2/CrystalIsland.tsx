import { SOFT_NORMAL_GLSL, softNormals, softScalar } from '@/features/home/diorama/softNormals';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { DIORAMA_PALETTES, DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';
import { buildCrystalSurround } from '@/features/home/diorama/surround';
import { rockGrainTexture } from '../scene/rockGrainTexture';
import { SHADOW_FRAGMENT_PARS, SHADOW_TINT, SHADOW_VERTEX, SHADOW_VERTEX_PARS, ShadowSun, shadowLightUniforms } from '@/features/home/diorama/shadowSun';
import type { Season } from '@/engine/species/grammar/season';
import { EMPTY_MESH, PAINT, buildCrystalIsland, type IslandMesh } from './crystalIsland';

// ============================================================
// Острів кристала за референсом власника (ADR-0221, гранчастий — ADR-0227):
// світлі плити, білі колони з плющем, фіолетова підошва великими гранями,
// кавалки, м'яке сяйво в основі кристала й далекий храм із променями. Геометрія — `crystalIsland.ts`; тут лише фарби.
// ============================================================

const END = /* glsl */ `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
`;

const KEY = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
const BUFFER = new THREE.Vector2();

/** Фарби: бруківка, скеля, камінь руїн, плющ, самоцвіт, земля між плитами. */
/**
 * Гранчастий low-poly за референсом (ADR-0227): плити майже білі з лілом,
 * колони — теплий білий камінь, підошва — насичений фіолетовий, плющ
 * соковито-зелений.
 */
/*
 * Природна гама (власник, 2026-10-06: «руїни менш білими/пластиковими …
 * платформа природніша»): плити — теплий сірий камінь, руїни — вивітрений
 * пісковик, скеля — темний сланцево-ліловий камінь замість насиченого
 * синього, земля — бура. Лілове лишається лише в тіні скелі.
 */
/*
 * Святилище (ADR-0242, власник 2026-10-05: «зелень доповнює рожеве, а не
 * домінує»): плющ — м'якший і прохолодніший зелений; скеля — світліший
 * лілово-сланцевий камінь замість майже чорного (підошва читалась дірою);
 * 8 — дрібні рожеві квіти, 9 — світліші пласти породи в підошві.
 */
const ISLAND_PAINTS: Record<'light' | 'dark', readonly string[]> = {
  light: ['#cfc6c3', '#6a5f84', '#c5b9aa', '#5f9f5c', '#ff8fd0', '#7a6656', '#ffffff', '#8a7a9a', '#ff9fd6', '#9184ad'],
  dark: ['#9a909c', '#4a4068', '#968b8f', '#4c8c56', '#ff82d2', '#55463f', '#e8dcf0', '#2f2846', '#ff96d8', '#6b5d8c'],
};

/**
 * Фарби храму: ті самі слоти, але камінь — присмерково-ліловий, а не денна
 * бруківка острова: храм у підземеллі, і світлий мармур читався б сонцем.
 */
const TEMPLE_PAINTS: Record<'light' | 'dark', readonly string[]> = {
  light: ['#dcc3c6', '#5e4f8a', '#b9a8d2', '#5fae45', '#ff8fd0', '#7d6878', '#ffffff', '#5a4a9a'],
  dark: ['#a591b0', '#2f2752', '#6f6398', '#3f8a3a', '#ff82d2', '#473c57', '#d8cff0', '#241c4c'],
};

/** Повітря підземного храму (серпанок оточення) і промені з розлому. */
const CAVE: Record<'light' | 'dark', { air: string; ray: string }> = {
  light: { air: '#9c86cf', ray: '#fff0fb' },
  dark: { air: '#2a2058', ray: '#ffb8ec' },
};

/**
 * Серпанок для далекого оточення (ADR-0224): що далі від осі острова, то
 * ближче колір до повітря сцени. Рахується від осі, а не від камери, —
 * інакше на далекому зумі тонув би й сам острів.
 */
export interface IslandHaze {
  colour: string;
  from: number;
  to: number;
  strength: number;
  /**
   * Відстань від камери, ближче за яку оточення тоне в повітрі майже
   * повністю. Власник (знімки згори): брили й капітелі, що опинились біля
   * об'єктива, лягали важкими плямами на шапку головної. 0 — вимкнено.
   */
  near?: number;
  /**
   * Тонути не в сталому кольорі, а в небі за спиною (ADR-0242): той самий
   * екранний градієнт і сяйво, що малює тло діорами. Далекий храм тоді
   * розчиняється в повітрі, а не стоїть темними смугами поперед нього.
   */
  sky?: { top: string; bottom: string; glow: string };
}

/**
 * Матеріал острова: фарба з палітри, м'яке світло діорами. Палітра — 8
 * кольорів або більше (риф має дев'ятий — пісок дна, ADR-0224).
 */
/**
 * Поверхня каменю святилища (ADR-0243): лише острів і храм кристала. Дерево
 * й риф ділять цей матеріал і нічого з цього не отримують — їхній шейдер
 * той самий, що й до цього.
 */
export interface IslandSurface {
  /**
   * Зерно каменю (`rockGrainTexture`): сіра безшовна карта, накладена з
   * трьох боків (triplanar), тож на колоні не тягнеться й не має шва.
   * Лягає лише на камінь — не на плющ, квіти, самоцвіти й хмари.
   */
  grain?: THREE.Texture | null;
  /**
   * Які фарби палітри — камінь, тобто отримують зерно. Типово — усе, крім
   * плюща, самоцвітів, хмар і квітів (слоти 3, 4, 6, 8 палітри кристала).
   * Острів вулкана має іншу палітру й передає лише плато, скелю й брили.
   */
  stonePaints?: readonly number[];
  /**
   * Руїни (фарба 2) темніють і зеленіють до землі, з патьоками — лише в
   * святилищі кристала. У палітрі рифу слот 2 — брили, і без цього прапорця
   * уламки вулкана зеленіли (виміряно в DevTools, ADR-0246).
   */
  mossyRuins?: boolean;
  /** Висота землі святилища у сцені: від неї темніє й зеленіє низ колон. */
  ground?: number;
  /**
   * Тіні від справжньої карти тіней three.js (напрямлене світло з
   * `castShadow`). Шейдер бере маску тіні тим самим `getShadowMask()`, що й
   * `ShadowMaterial`, і темнить нею лише освітлений бік.
   */
  shadows?: boolean;
  /**
   * Світло кристала на далекому храмі: грані, повернуті до острова,
   * ловлять його колір, а верх колон — світло з розлому згори.
   */
  crystalLight?: { colour: THREE.Color; strength: number };
}


export function createIslandMaterial(paints: readonly string[], haze?: IslandHaze, surface?: IslandSurface): THREE.ShaderMaterial {
  const count = paints.length;
  const grain = surface?.grain ?? null;
  const stoneTest = surface?.stonePaints
    ? surface.stonePaints.map((k) => `i == ${Math.round(k)}`).join(' || ') || 'false'
    : 'i != 3 && i != 4 && i != 6 && i != 8';
  const shadows = surface?.shadows === true;
  const light = surface?.crystalLight;
  const own = {
    uPaint: { value: paints.map((hex) => new THREE.Color(hex)) },
    uKey: { value: KEY.clone() },
    uAmbient: { value: 0.52 },
    uTime: { value: 0 },
    uHaze: { value: new THREE.Color(haze?.colour ?? '#000000') },
    uHazeRange: { value: new THREE.Vector4(haze?.from ?? 1, haze?.to ?? 2, haze?.strength ?? 0, haze?.near ?? 0) },
    uSkyTop: { value: new THREE.Color(haze?.sky?.top ?? '#000000') },
    uSkyBottom: { value: new THREE.Color(haze?.sky?.bottom ?? '#000000') },
    uSkyGlow: { value: new THREE.Color(haze?.sky?.glow ?? '#000000') },
    uSkyOn: { value: haze?.sky ? 1 : 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: grain },
    uGround: { value: surface?.ground ?? 0 },
    uShadowTint: { value: SHADOW_TINT.clone() },
    uCrystalLight: { value: light?.colour.clone() ?? new THREE.Color(0, 0, 0) },
    uCrystalStrength: { value: light?.strength ?? 0 },
  };
  const defines: Record<string, string> = {};
  if (grain) defines.USE_STONE_GRAIN = '';
  if (surface?.mossyRuins) defines.USE_MOSSY_RUINS = '';
  if (light) defines.USE_CRYSTAL_LIGHT = '';
  if (shadows) defines.USE_DIORAMA_SHADOWS = '';
  return new THREE.ShaderMaterial({
    // Обидва боки: віяла кришок плит і кавалків закручені як прийдеться, а
    // нормаль шейдер однаково повертає до камери. Перший кадр показав
    // бруківку білою сіткою — кришки відсікались, лишались самі стінки.
    side: THREE.DoubleSide,
    defines,
    // Маска тіні three приходить лише в матеріал зі світлом: тоді рендерер
    // кладе в нього карти тіней і їхні матриці.
    lights: shadows,
    uniforms: shadows ? { ...shadowLightUniforms(), ...own } : own,
    vertexShader: /* glsl */ `
      attribute float paint;
      attribute float tone;
      attribute float glow;
      varying vec3 vWorld;
      varying float vPaint;
      varying float vTone;
      varying float vGlow;
      varying vec3 vNormal;
      ${SHADOW_VERTEX_PARS}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = mat3(modelMatrix) * normal;
        vPaint = paint;
        vTone = tone;
        vGlow = glow;
        ${SHADOW_VERTEX}
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaint[${count}];
      uniform vec3 uKey;
      uniform float uAmbient;
      uniform float uTime;
      uniform vec3 uHaze;
      uniform vec4 uHazeRange;
      uniform vec3 uSkyTop;
      uniform vec3 uSkyBottom;
      uniform vec3 uSkyGlow;
      uniform float uSkyOn;
      uniform vec2 uResolution;
      uniform sampler2D uGrain;
      uniform float uGround;
      uniform vec3 uShadowTint;
      uniform vec3 uCrystalLight;
      uniform float uCrystalStrength;
      varying vec3 vWorld;
      varying float vPaint;
      varying float vTone;
      varying float vGlow;
      varying vec3 vNormal;
      ${SHADOW_FRAGMENT_PARS}
      ${DIORAMA_SHADE}
      ${SOFT_NORMAL_GLSL}
      #ifdef USE_STONE_GRAIN
        // Зерно з трьох проєкцій, змішаних за нормаллю: без розгортки й без
        // шва; середина карти 0.86 — ділимо, щоб зерно не пригасило камінь.
        float stoneGrain(vec3 p, vec3 n) {
          vec3 w = pow(abs(n), vec3(4.0));
          w /= (w.x + w.y + w.z);
          float g = texture2D(uGrain, p.zy * 1.7).r * w.x
                  + texture2D(uGrain, p.xz * 1.7).r * w.y
                  + texture2D(uGrain, p.xy * 1.7).r * w.z;
          return g / 0.86;
        }
      #endif
      void main() {
        // Обтічне світло на гранчастому острові (власник, 2026-10-04).
        vec3 n = softNormal(vNormal, vWorld);
        vec3 view = normalize(cameraPosition - vWorld);
        int i = int(vPaint + 0.5);
        vec3 base = uPaint[0];
        for (int k = 1; k < ${count}; k++) if (k == i) base = uPaint[k];
        vec3 albedo = base * vTone;
        // Камінь — фарби з \`stonePaints\` (типово все, крім плюща, самоцвітів, хмар і квітів).
        bool stone = ${stoneTest};
        #ifdef USE_STONE_GRAIN
          if (stone) {
            albedo *= mix(1.0, stoneGrain(vWorld, n), 0.85);
            // Руїни (2): низ темніший і зеленіє — колона століттями стоїть
            // у вологій землі; на прямовисних гранях — темні патьоки згори.
            #ifdef USE_MOSSY_RUINS
            if (i == 2) {
              float h = vWorld.y - uGround;
              float foot = 1.0 - smoothstep(0.0, 0.32, h);
              albedo *= mix(1.0, 0.72, foot);
              albedo = mix(albedo, uPaint[3] * 0.55, foot * 0.28);
              float side = 1.0 - abs(n.y);
              float streak = texture2D(uGrain, vec2(dot(vWorld.xz, vec2(3.1, 2.3)), vWorld.y * 0.35)).r;
              albedo *= mix(1.0, smoothstep(0.55, 1.0, streak) * 0.25 + 0.78, side * 0.7);
            }
            #endif
          }
        #endif
        vec3 c = dioramaShade(albedo, n, view);
        c = dioramaShadow(c, n, uKey, uShadowTint);
        #ifdef USE_CRYSTAL_LIGHT
          // Далекий храм: грані до острова ловлять колір кристала, верх
          // колон — світло з розлому, низ тоне в тіні підземелля.
          vec3 toIsland = normalize(vec3(-vWorld.x, 0.0, -vWorld.z));
          float facingIsland = max(0.0, dot(n, toIsland));
          float rise = smoothstep(-4.0, 14.0, vWorld.y);
          c *= mix(0.62, 1.12, rise);
          c += albedo * uCrystalLight * pow(facingIsland, 2.0) * uCrystalStrength * (1.0 - 0.5 * rise);
        #endif
        // Самоцвіти в скелі світяться самі й повільно дихають.
        c = mix(c, base * (1.25 + 0.2 * sin(uTime * 1.3 + vWorld.x * 3.0)), vGlow * 0.85);
        float haze = smoothstep(uHazeRange.x, uHazeRange.y, length(vWorld)) * uHazeRange.z;
        if (uHazeRange.w > 0.0) {
          float near = 1.0 - smoothstep(uHazeRange.w * 0.35, uHazeRange.w, distance(cameraPosition, vWorld));
          haze = max(haze, near * 0.92);
        }
        vec3 air = uHaze;
        if (uSkyOn > 0.5) {
          // Небо за цим пікселем — та сама формула, що в тла діорами.
          vec2 uv = gl_FragCoord.xy / uResolution;
          air = mix(uSkyBottom, uSkyTop, smoothstep(0.05, 0.95, uv.y));
          vec2 d = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
          air += uSkyGlow * exp(-dot(d, d) * 16.0) * 0.3;
          air *= mix(0.72, 1.0, smoothstep(0.95, 0.35, length(uv - 0.5)));
          air = mix(air, uHaze, 0.25);
        }
        c = mix(c, air, haze);
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/** Пологіше за цей кут — світло плавне; гостріше — злам (край скелі, ребро брили). */
export const ISLAND_CREASE_DEG = 55;

export function meshGeometry(mesh: IslandMesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('paint', new THREE.BufferAttribute(mesh.paint, 1));
  g.setAttribute('tone', new THREE.BufferAttribute(softScalar(mesh.positions, mesh.tone, ISLAND_CREASE_DEG), 1));
  g.setAttribute('glow', new THREE.BufferAttribute(mesh.glow, 1));
  g.setAttribute('normal', new THREE.BufferAttribute(softNormals(mesh.positions, ISLAND_CREASE_DEG), 3));
  g.computeBoundingSphere();
  return g;
}

/** М'яке кругле сяйво (для основи кристала й самоцвітів). */
function createGlowMaterial(tint: string, strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uColour: { value: new THREE.Color(tint) }, uStrength: { value: strength }, uPulse: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      uniform float uPulse;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(smoothstep(1.0, 0.0, r), 2.2) * uStrength * uPulse;
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  });
}

export function createRayMaterial(tint: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColour: { value: new THREE.Color(tint) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        // Промінь — вертикальна смуга світла. Збоку він читається променем,
        // а згори — смугою, покладеною поперек сцени (власник, знімки з
        // телефона): що крутіше камера дивиться вниз, то слабший промінь.
        vec3 view = normalize(cameraPosition - w.xyz);
        vFacing = 1.0 - smoothstep(0.3, 0.6, abs(view.y));
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uTime;
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
        // Обидва кінці тануть: низ променя не впирається в острів рискою.
        float along = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
        float a = across * along * vFacing * (0.11 + 0.04 * sin(uTime * 0.5 + vUv.x * 3.0));
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  });
}

interface CrystalIslandProps {
  seed: string;
  theme: 'light' | 'dark';
  /** Радіус верхівки острова в одиницях сцени. */
  radius: number;
  groundY: number;
  /** Колір сяйва в основі кристала — колір колонії. */
  glowColour: THREE.Color;
  /** Висота монарха в сцені — сяйво під нього. */
  crystalHeight: number;
  reduceMotion: boolean;
  /** Лише острів, без храму й променів — острівець на тлі входу (ADR-0228). */
  bare?: boolean;
  /** Друзи-самоцвіти на плитах — спільні вихідні пари (ADR-0237). */
  druses?: number;
  /** Пора року (ADR-0237): іній узимку, квіти навесні. */
  season?: Season;
  /**
   * Справжні тіні (ADR-0243): напрямлене світло з картою тіней. Лише там,
   * де полотно створене з `shadows`, і не на слабкому профілі пристрою.
   */
  shadows?: boolean;
}

export function CrystalIsland({ seed, theme, radius, groundY, glowColour, crystalHeight, reduceMotion, bare = false, druses = 0, season = 'summer', shadows = false }: CrystalIslandProps) {
  const built = useMemo(() => buildCrystalIsland(seed, radius, druses, season), [seed, radius, druses, season]);
  const island = useMemo(() => meshGeometry(built.island), [built]);
  const debris = useMemo(() => meshGeometry(built.debris), [built]);
  const ground = useMemo(() => meshGeometry(built.ground), [built]);
  // Давній храм у підземеллі навколо острова, на всі 360° (ADR-0224).
  const temple = useMemo(() => meshGeometry(bare ? EMPTY_MESH : buildCrystalSurround(seed)), [seed, bare]);
  const glowHex = `#${glowColour.getHexString()}`;
  // Зерно каменю — одна сіра карта 256² на всю сцену (ADR-0243).
  const grain = useMemo(() => rockGrainTexture(), []);
  useEffect(() => () => grain?.dispose(), [grain]);
  const materials = useMemo(() => {
    // Земля кристала світиться його кольором, а не сталим рожевим самоцвітів.
    const groundPaints = ISLAND_PAINTS[theme].map((hex, i) => (i === PAINT.gem ? glowHex : hex));
    const stone: IslandSurface = { grain, ground: groundY, shadows, mossyRuins: true };
    return {
      island: createIslandMaterial(ISLAND_PAINTS[theme], undefined, stone),
      ground: createIslandMaterial(groundPaints, undefined, { shadows }),
      // Далекий храм тоне в небі, а не в сталому кольорі (ADR-0242): ближні
      // колони печери стояли яскравими смугами через увесь кадр і
      // сперечались із кристалом. Тепер ближче за 5 — повністю, далі — небо.
      temple: createIslandMaterial(TEMPLE_PAINTS[theme], {
        colour: CAVE[theme].air,
        from: 5,
        to: 40,
        strength: 0.82,
        near: 30,
        sky: DIORAMA_PALETTES.crystal[theme],
      }, {
        // Без зерна: карта 256² на велетенських далеких колонах малювала
        // горизонтальну смугу поперек кадру, а не фактуру (A/B у DevTools).
        crystalLight: { colour: new THREE.Color(glowHex).lerp(new THREE.Color(1, 0.92, 0.97), 0.3), strength: theme === 'dark' ? 0.9 : 0.5 },
      }),
      ray: createRayMaterial(CAVE[theme].ray),
      // Сяйво в основі — м'яке, ледь помітне: магія всередині кристала
      // (шейдер), а не хмарою навколо (власник, 2026-10-06).
      core: createGlowMaterial(glowHex, theme === 'dark' ? 0.12 : 0.08),
    };
  }, [theme, glowHex, grain, groundY, shadows]);
  const debrisRef = useRef<THREE.Group>(null);


  useEffect(() => () => { island.dispose(); debris.dispose(); ground.dispose(); temple.dispose(); }, [island, debris, ground, temple]);
  useEffect(() => () => { for (const m of Object.values(materials)) m.dispose(); }, [materials]);

  useFrame(({ clock, gl }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    materials.temple.uniforms.uResolution!.value.copy(gl.getDrawingBufferSize(BUFFER));
    materials.island.uniforms.uTime!.value = t;
    materials.ground.uniforms.uTime!.value = t;
    materials.temple.uniforms.uTime!.value = t;
    materials.ray.uniforms.uTime!.value = t;
    materials.core.uniforms.uPulse!.value = 0.85 + 0.15 * Math.sin(t * 0.9);
    // Уламки повільно пливуть довкола й гойдаються.
    if (debrisRef.current) {
      debrisRef.current.rotation.y = t * 0.03;
      debrisRef.current.position.y = Math.sin(t * 0.5) * radius * 0.02;
    }
  });

  return (
    <>
      {!bare && <mesh geometry={temple} material={materials.temple} frustumCulled={false} />}
      {/* Промені з розлому в склепінні: стоять кільцем і повертаються до
          камери лише навколо вертикалі — збоку вони більше не дошки. */}
      {!bare && [0, 1, 2, 3, 4].map((k) => (
        <Billboard
          key={k}
          lockX
          lockZ
          position={[Math.cos(k * 1.3 + 0.4) * radius * 2.2, groundY + radius * 4.4, Math.sin(k * 1.3 + 0.4) * radius * 2.2]}
        >
          <mesh material={materials.ray} rotation={[0, 0, -0.2]} renderOrder={-4}>
            <planeGeometry args={[radius * (0.45 + 0.15 * (k % 2)), radius * 5]} />
          </mesh>
        </Billboard>
      ))}
      {/* Світло, що кидає тінь (ADR-0243), — уздовж ключа діорами. */}
      {shadows && <ShadowSun direction={KEY} radius={radius} groundY={groundY} version={built} />}
      <group position={[0, groundY, 0]}>
        <mesh geometry={island} material={materials.island} castShadow receiveShadow />
        <mesh geometry={ground} material={materials.ground} receiveShadow />
        <group ref={debrisRef}>
          <mesh geometry={debris} material={materials.island} />
        </group>
        {/* Сяйво в основі кристала — біля самої землі: вище воно лягало
            круглим ореолом поперек монарха (ADR-0242). */}
        <Billboard position={[0, crystalHeight * 0.06, 0]}>
          <mesh material={materials.core} renderOrder={5}>
            <planeGeometry args={[crystalHeight * 0.85, crystalHeight * 0.5]} />
          </mesh>
        </Billboard>
      </group>
    </>
  );
}
