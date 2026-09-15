// ============================================================
// Поверхня каменю: карти, що сім тижнів лежали нечитаними.
// ------------------------------------------------------------
// У репозиторії з серпня лежить повний CC0-набір Poly Haven («Coral Stone
// Wall»): дифузна, нормаль і шорсткість, 1K, WebP. Лежить не випадково —
// `docs/evolution-engine/REEF_ENVIRONMENT_VISUAL_PASS.md` описує його як
// чинну частину сцени, `vite.config.ts` уже виключає його з precache й
// має для нього окремий рантайм-кеш `reef-visual-assets`.
//
// **Не читав його жоден рядок коду.** Тобто вся оснастка була, бракувало
// читача. Це той самий випадок, що ADR-0182 описав про GLB еталона, і
// саме він виявився найдешевшим способом прибрати «аплікацію»: нормаль і
// шорсткість позбавляють поверхню плаского кольору, **не додаючи жодного
// трикутника** (ADR-0195, крок 4).
//
// ЧОМУ ТРИПЛАНАРНО, А НЕ ПО UV. У мешів рифа UV немає зовсім, і завести
// їх на куполі означало б одне з двох, і обидва погані:
//
//  - **сферична розгортка** дає шов на азимуті 0 (де `u` стрибає з 0.98 у
//    0, і остання смуга дзеркалить текстуру) і сходження до точки на
//    маківці, тобто розтяг зерна саме там, куди дивиться око;
//  - **дублювання шовної колонки вершин** шов закриває, але змінює
//    кількість вершин у кільці — а на ній тримаються всі перевірки, що
//    шукають основу чи маківку за номером вершини (ADR-0195, крок 1).
//
// Триплан не має ні шва, ні полюса: зерно береться з трьох площин за
// світовими координатами й змішується за нормаллю. Для каменю це не
// компроміс, а стандартний прийом — камінь не має розгортки в природі.
//
// ЩО САМЕ БЕРЕТЬСЯ З НАБОРУ. Нормаль і шорсткість. **Дифузна свідомо не
// береться:** вона кольорова, а колір рифа заробляється темою й палітрою
// (ADR-0004 про кристал каже це дослівно — карта, яка несе власний
// відтінок, замінює зароблений колір замість того, щоб його модулювати).
// Тут потрібна нерівність, а не чужий колір.
// ============================================================
import * as THREE from 'three';

const NORMAL_URL = 'textures/reef/coral_stone_nor_gl_1k.webp';
const ROUGH_URL = 'textures/reef/coral_stone_rough_1k.webp';

/** Анізотропія обмежена чотирма — межа вже названа в специфікації. */
const ANISOTROPY = 4;

/**
 * Версія шейдера в ключі кеша програм.
 *
 * Без неї Three віддав би скомпільовану програму попередньої редакції на
 * матеріал із новим кодом — і правка не з'явилась би на екрані, хоч файл
 * змінено. Той самий запобіжник, що в гойданні дрібноти.
 */
const STONE_VERSION = 'reef-stone-triplanar-1';

export interface ReefStoneTextures {
  normal: THREE.Texture;
  roughness: THREE.Texture;
}

let cached: ReefStoneTextures | null = null;

