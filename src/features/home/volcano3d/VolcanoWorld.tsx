// ============================================================
// Світ підводного вулкана (ADR-0235).
// ------------------------------------------------------------
// Глибина, острів, трава, риби й корали — світ рифу v2 як є (`ReefV2World`):
// вулкан став його серцем замість кам'яної голови. Своє тут лише те, що
// світиться: озеро лави в кратері, жили на схилах і жар, що здіймається з
// кратера. Лава б'ється подвійним поштовхом і паузою — «серце вулкана».
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import type { VolcanoGeometry } from '@/engine/species/volcano/geometry';
import type { VolcanoCreature } from '@/engine/species/volcano/model';
import { VolcanoCreatures } from './VolcanoCreatures';
import type { Season } from '@/engine/species/grammar/season';
import { PORTAL_GROUND_Y } from '../crystal3d/scene/portalScene';
import { ReefV2World } from '../reef3d/v2/ReefV2World';
import { isCrystalTap, type CrystalPointerSample } from '../crystal3d/evolution/tapGesture';
import { eruptionAt } from './eruption';

const VOLCANO_ROCK_NAME = 'volcano-rock';
const VOLCANO_LAVA_NAME = 'volcano-lava';
import { REEF_PALETTES, createGlowMaterial, createVolcanoRockMaterial } from '../reef3d/v2/reefV2Materials';
import { rockGrainTexture } from '../crystal3d/scene/rockGrainTexture';
import { lavaProximity } from './lavaProximity';

/** Базальт: темніший і тепліший за камінь рифу. */
/**
 * Конус — насичений фіолетовий, як у референсі власника. Від скелі острова
 * його відділяє біле плато й ріки лави, тож він не зливається (сіро-сливовий
 * `#4f3f5e` був до референсу).
 */
// Темно-фіолетовий, не червоний (власник, 2026-10-05: «темно-фіолетовий
// вулкан + рожево-помаранчева лава + глибокий синій океан»): відрізняється
// від яскраво-лілового кристала й лишається в гамі Amore.
export const VOLCANO_ROCK: Record<'light' | 'dark', string> = { light: '#3f2a6e', dark: '#33235e' };

/** Грані конуса не згладжуються: «8–12 великих фасетів» (власник). */
const VOLCANO_CREASE_DEG = 18;

/** Подвійний удар серця: два поштовхи й пауза, період 1.6 с. */
export function heartbeat(t: number): number {
  const p = ((t % 1.6) + 1.6) % 1.6;
  const beat = (c: number) => Math.exp(-((p - c) ** 2) / 0.004);
  return beat(0.1) + 0.7 * beat(0.35);
}

function createLavaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uBeat: { value: 0 }, uGlow: { value: 1 }, uFront: { value: 0 }, uCool: { value: 0 }, uRest: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float heat;
      attribute float flow;
      varying float vHeat;
      varying float vFlow;
      varying vec3 vLocal;
      void main() {
        vHeat = heat;
        vFlow = flow;
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBeat;
      uniform float uGlow;
      uniform float uFront;
      uniform float uCool;
      uniform float uRest;
      uniform float uTime;
      varying float vHeat;
      varying float vFlow;
      varying vec3 vLocal;
      // Згладжений шум у просторі моделі — для кірки, що пливе рікою.
      float lavaHash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float lavaNoise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(lavaHash(i), lavaHash(i + vec3(1, 0, 0)), f.x), mix(lavaHash(i + vec3(0, 1, 0)), lavaHash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(lavaHash(i + vec3(0, 0, 1)), lavaHash(i + vec3(1, 0, 1)), f.x), mix(lavaHash(i + vec3(0, 1, 1)), lavaHash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
      void main() {
        // Ріки (flow ≥ 0) видно лише до фронту дотику; фронт нерівний —
        // язики лави біжать трохи вперед і відстають. Чаша (flow < 0) — завжди.
        float head = 0.0;
        if (vFlow >= 0.0) {
          float lick = 0.02 * sin(vLocal.x * 57.0 + vLocal.z * 43.0) + 0.012 * sin(vLocal.y * 91.0);
          // У спокої тонкі потоки видно до uRest (стадія пробудження);
          // дотик женe фронт до підніжжя, а застигає лише те, що нижче.
          if (vFlow > max(uFront, uRest) + lick) discard;
          // Застигання — розсип: гасне крапка за крапкою, без прозорості.
          float grain = fract(sin(dot(floor(gl_FragCoord.xy * 0.5), vec2(12.9898, 78.233))) * 43758.5453);
          if (vFlow > uRest && grain < uCool) discard;
          // Голова потоку — найгарячіша.
          head = smoothstep(0.08, 0.0, uFront - vFlow) * step(uFront, 0.999);
        }
        // Від застиглої темно-червоної кірки до жовто-рожевого серця.
        // Референс власника: ріки й корона — чистий червоно-помаранчевий,
        // серце кратера — жовте.
        // Рожево-помаранчева лава (власник, 2026-10-05), не пекельно-червона.
        vec3 crust = vec3(0.86, 0.26, 0.45);
        vec3 hot = vec3(1.0, 0.47, 0.32);
        vec3 core = vec3(1.0, 0.84, 0.46);
        float h = clamp(vHeat * (0.65 + 0.35 * uGlow) + 0.18 * uBeat * vHeat + 0.35 * head, 0.0, 1.0);
        vec3 c = h < 0.6 ? mix(crust, hot, h / 0.6) : mix(hot, core, (h - 0.6) / 0.4);
        /*
         * Кірка, що пливе (ADR-0246): темніші острівці застиглої лави
         * сунуться вниз рікою — у ріці лава тече, у чаші ледь вирує. Голова
         * потоку й серце кратера — без кірки: там найгарячіше.
         */
        float speed = vFlow >= 0.0 ? 0.16 : 0.03;
        float crustNoise = lavaNoise(vLocal * 11.0 + vec3(0.0, uTime * speed, 0.0));
        // У спокої фронту немає (uFront = 0, head = 1 скрізь) — кірка тоді
        // лежить на всій ріці; лише серце кратера лишається чистим.
        float hotCore = vFlow >= 0.0 ? 0.0 : smoothstep(0.7, 1.0, h);
        float crustMask = smoothstep(0.45, 0.65, crustNoise) * (1.0 - head * step(0.001, uFront)) * (1.0 - hotCore);
        c = mix(c, crust * 0.55, crustMask * 0.6);
        gl_FragColor = vec4(c * (0.9 + 0.5 * uBeat * vHeat), 1.0);
      }
    `,
  });
}

/**
 * Пара над кратером (власник, 2026-10-06: «невеликий дим/пара»): кілька
 * м'яких клубів повільно здіймаються, розширюються й тануть. Звичайне
 * змішування, а не додавання світла: пара — не сяйво.
 */
function createSteamMaterial(colour: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uSize: { value: 0.3 }, uRise: { value: 1 }, uStrength: { value: 0.35 }, uColour: { value: new THREE.Color(colour) } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform float uScale;
      uniform float uSize;
      uniform float uRise;
      varying float vAlpha;
      void main() {
        float life = fract(uTime * 0.05 + seed);
        vec3 p = position;
        p.y += life * uRise;
        p.x += sin(uTime * 0.3 + seed * 20.0) * uRise * 0.12 * life;
        p.z += cos(uTime * 0.25 + seed * 13.0) * uRise * 0.1 * life;
        vAlpha = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.55, 1.0, life));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.6 + 1.2 * life) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.1, r) * vAlpha * uStrength;
        gl_FragColor = vec4(uColour, a);
      }
    `,
  });
}

interface VolcanoWorldProps {
  seed: string;
  geometry: VolcanoGeometry;
  scale: number;
  theme: 'light' | 'dark';
  reduceMotion: boolean;
  island: number;
  rockRadius: number;
  /** Жар кратера з моделі: 0…1. */
  glow: number;
  /** Скільки схилу потоки проходять у спокої (`model.streamReach`). */
  streamReach?: number;
  /** Радіус кратера в одиницях моделі: розмір сяйва над жерлом. */
  craterRadius?: number;
  /**
   * Без діорами (екран входу, лабораторія): там нікому торкнутися, тож ріки
   * течуть завжди — інакше вулкан у ряду вибору був би без лави.
   */
  bare?: boolean;
  /** Видів риб у зграї: новий на 5 / 10 / 20 роках разом (ADR-0237). */
  fishKinds?: number;
  /** Пора року: світло й морський сніг у воді (ADR-0237). */
  season?: Season;
  /** Дотик по вулкану, крім виверження, відкриває хроніку росту (ADR-0238). */
  onTap?: (() => void) | undefined;
  /** Мешканці за виконаними бажаннями (2026-10-05). */
  creatures?: readonly VolcanoCreature[];
}

