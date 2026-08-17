import { AdditiveBlending, ShaderMaterial, type Texture } from 'three';

// ============================================================
// Матеріал розкритої події.
// ------------------------------------------------------------
// `sun.glb` приїхав із запеченою текстурою 1024×512 на шістнадцять кольорів і
// БЕЗ emissive узагалі — це виміряно в самому контейнері, а не припущено.
//
// Через це найкоротший шлях — «поставити матеріалу колір події» — не годиться:
// `color` домножується на запечену текстуру, тобто помаранчеве сонце під
// бірюзовим множником дало б брудно-сіре, а не бірюзове. Тому текстура працює
// ЯСКРАВІСТЮ й деталлю, а колір події входить окремим множником. Геометрія й
// текстура лишаються ті самі, як і просив власник.
//
// Матеріал створюється НА КОЖЕН показ. Спокуса тримати один і міняти уніформу
// велика, але тоді дві події ділили б одну одиницю стану, і колір попередньої
// встиг би блимнути на наступній під час переходу. Ціна — один `dispose()`,
// і за ним стежить `useEffect`.
// ============================================================

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec3 uColour;
  uniform float uOpacity;
  uniform float uRim;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    // Текстура дає ЯСКРАВІСТЬ і деталь, не барву: її запечений помаранчевий
    // під бірюзовим множником дав би бруд, а не бірюзу.
    vec3 baked = texture2D(uMap, vUv).rgb;
    float detail = dot(baked, vec3(0.2126, 0.7152, 0.0722));
    detail = mix(1.0, detail, uHasMap);
    // Підняте дно: у запеченій текстурі є майже чорні ділянки, і без цього на
    // сонці лишались би мертві плями замість поверхні.
    detail = 0.45 + detail * 0.75;

    // Край яскравіший за середину — так світиться будь-яке тіло, у якого
    // світло йде зсередини, і саме цього бракує рівній кулі.
    float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 2.0);

    vec3 colour = uColour * detail + uColour * rim * uRim;
    gl_FragColor = vec4(colour, uOpacity);
  }
`;

export interface FocusStarMaterialOptions {
  /** Запечена текстура з асета. `null` — сонце світиться рівно. */
  map: Texture | null;
  /** Колір події, три числа 0…1. */
  colour: readonly [number, number, number];
  /** Наскільки проявлене сонце, 0…1 — веде перехід LOD. */
  opacity?: number;
}

/** Скільки додає світний край понад тіло. */
const RIM_GAIN = 0.85;

export function createFocusStarMaterial(options: FocusStarMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uMap: { value: options.map },
      uHasMap: { value: options.map ? 1 : 0 },
      // Новий об'єкт на кожен показ: спільний масив зробив би дві події однією
      // одиницею стану, і колір попередньої блимнув би на наступній.
      uColour: { value: [...options.colour] },
      uOpacity: { value: options.opacity ?? 1 },
      uRim: { value: RIM_GAIN },
    },
    transparent: true,
    // Глибину сонце ПИШЕ, і це не дрібниця. Без цього промінь сузір'я, що
    // проходить позаду події, малювався поверх її диска — на живому екрані це
    // виглядало подряпиною через усе сонце. Куля опукла й малюється лише
    // передніми гранями, тож подвійного додавання це не дає.
    depthWrite: true,
    // Сонце світиться, а не відбиває: воно додається до неба за ним, а не
    // закриває його прямокутником темряви на краях прозорості.
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

/** Назви уніформ, які читає шейдер — рівно ті, що має віддати фабрика. */
export function declaredUniforms(): string[] {
  const names = new Set<string>();
  for (const source of [VERTEX, FRAGMENT]) {
    for (const match of source.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)) names.add(match[1]!);
  }
  return [...names].sort();
}
