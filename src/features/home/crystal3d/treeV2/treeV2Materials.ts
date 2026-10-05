// ============================================================
// Дерево v2 — матеріали світу (ADR-0218).
// ------------------------------------------------------------
// Уся сцена «намальована, а не освітлена», як кристал v2: тон грані —
// колір × м'яке світло діорами (ADR-0220) × власний зсув, пласкі грані з
// похідних позиції. Туману немає, як і в острова й неба (ADR-0224): туман
// старої луки тонув дерево в кольорі свого обрію, і на далекому зумі
// дерево ставало фіолетовим над незайманим островом.
//
// Небо дерева денне в обох темах (artifactThemes.css): світла тема —
// ясний день, темна — вечірнє світло того ж дня, а не ніч.
// ============================================================
import { SOFT_NORMAL_GLSL } from '@/features/home/diorama/softNormals';
import * as THREE from 'three';
import { DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';

export interface TreePalette {
  bark: string;
  leaf: string;
  leafAutumn: string;
  grass: string;
  key: string;
  keyStrength: number;
  ambient: number;
  firefly: string;
  fireflyStrength: number;
}

/**
 * Колір крони за формою дерева (ADR-0237): ялина — темна хвоя, сакура —
 * рожеве цвітіння, восени — теплий помаранч. Решта палітри спільна.
 */
export const TREE_FORM_LEAVES: Record<'spruce' | 'sakura', Record<'light' | 'dark', Pick<TreePalette, 'leaf' | 'leafAutumn'>>> = {
  spruce: { light: { leaf: '#2f8f55', leafAutumn: '#2f8f55' }, dark: { leaf: '#2b7d4b', leafAutumn: '#2b7d4b' } },
  sakura: { light: { leaf: '#ffb7d2', leafAutumn: '#ff8a5c' }, dark: { leaf: '#f39cc2', leafAutumn: '#f07f52' } },
};

export const TREE_PALETTES: Record<'light' | 'dark', TreePalette> = {
  light: {
    bark: '#8a5236',
    leaf: '#72c443',
    leafAutumn: '#f5b83a',
    grass: '#7fcf5e',
    key: '#fff1d6',
    keyStrength: 1.0,
    ambient: 0.55,
    firefly: '#ffd98a',
    fireflyStrength: 0.45,
  },
  dark: {
    // Небо дерева денне й у темній темі (artifactThemes.css) — листя теж.
    bark: '#7a4a34',
    leaf: '#68b43e',
    leafAutumn: '#eaa934',
    grass: '#74c258',
    // Вечірнє тепле світло, а не місячне синє старої луки.
    key: '#ffe0bf',
    keyStrength: 0.9,
    ambient: 0.52,
    firefly: '#fff0a0',
    fireflyStrength: 1.0,
  },
};

/** Ключ — ліворуч згори спереду, як у кристала й у двійника. */
export const TREE_KEY = new THREE.Vector3(-0.55, 0.75, 0.4).normalize();

const colour = (hex: string) => new THREE.Color(hex);

/* Спільні шматки GLSL: пласка нормаль і світло. */
const LIT = /* glsl */ `
  uniform vec3 uKey;
  uniform vec3 uKeyColour;
  uniform float uKeyStrength;
  uniform float uAmbient;
  vec3 flatNormal(vec3 world) {
    vec3 n = normalize(cross(dFdx(world), dFdy(world)));
    if (dot(n, cameraPosition - world) < 0.0) n = -n;
    return n;
  }
  ${DIORAMA_SHADE}
  ${SOFT_NORMAL_GLSL}
  // М'яке пастельне світло діорами (ADR-0220). Кожен шейдер, що кличе
  // lit(), оголошує varying vWorld перед цим шматком.
  vec3 lit(vec3 base, vec3 n) {
    return dioramaShade(base, n, normalize(cameraPosition - vWorld)) * mix(vec3(1.0), uKeyColour, 0.25 * uKeyStrength);
  }
`;

function litUniforms(p: TreePalette) {
  return {
    uKey: { value: TREE_KEY.clone() },
    uKeyColour: { value: colour(p.key) },
    uKeyStrength: { value: p.keyStrength },
    uAmbient: { value: p.ambient },
  };
}

const END = /* glsl */ `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
`;

/** Деревина: тон грані, темніше донизу (земля не підсвічує корінь). */
export function createWoodMaterial(p: TreePalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...litUniforms(p), uBark: { value: colour(p.bark) } },
    vertexShader: /* glsl */ `
      attribute float tone;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vTone;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vTone = tone;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBark;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vTone;
      ${LIT}
      void main() {
        // Кругле світло на гранчастому силуеті: гілка не балка (ADR-0237).
        vec3 c = lit(uBark * vTone, normalize(vNormal));
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/**
 * Листя: зелене або осіннє на кластер, тон грані, світло неба на верхніх
 * гранях і вітер — повільне гойдання, тим більше, чим вище над землею.
 */
export function createLeafMaterial(p: TreePalette, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...litUniforms(p),
      uLeaf: { value: colour(p.leaf) },
      uAutumn: { value: colour(p.leafAutumn) },
      // Верх кластерів трохи золотіє на сонці (ADR-0222), стримано: «золотого
      // менше» (власник, 2026-10-05).
      uSunLeaf: { value: colour('#d4e46e') },
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
      varying vec3 vNormal;
      varying float vTone;
      varying float vAutumn;
      void main() {
        vNormal = mat3(modelMatrix) * normal;
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
      uniform vec3 uSunLeaf;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vTone;
      varying float vAutumn;
      ${LIT}
      void main() {
        // Крона обтічна: гранчастий силует, плавне світло (власник, 2026-10-04).
        vec3 n = softNormal(vNormal, vWorld);
        vec3 base = mix(uLeaf, uAutumn, vAutumn) * vTone;
        base = mix(base, uSunLeaf * vTone, smoothstep(0.35, 0.95, n.y) * 0.13 * (1.0 - vAutumn));
        vec3 c = lit(base, n) + base * pow(max(0.0, n.y), 3.0) * 0.18;
        gl_FragColor = vec4(c, 1.0);
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

/**
 * Плоди й квіти бажань (яблука, квітки сакури, шишки): колір на вершину,
 * пласке освітлення граней і легке гойдання від точки, де прикраса тримається.
 */
export function createWishMaterial(ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uWind: { value: 1 }, uGround: { value: ground } },
    vertexShader: /* glsl */ `
      attribute vec3 colour;
      attribute float sway;
      attribute vec3 anchor;
      uniform float uTime;
      uniform float uWind;
      uniform float uGround;
      varying vec3 vWorld;
      varying vec3 vColour;
      varying vec3 vNormal;
      void main() {
        vNormal = mat3(modelMatrix) * normal;
        vec4 w = modelMatrix * vec4(position, 1.0);
        // Прикраса їде разом із листям, за яке тримається: той самий вітер,
        // що в \`createLeafMaterial\`, узятий у точці кріплення. Без цього
        // крона й квітка гойдались кожна по-своєму, і квітка пірнала під
        // листя (власник, 2026-10-04).
        vec4 a = modelMatrix * vec4(anchor, 1.0);
        float lift = max(0.0, a.y - uGround);
        float phase = a.x * 1.7 + a.z * 1.3;
        w.x += sin(uTime * 1.1 + phase) * 0.018 * lift * uWind;
        w.z += cos(uTime * 0.9 + phase) * 0.012 * lift * uWind;
        float s = sway * uWind;
        w.x += sin(uTime * 1.4 + a.y * 7.0 + a.z * 3.0) * 0.012 * s;
        w.z += cos(uTime * 1.1 + a.x * 5.0) * 0.01 * s;
        vWorld = w.xyz;
        // Кольори вершин записані в sRGB; рендер чекає лінійних — інакше
        // червоне яблуко вицвітає до рожевого, а рожева квітка до білої.
        vColour = pow(colour, vec3(2.2));
        // Трохи ближче до камери: прикраса лежить НА листі, і там, де грань
        // кулачка вигинається, листя не має права її перекрити.
        vec4 view = viewMatrix * w;
        view.xyz += normalize(-view.xyz) * 0.02;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vColour;
      varying vec3 vNormal;
      ${SOFT_NORMAL_GLSL}
      void main() {
        vec3 n = softNormal(vNormal, vWorld);
        float light = 0.7 + 0.3 * max(0.0, dot(n, normalize(vec3(-0.45, 0.8, 0.4)))) + 0.12 * abs(n.y);
        gl_FragColor = vec4(vColour * light * 1.05, 1.0);
        ${END}
      }
    `,
  });
}

/** Трава: пучки інстансами; верхівка світліша й гойдається. */
export function createGrassMaterial(p: TreePalette): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...litUniforms(p), uGrass: { value: colour(p.grass) }, uTime: { value: 0 }, uWind: { value: 1 } },
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
        gl_FragColor = vec4(c, 1.0);
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
