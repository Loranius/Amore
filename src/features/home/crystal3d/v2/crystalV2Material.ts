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
  uniform float uBack;
  varying vec3 vWorld;
  varying float vTone;
  varying vec3 vEdge;
  varying float vRise;
  void main() {
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 view = normalize(cameraPosition - vWorld);
    if (dot(n, view) < 0.0) n = -n;
    float light = max(0.0, dot(n, uKey));
    // Основа темна, вершина світла: вертикальний градієнт еталона
    // (low_poly_dirt_crystals — тіло глибоке, до вістря світлішає). 0.5→0.95
    // давало майже рівний пастельний тон, який і читався картоном.
    float body = mix(0.26, 1.0, pow(vRise, 0.8));
    // Розкид тону граней подвоєно: сусідні грані мусять різнитись на 30%+
    // лінійного світла, інакше монарх читається гладким стовпом (виміряно
    // профілем: із тоном 0.85…1.15 медіана між гранями була 21%).
    float tone = 1.0 + (vTone - 1.0) * 2.0;
    // Світло — зі степенем: лінійне давало сусіднім граням призми 0.66 і
    // 0.45 ключа, тобто ті самі 20%, що й шум тону. Степінь розводить їх.
    vec3 colour = uColour * tone * (0.1 + 0.85 * pow(light, 1.7)) * body;
    // Світло неба на гранях вершини: у еталоні саме вони найсвітліші, і
    // вістря відділяється від тіла, а не продовжує його конусом.
    colour += uColour * pow(max(0.0, n.y), 3.0) * 0.22 * body;
    // Кант — у пікселях екрана, а не в одиницях тіла, інакше малий кристал
    // року став би більше обведенням, ніж кристалом. Похідна знизу обмежена:
    // придушене ребро має 1 у всіх кутах, fwidth = 0, і smoothstep(0, 0, x)
    // дав би NaN, який min() розносить на всю грань.
    vec3 width = max(fwidth(vEdge) * 1.0, vec3(1e-5));
    vec3 near = 1.0 - smoothstep(vec3(0.0), width, vEdge);
    float rim = max(near.x, max(near.y, near.z));
    // Кант — світліший тон ТОГО Ж кольору і ледь помітний. Білий обвід на
    // кожному ребрі (0.5 до білого) малював паперову розгортку, а не камінь:
    // в еталонах ребро видно з різниці граней, а не з лінії.
    colour = mix(colour, uColour * body * 1.25, rim * 0.22);
    // Відблиск лише на силуеті — константа на кожній грані зрівняла б грані.
    float fresnel = pow(1.0 - abs(dot(n, view)), 3.0);
    colour += mix(uColour, vec3(1.0), 0.5) * fresnel * 0.14;
    // Світло зсередини — медіа (ADR-0217): лише сяйво, не розмір.
    colour += uColour * uGlow * uPulse * (0.25 + 0.75 * vRise) * 0.18;

    /*
     * СКЛО (власник, 2026-09-28: «зроби кристали прозорішими, як скло»).
     *
     * Два проходи одного меша. Спершу ЗАДНІ грані — внутрішня стінка:
     * глибокий колір без канта й без відблиску, і саме тому дальні ребра
     * не просвічують сіткою (навичка crystal-look: відкрита оболонка вже
     * раз перетворила кристал на каркас, бо два набори ребер гасили один
     * одного). Потім ПЕРЕДНІ — напівпрозорі, щільніші на силуеті (Френель,
     * як у справжнього скла), з відблиском ключа. Заломлення немає й не
     * буде (небо — CSS, не в буфері), тож «скло» — це те, що крізь нього
     * видно острів і небо, край густіший за середину, а блік — білий.
     */
    float facing = abs(dot(n, view));
    float alpha;
    if (uBack > 0.5) {
      colour = uColour * body * (0.1 + 0.22 * light) + uColour * uGlow * uPulse * 0.08;
      alpha = 0.26;
    } else {
      // Внутрішній відблиск грані: кожна своя, як запечене світло в
      // текстурах еталона (low_poly_dirt_crystals). Крізь скло тло зрівнює
      // освітлення граней, тож розрізняє їх саме цей намальований тон.
      colour *= 1.0 + (vTone - 1.0) * 4.0;
      vec3 mirror = reflect(-uKey, n);
      float spark = pow(max(0.0, dot(mirror, view)), 28.0);
      colour += vec3(1.0) * spark * 0.9;
      // Ребро скла ловить світло: тонка світліша лінія лише на ПЕРЕДНІХ
      // гранях (задні канта не мають — див. вище).
      colour = mix(colour, mix(uColour, vec3(1.0), 0.45), rim * 0.3);
      // Освітлена грань відбиває більше, тож щільніша: так грані лишаються
      // різними й крізь скло, а не зливаються в рівний прозорий «гель».
      // Виміряно профілем: 0.34 + 0.32·світло дало медіану між гранями 7% —
      // тло крізь скло зрівнювало грані. Розкид щільності вдвічі більший.
      alpha = clamp((0.16 + 0.7 * pow(light, 1.3)) * tone + 0.45 * pow(1.0 - facing, 2.0)
        + spark * 0.6 + rim * 0.3, 0.0, 1.0);
    }
    // Премножений альфа-канал: полотно прозоре, і непремножений колір над
    // CSS-небом світився б обідком (та сама вада, що в зірок «Нашого шляху»).
    gl_FragColor = vec4(colour * alpha, alpha);
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

export function createCrystalV2Material(
  rgb: readonly [number, number, number],
  glow: number,
  pass: 'back' | 'front',
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    side: pass === 'back' ? THREE.BackSide : THREE.FrontSide,
    // Задня стінка глибину не пише: інакше вона закрила б передні грані
    // сусіднього кристала, що стоїть за нею.
    depthWrite: pass === 'front',
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColour: { value: linearColour(rgb) },
      uKey: { value: KEY.clone() },
      uGlow: { value: glow },
      uPulse: { value: 1 },
      uBack: { value: pass === 'back' ? 1 : 0 },
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
      // Тон скелі острівця діорами, а не темний граніт: камінь — частина острова.
      uRock: { value: new THREE.Color(theme === 'dark' ? '#5c579a' : '#b4a7e2') },
      uAmbient: { value: 0.55 },
      uColour: { value: linearColour(rgb) },
      uKey: { value: KEY.clone() },
      uGlow: { value: glow },
      uGround: { value: ground },
    },
  });
}
