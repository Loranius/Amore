import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import { buildDioramaBase } from './dioramaBase';
import { DIORAMA_PALETTES, DIORAMA_SHADE, type DioramaSpecies } from './dioramaStyle';

const END = /* glsl */ `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
`;

const KEY = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();
const BUFFER = new THREE.Vector2();

/** Тло: вертикальний градієнт, сяйво за предметом і легка віньєтка. */
function createBackdropMaterial(top: string, bottom: string, glow: string, milk?: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uGlow: { value: new THREE.Color(glow) },
      // Молочна смуга між синню й низом («небесний сад» дерева); без неї —
      // двоколірний градієнт, як було.
      uMilk: { value: new THREE.Color(milk ?? bottom) },
      uHasMilk: { value: milk ? 1 : 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform vec3 uGlow;
      uniform vec3 uMilk;
      uniform float uHasMilk;
      uniform vec2 uResolution;
      varying vec3 vDir;
      void main() {
        // Градієнт — по висоті ЕКРАНА, як у AbyssRium: камера дивиться трохи
        // вниз, і градієнт за напрямком лишав би видимим лише низ неба.
        vec2 uv = gl_FragCoord.xy / uResolution;
        vec3 c = mix(uBottom, uTop, smoothstep(0.05, 0.95, uv.y));
        if (uHasMilk > 0.5) {
          // Синє небо → молочні хмари → світлий золотий серпанок унизу.
          vec3 low = mix(uBottom, uMilk, smoothstep(0.08, 0.45, uv.y));
          c = mix(low, uTop, smoothstep(0.45, 0.98, uv.y));
        }
        vec2 d = (uv - vec2(0.5, 0.5)) * vec2(uResolution.x / uResolution.y, 1.0);
        c += uGlow * exp(-dot(d, d) * 16.0) * 0.3;
        float vignette = smoothstep(0.95, 0.35, length(uv - 0.5));
        c *= mix(0.72, 1.0, vignette);
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/** Острівець: пастельна верхівка й гранчаста скеля, м'яке світло. */
function createBaseMaterial(ground: string, cliff: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGround: { value: new THREE.Color(ground) },
      uCliff: { value: new THREE.Color(cliff) },
      uKey: { value: KEY.clone() },
      uAmbient: { value: 0.55 },
    },
    vertexShader: /* glsl */ `
      attribute float tone;
      attribute float top;
      varying vec3 vWorld;
      varying float vTone;
      varying float vTop;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vTone = tone;
        vTop = top;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uGround;
      uniform vec3 uCliff;
      uniform vec3 uKey;
      uniform float uAmbient;
      varying vec3 vWorld;
      varying float vTone;
      varying float vTop;
      ${DIORAMA_SHADE}
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 view = normalize(cameraPosition - vWorld);
        if (dot(n, view) < 0.0) n = -n;
        vec3 base = mix(uCliff, uGround, vTop) * vTone;
        gl_FragColor = vec4(dioramaShade(base, n, view), 1.0);
        ${END}
      }
    `,
  });
}

/**
 * Контактна тінь: м'яка пляма під предметом, зсунута від світла. Без неї
 * кристал, дерево й вулкан висіли над острівцем; з нею — стоять на ньому.
 * Тон — та сама земля, притемнена в холодний ліловий, а не чорне.
 */