function decode(url: string): THREE.Texture {
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${url}`);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = ANISOTROPY;
  return texture;
}

/**
 * Обидві карти каменю, або `null`, якщо DOM немає.
 *
 * `null` — не мовчазний провал, а єдина чесна відповідь поза браузером:
 * `TextureLoader` декодує через `HTMLImageElement`, а його немає ні в
 * тестах, ні на сервері. Сцена від того лишається з рівним каменем і
 * нічого не ламає.
 *
 * Один декод на весь застосунок: камінь у рифа однаковий скрізь, тож
 * завантаження на кожен матеріал було б тими самими байтами вдруге.
 */
export function reefStoneTextures(): ReefStoneTextures | null {
  if (typeof document === 'undefined') return null;
  if (cached === null) {
    cached = { normal: decode(NORMAL_URL), roughness: decode(ROUGH_URL) };
  }
  return cached;
}

/** Тестовий шов: дає набору початись із нуля. */
export function disposeReefStoneTextures(): void {
  cached?.normal.dispose();
  cached?.roughness.dispose();
  cached = null;
}

export const REEF_STONE_VERTEX_PARS = `
varying vec3 vReefStonePosition;
varying vec3 vReefStoneNormal;
`;

export const REEF_STONE_VERTEX_BODY = `
  vReefStonePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vReefStoneNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

export const REEF_STONE_FRAGMENT_PARS = `
uniform sampler2D uReefStoneNormal;
uniform sampler2D uReefStoneRough;
uniform float uReefStoneScale;
uniform float uReefStoneStrength;
uniform float uReefStoneRoughness;
varying vec3 vReefStonePosition;
varying vec3 vReefStoneNormal;

/*
 * Ваги змішування трьох площин. Нормаль підноситься до степеня, щоб на
 * схилі перемагала одна площина, а не всі три однаково: без цього на
 * похилій поверхні зерно виходить кашею з трьох накладених.
 */
vec3 reefStoneBlend(vec3 worldNormal) {
  vec3 weights = pow(abs(worldNormal), vec3(4.0));
  return weights / max(1e-5, weights.x + weights.y + weights.z);
}
`;

/*
 * ЗМІШУВАННЯ НОРМАЛЕЙ — «whiteout», а не середнє.
 *
 * Пряме усереднення трьох тангенційних нормалей гасить рельєф: на схилі
 * дві з них дивляться в різні боки, і сума дає майже рівну поверхню.
 * Whiteout додає похилі складові до світової нормалі й лишає z, тобто
 * зберігає силу рельєфу в кожній площині окремо.
 */
/**
 * Спільна підготовка: ваги площин і три пари координат.
 *
 * СТОЇТЬ ОКРЕМО, І ЦЕ НЕ ОХАЙНІСТЬ. У Three `roughnessmap_fragment` іде
 * ВИЩЕ за `normal_fragment_maps` (рядки 177 і 180 `meshphysical.glsl.js`),
 * тож блок шорсткості не може посилатись на змінні, оголошені в блоці
 * нормалі, — шейдер просто не скомпілювався б. Перша редакція саме так і
 * була написана.
 *
 * Рахувати їх двічі теж не можна: дві копії тієї самої арифметики
 * розійшлись би, і зерно шорсткості поїхало б відносно зерна рельєфу.
 */
export const REEF_STONE_SETUP_FRAGMENT = `
  vec3 stoneWorldNormal = normalize(vReefStoneNormal);
  vec3 stoneBlend = reefStoneBlend(stoneWorldNormal);
  vec2 stoneUvX = vReefStonePosition.zy * uReefStoneScale;
  vec2 stoneUvY = vReefStonePosition.xz * uReefStoneScale;
  vec2 stoneUvZ = vReefStonePosition.xy * uReefStoneScale;
`;

export const REEF_STONE_NORMAL_FRAGMENT = `
  vec3 stoneNx = texture2D(uReefStoneNormal, stoneUvX).xyz * 2.0 - 1.0;
  vec3 stoneNy = texture2D(uReefStoneNormal, stoneUvY).xyz * 2.0 - 1.0;
  vec3 stoneNz = texture2D(uReefStoneNormal, stoneUvZ).xyz * 2.0 - 1.0;
  stoneNx = vec3(stoneNx.xy + stoneWorldNormal.zy, abs(stoneNx.z) * stoneWorldNormal.x);
  stoneNy = vec3(stoneNy.xy + stoneWorldNormal.xz, abs(stoneNy.z) * stoneWorldNormal.y);
  stoneNz = vec3(stoneNz.xy + stoneWorldNormal.xy, abs(stoneNz.z) * stoneWorldNormal.z);
  vec3 stoneNormal = normalize(
    stoneNx.zyx * stoneBlend.x + stoneNy.xzy * stoneBlend.y + stoneNz.xyz * stoneBlend.z
  );
  stoneNormal = normalize(mix(stoneWorldNormal, stoneNormal, uReefStoneStrength));
  normal = normalize((viewMatrix * vec4(stoneNormal, 0.0)).xyz);
`;

export const REEF_STONE_ROUGHNESS_FRAGMENT = `
  float stoneRough =
    texture2D(uReefStoneRough, stoneUvX).g * stoneBlend.x
    + texture2D(uReefStoneRough, stoneUvY).g * stoneBlend.y
    + texture2D(uReefStoneRough, stoneUvZ).g * stoneBlend.z;
  roughnessFactor = mix(roughnessFactor, roughnessFactor * (0.6 + 0.8 * stoneRough), uReefStoneRoughness);
`;

export interface ReefStoneOptions {
  /**
   * Скільки разів зерно вкладається в одиницю сцени.
   *
   * Камінь рифа завширшки близько одиниці, тож 6 дає зерно приблизно в
   * шосту його частину — розмір, на якому нерівність ще читається на
   * телефоні й уже не збивається в шум.
   */
  scale?: number;
  /** Наскільки сильно нормаль гне поверхню, 0..1. */
  strength?: number;
  /** Наскільки карта шорсткості міняє блиск, 0..1. */
  roughness?: number;
}

/**
 * Одягнути стандартний матеріал у камінь.
 *
 * Повертає `false`, якщо карт немає (немає DOM) — тоді матеріал лишається
 * тим, чим був, і сцена малюється рівним каменем. Це названа деградація,
 * а не мовчазний провал.
 */
export function applyReefStoneSurface(
  material: THREE.MeshStandardMaterial,
  options: ReefStoneOptions = {},
): boolean {
  const textures = reefStoneTextures();
  if (textures === null) return false;

  const scale = options.scale ?? 6;
  const strength = options.strength ?? 0.85;
  const roughness = options.roughness ?? 0.7;

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uReefStoneNormal'] = { value: textures.normal };
    shader.uniforms['uReefStoneRough'] = { value: textures.roughness };
    shader.uniforms['uReefStoneScale'] = { value: scale };
    shader.uniforms['uReefStoneStrength'] = { value: strength };
    shader.uniforms['uReefStoneRoughness'] = { value: roughness };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${REEF_STONE_VERTEX_PARS}`)
      /*
       * ПІСЛЯ `begin_vertex`, А НЕ `beginnormal_vertex`: `objectNormal`
       * оголошує перший, `transformed` — другий, і потрібні обидва. Та сама
       * пастка, що колись коштувала дереву зниклої крони.
       */
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${REEF_STONE_VERTEX_BODY}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${REEF_STONE_FRAGMENT_PARS}`)
      /*
       * Нормаль перебивається ПІСЛЯ `normal_fragment_maps`, тобто після
       * всього, що Three робить із нормаллю сам. Вставити раніше означало
       * б, що наступний же `include` перезапише результат — і карта не
       * з'явиться на екрані, хоч код скомпілюється.
       */
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n${REEF_STONE_NORMAL_FRAGMENT}`,
      )
      /*
       * Підготовка й шорсткість — навколо `roughnessmap_fragment`, бо саме
       * там оголошено `roughnessFactor`, і саме цей include у Three стоїть
       * ВИЩЕ за блок нормалі.
       */
      .replace(
        '#include <roughnessmap_fragment>',
        `${REEF_STONE_SETUP_FRAGMENT}\n#include <roughnessmap_fragment>\n${REEF_STONE_ROUGHNESS_FRAGMENT}`,
      );
  };
  material.customProgramCacheKey = () => `${STONE_VERSION}|${scale}|${strength}|${roughness}`;
  material.needsUpdate = true;
  return true;
}

