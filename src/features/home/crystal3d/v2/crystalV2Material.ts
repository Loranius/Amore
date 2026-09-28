// ============================================================
// Матеріал кристала v2 (ADR-0217).
// ------------------------------------------------------------
// «Кристал намальований, а не освітлений» (навичка crystal-look): тон грані —
// колір колонії × світло ключа × власний зсув грані, світлий кант на
// справжніх ребрах, градієнт від темнішої основи до світлішої вершини і
// відблиск лише на силуеті. Те саме правило, що в рендері Python-двійника,
// тож знімок двійника і кадр порталу кажуть одне.
//
// Нормаль рахується з похідних позиції: грань пласка за побудовою, і
// нормаль мусить бути однією на всю грань — інтерпольована дала б
// «обмилок», якого власник не хоче.
// ============================================================
import * as THREE from 'three';
import { DIORAMA_SHADE } from '@/features/home/diorama/dioramaStyle';

const VERTEX = /* glsl */ `
  attribute float faceTone;
  attribute vec3 edge;
  attribute float rise;
  varying vec3 vWorld;
  varying float vTone;
  varying vec3 vEdge;
  varying float vRise;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vTone = faceTone;
    vEdge = edge;
    vRise = rise;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  uniform vec3 uKey;
  uniform float uGlow;
  uniform float uPulse;
  varying vec3 vWorld;
  varying float vTone;
  varying vec3 vEdge;
  varying float vRise;
  void main() {
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 view = normalize(cameraPosition - vWorld);
    if (dot(n, view) < 0.0) n = -n;
    float light = max(0.0, dot(n, uKey));
    /*
     * ГРАНЧАСТИЙ LOW-POLY (ADR-0227, референс власника з шести ракурсів).
     *
     * Кристал суцільний і намальований: кожна грань — один рівний тон
     * кольору колонії. Скло (два проходи, напівпрозорі грані) прибрано: у
     * референсі кристал непрозорий, а крізь скло дальні ребра просвічували
     * сіткою. Грані розрізняє світло ключа й власний зсув тону грані;
     * основа трохи глибша, вершина світліша — м'яко, без темного низу.
     */
    float body = mix(0.8, 1.06, pow(vRise, 0.8));
    float tone = 1.0 + (vTone - 1.0) * 1.4;
    vec3 colour = uColour * tone * (0.58 + 0.5 * pow(light, 1.2)) * body;
    // Грані вершини ловлять небо: вістря світліше за тіло.
    colour += uColour * pow(max(0.0, n.y), 3.0) * 0.12;
    // Кант — ледь світліший тон того ж кольору, у пікселях екрана. Похідна
    // знизу обмежена: придушене ребро має 1 у всіх кутах, fwidth = 0, і
    // smoothstep(0, 0, x) дав би NaN, який min() розносить на всю грань.
    vec3 width = max(fwidth(vEdge) * 1.0, vec3(1e-5));
    vec3 near = 1.0 - smoothstep(vec3(0.0), width, vEdge);
    float rim = max(near.x, max(near.y, near.z));
    colour = mix(colour, mix(uColour, vec3(1.0), 0.3) * body, rim * 0.18);
    // Світло зсередини — медіа (ADR-0217): лише сяйво, не розмір.
    colour += uColour * uGlow * uPulse * (0.25 + 0.75 * vRise) * 0.08;
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ROCK_VERTEX = /* glsl */ `
  attribute float tone;
  varying vec3 vWorld;
  varying float vTone;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vTone = tone;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ROCK_FRAGMENT = /* glsl */ `
  uniform vec3 uRock;
  uniform float uGround;
  uniform vec3 uColour;
  uniform vec3 uKey;
  uniform float uGlow;
  uniform float uAmbient;
  varying vec3 vWorld;
  varying float vTone;
  ${DIORAMA_SHADE}
  void main() {
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 view = normalize(cameraPosition - vWorld);
    if (dot(n, view) < 0.0) n = -n;
    // Пастельна брила діорами (ADR-0220): м'яке світло замість різкого.
    vec3 colour = dioramaShade(uRock * vTone, n, view);
    // Світло з-поміж каменів: сяйво кристала на низі жеоди.
    colour += uColour * uGlow * 0.18 * (1.0 - smoothstep(0.0, 0.25, vWorld.y - uGround));
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Ключ падає зліва згори спереду — той самий напрямок, що в двійника. */
const KEY = new THREE.Vector3(-0.5, 0.75, 0.45).normalize();

export function linearColour(rgb: readonly [number, number, number]): THREE.Color {
  return new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}

export function createCrystalV2Material(rgb: readonly [number, number, number], glow: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColour: { value: linearColour(rgb) },
      uKey: { value: KEY.clone() },
      uGlow: { value: glow },
      uPulse: { value: 1 },
    },
  });
}

export function createGeodeMaterial(
  rgb: readonly [number, number, number],
  glow: number,
  theme: 'light' | 'dark',
  ground: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ROCK_VERTEX,
    fragmentShader: ROCK_FRAGMENT,
    uniforms: {
      // Світлий камінь плит острова (ADR-0227): уламки біля підніжжя кристала —
      // з тих самих плит, а не з фіолетової скелі.
      uRock: { value: new THREE.Color(theme === 'dark' ? '#8f86b4' : '#ddd5ee') },
      uAmbient: { value: 0.55 },
      uColour: { value: linearColour(rgb) },
      uKey: { value: KEY.clone() },
      uGlow: { value: glow },
      uGround: { value: ground },
    },
  });
}
