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
import { SOFT_NORMAL_GLSL } from '@/features/home/diorama/softNormals';
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
  uniform float uTime;
  uniform float uInvScale;
  // Згладжений шум у просторі — для світла всередині тіла.
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
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
    /*
     * КРИСТАЛЬНІСТЬ (власник, 2026-10-04: «зроби кристал більш кристальним —
     * трішки прозорим і блискучим»).
     *
     * Блиск — відблиск ключа (Блінн-Фонг, вузький) і френелівське сяйво на
     * силуеті: грань, що дивиться повз камеру, світліє, як скло. Відблиск
     * білий, але слабкий на темних гранях, щоб колір колонії не вицвітав.
     *
     * Прозорість — легка й лише в серці грані: кант і силует майже
     * непрозорі, тож дальні ребра не просвічують сіткою (урок ADR-0227 —
     * відкрите скло читалось каркасом). Задні грані не малюються взагалі.
     */
    vec3 halfway = normalize(uKey + view);
    float spec = pow(max(0.0, dot(n, halfway)), 56.0);
    float facing = max(0.0, dot(n, view));
    float fresnel = pow(1.0 - facing, 3.0);
    // Іскра грані: кожна грань ловить світло трохи по-своєму (зсув тону грані).
    float glint = spec * (0.75 + 0.5 * vTone);
    colour += vec3(1.0) * glint * 0.85;
    colour = mix(colour, mix(uColour, vec3(1.0), 0.55), fresnel * 0.35);
    /*
     * МАГІЯ ВСЕРЕДИНІ (власник, 2026-10-06: «більше магії саме всередину
     * кристала, а не навколо нього»).
     *
     * Світло читається внутрішнім, коли воно ЗСУВАЄТЬСЯ з поглядом інакше,
     * ніж поверхня: поле береться не в точці грані, а глибше вздовж погляду
     * (паралакс), тож жили світла лежать у товщі й пливуть повільно. Ядро
     * найяскравіше там, де дивимось у тіло прямо (грань до камери), і
     * гасне до силуету — протилежно френелю, тож грані й кант лишаються.
     * Поле тривимірне: воно не перетинає ребра малюнком на поверхні
     * (правило навички crystal-look).
     */
    vec3 inner = vWorld * uInvScale - view * (0.12 + 0.3 * facing);
    float drift = uTime * 0.12;
    // Жилки — гребінь шуму (тонкі світлі нитки, а не плями).
    float ridge = 1.0 - abs(noise3(inner * 2.2 + vec3(0.0, -drift, drift * 0.5)) * 2.0 - 1.0);
    float veins = pow(ridge, 10.0);
    float motes = pow(noise3(inner * 9.0 + vec3(drift * 0.7)), 9.0) * 4.0;
    float core = facing * facing * (0.3 + 0.7 * pow(vRise, 0.6));
    float magic = (0.2 * core + 1.0 * veins + motes) * (0.5 + 0.5 * uGlow) * (0.75 + 0.25 * uPulse);
    // Колір світла — колір колонії, висвітлений до білого лише в серці жилки.
    vec3 glowTint = mix(uColour * 1.7, vec3(1.0), 0.15 + 0.35 * veins);
    colour += glowTint * magic * 0.6;
    float alpha = mix(0.84, 1.0, max(rim, fresnel));
    alpha = max(alpha, clamp(glint * 1.5, 0.0, 1.0));
    gl_FragColor = vec4(colour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ROCK_VERTEX = /* glsl */ `
  attribute float tone;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vTone;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = mat3(modelMatrix) * normal;
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
  varying vec3 vNormal;
  varying float vTone;
  ${DIORAMA_SHADE}
  ${SOFT_NORMAL_GLSL}
  void main() {
    vec3 n = softNormal(vNormal, vWorld);
    vec3 view = normalize(cameraPosition - vWorld);
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
    // Трішки прозорий (власник, 2026-10-04); пише глибину, тож дальні грані
    // власного тіла не просвічують.
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
    uniforms: {
      uColour: { value: linearColour(rgb) },
      uKey: { value: KEY.clone() },
      uGlow: { value: glow },
      uPulse: { value: 1 },
      uTime: { value: 0 },
      // Одиниці сцени → одиниці моделі: поле всередині не залежить від масштабу кадру.
      uInvScale: { value: 1 },
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