/*
 * ============================================================
 * СЕРПАНОК ДНА — той самий урок, що з тоном грані.
 * ------------------------------------------------------------
 * Дно згасає у воду на відстані, і це згасання писалось у ВЕРШИНИ: далекі
 * вершини множились на нуль і зникали разом із каустикою. Причина була
 * слушна — каустика малюється ДОДАВАННЯМ, і туман сцени на ній не гасить,
 * а додає свій колір.
 *
 * Але сітка дна радіальна, з `RADIAL_BIAS`, тож саме там, де згасання
 * найкрутіше, кільця стоять найрідше. Градієнт, записаний у такі вершини,
 * інтерполюється великими трикутниками — і навколо рифа лягає **бліда
 * багатокутна тераса з прямими краями**. Вона є на кадрах від першого дня
 * цієї роботи; побачити її вдалось аж тоді, коли все решта перестало бути
 * гранованим.
 *
 * Це та сама вада, що й тон на грані (крок 3), тільки на дні: **плавна
 * величина, покладена в занадто рідкі вершини, стає сходинкою.** І
 * виправлення те саме — перенести її туди, де вона неперервна за
 * побудовою.
 * ============================================================
 */

const HAZE_VERSION = 'reef-haze-1';

export const REEF_HAZE_VERTEX_PARS = `
varying vec2 vReefHazeGround;
`;

export const REEF_HAZE_VERTEX_BODY = `
  vReefHazeGround = (modelMatrix * vec4(transformed, 1.0)).xz;
`;

export const REEF_HAZE_FRAGMENT_PARS = `
uniform float uReefHazeFrom;
uniform float uReefHazeTo;
varying vec2 vReefHazeGround;
`;

export const REEF_HAZE_FRAGMENT_BODY = `
  float reefHaze = 1.0 - smoothstep(uReefHazeFrom, uReefHazeTo, length(vReefHazeGround));
  diffuseColor.rgb *= reefHaze;
`;

/**
 * Згасання дна у воду, пораховане в пікселі.
 *
 * `from` і `to` — у тих самих одиницях сцени, що й позиції: відстань від
 * осі рифа, а не частка радіуса. Так її видно на місці виклику без
 * множення в голові.
 */
export function applyReefHaze(
  material: THREE.Material & { onBeforeCompile?: THREE.Material['onBeforeCompile'] },
  from: number,
  to: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uReefHazeFrom'] = { value: from };
    shader.uniforms['uReefHazeTo'] = { value: to };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${REEF_HAZE_VERTEX_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${REEF_HAZE_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${REEF_HAZE_FRAGMENT_PARS}`)
      /*
       * Після `color_fragment`, бо саме він домножує `diffuseColor` на
       * колір вершини. Раніше — і серпанок затерся б тоном дюн; пізніше
       * (в `map_fragment`) його не існує для матеріалів без карти.
       */
      .replace('#include <color_fragment>', `#include <color_fragment>\n${REEF_HAZE_FRAGMENT_BODY}`);
  };
  material.customProgramCacheKey = () => `${HAZE_VERSION}|${from}|${to}`;
  material.needsUpdate = true;
}
