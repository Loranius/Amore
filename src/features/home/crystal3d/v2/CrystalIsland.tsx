import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';
import { buildCrystalSurround } from '@/features/home/diorama/surround';
import { EMPTY_MESH, buildCrystalIsland, type IslandMesh } from './crystalIsland';

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

/** Фарби: бруківка, скеля, камінь руїн, плющ, самоцвіт, земля між плитами. */
/**
 * Гранчастий low-poly за референсом (ADR-0227): плити майже білі з лілом,
 * колони — теплий білий камінь, підошва — насичений фіолетовий, плющ
 * соковито-зелений.
 */
const ISLAND_PAINTS: Record<'light' | 'dark', readonly string[]> = {
  light: ['#e9e3f0', '#6b62d2', '#f2eee8', '#5cbf45', '#ff8fd0', '#b3a8cc', '#ffffff', '#9c86cf'],
  dark: ['#b4abc9', '#4a42a6', '#d2cbd8', '#4aa53e', '#ff82d2', '#6c6388', '#d8cff0', '#3a2c6c'],
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
}

/**
 * Матеріал острова: фарба з палітри, м'яке світло діорами. Палітра — 8
 * кольорів або більше (риф має дев'ятий — пісок дна, ADR-0224).
 */
export function createIslandMaterial(paints: readonly string[], haze?: IslandHaze): THREE.ShaderMaterial {
  const count = paints.length;
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
      uHaze: { value: new THREE.Color(haze?.colour ?? '#000000') },
      uHazeRange: { value: new THREE.Vector4(haze?.from ?? 1, haze?.to ?? 2, haze?.strength ?? 0, haze?.near ?? 0) },
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
      uniform vec3 uPaint[${count}];
      uniform vec3 uKey;
      uniform float uAmbient;
      uniform float uTime;
      uniform vec3 uHaze;
      uniform vec4 uHazeRange;
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
        for (int k = 1; k < ${count}; k++) if (k == i) base = uPaint[k];
        vec3 c = dioramaShade(base * vTone, n, view);
        // Самоцвіти в скелі світяться самі й повільно дихають.
        c = mix(c, base * (1.25 + 0.2 * sin(uTime * 1.3 + vWorld.x * 3.0)), vGlow * 0.85);
        float haze = smoothstep(uHazeRange.x, uHazeRange.y, length(vWorld)) * uHazeRange.z;
        if (uHazeRange.w > 0.0) {
          float near = 1.0 - smoothstep(uHazeRange.w * 0.35, uHazeRange.w, distance(cameraPosition, vWorld));
          haze = max(haze, near * 0.92);
        }
        c = mix(c, uHaze, haze);
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
}

export function CrystalIsland({ seed, theme, radius, groundY, glowColour, crystalHeight, reduceMotion, bare = false, druses = 0 }: CrystalIslandProps) {
  const built = useMemo(() => buildCrystalIsland(seed, radius, druses), [seed, radius, druses]);
  const island = useMemo(() => meshGeometry(built.island), [built]);
  const debris = useMemo(() => meshGeometry(built.debris), [built]);
  // Давній храм у підземеллі навколо острова, на всі 360° (ADR-0224).
  const temple = useMemo(() => meshGeometry(bare ? EMPTY_MESH : buildCrystalSurround(seed)), [seed, bare]);
  const glowHex = `#${glowColour.getHexString()}`;
  const materials = useMemo(() => ({
    island: createIslandMaterial(ISLAND_PAINTS[theme]),
    temple: createIslandMaterial(TEMPLE_PAINTS[theme], { colour: CAVE[theme].air, from: 12, to: 130, strength: 0.88, near: 30 }),
    ray: createRayMaterial(CAVE[theme].ray),
    // Сяйво в основі — м'яке біле, як у референсі: кристал суцільний, і
    // яскравий ореол кольору колонії розмивав би його грані.
    core: createGlowMaterial(glowHex, theme === 'dark' ? 0.6 : 0.4),
  }), [theme, glowHex]);
  const debrisRef = useRef<THREE.Group>(null);

  useEffect(() => () => { island.dispose(); debris.dispose(); temple.dispose(); }, [island, debris, temple]);
  useEffect(() => () => { for (const m of Object.values(materials)) m.dispose(); }, [materials]);

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    materials.island.uniforms.uTime!.value = t;
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
