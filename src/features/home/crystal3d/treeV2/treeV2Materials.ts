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

export interface MeadowPalette {
  skyTop: string;
  skyHorizon: string;
  sun: string;
  sunGlow: number;
  ground: string;
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
  stars: number;
}

export const MEADOW_PALETTES: Record<'light' | 'dark', MeadowPalette> = {
  light: {
    skyTop: '#4f8fd6',
    skyHorizon: '#ffcf9e',
    sun: '#fff0c8',
    sunGlow: 0.9,
    ground: '#79ad4e',
    bark: '#6e4b36',
    leaf: '#4f9a47',
    leafAutumn: '#e3902f',
    grass: '#6ea648',
    fog: '#ffcf9e',
    key: '#fff1d6',
    keyStrength: 1.0,
    ambient: 0.42,
    firefly: '#ffd98a',
    fireflyStrength: 0.45,
    stars: 0,
  },
  dark: {
    skyTop: '#0a0f2c',
    skyHorizon: '#3c2f5e',
    sun: '#e6e4ff',
    sunGlow: 0.35,
    ground: '#2c4a33',
    bark: '#3d2c26',
    leaf: '#2f6040',
    leafAutumn: '#8a5a2e',
    grass: '#2e5236',
    fog: '#3c2f5e',
    key: '#c9cdff',
    keyStrength: 0.75,
    ambient: 0.32,
    firefly: '#fff0a0',
    fireflyStrength: 1.0,
    stars: 1,
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
  vec3 lit(vec3 base, vec3 n) {
    float key = max(0.0, dot(n, uKey));
    float sky = 0.5 + 0.5 * n.y;
    return base * (uAmbient * (0.6 + 0.4 * sky) + uKeyColour * uKeyStrength * pow(key, 1.2));
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

/** Небо: градієнт від обрію до зеніту, сонце (або місяць) і зорі вночі. */
export function createSkyMaterial(p: MeadowPalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: colour(p.skyTop) },
      uHorizon: { value: colour(p.skyHorizon) },
      uSun: { value: colour(p.sun) },
      uSunGlow: { value: p.sunGlow },
      uSunDir: { value: new THREE.Vector3(-0.62, 0.22, -0.75).normalize() },
      uStars: { value: p.stars },
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
      uniform vec3 uHorizon;
      uniform vec3 uSun;
      uniform float uSunGlow;
      uniform vec3 uSunDir;
      uniform float uStars;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = clamp(vDir.y, -0.2, 1.0);
        // Камера дивиться трохи вниз: верх кадру — це лише h ≈ 0.2, тож
        // синь мусить набиратись низько, інакше небо все — колір обрію.
        vec3 c = mix(uHorizon, uTop, smoothstep(-0.02, 0.3, h));
        float s = max(0.0, dot(vDir, uSunDir));
        // Широке сяйво — лише над обрієм: на самому обрії небо мусить дорівнювати
        // туману лугу, інакше між ними видно шов (виміряно: 47 проти 35 зі 255).
        float above = smoothstep(0.0, 0.14, h);
        c += uSun * (pow(s, 900.0) * 1.6 + (pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12) * uSunGlow * above);
        if (uStars > 0.5 && h > 0.05) {
          vec3 cell = floor(vDir * 160.0);
          float star = step(0.9965, hash(cell)) * smoothstep(0.05, 0.4, h);
          c += vec3(star) * 0.9;
        }
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/** Земля й пагорби: колір на вершину (`tone`), пласкі грані, туман. */
export function createGroundMaterial(p: MeadowPalette, fogNear: number, fogFar: number, base: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    // Луг видно згори, пагорби — зсередини кільця; обидва боки дешевші за
    // суперечку про закрут, а нормаль шейдер однаково повертає до камери.
    side: THREE.DoubleSide,
    uniforms: { ...litUniforms(p, fogNear, fogFar), uBase: { value: colour(base) } },
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
      uniform vec3 uBase;
      varying vec3 vWorld;
      varying float vTone;
      ${LIT}
      void main() {
        vec3 c = lit(uBase * vTone, flatNormal(vWorld));
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

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
