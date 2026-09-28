import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import { DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';
import { buildCrystalIsland, type IslandMesh } from './crystalIsland';

// ============================================================
// Острів кристала за референсом власника (ADR-0221): бруківка, скеля з
// самоцвітами, руїни з плющем, уламки, сяйво в основі кристала й далекий
// грот із променями. Геометрія — `crystalIsland.ts`; тут лише фарби.
// ============================================================

const END = /* glsl */ `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
`;

const KEY = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();

/** Фарби: бруківка, скеля, камінь руїн, плющ, самоцвіт, земля між плитами. */
const ISLAND_PAINTS: Record<'light' | 'dark', readonly string[]> = {
  light: ['#dcc3c6', '#6d5c96', '#d9c6c4', '#5fae45', '#ff8fd0', '#7d6878', '#ffffff', '#9c86cf'],
  dark: ['#a591b0', '#3c3163', '#ad9cba', '#4a9440', '#ff82d2', '#473c57', '#d8cff0', '#3a2c6c'],
};

/** Далекий грот: силуети, що тонуть у повітрі, і промені. */
const CAVE: Record<'light' | 'dark', { far: string; air: string; ray: string }> = {
  // Силуети грота ледь темніші за повітря: далина, а не стіна поруч.
  light: { far: '#6a5bab', air: '#9c86cf', ray: '#fff0fb' },
  dark: { far: '#2e2458', air: '#3a2c6c', ray: '#ffb8ec' },
};

/** Матеріал острова: фарба з палітри (8 кольорів), м'яке світло діорами. */
export function createIslandMaterial(paints: readonly string[]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    // Обидва боки: віяла кришок плит і кавалків закручені як прийдеться, а
    // нормаль шейдер однаково повертає до камери. Перший кадр показав
    // бруківку білою сіткою — кришки відсікались, лишались самі стінки.
    side: THREE.DoubleSide,
    uniforms: {
      uPaint: { value: paints.map((hex) => new THREE.Color(hex)) },
      uKey: { value: KEY.clone() },
      uAmbient: { value: 0.52 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float paint;
      attribute float tone;
      attribute float glow;
      varying vec3 vWorld;
      varying float vPaint;
      varying float vTone;
      varying float vGlow;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vPaint = paint;
        vTone = tone;
        vGlow = glow;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaint[8];
      uniform vec3 uKey;
      uniform float uAmbient;
      uniform float uTime;
      varying vec3 vWorld;
      varying float vPaint;
      varying float vTone;
      varying float vGlow;
      ${DIORAMA_SHADE}
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 view = normalize(cameraPosition - vWorld);
        if (dot(n, view) < 0.0) n = -n;
        int i = int(vPaint + 0.5);
        vec3 base = uPaint[0];
        for (int k = 1; k < 8; k++) if (k == i) base = uPaint[k];
        vec3 c = dioramaShade(base * vTone, n, view);
        // Самоцвіти в скелі світяться самі й повільно дихають.
        c = mix(c, base * (1.25 + 0.2 * sin(uTime * 1.3 + vWorld.x * 3.0)), vGlow * 0.85);
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

export function meshGeometry(mesh: IslandMesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('paint', new THREE.BufferAttribute(mesh.paint, 1));
  g.setAttribute('tone', new THREE.BufferAttribute(mesh.tone, 1));
  g.setAttribute('glow', new THREE.BufferAttribute(mesh.glow, 1));
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

/** Далекі силуети грота: колони й арки, що тонуть у повітрі. */
function buildCave(seed: string): Float32Array {
  const out: number[] = [];
  const quad = (x0: number, x1: number, y0: number, y1: number, z: number) => {
    out.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z);
  };
  for (let k = 0; k < 9; k += 1) {
    const side = k % 2 === 0 ? -1 : 1;
    const x = side * (4 + 9 * unit(seed, `cave${k}:x`));
    const z = -10 - 12 * unit(seed, `cave${k}:z`);
    const w = 0.8 + 1.6 * unit(seed, `cave${k}:w`);
    const top = 3 + 9 * unit(seed, `cave${k}:h`);
    quad(x - w / 2, x + w / 2, -8, top, z);
    // Кожна третя — арка: перекладина до сусідньої колони.
    if (k % 3 === 0) quad(x - w / 2, x + w * 2.6, top - 1.2, top - 0.3, z);
  }
  return new Float32Array(out);
}

function createCaveMaterial(far: string, air: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { uFar: { value: new THREE.Color(far) }, uAir: { value: new THREE.Color(air) } },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFar;
      uniform vec3 uAir;
      varying float vY;
      void main() {
        // Низ тоне в повітрі грота: силует, а не стіна.
        vec3 c = mix(uAir, uFar, smoothstep(-6.0, 4.0, vY));
        gl_FragColor = vec4(c, 1.0);
        ${END}
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
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
        float along = smoothstep(0.0, 0.6, vUv.y);
        float a = across * along * (0.11 + 0.04 * sin(uTime * 0.5 + vUv.x * 3.0));
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
}

export function CrystalIsland({ seed, theme, radius, groundY, glowColour, crystalHeight, reduceMotion }: CrystalIslandProps) {
  const built = useMemo(() => buildCrystalIsland(seed, radius), [seed, radius]);
  const island = useMemo(() => meshGeometry(built.island), [built]);
  const debris = useMemo(() => meshGeometry(built.debris), [built]);
  const cave = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buildCave(seed), 3));
    return g;
  }, [seed]);
  const glowHex = `#${glowColour.getHexString()}`;
  const materials = useMemo(() => ({
    island: createIslandMaterial(ISLAND_PAINTS[theme]),
    cave: createCaveMaterial(CAVE[theme].far, CAVE[theme].air),
    ray: createRayMaterial(CAVE[theme].ray),
    core: createGlowMaterial(glowHex, theme === 'dark' ? 1.2 : 0.9),
  }), [theme, glowHex]);
  const debrisRef = useRef<THREE.Group>(null);

  useEffect(() => () => { island.dispose(); debris.dispose(); cave.dispose(); }, [island, debris, cave]);
  useEffect(() => () => { for (const m of Object.values(materials)) m.dispose(); }, [materials]);

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    materials.island.uniforms.uTime!.value = t;
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
      <mesh geometry={cave} material={materials.cave} renderOrder={-5} frustumCulled={false} />
      {[0, 1, 2].map((k) => (
        <mesh
          key={k}
          material={materials.ray}
          position={[radius * (0.6 + k * 0.9), groundY + radius * 2.2, -radius * (1.5 + k)]}
          rotation={[0, 0, -0.45 - k * 0.08]}
          renderOrder={-4}
        >
          <planeGeometry args={[radius * (0.45 + 0.2 * k), radius * 7]} />
        </mesh>
      ))}
      <group position={[0, groundY, 0]}>
        <mesh geometry={island} material={materials.island} />
        <group ref={debrisRef}>
          <mesh geometry={debris} material={materials.island} />
        </group>
        {/* Сяйво в основі кристала: він світиться зсередини, найяскравіше знизу. */}
        <Billboard position={[0, crystalHeight * 0.18, 0]}>
          <mesh material={materials.core} renderOrder={5}>
            <planeGeometry args={[crystalHeight * 1.1, crystalHeight * 1.1]} />
          </mesh>
        </Billboard>
      </group>
    </>
  );
}