function createShadowMaterial(tint: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTint: { value: new THREE.Color(tint).multiplyScalar(0.32).lerp(new THREE.Color('#2a2050'), 0.35) }, uStrength: { value: 0.42 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6) * uStrength;
        gl_FragColor = vec4(uTint, a);
      }
    `,
  });
}

/** Куди падає тінь: геть від ключового світла, по землі. */
export const DIORAMA_SHADOW_SHIFT: [number, number] = [-KEY.x, -KEY.z];

/** Частинки світла: повільно пливуть угору й пульсують. */
function createMoteMaterial(tint: string, strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColour: { value: new THREE.Color(tint) },
      uStrength: { value: strength },
      uTime: { value: 0 },
      uScale: { value: 400 },
      uHeight: { value: 4 },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform float uScale;
      uniform float uHeight;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float h = mod(p.y + uTime * (0.05 + seed * 0.06), uHeight);
        p.y = h - uHeight * 0.25;
        p.x += sin(uTime * 0.4 + seed * 17.0) * 0.15;
        p.z += cos(uTime * 0.3 + seed * 11.0) * 0.15;
        // Народжується й гасне на краях шляху, а між тим — дихає.
        vAlpha = smoothstep(0.0, 0.3, h / uHeight) * smoothstep(1.0, 0.7, h / uHeight)
               * (0.5 + 0.5 * sin(uTime * 1.3 + seed * 30.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.05 + 0.05 * seed) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(1.0, 0.0, r);
        float a = (pow(core, 3.0) + core * 0.3) * uStrength * vAlpha;
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  });
}

interface DioramaProps {
  species: DioramaSpecies;
  theme: 'light' | 'dark';
  seed: string;
  /** Радіус верхівки острівця в одиницях сцени. */
  radius: number;
  /** Висота землі (верхівки острівця) у сцені. */
  groundY: number;
  reduceMotion: boolean;
  /**
   * Чи малювати спільний острівець. Кристал має власний острів за
   * референсом власника (ADR-0221) і бере з діорами лише тло й частинки.
   */
  base?: boolean;
  /**
   * На скільки земля в центрі острова вища за `groundY`. Верх острова
   * дерева й рифу — купол, і пласка тінь на висоті краю ховалась під
   * травою: тінь має лягти на справжню землю під предметом.
   */
  shadowLift?: number;
}

/**
 * Спільна діорама трьох видів (ADR-0220): тло з сяйвом, острівець під
 * предметом і частинки світла. Предмет ставить на острівець сама сцена.
 */
export function Diorama({ species, theme, seed, radius, groundY, reduceMotion, base: showBase = true, shadowLift = 0 }: DioramaProps) {
  const palette = DIORAMA_PALETTES[species][theme];
  const size = useThree((state) => state.size);
  const base = useMemo(() => {
    const mesh = buildDioramaBase(seed, radius);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('tone', new THREE.BufferAttribute(mesh.tone, 1));
    g.setAttribute('top', new THREE.BufferAttribute(mesh.top, 1));
    g.computeBoundingSphere();
    return g;
  }, [seed, radius]);
  const motes = useMemo(() => {
    const count = 70;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let k = 0; k < count; k += 1) {
      const a = unit(seed, `mote${k}:a`) * Math.PI * 2;
      const r = radius * (0.4 + 1.8 * unit(seed, `mote${k}:r`));
      positions.set([Math.cos(a) * r, unit(seed, `mote${k}:y`) * 4, Math.sin(a) * r], k * 3);
      seeds[k] = unit(seed, `mote${k}:s`);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [seed, radius]);
  const materials = useMemo(() => ({
    backdrop: createBackdropMaterial(palette.top, palette.bottom, palette.glow, palette.milk),
    base: createBaseMaterial(palette.ground, palette.cliff),
    motes: createMoteMaterial(palette.mote, palette.moteStrength),
    shadow: createShadowMaterial(palette.ground),
  }), [palette]);

  useEffect(() => () => { base.dispose(); motes.dispose(); }, [base, motes]);
  useEffect(() => () => { for (const m of Object.values(materials)) m.dispose(); }, [materials]);

  useFrame(({ clock, gl }) => {
    materials.backdrop.uniforms.uResolution!.value.copy(gl.getDrawingBufferSize(BUFFER));
    materials.motes.uniforms.uTime!.value = reduceMotion ? 0 : clock.getElapsedTime();
    materials.motes.uniforms.uScale!.value = size.height;
  });

  return (
    <>
      <mesh material={materials.backdrop} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[80, 32, 20]} />
      </mesh>
      <group position={[0, groundY, 0]}>
        {showBase && <mesh geometry={base} material={materials.base} />}
        <mesh
          material={materials.shadow}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[DIORAMA_SHADOW_SHIFT[0] * radius * 0.16, shadowLift + 0.012, DIORAMA_SHADOW_SHIFT[1] * radius * 0.16]}
          scale={[radius * 0.62, radius * 0.5, 1]}
          renderOrder={1}
        >
          <planeGeometry args={[2, 2]} />
        </mesh>
        <points geometry={motes} material={materials.motes} frustumCulled={false} />
      </group>
    </>
  );
}
