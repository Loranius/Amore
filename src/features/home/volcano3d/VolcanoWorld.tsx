// ============================================================
// Світ підводного вулкана (ADR-0235).
// ------------------------------------------------------------
// Глибина, острів, трава, риби й корали — світ рифу v2 як є (`ReefV2World`):
// вулкан став його серцем замість кам'яної голови. Своє тут лише те, що
// світиться: озеро лави в кратері, жили на схилах і жар, що здіймається з
// кратера. Лава б'ється подвійним поштовхом і паузою — «серце вулкана».
// ============================================================
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import type { VolcanoGeometry } from '@/engine/species/volcano/geometry';
import { PORTAL_GROUND_Y } from '../crystal3d/scene/portalScene';
import { ReefV2World } from '../reef3d/v2/ReefV2World';
import { createGlowMaterial } from '../reef3d/v2/reefV2Materials';

/** Базальт: темніший і тепліший за камінь рифу. */
export const VOLCANO_ROCK: Record<'light' | 'dark', string> = { light: '#6f5ca6', dark: '#3d3170' };

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
    uniforms: { uBeat: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float heat;
      varying float vHeat;
      void main() {
        vHeat = heat;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uBeat;
      uniform float uGlow;
      varying float vHeat;
      void main() {
        // Від застиглої темно-червоної кірки до жовто-рожевого серця.
        vec3 crust = vec3(0.45, 0.08, 0.12);
        vec3 hot = vec3(1.0, 0.36, 0.30);
        vec3 core = vec3(1.0, 0.78, 0.55);
        float h = clamp(vHeat * (0.65 + 0.35 * uGlow) + 0.18 * uBeat * vHeat, 0.0, 1.0);
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
  /** Жар кратера з моделі: 0.35…1. */
  glow: number;
  bare?: boolean;
}

export function VolcanoWorld({ seed, geometry, scale, theme, reduceMotion, island, rockRadius, glow, bare = false }: VolcanoWorldProps) {
  const lava = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geometry.lava.positions, 3));
    g.setAttribute('heat', new THREE.BufferAttribute(geometry.lava.heat, 1));
    g.computeBoundingSphere();
    return g;
  }, [geometry]);
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
  const materials = useMemo(() => ({
    lava: createLavaMaterial(),
    embers: createGlowMaterial('#ffb487', 0.9 + 0.6 * glow, 0.09, 'bubbles'),
  }), [glow]);

  useEffect(() => () => { lava.dispose(); embers.dispose(); }, [lava, embers]);
  useEffect(() => () => { materials.lava.dispose(); materials.embers.dispose(); }, [materials]);

  useFrame(({ clock, size }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    materials.lava.uniforms.uBeat!.value = reduceMotion ? 0.3 : heartbeat(t);
    materials.lava.uniforms.uGlow!.value = glow;
    materials.embers.uniforms.uTime!.value = t;
    materials.embers.uniforms.uScale!.value = size.height;
  });

  return (
    <>
      <ReefV2World
        seed={seed}
        geometry={geometry}
        scale={scale}
        theme={theme}
        reduceMotion={reduceMotion}
        island={island}
        rockRadius={rockRadius}
        rockColour={VOLCANO_ROCK[theme]}
        islandArch={false}
        bare={bare}
      />
      <group position={[0, PORTAL_GROUND_Y, 0]}>
        <group scale={scale}>
          <mesh geometry={lava} material={materials.lava} />
          <points geometry={embers} material={materials.embers} frustumCulled={false} />
        </group>
      </group>
    </>
  );
}
