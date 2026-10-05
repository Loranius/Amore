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
    uniforms: { uBeat: { value: 0 }, uGlow: { value: 1 }, uFront: { value: 0 }, uCool: { value: 0 }, uRest: { value: 0 } },
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
      varying float vHeat;
      varying float vFlow;
      varying vec3 vLocal;
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
        gl_FragColor = vec4(c * (0.9 + 0.5 * uBeat * vHeat), 1.0);
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
  const materials = useMemo(() => ({
    rock: createVolcanoRockMaterial(REEF_PALETTES[theme], VOLCANO_ROCK[theme], PORTAL_GROUND_Y),
    lava: createLavaMaterial(),
    embers: createGlowMaterial('#ffb0a0', 0.05 + 1.3 * glow, 0.09, 'bubbles'),
    halo: createGlowMaterial('#ff6f6a', 0.05 + 0.28 * glow, craterRadius * scale * 4.5, 'still'),
  }), [glow, theme, craterRadius, scale]);

  useEffect(() => () => { lava.dispose(); embers.dispose(); halo.dispose(); }, [lava, embers, halo]);
  useEffect(() => () => { materials.rock.dispose(); materials.lava.dispose(); materials.embers.dispose(); materials.halo.dispose(); }, [materials]);

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
      />
      <group position={[0, PORTAL_GROUND_Y, 0]}>
        <group scale={scale}>
          <mesh name={VOLCANO_LAVA_NAME} geometry={lava} material={materials.lava} />
          <points geometry={embers} material={materials.embers} frustumCulled={false} />
          <points geometry={halo} material={materials.halo} frustumCulled={false} />
          <VolcanoCreatures creatures={creatures} reduceMotion={reduceMotion} />
        </group>
      </group>
    </group>
  );
}
