// ============================================================
// Дерево v2 — матеріали світу (ADR-0218).
// ------------------------------------------------------------
// Уся сцена «намальована, а не освітлена», як кристал v2: тон грані —
// колір × ключ × власний зсув, туман до кольору обрію, пласкі грані з
// похідних позиції. Одна мова для дерева, трави, пагорбів і неба, тож
// нічого не виглядає вклеєним з іншої гри.
//
// Дві пори доби — один світ (PRODUCT.md §7): світла тема — золота година,
// темна — місячна ніч, де головні — світлячки.
// ============================================================
import * as THREE from 'three';
import { DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';

export interface MeadowPalette {
  bark: string;
  leaf: string;
  leafAutumn: string;
  grass: string;
  /** Дорівнює кольору обрію неба: луг тане в небо без шва. */
  fog: string;
  key: string;
  keyStrength: number;
  ambient: number;
  firefly: string;
  fireflyStrength: number;
}

export const MEADOW_PALETTES: Record<'light' | 'dark', MeadowPalette> = {
  light: {
    bark: '#8c6149',
    leaf: '#6cc56a',
    leafAutumn: '#f4a64e',
    grass: '#7fcf5e',
    fog: '#ffcf9e',
    key: '#fff1d6',
    keyStrength: 1.0,
    ambient: 0.55,
    firefly: '#ffd98a',
    fireflyStrength: 0.45,
  },
  dark: {
    // Небо дерева денне й у темній темі (artifactThemes.css) — листя теж.
    bark: '#86594a',
    leaf: '#62b964',
    leafAutumn: '#ee9a4a',
    grass: '#74c258',
    fog: '#3c2f5e',
    key: '#c9cdff',
    keyStrength: 0.75,
    ambient: 0.52,
    firefly: '#fff0a0',
    fireflyStrength: 1.0,
  },
};

/** Ключ — ліворуч згори спереду, як у кристала й у двійника. */
export const MEADOW_KEY = new THREE.Vector3(-0.55, 0.75, 0.4).normalize();

const colour = (hex: string) => new THREE.Color(hex);

/* Спільні шматки GLSL: пласка нормаль, світло й туман. */
const LIT = /* glsl */ `
  uniform vec3 uKey;
  uniform vec3 uKeyColour;
  uniform float uKeyStrength;
  uniform float uAmbient;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  vec3 flatNormal(vec3 world) {
    vec3 n = normalize(cross(dFdx(world), dFdy(world)));
    if (dot(n, cameraPosition - world) < 0.0) n = -n;
    return n;
  }
  ${DIORAMA_SHADE}
  // М'яке пастельне світло діорами (ADR-0220). Кожен шейдер, що кличе
  // lit(), оголошує varying vWorld перед цим шматком.
  vec3 lit(vec3 base, vec3 n) {
    return dioramaShade(base, n, normalize(cameraPosition - vWorld)) * mix(vec3(1.0), uKeyColour, 0.25 * uKeyStrength);
  }
  vec3 fogged(vec3 c, vec3 world) {
    float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - world));
    return mix(c, uFog, f);
  }
`;

function litUniforms(p: MeadowPalette, fogNear: number, fogFar: number) {
  return {
    uKey: { value: MEADOW_KEY.clone() },
    uKeyColour: { value: colour(p.key) },
    uKeyStrength: { value: p.keyStrength },
    uAmbient: { value: p.ambient },
    uFog: { value: colour(p.fog) },
    uFogNear: { value: fogNear },
    uFogFar: { value: fogFar },
  };
}

const END = /* glsl */ `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
`;

/** Деревина: тон грані, темніше донизу (земля не підсвічує корінь). */
export function createWoodMaterial(p: MeadowPalette, fogNear: number, fogFar: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...litUniforms(p, fogNear, fogFar), uBark: { value: colour(p.bark) } },
    vertexShader: /* glsl */ `
      attribute float tone;
      varying vec3 vWorld;
      varying float vTone;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vTone = tone;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBark;
      varying vec3 vWorld;
      varying float vTone;
      ${LIT}
      void main() {
        vec3 c = lit(uBark * vTone, flatNormal(vWorld));
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/**
 * Листя: зелене або осіннє на кластер, тон грані, світло неба на верхніх
 * гранях і вітер — повільне гойдання, тим більше, чим вище над землею.
 */
export function createLeafMaterial(p: MeadowPalette, fogNear: number, fogFar: number, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...litUniforms(p, fogNear, fogFar),
      uLeaf: { value: colour(p.leaf) },
      uAutumn: { value: colour(p.leafAutumn) },
      uTime: { value: 0 },
      uWind: { value: 1 },
      uGround: { value: ground },
    },
    vertexShader: /* glsl */ `
      attribute float tone;
      attribute float autumn;
      uniform float uTime;
      uniform float uWind;
      uniform float uGround;
      varying vec3 vWorld;
      varying float vTone;
      varying float vAutumn;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float lift = max(0.0, w.y - uGround);
        float phase = w.x * 1.7 + w.z * 1.3;
        w.x += sin(uTime * 1.1 + phase) * 0.018 * lift * uWind;
        w.z += cos(uTime * 0.9 + phase) * 0.012 * lift * uWind;
        vWorld = w.xyz;
        vTone = tone;
        vAutumn = autumn;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLeaf;
      uniform vec3 uAutumn;
      varying vec3 vWorld;
      varying float vTone;
      varying float vAutumn;
      ${LIT}
      void main() {
        vec3 n = flatNormal(vWorld);
        vec3 base = mix(uLeaf, uAutumn, vAutumn) * vTone;
        vec3 c = lit(base, n) + base * pow(max(0.0, n.y), 3.0) * 0.18;
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/** Квіти бажань: колір каналу (червоний, блакитний, зелений). */
export const BLOSSOM_COLOURS = ['#ff5f7e', '#6ea8ff', '#a8f07a', '#ffffff'] as const;
/** Польові квіти вихідних: біла ромашка, жовтець, дзвоник, конюшина. */
export const FLOWER_COLOURS = ['#fff6e8', '#ffd24a', '#b58cff', '#ff8fb1'] as const;

/**
 * Дрібні квіти з кольором за індексом (`channel`). Власне світіння — їх
 * видно й у тіні крони, і вночі вони не зникають зовсім.
 */
export function createBlossomMaterial(colours: readonly string[] = BLOSSOM_COLOURS): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRed: { value: colour(colours[0]!) },
      uBlue: { value: colour(colours[1]!) },
      uGreen: { value: colour(colours[2]!) },
      uFourth: { value: colour(colours[3]!) },
    },
    vertexShader: /* glsl */ `
      attribute float channel;
      varying float vChannel;
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vChannel = channel;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uRed;
      uniform vec3 uBlue;
      uniform vec3 uGreen;
      uniform vec3 uFourth;
      varying float vChannel;
      varying vec3 vWorld;
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 base = vChannel < 0.5 ? uRed : (vChannel < 1.5 ? uBlue : (vChannel < 2.5 ? uGreen : uFourth));
        float shade = 0.75 + 0.25 * abs(n.y);
        gl_FragColor = vec4(base * shade * 1.15, 1.0);
        ${END}
      }
    `,
  });
}