export function VolcanoWorld({ seed, geometry, scale, theme, reduceMotion, island, rockRadius, glow, streamReach = 0.5, craterRadius = 0.3, bare = false, fishKinds = 1, season, onTap, creatures = [] }: VolcanoWorldProps) {
  const lava = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geometry.lava.positions, 3));
    g.setAttribute('heat', new THREE.BufferAttribute(geometry.lava.heat, 1));
    g.setAttribute('flow', new THREE.BufferAttribute(geometry.lava.flow, 1));
    g.computeBoundingSphere();
    return g;
  }, [geometry]);
  // Виверження на дотик (власник: «нехай лава починає текти лише при дотику
  // по вулкану»). Час дотику — з годинника сцени; тап відділено від
  // перетягування орбіти тим самим правилом, що в кристала.
  const tappedAt = useRef<number | null>(null);
  const pointerDown = useRef<CrystalPointerSample | null>(null);
  const clockRef = useRef(0);
  // Жар: іскри, що здіймаються з кратера (рух — шейдер «бульбашок» рифу).
  const embers = useMemo(() => {
    const out: number[] = [];
    const seeds: number[] = [];
    for (let k = 0; k < 14; k += 1) {
      const a = unit(seed, `ember${k}:a`) * Math.PI * 2;
      const r = 0.12 * Math.sqrt(unit(seed, `ember${k}:r`));
      out.push(Math.cos(a) * r, geometry.magmaY, Math.sin(a) * r);
      seeds.push(unit(seed, `ember${k}`));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(seeds), 1));
    return g;
  }, [geometry, seed]);
  // Сяйво над жерлом: кратер — головний акцент і з боку, коли саме озеро
  // жару не видно (власник: «кратер має стати головним акцентом … легке
  // світіння країв»). Одна м'яка точка; сила — зі стадії пробудження.
  const halo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, geometry.magmaY + craterRadius * 1.25, 0]), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array([0.5]), 1));
    return g;
  }, [geometry, craterRadius]);
  const steam = useMemo(() => {
    const out: number[] = [];
    const seeds: number[] = [];
    for (let k = 0; k < 9; k += 1) {
      const a = unit(seed, `steam${k}:a`) * Math.PI * 2;
      const r = craterRadius * 0.4 * Math.sqrt(unit(seed, `steam${k}:r`));
      out.push(Math.cos(a) * r, geometry.magmaY + craterRadius * 1.1, Math.sin(a) * r);
      seeds.push(k / 9 + 0.05 * unit(seed, `steam${k}`));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(seeds), 1));
    return g;
  }, [geometry, seed, craterRadius]);
  // Світло рік на схилі (ADR-0246): близькість кожної вершини до ріки.
  const rockLava = useMemo(() => ({
    lava: new THREE.BufferAttribute(lavaProximity(geometry.rock.positions, geometry.lava.positions, geometry.lava.flow, craterRadius * 0.9), 2),
  }), [geometry, craterRadius]);
  // Зерно базальту — одна сіра карта 256² на сцену (ADR-0246).
  const grain = useMemo(() => rockGrainTexture(), []);
  useEffect(() => () => grain?.dispose(), [grain]);
  const materials = useMemo(() => ({
    rock: createVolcanoRockMaterial(REEF_PALETTES[theme], VOLCANO_ROCK[theme], PORTAL_GROUND_Y, { grain, lavaLight: true }),
    lava: createLavaMaterial(),
    embers: createGlowMaterial('#ffb0a0', 0.05 + 1.3 * glow, 0.09, 'bubbles'),
    halo: createGlowMaterial('#ff6f6a', 0.05 + 0.28 * glow, craterRadius * scale * 4.5, 'still'),
    steam: createSteamMaterial(theme === 'light' ? '#eef0fa' : '#c9c4e0'),
  }), [glow, theme, craterRadius, scale, grain]);

  useEffect(() => () => { lava.dispose(); embers.dispose(); halo.dispose(); steam.dispose(); }, [lava, embers, halo, steam]);
  useEffect(() => () => { for (const m of Object.values(materials)) m.dispose(); }, [materials]);

  useFrame(({ clock, size }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    const beat = reduceMotion ? 0.3 : heartbeat(t);
    clockRef.current = clock.getElapsedTime();
    const eruption = bare
      ? { front: 1, cool: 0 }
      : eruptionAt(tappedAt.current === null ? null : clockRef.current - tappedAt.current, reduceMotion);
    materials.lava.uniforms.uFront!.value = eruption.front;
    materials.lava.uniforms.uRest!.value = streamReach;
    materials.lava.uniforms.uCool!.value = eruption.cool;
    materials.lava.uniforms.uTime!.value = t;
    // Камінь бачить той самий фронт, що й ріка: світло біжить разом із нею.
    materials.rock.uniforms.uFront!.value = eruption.front * (1 - eruption.cool);
    materials.rock.uniforms.uRest!.value = streamReach;
    // Камінь тепліє з рікою: у спокої — лише біля жерла.
    const flowing = eruption.front * (1 - eruption.cool);
    materials.lava.uniforms.uBeat!.value = beat;
    materials.rock.uniforms.uBeat!.value = beat;
    // Жерло тліє й у спокої — як у референсі; ріка лише додає.
    materials.rock.uniforms.uGlow!.value = glow * (0.65 + 0.35 * flowing);
    materials.rock.uniforms.uTime!.value = t;
    materials.lava.uniforms.uGlow!.value = glow;
    materials.embers.uniforms.uTime!.value = t;
    materials.embers.uniforms.uScale!.value = size.height;
    materials.halo.uniforms.uScale!.value = size.height;
    materials.steam.uniforms.uScale!.value = size.height;
    materials.steam.uniforms.uTime!.value = t;
    // Розмір і висота клубів — у сцені: група масштабована (`scale`).
    materials.steam.uniforms.uSize!.value = craterRadius * scale * 2.2;
    materials.steam.uniforms.uRise!.value = craterRadius * 4;
    // Сплячий вулкан ледь парує; прокинутий — помітніше, але легко.
    materials.steam.uniforms.uStrength!.value = 0.08 + 0.18 * glow;
    // Сяйво дихає разом із серцем вулкана.
    materials.halo.uniforms.uStrength!.value = (0.05 + 0.28 * glow) * (0.85 + 0.25 * beat);
  });

  const isVolcano = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
    event.object.name === VOLCANO_ROCK_NAME || event.object.name === VOLCANO_LAVA_NAME;

  return (
    <group
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        if (!isVolcano(event)) return;
        pointerDown.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, at: performance.now() };
      }}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (!isVolcano(event)) return;
        const start = pointerDown.current;
        pointerDown.current = null;
        if (!isCrystalTap(start, { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, at: performance.now() })) return;
        event.stopPropagation();
        tappedAt.current = clockRef.current;
        onTap?.();
      }}
    >
      <ReefV2World
        seed={seed}
        geometry={geometry}
        scale={scale}
        theme={theme}
        reduceMotion={reduceMotion}
        island={island}
        rockRadius={rockRadius}
        rockColour={VOLCANO_ROCK[theme]}
        rockMaterial={materials.rock}
        rockName={VOLCANO_ROCK_NAME}
        rockHeat={geometry.rockHeat}
        rockCreaseDeg={VOLCANO_CREASE_DEG}
        volcanicIsland
        islandArch={false}
        islandLagoon={false}
        islandStones={false}
        seagrassScale={0.35}
        islandWildlife={1 / 4}
        calmSurround
        fishKinds={fishKinds}
        {...(season ? { season } : {})}
        bare={bare}
        rockAttributes={rockLava}
      />
      <group position={[0, PORTAL_GROUND_Y, 0]}>
        <group scale={scale}>
          <mesh name={VOLCANO_LAVA_NAME} geometry={lava} material={materials.lava} />
          <points geometry={embers} material={materials.embers} frustumCulled={false} />
          <points geometry={halo} material={materials.halo} frustumCulled={false} />
          <points geometry={steam} material={materials.steam} frustumCulled={false} renderOrder={3} />
          <VolcanoCreatures creatures={creatures} reduceMotion={reduceMotion} />
        </group>
      </group>
    </group>
  );
}
