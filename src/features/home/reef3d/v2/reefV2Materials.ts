// ============================================================
// Риф v2 — матеріали глибини (ADR-0219).
// ------------------------------------------------------------
// «Риф — глибина» (PRODUCT.md). Та сама мова, що в кристала й дерева v2:
// пласкі грані, тон грані — колір × світло × власний зсув. Під водою до
// цього додаються три речі, без яких вода — просто синій туман:
//   * світло падає лише згори й слабне з глибиною;
//   * по піску й каменю біжать каустики — світлові плями від хвиль;
//   * даль тоне в кольорі води, а не в сірому.
//
// Світла тема — мілка лагуна опівдні; темна — нічний риф, де корали й
// планктон світяться самі (біолюмінесценція).
// ============================================================
import * as THREE from 'three';
import { DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';

export interface ReefPalette {
  fog: string;
  rock: string;
  key: string;
  keyStrength: number;
  ambient: number;
  caustics: number;
  glow: number;
  seagrass: string;
  snow: string;
  snowStrength: number;
}

export const REEF_PALETTES: Record<'light' | 'dark', ReefPalette> = {
  light: {
    fog: '#2f8db4',
    // Камінь рифу — тієї ж барвінкової гами, що й острів (ADR-0223).
    rock: '#9a90dc',
    key: '#fff6e0',
    keyStrength: 1.05,
    ambient: 0.58,
    caustics: 0.4,
    glow: 0.05,
    seagrass: '#4fa267',
    snow: '#e8fbff',
    snowStrength: 0.35,
  },
  dark: {
    fog: '#0b1840',
    rock: '#5a529e',
    key: '#9fb6ff',
    keyStrength: 0.55,
    ambient: 0.48,
    caustics: 0.18,
    glow: 0.55,
    seagrass: '#2b5a55',
    snow: '#8ff7ff',
    snowStrength: 0.9,
  },
};

/** Кольори шести форм: мозковик, гіллястий, віяло, трубки, стіл, пальці. */
export const CORAL_COLOURS = ['#f2a765', '#ff6f91', '#b27cff', '#ffc94d', '#4fd1c5', '#ff8a5c'] as const;
/** Актинії (хто виконав бажання) і мушля: червоний, блакитний, зелений, перламутр. */
export const CRITTER_COLOURS = ['#ff5f7e', '#6ea8ff', '#a8f07a', '#f3e6f0'] as const;

const colour = (hex: string) => new THREE.Color(hex);
const KEY = new THREE.Vector3(-0.25, 0.92, 0.3).normalize();

const END = /* glsl */ `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
`;

const WATER = /* glsl */ `
  uniform vec3 uKey;
  uniform vec3 uKeyColour;
  uniform float uKeyStrength;
  uniform float uAmbient;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  uniform float uCaustics;
  uniform float uGround;
  vec3 flatNormal(vec3 world) {
    vec3 n = normalize(cross(dFdx(world), dFdy(world)));
    if (dot(n, cameraPosition - world) < 0.0) n = -n;
    return n;
  }
  // Каустики: дві хвилясті сітки, що біжать назустріч; яскраво там, де
  // вони збігаються. Дешево, без текстури, і не повторюється на око.
  float caustic(vec2 p, float t) {
    vec2 a = p * 2.3 + vec2(t * 0.21, t * 0.13);
    vec2 b = p * 3.1 - vec2(t * 0.17, -t * 0.19);
    float c1 = abs(sin(a.x + sin(a.y * 1.3)) * sin(a.y + sin(a.x * 1.7)));
    float c2 = abs(sin(b.x + sin(b.y * 1.1)) * sin(b.y + sin(b.x * 1.4)));
    return pow(1.0 - min(c1, c2), 6.0);
  }
  ${DIORAMA_SHADE}
  vec3 underwater(vec3 base, vec3 n, vec3 world) {
    // М'яке пастельне світло діорами (ADR-0220), трохи тоноване кольором
    // підводного світла; світло слабне до підніжжя, каустики — лише зверху.
    float depthLight = 0.85 + 0.15 * clamp((world.y - uGround) / 1.5, 0.0, 1.0);
    vec3 c = dioramaShade(base, n, normalize(cameraPosition - world)) * depthLight
           * mix(vec3(1.0), uKeyColour, 0.25 * uKeyStrength);
    c += uKeyColour * caustic(world.xz, uTime) * uCaustics * 0.6 * max(0.0, n.y);
    return c;
  }
  vec3 fogged(vec3 c, vec3 world) {
    float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - world));
    return mix(c, uFog, f);
  }
`;

function waterUniforms(p: ReefPalette, fogNear: number, fogFar: number, ground: number) {
  return {
    uKey: { value: KEY.clone() },
    uKeyColour: { value: colour(p.key) },
    uKeyStrength: { value: p.keyStrength },
    uAmbient: { value: p.ambient },
    uFog: { value: colour(p.fog) },
    uFogNear: { value: fogNear },
    uFogFar: { value: fogFar },
    uTime: { value: 0 },
    uCaustics: { value: p.caustics },
    uGround: { value: ground },
  };
}

const BASIC_VERTEX = /* glsl */ `
  attribute float tone;
  varying vec3 vWorld;
  varying float vTone;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vTone = tone;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/** Пісок і камінь: колір × тон грані, світло згори, каустики, туман. */
export function createSeabedMaterial(p: ReefPalette, base: string, fogNear: number, fogFar: number, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...waterUniforms(p, fogNear, fogFar, ground), uBase: { value: colour(base) } },
    vertexShader: BASIC_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      varying vec3 vWorld;
      varying float vTone;
      ${WATER}
      void main() {
        vec3 c = underwater(uBase * vTone, flatNormal(vWorld), vWorld);
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/**
 * Корали: колір форми, власний зсув відтінку колонії, темніше біля основи,
 * світліші кінчики; уночі кінчики й ребра світяться (біолюмінесценція).
 */
export function createCoralMaterial(p: ReefPalette, fogNear: number, fogFar: number, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...waterUniforms(p, fogNear, fogFar, ground),
      uColours: { value: CORAL_COLOURS.map(colour) },
      uGlow: { value: p.glow },
      uSway: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float tone;
      attribute float form;
      attribute float hue;
      attribute float rise;
      uniform float uTime;
      uniform float uSway;
      varying vec3 vWorld;
      varying float vTone;
      varying float vForm;
      varying float vHue;
      varying float vRise;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        // Течія: м'які форми (віяло, пальці) гойдаються, кам'яні — ні.
        float soft = (form > 1.5 && form < 2.5) || form > 4.5 ? 1.0 : 0.15;
        w.x += sin(uTime * 0.8 + w.z * 2.0) * 0.03 * rise * soft * uSway;
        w.z += cos(uTime * 0.6 + w.x * 2.0) * 0.02 * rise * soft * uSway;
        vWorld = w.xyz;
        vTone = tone;
        vForm = form;
        vHue = hue;
        vRise = rise;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColours[6];
      uniform float uGlow;
      varying vec3 vWorld;
      varying float vTone;
      varying float vForm;
      varying float vHue;
      varying float vRise;
      ${WATER}
      vec3 hueShift(vec3 c, float a) {
        // Поворот відтінку в YIQ: колонії одного виду не однакові.
        mat3 toYiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
        mat3 toRgb = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
        vec3 yiq = toYiq * c;
        float cs = cos(a);
        float sn = sin(a);
        yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz;
        return max(toRgb * yiq, vec3(0.0));
      }
      void main() {
        int i = int(vForm + 0.5);
        vec3 base = uColours[0];
        for (int k = 1; k < 6; k++) if (k == i) base = uColours[k];
        // Кожна колонія року — свій відтінок: у пари, чиї роки всі «спогадові»,
        // риф інакше був би купою однакових куль (перший живий кадр).
        base = hueShift(base, (vHue - 0.5) * 2.0) * vTone * mix(0.6, 1.15, vRise);
        vec3 n = flatNormal(vWorld);
        vec3 c = underwater(base, n, vWorld);
        c += base * uGlow * (0.25 + 0.75 * vRise * vRise);
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/** Актинії й мушлі: колір каналу, трохи власного світла — їх видно в тіні. */
export function createCritterMaterial(p: ReefPalette, fogNear: number, fogFar: number, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...waterUniforms(p, fogNear, fogFar, ground), uColours: { value: CRITTER_COLOURS.map(colour) }, uGlow: { value: p.glow } },
    vertexShader: /* glsl */ `
      attribute float channel;
      uniform float uTime;
      varying vec3 vWorld;
      varying float vChannel;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        w.x += sin(uTime * 1.3 + w.z * 9.0) * 0.006;
        vWorld = w.xyz;
        vChannel = channel;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColours[4];
      uniform float uGlow;
      varying vec3 vWorld;
      varying float vChannel;
      ${WATER}
      void main() {
        int i = int(vChannel + 0.5);
        vec3 base = uColours[0];
        for (int k = 1; k < 4; k++) if (k == i) base = uColours[k];
        vec3 c = underwater(base, flatNormal(vWorld), vWorld) + base * (0.25 + uGlow * 0.6);
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/** Морська трава: пучки інстансами, що гойдаються в течії. */
export function createSeagrassMaterial(p: ReefPalette, fogNear: number, fogFar: number, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...waterUniforms(p, fogNear, fogFar, ground), uGrass: { value: colour(p.seagrass) }, uSway: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSway;
      varying vec3 vWorld;
      varying float vTip;
      void main() {
        vec4 local = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
        #endif
        vec4 w = modelMatrix * local;
        vTip = position.y;
        w.x += sin(uTime * 0.9 + w.z * 1.7) * 0.08 * position.y * position.y * uSway;
        w.z += cos(uTime * 0.7 + w.x * 1.3) * 0.05 * position.y * position.y * uSway;
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uGrass;
      varying vec3 vWorld;
      varying float vTip;
      ${WATER}
      void main() {
        vec3 base = uGrass * mix(0.6, 1.2, clamp(vTip, 0.0, 1.0));
        vec3 c = base * (uAmbient + uKeyColour * uKeyStrength * 0.5);
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/**
 * Зграя: кожна риба кружляє своєю орбітою довкола рифу (атрибути інстанса),
 * хвіст б'є, тіло дивиться туди, куди пливе. Позиції рахує шейдер — CPU
 * щокадру нічого не пише.
 */
export function createFishMaterial(p: ReefPalette, fogNear: number, fogFar: number, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...waterUniforms(p, fogNear, fogFar, ground),
      uColours: { value: ['#ffd24a', '#6ec6ff', '#ff8a5c'].map(colour) },
      uGlow: { value: p.glow },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aOrbit;
      attribute float aHeight;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aKind;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vWorld;
      varying float vKind;
      void main() {
        float ang = radians(aPhase) + uTime * aSpeed * 0.35 / max(0.3, aOrbit);
        vec3 centre = vec3(cos(ang) * aOrbit, aHeight + sin(uTime * 0.8 + aPhase) * 0.05, sin(ang) * aOrbit);
        vec3 forward = vec3(-sin(ang), 0.0, cos(ang));
        vec3 side = vec3(cos(ang), 0.0, sin(ang));
        vec3 p = position;
        // Хвіст (x < 0) б'є вбік; тіло нерухоме.
        p.z += step(p.x, -0.3) * sin(uTime * 8.0 + aPhase) * 0.18;
        vec3 local = forward * p.x + vec3(0.0, p.y, 0.0) + side * p.z;
        vec4 w = modelMatrix * vec4(centre + local * 0.09 * uScale, 1.0);
        vWorld = w.xyz;
        vKind = aKind;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColours[3];
      uniform float uGlow;
      varying vec3 vWorld;
      varying float vKind;
      ${WATER}
      void main() {
        vec3 base = vKind < 0.5 ? uColours[0] : (vKind < 1.5 ? uColours[1] : uColours[2]);
        vec3 c = underwater(base, flatNormal(vWorld), vWorld) + base * uGlow * 0.3;
        gl_FragColor = vec4(fogged(c, vWorld), 1.0);
        ${END}
      }
    `,
  });
}

/** Планктон, бульбашки й перлини: м'які кружальця, що світяться. */
export function createGlowMaterial(tint: string, strength: number, size: number, motion: 'snow' | 'bubbles' | 'still'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColour: { value: colour(tint) },
      uStrength: { value: strength },
      uSize: { value: size },
      uTime: { value: 0 },
      uScale: { value: 400 },
      uMotion: { value: motion === 'snow' ? 1 : motion === 'bubbles' ? 2 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform float uSize;
      uniform float uScale;
      uniform float uMotion;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        vAlpha = 1.0;
        if (uMotion > 0.5 && uMotion < 1.5) {
          // Морський сніг: повільно осідає й дрейфує, по колу в межах товщі.
          p.y = mod(p.y - uTime * (0.03 + seed * 0.04), 4.0);
          p.x += sin(uTime * 0.3 + seed * 20.0) * 0.2;
          vAlpha = 0.4 + 0.6 * seed;
        } else if (uMotion > 1.5) {
          // Бульбашки: піднімаються й хитаються; зникають угорі.
          float h = mod(uTime * (0.25 + seed * 0.2) + seed * 3.0, 3.0);
          p.y += h;
          p.x += sin(uTime * 3.0 + seed * 30.0) * 0.03;
          vAlpha = 1.0 - h / 3.0;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * uScale / -mv.z;
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
        float a = (pow(core, 3.0) + core * 0.25) * uStrength * vAlpha;
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  });
}