/** Трава: пучки інстансами; верхівка світліша й гойдається. */
export function createGrassMaterial(p: MeadowPalette, fogNear: number, fogFar: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...litUniforms(p, fogNear, fogFar), uGrass: { value: colour(p.grass) }, uTime: { value: 0 }, uWind: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWind;
      varying vec3 vWorld;
      varying float vTip;
      void main() {
        vec4 local = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
        #endif
        vec4 w = modelMatrix * local;
        vTip = position.y;
        w.x += sin(uTime * 1.6 + w.x * 2.1 + w.z * 1.7) * 0.04 * position.y * uWind;
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uGrass;
      varying vec3 vWorld;
      varying float vTip;
      ${LIT}
      void main() {
        vec3 base = uGrass * mix(0.7, 1.25, clamp(vTip * 4.0, 0.0, 1.0));
        vec3 c = base * (uAmbient + uKeyColour * uKeyStrength * 0.55);
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/** Світлячки й золоті плоди: м'які кружальця, що світяться (адитивно). */
export function createGlowPointsMaterial(tint: string, strength: number, size: number, pulse: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Колір уже помножено на альфу в шейдері; інакше адитив множив би двічі.
    premultipliedAlpha: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColour: { value: colour(tint) },
      uStrength: { value: strength },
      uSize: { value: size },
      uTime: { value: 0 },
      uPulse: { value: pulse ? 1 : 0 },
      uScale: { value: 400 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      uniform float uPulse;
      uniform float uScale;
      attribute float seed;
      varying float vGlow;
      void main() {
        vec3 p = position;
        // Світлячок блукає маленькою вісімкою навколо свого місця.
        p.x += uPulse * sin(uTime * 0.7 + seed * 6.283) * 0.12;
        p.y += uPulse * sin(uTime * 1.1 + seed * 11.0) * 0.08;
        p.z += uPulse * cos(uTime * 0.6 + seed * 4.0) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vGlow = uPulse > 0.5 ? 0.35 + 0.65 * max(0.0, sin(uTime * 1.8 + seed * 20.0)) : 1.0;
        gl_PointSize = uSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      varying float vGlow;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float core = smoothstep(1.0, 0.0, r);
        float a = (pow(core, 3.0) * 1.0 + core * 0.25) * vGlow * uStrength;
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  });
}
