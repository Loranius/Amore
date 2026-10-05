// ============================================================
// Риф v2 — матеріали глибини (ADR-0219).
// ------------------------------------------------------------
// «Риф — глибина» (PRODUCT.md). Гранчастий low-poly за референсом
// власника (ADR-0225): кожна грань — один чистий колір, тон грані —
// колір × м'яке світло діорами × власний зсув; світло трохи слабне до
// підніжжя. Каустик і туману більше немає: каустики — плями світла, що
// перетинали грані й розмивали їх, а туман старої глибини тонув корали
// в нічному синьому над островом, який туману не має.
//
// Світла тема — мілка лагуна опівдні; темна — нічний риф, де корали й
// планктон світяться самі (біолюмінесценція).
// ============================================================
import { SOFT_NORMAL_GLSL } from '@/features/home/diorama/softNormals';
import * as THREE from 'three';
import type { Season } from '@/engine/species/grammar/season';
import { DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';

export interface ReefPalette {
  rock: string;
  key: string;
  keyStrength: number;
  ambient: number;
  glow: number;
  seagrass: string;
  snow: string;
  snowStrength: number;
}

export const REEF_PALETTES: Record<'light' | 'dark', ReefPalette> = {
  light: {
    // Камінь рифу — тієї ж барвінкової гами, що й острів (ADR-0223).
    rock: '#8f84e0',
    key: '#fff6e0',
    keyStrength: 1.05,
    ambient: 0.58,
    glow: 0.05,
    seagrass: '#4fa267',
    snow: '#e8fbff',
    snowStrength: 0.35,
  },
  dark: {
    rock: '#5a50b0',
    key: '#9fb6ff',
    keyStrength: 0.55,
    ambient: 0.48,
    glow: 0.55,
    seagrass: '#2b5a55',
    snow: '#8ff7ff',
    snowStrength: 0.9,
  },
};

/**
 * Пора року у воді (ADR-0237 §7, п. 4): світло з поверхні й морський сніг.
 * Зима — холодне тьмяніше світло й густий сніг; весна — свіже зеленкувате;
 * літо — тепле яскраве; осінь — бурштинове. Колір каменю й живності не
 * змінюється: це погода, а не ріст.
 */
export function seasonalReefPalette(p: ReefPalette, season: Season, theme: 'light' | 'dark'): ReefPalette {
  const light = theme === 'light';
  switch (season) {
    case 'winter':
      return { ...p, key: light ? '#dfe9ff' : '#8aa6ff', keyStrength: p.keyStrength * 0.85, snowStrength: p.snowStrength * 1.6 };
    case 'spring':
      return { ...p, key: light ? '#f2ffe8' : '#a8e6c8', keyStrength: p.keyStrength * 1.0 };
    case 'summer':
      return { ...p, key: light ? '#fff1cc' : '#b8c6ff', keyStrength: p.keyStrength * 1.12, snowStrength: p.snowStrength * 0.8 };
    case 'autumn':
      return { ...p, key: light ? '#ffe0bd' : '#c9a8ff', keyStrength: p.keyStrength * 0.95 };
  }
}

/**
 * Кольори шести форм — чисті й насичені, як у референсі (ADR-0225):
 * помпон рожевий, гіллястий помаранчевий, леза зелені, трубки бірюзові,
 * пластини жовті, пальці корально-червоні.
 */
export const CORAL_COLOURS = ['#ff5f9e', '#ff7a36', '#5fd35a', '#3fcfe6', '#ffc629', '#ff5a4f'] as const;
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
  uniform float uTime;
  uniform float uGround;
  vec3 flatNormal(vec3 world) {
    vec3 n = normalize(cross(dFdx(world), dFdy(world)));
    if (dot(n, cameraPosition - world) < 0.0) n = -n;
    return n;
  }
  ${DIORAMA_SHADE}
  ${SOFT_NORMAL_GLSL}
  vec3 underwater(vec3 base, vec3 n, vec3 world) {
    // М'яке пастельне світло діорами (ADR-0220), трохи тоноване кольором
    // підводного світла; світло слабне до підніжжя.
    float depthLight = 0.85 + 0.15 * clamp((world.y - uGround) / 1.5, 0.0, 1.0);
    vec3 c = dioramaShade(base, n, normalize(cameraPosition - world)) * depthLight
           * mix(vec3(1.0), uKeyColour, 0.25 * uKeyStrength);
    return c;
  }
`;

function waterUniforms(p: ReefPalette, ground: number) {
  return {
    uKey: { value: KEY.clone() },
    uKeyColour: { value: colour(p.key) },
    uKeyStrength: { value: p.keyStrength },
    uAmbient: { value: p.ambient },
    uTime: { value: 0 },
    uGround: { value: ground },
  };
}

const BASIC_VERTEX = /* glsl */ `
  attribute float tone;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vTone;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = mat3(modelMatrix) * normal;
    vTone = tone;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/** Пісок і камінь: колір × тон грані, світло згори, каустики, туман. */
export function createSeabedMaterial(p: ReefPalette, base: string, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...waterUniforms(p, ground), uBase: { value: colour(base) } },
    vertexShader: BASIC_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vTone;
      ${WATER}
      void main() {
        // Обтічне світло на гранчастому камені (власник, 2026-10-04).
        vec3 c = underwater(uBase * vTone, softNormal(vNormal, vWorld), vWorld);
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/**
 * Базальт вулкана (ADR-0235): той самий підводний камінь, але з жаром на
 * вершину — біля кратера й жил він тепліє до кольору жару й пульсує разом
 * із лавою (`uBeat`). Сам камінь не світить: жар лише підмішується.
 */
export function createVolcanoRockMaterial(p: ReefPalette, base: string, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...waterUniforms(p, ground), uBase: { value: colour(base) }, uBeat: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float tone;
      attribute float heat;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vTone;
      varying float vHeat;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = mat3(modelMatrix) * normal;
        vTone = tone;
        vHeat = heat;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform float uBeat;
      uniform float uGlow;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vTone;
      varying float vHeat;
      ${WATER}
      void main() {
        // Обтічний базальт: гранчастий силует, плавне світло (власник, 2026-10-04).
        vec3 c = underwater(uBase * vTone, softNormal(vNormal, vWorld), vWorld);
        // Легка тінь біля дна: камінь «сидить» на плато, а не висить.
        c *= mix(0.72, 1.0, smoothstep(uGround - 0.05, uGround + 0.9, vWorld.y));
        float h = vHeat * (0.6 + 0.4 * uGlow);
        vec3 ember = vec3(1.0, 0.33, 0.28);
        c = mix(c, c * 0.55 + ember * 0.75, h * 0.6) + ember * h * uBeat * 0.28;
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/**
 * Корали: колір форми, власний зсув відтінку колонії, темніше біля основи,
 * світліші кінчики; уночі кінчики й ребра світяться (біолюмінесценція).
 */
export function createCoralMaterial(p: ReefPalette, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...waterUniforms(p, ground),
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
        // Кожна колонія року — свій відтінок, але в межах свого кольору: форми
        // тепер різні й самі розводять риф, а широкий поворот відтінку
        // каламутив чисті кольори референсу (ADR-0225).
        base = hueShift(base, (vHue - 0.5) * 0.7) * vTone * mix(0.82, 1.1, vRise);
        vec3 n = flatNormal(vWorld);
        vec3 c = underwater(base, n, vWorld);
        c += base * uGlow * (0.25 + 0.75 * vRise * vRise);
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/** Актинії й мушлі: колір каналу, трохи власного світла — їх видно в тіні. */
export function createCritterMaterial(p: ReefPalette, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...waterUniforms(p, ground), uColours: { value: CRITTER_COLOURS.map(colour) }, uGlow: { value: p.glow } },
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
        gl_FragColor = vec4(c, 1.0);
        ${END}
      }
    `,
  });
}

/** Морська трава: пучки інстансами, що гойдаються в течії. */
export function createSeagrassMaterial(p: ReefPalette, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...waterUniforms(p, ground), uGrass: { value: colour(p.seagrass) }, uSway: { value: 1 } },
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
        gl_FragColor = vec4(c, 1.0);
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
export function createFishMaterial(p: ReefPalette, ground: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...waterUniforms(p, ground),
      // Четвертий — скат вулкана на 20-му році разом (ADR-0237): бузковий і
      // більший за решту зграї.
      uColours: { value: ['#ffd24a', '#6ec6ff', '#ff8a5c', '#c58cff'].map(colour) },
      uGlow: { value: p.glow },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aOrbit;
      attribute float aHeight;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aKind;
      attribute float part;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vWorld;
      varying float vKind;
      varying float vPart;
      void main() {
        float ang = radians(aPhase) + uTime * aSpeed * 0.35 / max(0.3, aOrbit);
        vec3 centre = vec3(cos(ang) * aOrbit, aHeight + sin(uTime * 0.8 + aPhase) * 0.05, sin(ang) * aOrbit);
        vec3 forward = vec3(-sin(ang), 0.0, cos(ang));
        vec3 side = vec3(cos(ang), 0.0, sin(ang));
        vec3 p = position;
        // Тіло хвилюється від голови до хвоста: що далі назад, то ширше.
        p.z += smoothstep(0.25, -1.0, p.x) * sin(uTime * 8.0 + aPhase - p.x * 2.5) * 0.22;
        vec3 local = forward * p.x + vec3(0.0, p.y, 0.0) + side * p.z;
        vec4 w = modelMatrix * vec4(centre + local * 0.09 * uScale * (aKind > 2.5 ? 1.7 : 1.0), 1.0);
        vWorld = w.xyz;
        vKind = aKind;
        vPart = part;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColours[4];
      uniform float uGlow;
      varying vec3 vWorld;
      varying float vKind;
      varying float vPart;
      ${WATER}
      void main() {
        vec3 base = vKind < 0.5 ? uColours[0] : (vKind < 1.5 ? uColours[1] : (vKind < 2.5 ? uColours[2] : uColours[3]));
        // Черевце світліше, плавці темніші, око темне (\`fishMesh\` PART).
        if (vPart > 2.5) base = vec3(0.08, 0.07, 0.12);
        else if (vPart > 1.5) base *= 0.78;
        else if (vPart > 0.5) base = mix(base, vec3(1.0), 0.45);
        vec3 c = underwater(base, flatNormal(vWorld), vWorld) + base * uGlow * 0.3;
        gl_FragColor = vec4(c, 1.0);
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
