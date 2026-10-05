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
    /*
     * ШАРИ КАМЕНЮ (ADR-0244, власник 2026-10-05: «монарх заблідий — багатший
     * рожевий: зовні перлинно-рожевий, усередині насичений, енергія майже
     * біла рожева; не білий цілком»). Колір той самий, заслужений: шари
     * міняють лише насиченість і світлоту ТОГО Ж відтінку.
     *
     *   * серце грані — насичений тон (колір колонії в степені 1.8: канали
     *     розходяться, відтінок лишається), темніший біля основи;
     *   * тон грані — один із трьох (геометрія), тож сусідні грані різні,
     *     як в оригінальному монарху, а не одна лососева площина;
     *   * кант — світлий тон того ж каменю, не білий (білий кант на
     *     насиченому камені читається швом форми — ADR-0177);
     *   * перлинна оболонка — лише на силуеті, де погляд ковзає по грані.
     */
    float rise = pow(vRise, 0.8);
    vec3 rich = pow(uColour, vec3(1.8));
    vec3 inner = mix(rich * 0.5, mix(rich, uColour, 0.35) * 0.88, smoothstep(0.0, 1.0, rise));
    vec3 pearl = mix(uColour, vec3(1.0, 0.94, 0.97), 0.55);
    // Тон грані в степені 1.6 і серце на 0.7: глибокі грані поруч зі
    // світлими, як в оригінальному монарху (DevTools: найслабша пара 2 % → 17 %).
    vec3 colour = inner * pow(vTone, 1.6) * 0.7 * (0.62 + 0.48 * pow(light, 1.1));
    // Грані вершини ловлять небо: вістря світліше за тіло.
    colour += uColour * pow(max(0.0, n.y), 3.0) * 0.1;
    // Кант у пікселях екрана. Похідна знизу обмежена: придушене ребро має
    // 1 у всіх кутах, fwidth = 0, і smoothstep(0, 0, x) дав би NaN.
    vec3 width = max(fwidth(vEdge) * 1.2, vec3(1e-5));
    vec3 near = 1.0 - smoothstep(vec3(0.0), width, vEdge);
    float rim = max(near.x, max(near.y, near.z));
    colour = mix(colour, mix(uColour, vec3(1.0, 0.9, 0.96), 0.3) * 1.05, rim * 0.42);
    vec3 halfway = normalize(uKey + view);
    float spec = pow(max(0.0, dot(n, halfway)), 56.0);
    float facing = max(0.0, dot(n, view));
    float fresnel = pow(1.0 - facing, 2.5);
    float glint = spec * (0.6 + 0.5 * vTone);
    colour += pearl * glint * 0.75;
    colour = mix(colour, pearl, fresnel * 0.6);
    /*
     * ЕНЕРГІЯ, ЩО ПОВІЛЬНО РУХАЄТЬСЯ (ADR-0244). Три тихі шари в товщі, і
     * всі — тривимірні поля, тож не перетинають ребро малюнком на поверхні
     * (навичка crystal-look). Поле береться глибше вздовж погляду
     * (паралакс): воно рухається з поглядом інакше, ніж грань.
     *   * кишені світла — великі м'які плями, що повільно пливуть угору;
     *   * патьоки — витягнуті вздовж осі м'які смуги (а не гребінь шуму:
     *     гребінь малював тонку дугу-контур поперек монарха, ADR-0242 §7);
     *   * порошинки — рідкі цятки, що піднімаються.
     * Серце світиться вздовж осі монарха: діти отримують лише край цього
     * світла, тож монарх лишається головним.
     */
    vec3 deep = vWorld * uInvScale - view * (0.15 + 0.35 * facing);
    float axial = exp(-dot(deep.xz, deep.xz) * 4.0);
    float drift = uTime * 0.06;
    float pockets = smoothstep(0.55, 0.85, noise3(deep * 1.3 + vec3(0.0, -drift, 0.0)));
    float streaks = smoothstep(0.62, 0.9, noise3(deep * vec3(3.2, 0.45, 3.2) + vec3(0.0, -drift * 1.6, 0.0)));
    float motes = smoothstep(0.88, 0.98, noise3(deep * 9.0 + vec3(0.0, -uTime * 0.16, 0.0)));
    float core = (0.25 + 0.75 * pow(vRise, 0.7)) * (0.35 + 0.9 * axial);
    float glowScale = (0.6 + 0.4 * uGlow) * (0.8 + 0.2 * uPulse) * facing * (1.0 - rim);
    // Серце світиться КОЛЬОРОМ каменю. Біле світло, додане однаково до всіх
    // граней, вибілювало кристал і зливало грані: виміряно вимиканням у
    // DevTools — насиченість 0.38 → 0.52, кроки граней 11–18 % → 23–35 %.
    colour += rich * core * (0.7 + 0.6 * pockets) * 0.3 * glowScale;
    // Майже біла рожева енергія — лише в рідких патьоках і порошинках.
    float sparkle = 0.3 * streaks * axial + 0.8 * motes;
    vec3 glowTint = mix(uColour, vec3(1.0, 0.9, 0.96), 0.55 + 0.3 * motes);
    colour += glowTint * sparkle * 0.8 * glowScale;
    float alpha = mix(0.9, 1.0, max(rim, fresnel));
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
