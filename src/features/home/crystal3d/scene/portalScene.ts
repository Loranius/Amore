// ============================================================
// portalScene — числа й геометрія порталу, без React і без стану.
// ------------------------------------------------------------
// Сцена навколо артефакта раніше жила в CSS: пласкі шари неба, диск
// підлоги в perspective() і два прямокутники-колони. Вони ніколи не
// могли зійтися з кристалом, бо кристал живе в іншій системі координат
// — у WebGL-камері. Тут та сама сцена перенесена в 3D і стоїть на тій
// самій площині, що й артефакт (CRYSTAL_GROUND_BASELINE).
//
// Модуль навмисно чистий: кадрування камери, розкладка колон і поле
// зір — це арифметика, яку можна перевірити тестом без WebGL.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARTIFACT_FIT_HEIGHT, CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import { mulberry32 } from '../../mulberry32';
import {
  PORTAL_RELIC_OUTER_RADIUS,
  PORTAL_RELIC_TOP_RADIUS,
  buildPortalRelicBodyGeometry,
  buildPortalRelicEngravingGeometry,
  buildPortalRelicGlowGeometry,
} from './portalRelicPedestal';
// Колона й арка приходять моделлю: різьблення капітелі й профіль архівольта
// правилами не пишуться. Процедурні лишились нижче — вони визначають пропорції,
// проти яких розкладка й досі перевіряється.
import {
  buildPortalArchGeometry as buildModelledArch,
  buildPortalPillarGeometry as buildModelledPillar,
} from './portalColonnadeMesh';

/** Площина, на якій стоїть артефакт; уся сцена відраховується від неї. */
export const PORTAL_GROUND_Y = CRYSTAL_GROUND_BASELINE;

/**
 * Скільки draw call'ів додає оточення. Приймальний тест перевіряє, що
 * кристал лишається збатчений (draw call'и ≈ кількість матеріалів, а не
 * тіл), тож він мусить знати внесок сцени — інакше довелось би просто
 * послабити межу й перевірка втратила б сенс.
 *
 * Поле + підлога храму + три оптичні шари релікварію (бронза, гравіювання,
 * фіолетове скло) + колони (один InstancedMesh на все кільце) + вогні на них
 * (так само один) + арки (так само один) + зорі.
 */
export const PORTAL_ENVIRONMENT_DRAW_CALLS = 9;

/**
 * Скільки трикутників додає оточення. Той самий привід, що й у draw
 * call'ах: приймальний тест звіряє намальовані трикутники з бюджетом
 * геометрії кристала, і без цього числа сцена мовчки з'їла б перевірку.
 *
 * Значення прибите свідомо — рахувати його в рантаймі означало б
 * будувати геометрію двічі. За тим, щоб воно не розійшлось із реальними
 * буферами, стежить portalScene.test.ts.
 */
export const PORTAL_ENVIRONMENT_TRIANGLES = 14_752;

/** Сегментів у диску поля; єдине місце, що задає його вартість. */
const FIELD_SEGMENTS = 64;

/**
 * Реальна вартість оточення — джерело правди для константи вище.
 *
 * Напрямки жили на вартість не впливають: вони зсувають вершини, але не
 * додають і не прибирають жодного трикутника. Саме тому константа лишається
 * однією на всі пари.
 */
export function measurePortalEnvironmentTriangles(
  _seed = 1,
  _bearings: readonly number[] = [],
  _veinReach = 0,
): number {
  const relicBody = buildPortalRelicBodyGeometry();
  const relicEngraving = buildPortalRelicEngravingGeometry();
  const relicGlow = buildPortalRelicGlowGeometry();
  const pillar = buildModelledPillar();
  const lamp = buildPortalLampGeometry();
  const arch = buildModelledArch();
  const floor = buildPortalTempleFloorGeometry();
  const standingPillars = portalPillarInstances(
    portalCameraFrame(0.5, 1),
    0.5,
  ).length;
  const triangles = (geometry: THREE.BufferGeometry): number => {
    const index = geometry.getIndex();
    return index === null
      ? geometry.getAttribute('position').count / 3
      : index.count / 3;
  };

  const total = FIELD_SEGMENTS
    + triangles(relicBody)
    + triangles(relicEngraving)
    + triangles(relicGlow)
    // Колонада — кільце з розривом, тож рахується стільки колон, скільки
    // справді стоїть, і стільки арок, скільки між ними прольотів.
    + triangles(pillar) * standingPillars
    + triangles(lamp) * standingPillars
    + triangles(arch) * (standingPillars - 1)
    + triangles(floor);

  relicBody.dispose();
  relicEngraving.dispose();
  relicGlow.dispose();
  pillar.dispose();
  lamp.dispose();
  arch.dispose();
  floor.dispose();
  return total;
}

const FOV = 42;
const DEG = Math.PI / 180;

/**
 * Яку частку висоти кадру займає сам кристал — молодий і повністю дорослий.
 *
 * Це і є нова система відображення, яку попросив власник: **кадр іде за
 * кристалом, а не навпаки**. Раніше висота кадру була сталою (5.2), тож із
 * ростом кристала змінювався тільки він сам: трирічна пара займала 23% висоти
 * екрана й губилась у порожній залі, яку ніхто не просив показувати.
 *
 * Тепер камера підходить до малого кристала впритул — він і є головний
 * артефакт головного екрана — і відходить від великого, відкриваючи залу за
 * ним. Частка зростає повільніше, ніж сам кристал, тож видимого простору
 * стає більше, а кристал усе одно більший, ніж був молодим. Обидва рухи, які
 * назвав власник, — це одна крива.
 *
 * Частка задає **висотну** гілку. На вузькому екрані зазвичай зв'язує не вона,
 * а ширина: друза там займає 64–88% ширини кадру, і кадр по висоті виходить із
 * цього, а не з цих сталих. Тож на телефоні ці числа майже нічого не міняють —
 * вони вирішують кадр на планшеті й ноутбуці.
 *
 * Підняті з 0.52/0.66 разом із поправкою на ближній край нижче: та поправка
 * відсуває камеру, і без цього підйому широкий екран втратив би 10 пунктів.
 *
 * Виміряно проєкцією справжніх вершин через справжній кадр — частка **висоти
 * екрана**, яку займають кристали:
 *
 *   вік          телефон 0.46   ноутбук 1.6
 *   1 рік            65%            68%
 *   4 роки           56%            65%
 *   10 років         54%            68%
 *   20 років         54%            70%
 *   30 років         47%            69%
 */
const FRAME_SHARE_YOUNG = 0.62;
const FRAME_SHARE_GROWN = 0.76;

/**
 * Кадр для артефакта, про висоту якого нічого не відомо.
 *
 * Не «нуль»: сцену будують і без пайплайна (перелік трикутників, тести
 * геометрії), і кадр нульової висоти дав би нульову відстань до камери.
 */
const FALLBACK_ARTIFACT_HEIGHT = 1.2;

/**
 * Ширина кадру як частка висоти.
 *
 * Була окремою сталою 2.3 проти 5.2, тобто 0.44. Лишається часткою, бо тепер
 * рухається сама висота: ширина, що не йде за нею, або зрізала б широку друзу,
 * або тримала б камеру далеко від вузької.
 */
const FRAME_WIDTH_SHARE = 0.44;

/** Запас між крайнім кристалом і краєм кадру. */
const FRAME_MARGIN = 1.08;

/**
 * Куди дивиться камера — як частка висоти артефакта.
 *
 * Було 1.25 світової одиниці, тобто **вище за верхівку** трирічного кристала
 * (1.18): камера цілилась у порожнечу над ним, і кристал сидів у нижній
 * третині кадру. Частка тримає його на місці в будь-якому віці.
 *
 * Вище за половину навмисно. Верхню третину полотна закриває шапка головного
 * екрана — привітання, лічильник днів, перемикач видів і назва артефакта, — і
 * при 0.46 верхівка кристала виходила рівно під назву. Камера, що цілиться
 * трохи вище, опускає артефакт у вільну частину кадру.
 */
/**
 * Куди кадр ставить ціль камери, як частку висоти артефакта.
 *
 * Експортується, бо атлас маршрутів (ADR-0021) відновлює з цього числа
 * висоту артефакта в одиницях сцени: кадр — єдине місце, де вона вже
 * порахована, і другий проп означав би два описи одного артефакта, які
 * можуть розійтись.
 */
export const PORTAL_TARGET_SHARE_OF_ARTIFACT = 0.58;
const TARGET_SHARE_OF_ARTIFACT = PORTAL_TARGET_SHARE_OF_ARTIFACT;

/**
 * Синус кута, під яким камера дивиться згори.
 *
 * Був наслідком двох абсолютних висот (2.25 і 1.25 при відстані ≈7.1, тобто
 * 8°); тепер задається прямо, щоб кут не залежав від того, як далеко відійшла
 * камера. Підлога має читатись як поверхня, що йде вглиб, а не як лінія.
 */
const EYE_ELEVATION_SIN = 0.14;

export interface PortalCameraFrame {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  /** Відстань від камери до точки прицілу. */
  distance: number;
  fogNear: number;
  fogFar: number;
}

/** Куди дивиться камера й звідки, після накладання пози атласу. */
export interface PortalCameraView {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/**
 * Кадр, повернутий на позу маршруту (ADR-0021).
 *
 * Накладання, а не заміщення: `portalCameraFrame` лишається єдиним місцем, де
 * вирішується, як артефакт вміщається в екран під даний аспект, а поза лише
 * обертає камеру навколо тієї ж цілі й підсовує її ближче або далі.
 *
 * Обидві величини пози — в одиницях кадру: `distance` множить відстань
 * око–ціль, `elevation` — синус кута підйому. Тому центральна поза відтворює
 * кадр **точно**, і це стереже тест: у попередній редакції `elevation` була
 * часткою висоти артефакта, і головна тихо змінила б ракурс.
 */
export function portalCameraView(
  frame: PortalCameraFrame,
  pose: { azimuth: number; targetHeight: number; elevation: number; distance: number },
): PortalCameraView {
  // Висота артефакта, відновлена з кадру: він ставить ціль на
  // TARGET_SHARE_OF_ARTIFACT його висоти над землею. Брати її звідси, а не
  // окремим аргументом, — щоб поза й кадр не могли розійтись у тому, який
  // артефакт вони описують.
  const artifactHeight = Math.max(
    1e-3,
    (frame.target[1] - PORTAL_GROUND_Y) / TARGET_SHARE_OF_ARTIFACT,
  );
  const targetY = PORTAL_GROUND_Y + artifactHeight * pose.targetHeight;

  const eyeDistance = Math.max(1e-3, frame.distance * pose.distance);
  const rise = eyeDistance * pose.elevation;
  const radius = Math.sqrt(Math.max(0, eyeDistance * eyeDistance - rise * rise));

  return {
    position: [
      frame.target[0] + Math.sin(pose.azimuth) * radius,
      targetY + rise,
      frame.target[2] + Math.cos(pose.azimuth) * radius,
    ],
    target: [frame.target[0], targetY, frame.target[2]],
  };
}

function halfHeightTangent(): number {
  return Math.tan((FOV / 2) * DEG);
}

/**
 * Половина видимої ширини на заданій глибині. Колони спираються саме на
 * це: у 3D їх не можна прибити до краю кадру, як CSS-шар, — на широкому
 * екрані фіксовані позиції з'їхали б до центру й затиснули кристал.
 */
export function portalHalfWidthAt(depth: number, aspect: number): number {
  return depth * halfHeightTangent() * Math.max(aspect, 0.1);
}

/**
 * Кадр камери під конкретний артефакт.
 *
 * `artifactRadius` — це те, скільки місця вшир займають самі кристали в
 * одиницях сцени (`crystalSceneRadius(..., { includeSubstrate: false })`).
 * Камінь і подіум сюди не входять свідомо: це підлога, їй нормально
 * виходити за кадр, а от зрізаний кристал — це втрачений рік пари.
 *
 * Без цього аргументу ширина кадру була константою FIT_WIDTH = 2.3, тобто
 * півширина 1.15. Виміряно на справжньому пайплайні: кристали доростають
 * до 1.5 на десятому році — тобто зовнішні річні кристали десятирічної
 * пари просто зрізались краєм екрана на вертикальному телефоні.
 */
export function portalCameraFrame(
  aspect: number,
  artifactRadius = 0,
  artifactHeight = FALLBACK_ARTIFACT_HEIGHT,
): PortalCameraFrame {
  const tangent = halfHeightTangent();
  // Аспект приходить із viewport'а; на нульовій висоті контейнера він
  // вироджується, тож тримаємо його в межах реальних екранів.
  const safeAspect = Math.min(Math.max(Number.isFinite(aspect) ? aspect : 1, 0.3), 3.2);
  const safeRadius = Number.isFinite(artifactRadius) ? Math.max(0, artifactRadius) : 0;
  const safeHeight = Number.isFinite(artifactHeight) && artifactHeight > 0
    ? artifactHeight
    : FALLBACK_ARTIFACT_HEIGHT;

  // Наскільки кристал уже дорослий. ARTIFACT_FIT_HEIGHT — це висота, до якої
  // припасовується повністю вирослий, тож ділення дає 0..1 без окремої стелі.
  const grown = Math.min(1, Math.max(0, safeHeight / ARTIFACT_FIT_HEIGHT));
  const share = FRAME_SHARE_YOUNG + (FRAME_SHARE_GROWN - FRAME_SHARE_YOUNG) * grown;
  const height = safeHeight / share;
  const width = Math.max(height * FRAME_WIDTH_SHARE, safeRadius * 2 * FRAME_MARGIN);

  // Height is solved at the artifact's **near side**, not at its axis.
  //
  // The rule used to divide the wanted frame by the tangent and stop there,
  // which is an orthographic answer to a perspective question: the front of the
  // druse stands `safeRadius` closer to the camera than the axis the aim point
  // sits on, so it projects larger and lower than the arithmetic says. On a
  // slim spire the error is invisible — measured on main, 1% of the frame at
  // twenty years on a wide screen. On a wide artifact it is not: the same
  // measurement with a gem-proportioned monarch put **14% of the colony below
  // the bottom edge**, skirt and vein included.
  //
  // Adding the radius to the solved distance is the whole fix: it puts the
  // near side, rather than the axis, on the plane the frame was sized for.
  //
  // Width does **not** get the same term, and that asymmetry is the geometry
  // rather than a compromise: the bodies that set the horizontal extent stand
  // to the *side* of the axis, at very nearly the axis's own depth, while the
  // body that sets the vertical extent stands in *front* of it. Adding the
  // radius to both cost 10 points of screen width on a phone and bought
  // nothing — the clipping this fixes was entirely vertical.
  const byHeight = height / (2 * tangent) + safeRadius;
  const byWidth = width / (2 * tangent * safeAspect);
  const distance = Math.max(byHeight, byWidth);

  const targetY = PORTAL_GROUND_Y + safeHeight * TARGET_SHARE_OF_ARTIFACT;
  // Камера трохи вище за ціль, тож пряма відстань більша за z-виніс.
  const rise = distance * EYE_ELEVATION_SIN;
  const eyeY = targetY + rise;
  const z = Math.sqrt(Math.max(0, distance * distance - rise * rise));

  return {
    position: [0, eyeY, z],
    target: [0, targetY, 0],
    fov: FOV,
    distance,
    // Туман починається одразу за артефактом: він мусить з'їдати далеку
    // підлогу й задні колони, але не мити сам кристал.
    fogNear: distance * 0.96,
    fogFar: distance + 26,
  };
}

// ── Подіум ──────────────────────────────────────────────────
// Профіль обертання, y відраховується від PORTAL_GROUND_Y. Верхня площина
// подіуму втоплена рівно на товщину кам'яної плити, бо плита лежить у цій
// заглибині — а от ЇЇ верхня грань уже точно на нулі, тобто на площині, на
// якій рушій ставить кристали. Будь-яке відхилення або підвісило б жилу в
// повітрі, або втопило її в камені (2026-08-03: саме друге й було).

/** Товщина кам'яної плити платформи. */
const SLAB_THICKNESS = 0.075;

const DAIS_PROFILE: readonly (readonly [number, number])[] = [
  [0, -0.62],
  [1.9, -0.62],
  [1.9, -0.44],
  [1.66, -0.44],
  [1.66, -0.26],
  [1.44, -0.26],
  [1.44, -0.1],
  [1.3, -0.1],
  // Recessed by exactly the platform's thickness. The stone slab lies in this
  // recess, so it is the *slab's* top face that lands on 0 — see SLAB_TOP.
  [1.3, -SLAB_THICKNESS],
  [0, -SLAB_THICKNESS],
];

/** Радіус верхньої площини подіуму в базовій геометрії. */
export const PORTAL_DAIS_TOP_RADIUS = PORTAL_RELIC_TOP_RADIUS;
/** Зовнішній металевий край релікварію в базовому масштабі сцени. */
export const PORTAL_DAIS_OUTER_RADIUS = PORTAL_RELIC_OUTER_RADIUS;

/**
 * Наскільки верх подіуму має бути ширшим за видиму друзу.
 *
 * Кварцова жила більше не є видимою підкладкою релікварію, тому не має права
 * роздувати його масштаб. 1.5 лишає напис і світловий обвід навколо крайніх
 * дочірніх кристалів, але не перетворює основу на підлогу всього екрана.
 *
 * Стелю теж піднято: вона стерегла цоколі колон обабіч кадру, а відколи
 * колонада — кільце радіусом PORTAL_COLONNADE_RADIUS, до неї лишається кілька
 * постаментів запасу.
 */
const DAIS_CLEARANCE = 1.5;

/**
 * Стеля масштабу подіуму — її задають колони.
 *
 * Колони стоять на полі, а не на подіумі. Обмежує **передня** пара, і це не
 * очевидно: вона дзеркальна задній по z, але стоїть ближче до камери, тож
 * півширина кадру на її глибині менша й у світових координатах вона ближча до
 * осі. На найвужчому реальному кадрі вона відходить від осі на ≈2.81 проти
 * ≈2.99 у задньої.
 *
 * На висоті, де стоять цоколі (-PORTAL_FIELD_DROP), радіус подіуму — 1.66
 * базової геометрії, тож 1.66 × 1.66 = 2.76 < 2.81: цоколі лишаються зовні.
 *
 * Ціна стелі чесна й обмежена: приблизно після п'ятнадцяти років друза
 * доростає до краю подіуму й далі камінь торкається обводу замість того,
 * щоб лишати запас. Це помітно менша вада, ніж колона, що пробиває плиту.
 */
const DAIS_MAX_SCALE = 2.6;

/**
 * Масштаб подіуму під конкретний артефакт.
 *
 * Подіум був константою, і це трималось рівно доти, доки всі друзи були
 * дрібні. Але друза росте з роками, а камінь під нею — ще й з місцями, де
 * пара була (ADR-0004): пара з двадцятьма шістьма містами вже стояла на
 * плиті, вужчій за власний камінь, і золота інкрустація зникала під ним.
 *
 * Тільки збільшує: подіум, менший за спроєктований, зробив би сцену
 * тіснішою, ніж її кадрувала камера.
 */
export function portalDaisScale(artifactSceneRadius: number): number {
  const radius = Number.isFinite(artifactSceneRadius) ? Math.max(0, artifactSceneRadius) : 0;
  const needed = (radius * DAIS_CLEARANCE) / PORTAL_DAIS_TOP_RADIUS;
  return Math.min(DAIS_MAX_SCALE, Math.max(1, Number(needed.toFixed(4))));
}
/** Наскільки навколишнє поле нижче за верх подіуму. */
export const PORTAL_FIELD_DROP = 0.3;

export function buildPortalDaisGeometry(): THREE.LatheGeometry {
  const points = DAIS_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(points, 64);
  geometry.computeVertexNormals();
  return geometry;
}

// ── Кам'яна платформа ───────────────────────────────────────
// Суцільна верхня поверхня подіуму. Кристали ростуть просто з неї — крізь
// кварцову жилу, яку публікує рушій (engine/geometry/substrate.ts), — а
// камінь навколо вигинається рівно там, де під ним іде жила.
//
// Тут була ритуальна плита-кільце з розламаним внутрішнім обводом: усередині
// того обводу поверхня провалювалась на товщину плити, і під друзою виходило
// кругле заглиблення. Огляд (2026-08-03) відхилив його — тепер обводу немає
// зовсім, а пролом у камені є лише один, і це сама жила.

/** Зовнішній — трохи всередині обводу подіуму, щоб фаска подіуму лишалась видною. */
const SLAB_OUTER = 1.27;
const SLAB_SEGMENTS = 36;

/**
 * Верхня грань каменю — рівно площина артефакта.
 *
 * Це був справжній баг, і виміряний. Плита лежала **поверх** тієї самої
 * площини, на якій рушій ставить кристали, тобто камінь стояв на 0.075 вище за
 * основи кристалів і за кварцову жилу. Жила підіймається над площиною лише на
 * 0.024 в одиницях сцени, тож вона була похована під платформою з будь-якого
 * кута — а кристали виглядали зрізаними біля основи й підвішеними.
 *
 * Тепер плита втоплена в подіум: її низ на `-SLAB_THICKNESS`, верх на нулі.
 * Ту саму глибину вибрано в профілі подіуму, тож видима товщина каменю не
 * змінилась — змінилось лише те, від чого вона відраховується.
 */
const SLAB_TOP = 0;

/**
 * Скільки напрямків жили платформа підхоплює, якщо їх передали.
 *
 * Стримано: жила має 2–3 головні гілки, і камінь мусить читатись як їхнє
 * продовження, а не як власна система розломів. Раніше тут було дев'ять
 * рівномірних напрямків від власного насіння — саме та друга система.
 */
const CRACK_COUNT = 3;

/**
 * Напрямки, у яких камінь платформи піднято.
 *
 * Перший аргумент — насіння артефакта, другий — напрямки гілок кварцової жили
 * з опублікованого профілю субстрату. Коли вони є, камінь іде за ними: жила
 * розсунула його зсередини, тож будь-який інший напрямок був би розломом
 * нізвідки. Насіннєвий запас лишається для випадків, коли профіль старий і
 * напрямків у ньому немає, — тоді краще стриманий вигин, ніж пласка плита.
 */
export function portalCrackAngles(seed: number, bearings: readonly number[] = []): number[] {
  const fromVein = bearings.filter(Number.isFinite).slice(0, CRACK_COUNT);
  if (fromVein.length > 0) return fromVein;
  const random = mulberry32(seed ^ 0x0c2ac);
  return Array.from(
    { length: CRACK_COUNT },
    (_, index) => (index / CRACK_COUNT) * Math.PI * 2 + (random() - 0.5) * 0.35,
  );
}

/** Найменша кутова відстань між двома напрямками. */
function angularGap(left: number, right: number): number {
  const tau = Math.PI * 2;
  const raw = Math.abs(((left - right) % tau + tau) % tau);
  return Math.min(raw, tau - raw);
}

/** Наскільки плита піднімається просто над тріщиною. */
const SLAB_SWELL = 0.055;
/** Кутова ширина вигину; ширше — і вигини зіллються в купол. */
const SLAB_SWELL_SPREAD = 0.42;

/**
 * Підйом плити на заданому напрямку.
 *
 * Плита не просто розколота — її вигнуло тим, що йшло знизу. Вигин
 * найсильніший на самій тріщині й згасає вбік, тож між тріщинами камінь
 * лишається пласким і злам читається як злам, а не як брижі.
 */
function slabSwell(angle: number, cracks: readonly number[]): number {
  let swell = 0;
  for (const crack of cracks) {
    const gap = angularGap(angle, crack) / SLAB_SWELL_SPREAD;
    swell += SLAB_SWELL * Math.exp(-gap * gap);
  }
  return Math.min(SLAB_SWELL * 1.6, swell);
}

/**
 * Профіль вигину вздовж радіуса.
 *
 * Вигин не купол, а гребінь: над самою жилою камінь плаский, підіймається
 * одразу за нею й полого сходить до обводу.
 *
 * Пласка серцевина тут не косметика, і причин дві. При куполі вершина
 * припадала б рівно на вісь, де всі сегменти сходяться в одну точку, і
 * поверхня стала б віялом різнонахилених клинів. А головне — вигин, що
 * починається всередині сліду жили, підіймається **над кварцом** і ховає його:
 * жила стоїть на 0.024 над площиною артефакта, а камінь вигинався до 0.118.
 * Саме тому `veinReach` тут аргумент, а не константа: платформа зобов'язана
 * лишити шов у спокої, хоч би якою широкою була жила в цієї пари.
 */
function slabRidge(radius: number, veinReach: number): number {
  const clear = Math.max(0, Math.min(SLAB_OUTER * 0.75, veinReach));
  const span = Math.max(1e-6, SLAB_OUTER - clear);
  const along = Math.max(0, Math.min(1, (radius - clear) / span));
  const rise = Math.min(1, along / 0.3);
  const eased = rise * rise * (3 - 2 * rise);
  // Сила прийшла зсередини, тож на обводі від вигину лишається третина.
  return eased * (1 - along * 0.7);
}

/**
 * Висота поверхні платформи в точці.
 *
 * Одна функція на всіх, хто на камені лежить: сама платформа, руни й золота
 * інкрустація. Інкрустація спершу була пласким кільцем на сталій висоті — і
 * щойно камінь вигнуло, вигин її накрив, тобто золото зникло. Інкрустація
 * вкладена *в* камінь, тож вона мусить вигинатись разом із ним.
 */
export function portalSlabSurfaceY(
  angle: number,
  radius: number,
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): number {
  return slabSurfaceY(angle, radius, portalCrackAngles(seed, bearings), veinReach);
}

/** Наскільки інкрустація підведена над каменем плити. */
export const PORTAL_INLAY_CLEARANCE = 0.005;

function slabSurfaceY(
  angle: number,
  radius: number,
  cracks: readonly number[],
  veinReach: number,
): number {
  return SLAB_TOP + slabSwell(angle, cracks) * slabRidge(radius, veinReach);
}

/** Радіуси кілець верхньої площини — від осі до обводу, без жодного розриву. */
const SLAB_RINGS: readonly number[] = [0, 0.18, 0.36, 0.58, 0.8, 1];

/**
 * Платформа як суцільне тіло: верхня площина від осі до обводу і зовнішній
 * бортик. Не індексована — flatShading по гранях і є тим фасетним каменем, що
 * на референсі, а спільні вершини усереднили б нормалі якраз на ребрах.
 *
 * `bearings` — напрямки гілок кварцової жили (профіль субстрату). Камінь
 * піднімається саме над ними.
 */
export function buildPortalRitualSlabGeometry(
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): THREE.BufferGeometry {
  const cracks = portalCrackAngles(seed, bearings);
  const positions: number[] = [];
  const triangle = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ): void => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  const point = (angle: number, radius: number): readonly [number, number, number] => [
    Math.sin(angle) * radius,
    slabSurfaceY(angle, radius, cracks, veinReach),
    Math.cos(angle) * radius,
  ];

  for (let index = 0; index < SLAB_SEGMENTS; index += 1) {
    const a0 = (index / SLAB_SEGMENTS) * Math.PI * 2;
    const a1 = ((index + 1) / SLAB_SEGMENTS) * Math.PI * 2;

    for (let ring = 0; ring < SLAB_RINGS.length - 1; ring += 1) {
      const inner = SLAB_RINGS[ring]! * SLAB_OUTER;
      const outer = SLAB_RINGS[ring + 1]! * SLAB_OUTER;
      const o0 = point(a0, outer);
      const o1 = point(a1, outer);
      if (inner <= 0) {
        // Серцевина: одне віяло на пласкій ділянці, тож усі його трикутники
        // лежать в одній площині й flatShading не робить із них зірки.
        triangle(point(a0, 0), o0, o1);
        continue;
      }
      const i0 = point(a0, inner);
      const i1 = point(a1, inner);
      triangle(i0, o0, i1);
      triangle(i1, o0, o1);
    }

    // Зовнішній бортик — товщина каменю, видима з-під фаски подіуму. Низ
    // тепер у заглибині подіуму, а не на його верхній площині: саме цей зсув
    // і опускає всю плиту так, щоб її верх збігся з площиною артефакта.
    const out0 = point(a0, SLAB_OUTER);
    const out1 = point(a1, SLAB_OUTER);
    const floor0: readonly [number, number, number] = [out0[0], -SLAB_THICKNESS, out0[2]];
    const floor1: readonly [number, number, number] = [out1[0], -SLAB_THICKNESS, out1[2]];
    triangle(out0, floor0, out1);
    triangle(out1, floor0, floor1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Наскільки різьблення підведене над каменем плити. */
const CRACK_CLEARANCE = PORTAL_INLAY_CLEARANCE;

/** Скільки рун викарбувано на кільці. */
const RUNE_COUNT = 12;
/** Радіус, на якому вони лежать — між середнім і зовнішнім золотими кільцями. */
/** Між першим і другим кільцем — там для них є смуга завширшки 0.07. */
const RUNE_RADIUS = 1.1;
const RUNE_SIZE = 0.05;

/**
 * Рунічні візерунки по кільцю плити.
 *
 * Замінюють радіальні тріщини, які тут були: самі тріщини переїхали в геометрію
 * рушія, де кожен кристал ріже плиту власними, а їхні довжина, ширина й глибина
 * йдуть від його радіуса. Кільце лишилось порожнім, і на референсі саме там
 * стоїть різьблення.
 *
 * Кожна руна — кутник із двох штрихів, як на референсі: рівно стільки форми,
 * щоб читалось як знак, і жодної спроби зобразити алфавіт, якого не існує.
 */
export function buildPortalRuneGeometry(
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): THREE.BufferGeometry {
  const random = mulberry32(seed ^ 0x2c0de);
  const positions: number[] = [];
  const cracks = portalCrackAngles(seed, bearings);

  const stroke = (
    angle: number,
    radius: number,
    alongTangent: number,
    alongRadial: number,
    thickness: number,
  ): void => {
    const sx = Math.sin(angle);
    const cz = Math.cos(angle);
    // Локальні осі руни: вздовж радіуса й по дотичній.
    const rx = sx;
    const rz = cz;
    const tx = cz;
    const tz = -sx;
    const cx = sx * radius;
    const czz = cz * radius;
    const y = slabSurfaceY(angle, radius, cracks, veinReach) + CRACK_CLEARANCE;
    const half = thickness * 0.5;
    const corner = (u: number, v: number): readonly [number, number, number] => [
      cx + tx * u + rx * v,
      y,
      czz + tz * u + rz * v,
    ];
    const a = corner(-alongTangent * 0.5 - half, -alongRadial * 0.5 - half);
    const b = corner(alongTangent * 0.5 + half, alongRadial * 0.5 - half);
    const c = corner(alongTangent * 0.5 + half, alongRadial * 0.5 + half);
    const d = corner(-alongTangent * 0.5 - half, -alongRadial * 0.5 + half);
    positions.push(
      a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
      a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2],
    );
  };

  for (let index = 0; index < RUNE_COUNT; index += 1) {
    const angle = (index / RUNE_COUNT) * Math.PI * 2;
    const size = RUNE_SIZE * (0.8 + random() * 0.4);
    const flip = random() < 0.5 ? 1 : -1;
    // Кутник: поперечний штрих і радіальний, що виходить з його кінця.
    stroke(angle, RUNE_RADIUS, size * 1.6, 0, size * 0.22);
    stroke(angle + (size * 0.7 * flip) / RUNE_RADIUS, RUNE_RADIUS + size * 0.55, 0, size * 1.1, size * 0.22);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Золоті кільця по обводу верхньої площини. Два кільця одним buffer'ом —
 * інкрустація не варта другого draw call'а.
 */
export function buildPortalInlayGeometry(
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): THREE.BufferGeometry {
  const cracks = portalCrackAngles(seed, bearings);
  // Три кільця різного радіуса, як на референсі: вузьке ближче до друзи,
  // широке посередині, вузьке по обводу. Усі лежать далеко за жилою й
  // повторюють вигин каменю — інакше вигин їх накриває, і золото зникає рівно
  // на гребенях, де воно найпомітніше.
  const bands: readonly (readonly [number, number])[] = [
    [1.045, 1.065],
    [1.135, 1.155],
    [1.245, 1.262],
  ];
  const segments = 96;
  const positions: number[] = [];
  const point = (angle: number, radius: number): readonly [number, number, number] => [
    Math.sin(angle) * radius,
    slabSurfaceY(angle, radius, cracks, veinReach) + CRACK_CLEARANCE,
    Math.cos(angle) * radius,
  ];

  for (const [innerRadius, outerRadius] of bands) {
    for (let index = 0; index < segments; index += 1) {
      const a0 = (index / segments) * Math.PI * 2;
      const a1 = ((index + 1) / segments) * Math.PI * 2;
      const i0 = point(a0, innerRadius);
      const i1 = point(a1, innerRadius);
      const o0 = point(a0, outerRadius);
      const o1 = point(a1, outerRadius);
      positions.push(
        i0[0], i0[1], i0[2], o0[0], o0[1], o0[2], i1[0], i1[1], i1[2],
        i1[0], i1[1], i1[2], o0[0], o0[1], o0[2], o1[0], o1[1], o1[2],
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ── Колони ──────────────────────────────────────────────────

export interface PortalPillarPlacement {
  /** Глибина за площиною артефакта (від'ємна = вглиб кадру). */
  z: number;
  /**
   * Частка півширини кадру, на якій стоїть **внутрішня грань** колони:
   * 1 = грань точно на краю кадру.
   *
   * Саме грань, а не вісь. Для далеких колон різниця мізерна — їхній радіус
   * малий проти півширини кадру на тій глибині. Для колони перед артефактом
   * вона вирішальна: при радіусі 0.5 і півширині 0.52 колона, поставлена
   * віссю на край, закриває половину екрана.
   */
  edgeFraction: number;
  height: number;
  radius: number;
}

/**
 * Три пари, і всі три **позаду** артефакта.
 *
 * Тут колись стояла пара перед кристалом. Задум був у тому, щоб глядач
 * опинявся всередині зали, а не навпроти неї, і як задум він чесний — але
 * колона на передньому плані бореться з кристалом за увагу, а акцент тут
 * рівно один. Ближню пару відсунуто за артефакт, і додано третю, ще дальшу:
 * колонада тепер **відступає в глибину** й читається як тло, яким і має бути.
 *
 * Кожна дальша пара вища, ширша й ближча до осі кадру. Це не декоративний
 * градієнт: перспектива й так зменшує далеке, тож колона тієї самої висоти на
 * подвійній глибині виглядала б удвічі нижчою, і ряд читався б як спадна
 * сходинка замість однакових колон, що йдуть углиб.
 *
 * Обмеження, яке їх тримає: у проєкції на екран жодна не заходить на артефакт,
 * інакше замість обрамлення вийде затулянка. За цим стежить portalScene.test.ts.
 */
export const PORTAL_PILLARS: readonly PortalPillarPlacement[] = [
  { z: -3.2, edgeFraction: 0.94, height: 5.2, radius: 0.42 },
  { z: -7.4, edgeFraction: 0.86, height: 6.4, radius: 0.5 },
  { z: -12.2, edgeFraction: 0.78, height: 7.4, radius: 0.58 },
];

export interface PortalPillarInstance {
  position: readonly [number, number, number];
  /** Множник до базової геометрії висотою 1 і радіусом 1. */
  scale: readonly [number, number, number];
  rotationY: number;
}

/**
 * Розкладка колон для конкретного кадру. Камера дивиться вздовж -Z, тож
 * глибина колони — це distance + |z|.
 */
/**
 * Скільки колон стоїть у кільці, і на якому радіусі.
 *
 * Кільце, а не два ряди по краях кадру. Ряди були розкладкою під **екран**:
 * колони їхали з аспектом, щоб триматись його країв, і на широкому екрані
 * розходились так, що між ними не лишалось зали — лише два стовпи обабіч.
 * Референс тримається інакше: це кільце колон навколо подіуму, а кадр його
 * просто обрізає. Тоді колонада має власну форму, незалежну від того, у яке
 * вікно на неї дивляться.
 *
 * Радіус — від подіуму, не від кадру: зала оточує артефакт, а не екран.
 */
export const PORTAL_COLONNADE_COUNT = 18;
/**
 * Радіус кільця більший за відстань камери, і це вимога, а не запас.
 *
 * Замкнене кільце ставить колони й перед артефактом теж. Поки радіус був
 * менший за відстань камери, ці ближні колони опинялись **між** глядачем і
 * кристалом. Винесене за камеру, кільце тим самим боком проходить позаду неї —
 * у кадр не входить нічого, а аркада лишається замкненою.
 */
const COLONNADE_PILLAR_HEIGHT = 6.6;
const COLONNADE_PILLAR_RADIUS = 0.52;
export const PORTAL_COLONNADE_RADIUS = 13.2;

/**
 * Кільце замкнене — арка за аркою по всьому колу, без розриву.
 *
 * Тут був сектор, вирізаний перед артефактом: боялися, що замкнене кільце
 * поставить колону просто перед кристалом. Виміряно — не поставить. Кільце
 * стоїть на радіусі PORTAL_COLONNADE_RADIUS, а камера ближча за нього, тож
 * колони «переднього» боку опиняються **позаду глядача** й у кадр не входять
 * узагалі. Розрив нічого не рятував і лише робив аркаду незамкненою рівно там,
 * де її однаково не видно.
 */

export function portalPillarInstances(
  frame: PortalCameraFrame,
  aspect: number,
): PortalPillarInstance[] {
  void frame;
  void aspect;
  const instances: PortalPillarInstance[] = [];
  const step = (Math.PI * 2) / PORTAL_COLONNADE_COUNT;
  for (let index = 0; index < PORTAL_COLONNADE_COUNT; index += 1) {
    // Півкроку зсуву, щоб жодна колона не стала точно на вісь позаду
    // артефакта: з парною кількістю рівно одна там і опинялась, і в кадрі це
    // читалось як чорна щогла, що проходить крізь кристал.
    const angle = (index + 0.5) * step;
    // Одна й та сама колона по всьому колу. Розкладка перебирала три різні —
    // спадок від рядів, де дальша пара мусила бути вищою, щоб перспектива не
    // читала ряд як сходинку. У кільці всі колони рівновіддалені від центру,
    // тож різні висоти читаються не як глибина, а як щербатий ряд.
    const placement = PORTAL_PILLARS[0]!;
    void placement;
    instances.push({
      position: [
        Math.sin(angle) * PORTAL_COLONNADE_RADIUS,
        PORTAL_GROUND_Y - PORTAL_FIELD_DROP,
        Math.cos(angle) * PORTAL_COLONNADE_RADIUS,
      ],
      scale: [COLONNADE_PILLAR_RADIUS, COLONNADE_PILLAR_HEIGHT, COLONNADE_PILLAR_RADIUS],
      // Кожна колона розвернута на власний кут, щоб грані восьмигранника не
      // збігались по всьому кільцю — інакше кільце читається як один
      // повторений спрайт.
      rotationY: angle + index * 0.37,
    });
  }
  return instances;
}

/**
 * Арки між **сусідніми** колонами кільця.
 *
 * Це і є те, чого не могла дати попередня розкладка: там колони стояли парами
 * по краях кадру, тож арка між парою перекривала всю його ширину. У кільці
 * сусідки стоять на хорді, і арка над хордою — це проліт аркади, а не
 * перемичка через сцену.
 *
 * Арка ставиться лише там, де стоять **обидві** сусідки: над розривом, що
 * дивиться на глядача, пролягати нічому.
 */
export function portalArchInstances(
  frame: PortalCameraFrame,
  aspect: number,
): PortalArchInstance[] {
  const pillars = portalPillarInstances(frame, aspect);
  const instances: PortalArchInstance[] = [];
  const step = (Math.PI * 2) / PORTAL_COLONNADE_COUNT;
  // Сусідні за кільцем, а не за порядком у масиві: пропущені колони розривають
  // масив, і слідом за ним — аркаду.
  const spacing = 2 * PORTAL_COLONNADE_RADIUS * Math.sin(step * 0.5);
  for (let index = 0; index < pillars.length; index += 1) {
    const left = pillars[index]!;
    // Замикається: останній проліт іде від крайньої колони до першої, інакше
    // в замкненому кільці лишався б рівно один порожній прольот.
    const right = pillars[(index + 1) % pillars.length]!;
    const dx = right.position[0] - left.position[0];
    const dz = right.position[2] - left.position[2];
    const chord = Math.hypot(dx, dz);
    if (chord > spacing * 1.4) continue;
    instances.push({
      position: [
        (left.position[0] + right.position[0]) * 0.5,
        left.position[1] + left.scale[1] * ARCH_SPRING,
        (left.position[2] + right.position[2]) * 0.5,
      ],
      scale: [chord * 0.5, ARCH_RISE, left.scale[0]],
      // Площина арки мусить стояти вздовж хорди, інакше проліт дивиться
      // ребром і зникає.
      rotationY: Math.atan2(dx, dz) + Math.PI / 2,
    });
  }
  return instances;
}

/**
 * Колона висотою 1 і найбільшим радіусом 1 з цоколем і капітеллю — усе
 * одним buffer'ом, щоб чотири колони пішли одним InstancedMesh.
 * Нормалізація потрібна, щоб `radius` у PORTAL_PILLARS означав саме
 * габарит колони, а не радіус якоїсь її частини.
 */
export function buildPortalPillarGeometry(): THREE.BufferGeometry {
  const plinth = new THREE.CylinderGeometry(0.88, 1, 0.06, 8, 1);
  plinth.translate(0, 0.03, 0);
  const shaft = new THREE.CylinderGeometry(0.55, 0.67, 0.88, 8, 1);
  shaft.translate(0, 0.5, 0);
  const capital = new THREE.CylinderGeometry(0.83, 0.6, 0.06, 8, 1);
  capital.translate(0, 0.97, 0);

  const merged = mergeGeometries([plinth, shaft, capital]);
  plinth.dispose();
  shaft.dispose();
  capital.dispose();
  if (merged === null) throw new Error('Portal pillar geometry could not be merged.');
  merged.computeVertexNormals();
  return merged;
}

// ── Підлога храму ───────────────────────────────────────────

/** Де підлога починається і де закінчується, у світових одиницях. */
const FLOOR_INNER = 0.6;
const FLOOR_OUTER = 17;
/** Скільки разів плитка вкладається на один світовий юніт. */
const FLOOR_TILING = 0.55;

/**
 * Кам'яна підлога навколо подіуму.
 *
 * Кільце, а не диск: усередині стоїть подіум, і плитка під ним — це трикутники,
 * яких ніхто не побачить. Далі сімнадцяти юнітів її з'їдає туман, тож там
 * лишається просте поле.
 *
 * Тут раніше лежала процедурна викладка плит по кільцях — вона робила свою
 * роботу, але власник передав власну плитку, і візерунок, намальований
 * художником, чесніше за будь-яку розкладку, згенеровану з правил. Від
 * попередньої версії лишилась сама ідея кільцевої, а не квадратної розгортки:
 * подіум круглий, друза на його осі, колони розходяться від неї, і квадратна
 * плитка внесла б у сцену другу, чужу вісь.
 *
 * UV — **плоска проєкція згори**, а не полярна. Полярна здавалась логічнішою:
 * плитка гнеться разом із кільцем. На ділі вона зсуває кожну плитку тим
 * сильніше, чим далі від осі — внутрішній край сектора коротший за зовнішній, —
 * і підлога вийшла змазаною в дуги. Плитку кладуть рядами, а не по колу; кільце
 * тут — форма поверхні, а не візерунка на ній.
 */
export function buildPortalTempleFloorGeometry(): THREE.BufferGeometry {
  // Кільце пласке — розбиття потрібне лише на кривизну обводу, не на форму.
  const rings = 6;
  const sectors = 48;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = FLOOR_INNER + (FLOOR_OUTER - FLOOR_INNER) * (ring / rings);
    for (let sector = 0; sector <= sectors; sector += 1) {
      const angle = (sector / sectors) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      positions.push(x, 0, z);
      uvs.push(x * FLOOR_TILING, z * FLOOR_TILING);
    }
  }
  const stride = sectors + 1;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let sector = 0; sector < sectors; sector += 1) {
      const a = ring * stride + sector;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// ── Арки ────────────────────────────────────────────────────

/**
 * Скільки сегментів має половина стрілчастої арки.
 *
 * Вісім. Арка — це силует на тлі неба, а не поверхня, яку розглядають: усе, що
 * від неї видно, — це лінія, де темний камінь межує зі світлим прорізом. Далі
 * восьми сегментів додаються трикутники, яких на цій лінії не відрізнити.
 */
const ARCH_SEGMENTS = 8;

/**
 * Наскільки центр кола арки зміщений від осі прорізу, у частках півпрольоту.
 *
 * Це і є те, що робить арку **стрілчастою**, а не півкруглою. Стрілчаста арка —
 * два дуги, чиї центри рознесені: кожна починається вертикально від капітелі й
 * сходиться з іншою під кутом угорі. Нуль дав би римський півциркуль, який на
 * референсі якраз не той — там гострий верх, і саме він тягне око вгору.
 */
const ARCH_POINT = 0.55;

/** Товщина арки вздовж прольоту, у частках півпрольоту. */
const ARCH_THICKNESS = 0.22;
/** Наскільки арка глибша за колону, щоб не читалась як пласка накладка. */
const ARCH_DEPTH = 1.05;

/**
 * Стрілчаста арка одиничного прольоту: півпроліт 1, п'ята на y=0, вістря вгорі.
 *
 * Будується як смуга — два кільця точок, внутрішнє й зовнішнє, — а не як
 * витягнутий профіль: проліт у кожної пари колон свій, і смуга масштабується
 * під нього по x, лишаючи товщину постійною по y. Витягування дало б арку, що
 * товщає разом із прольотом.
 *
 * Одна геометрія на всі арки, як і в колон, щоб вони пішли одним
 * InstancedMesh.
 */
export function buildPortalArchGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  // Дуга правої половини: центр зміщено вліво від правої п'яти, тож дуга
  // виходить із неї вертикально й приходить до осі під кутом.
  const centerX = -ARCH_POINT;
  const radius = 1 - centerX;
  // Кут, під яким дуга перетинає вісь прольоту, — там вона й обривається,
  // зустрічаючись із дзеркальною половиною.
  const meetAngle = Math.acos(-centerX / radius);

  const ring = (offset: number): number => {
    const first = positions.length / 3;
    for (let step = 0; step <= ARCH_SEGMENTS; step += 1) {
      const angle = (step / ARCH_SEGMENTS) * meetAngle;
      positions.push(
        centerX + Math.cos(angle) * (radius + offset),
        Math.sin(angle) * (radius + offset),
        0,
      );
    }
    return first;
  };
  const inner = ring(0);
  const outer = ring(ARCH_THICKNESS);
  for (let step = 0; step < ARCH_SEGMENTS; step += 1) {
    const a = inner + step;
    const b = inner + step + 1;
    const c = outer + step;
    const d = outer + step + 1;
    indices.push(a, c, b, b, c, d);
  }

  const half = new THREE.BufferGeometry();
  half.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  half.setIndex(indices);

  // Дзеркало по x дає ліву половину. Віддзеркалення обертає намотку, тож
  // індекси розвертаються назад — інакше половина арки зникає під відсіканням
  // задніх граней.
  const mirrored = half.clone();
  const mirroredPositions = mirrored.getAttribute('position');
  for (let index = 0; index < mirroredPositions.count; index += 1) {
    mirroredPositions.setX(index, -mirroredPositions.getX(index));
  }
  const mirroredIndex = Array.from(mirrored.getIndex()!.array);
  for (let offset = 0; offset < mirroredIndex.length; offset += 3) {
    const swap = mirroredIndex[offset]!;
    mirroredIndex[offset] = mirroredIndex[offset + 2]!;
    mirroredIndex[offset + 2] = swap;
  }
  mirrored.setIndex(mirroredIndex);

  const flat = mergeGeometries([half, mirrored]);
  half.dispose();
  mirrored.dispose();
  if (flat === null) throw new Error('Portal arch geometry could not be merged.');

  // Товщина по z. Без неї арка — площина, яка зникає, щойно камера відходить
  // від осі, а колонада на широкому екрані дивиться на глядача збоку.
  const solid = mergeGeometries([
    flat.clone().translate(0, 0, ARCH_DEPTH * 0.5),
    flat.clone().translate(0, 0, -ARCH_DEPTH * 0.5),
  ]);
  flat.dispose();
  if (solid === null) throw new Error('Portal arch geometry could not be extruded.');
  solid.computeVertexNormals();
  return solid;
}

export interface PortalArchInstance {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotationY: number;
}

/**
 * На якій частці висоти колони лежить п'ята арки.
 *
 * Не під капітеллю, хоч архітектурно їй там і місце. Колони навмисно вищі за
 * кадр — вони мусять виходити за верхній край, щоб зала не мала стелі, — і
 * п'ята, поставлена під капітеллю, опинялась на y≈2.8 при верхньому краї кадру
 * 3.28, тобто арки не було видно взагалі. Виміряно, а не вгадано.
 */
const ARCH_SPRING = 0.49;
/**
 * Підйом арки над п'ятою, у світових одиницях.
 *
 * Опущено з 2.4: вістря опинялось під шапкою інтерфейсу, тобто арка була в
 * кадрі, але не на екрані. Портал — це не рендер у вакуумі, і верхня третина
 * його вікна зайнята текстом.
 */
const ARCH_RISE = 1.6;

// ── Світло на колонах ───────────────────────────────────────

/**
 * Де на колоні стоїть вогонь, як частка її висоти.
 *
 * Не під капітеллю, хоч там йому й місце за архітектурою: капітель передньої
 * пари лежить вище за верхній край кадру, тож вогонь було видно лише тому, хто
 * задере камеру. Джерело світла, якого не видно, — це не джерело світла, а
 * просто світло нізвідки. На цій висоті він у кадрі на кожному аспекті.
 */
const LAMP_HEIGHT_SHARE = 0.6;

/** Наскільки вогонь винесений усередину, до кристала, від осі колони. */
const LAMP_INSET = 0.62;

/**
 * Скільки колон несуть справжнє джерело світла.
 *
 * Два, і це не економія на вигляді, а на кадрі: кожен point light додає роботи
 * в кожному фрагменті кожного матеріалу сцени. Вогні горять на **всіх** колонах
 * — це геометрія, вона майже безкоштовна, — але освітлює кристал лише передня
 * пара, бо саме вона стоїть із того боку, з якого на нього дивляться. Задні
 * дали б контровий підсвіт, який тут уже є від directionalLight.
 */
export const PORTAL_LAMP_LIGHT_COUNT = 2;

export interface PortalLampInstance {
  position: readonly [number, number, number];
  /** Чи від цього вогню запалюється справжнє джерело світла. */
  lit: boolean;
}

/**
 * Вогні на колонах для конкретного кадру.
 *
 * Порядок той самий, що в `portalPillarInstances`, і це не збіг: вогонь мусить
 * стояти рівно на своїй колоні, а колони їдуть із кадром камери. Виводити їх
 * окремо означало б два джерела правди для однієї позиції.
 */
export function portalLampInstances(
  frame: PortalCameraFrame,
  aspect: number,
): PortalLampInstance[] {
  const pillars = portalPillarInstances(frame, aspect);
  // Горять на всіх, світять двоє — найближчі до глядача за азимутом. Вони
  // єдині дивляться на кристал із того боку, з якого на нього дивляться;
  // решта дала б контровий підсвіт, який тут уже є від directionalLight.
  const towardCamera = pillars.map(
    (pillar) => Math.abs(Math.atan2(pillar.position[0], pillar.position[2])),
  );
  const nearest = [...towardCamera].sort((left, right) => left - right).slice(0, PORTAL_LAMP_LIGHT_COUNT);
  const litThreshold = nearest[nearest.length - 1] ?? 0;
  return pillars.map((pillar, index) => {
    const height = pillar.scale[1] * LAMP_HEIGHT_SHARE;
    // Усередину кільця, до осі — не «вліво/вправо», що мало сенс лише поки
    // колони стояли двома рядами.
    const radius = Math.hypot(pillar.position[0], pillar.position[2]) || 1;
    const inset = pillar.scale[0] * LAMP_INSET;
    return {
      position: [
        pillar.position[0] * (1 - inset / radius),
        pillar.position[1] + height,
        pillar.position[2] * (1 - inset / radius),
      ] as const,
      lit: towardCamera[index]! <= litThreshold + 1e-9,
    };
  });
}

/**
 * Чаша вогню: маленька, гранована, з тією ж кількістю сторін, що й колона.
 *
 * Нормалізована так само, як колона, — радіусом 1, — тож масштаб інстансу
 * означає саме габарит вогню.
 */
export function buildPortalLampGeometry(): THREE.BufferGeometry {
  const bowl = new THREE.CylinderGeometry(1, 0.5, 0.55, 8, 1);
  bowl.translate(0, 0.28, 0);
  // Вузьке й високе. Перший конус був майже такої ж ширини, як чаша, і читався
  // як шпиль на колоні, а не як вогонь у ній.
  const flame = new THREE.ConeGeometry(0.62, 1.8, 8, 1);
  flame.translate(0, 1.4, 0);

  const merged = mergeGeometries([bowl, flame]);
  bowl.dispose();
  flame.dispose();
  if (merged === null) throw new Error('Portal lamp geometry could not be merged.');
  merged.computeVertexNormals();
  return merged;
}

/** Габарит вогню в одиницях сцени. */
export const PORTAL_LAMP_RADIUS = 0.19;

// ── Зорі ────────────────────────────────────────────────────

export interface PortalStarField {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}

const STAR_SHELL_RADIUS = 34;

/**
 * Зорі на сферичній оболонці, лише над горизонтом. Насіння — artifactSeed
 * пари: небо в кожної пари своє, але однакове при кожному відкритті.
 */
export function buildPortalStarField(seed: number, count: number): PortalStarField {
  const random = mulberry32(seed ^ 0x5f37);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const azimuth = random() * Math.PI * 2;
    // Зміщення в бік зеніту: біля горизонту зорі майже не видно крізь
    // туман, і рівномірний розподіл витратив би на них половину поля.
    const elevation = Math.asin(0.06 + random() * 0.94);
    const radius = STAR_SHELL_RADIUS * (0.86 + random() * 0.14);
    positions[index * 3] = Math.cos(elevation) * Math.cos(azimuth) * radius;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.cos(elevation) * Math.sin(azimuth) * radius;

    // Розкид яскравості важливіший за кількість: рівні зорі читаються як
    // шум, нерівні — як глибина.
    const brightness = 0.24 + random() * 0.76;
    const warmth = random();
    colors[index * 3] = brightness;
    colors[index * 3 + 1] = brightness * (0.9 + warmth * 0.1);
    colors[index * 3 + 2] = brightness * (0.94 + (1 - warmth) * 0.06);
  }

  return { positions, colors, count };
}

// ── Палітра ─────────────────────────────────────────────────

export interface PortalPalette {
  fog: string;
  field: string;
  dais: string;
  daisEmissive: string;
  /** Ритуальна плита — той самий камінь, що подіум, але світліший на зламі. */
  slab: string;
  /** Різьблення на кільці плити. */
  rune: string;
  runeGlow: string;
  inlay: string;
  pillar: string;
  /** Чаша вогню на колоні. */
  lamp: string;
  /** Саме полум'я — і колір джерела світла, що від нього запалюється. */
  lampGlow: string;
  lampIntensity: number;
  starOpacity: number;
  daisLight: string;
  daisLightIntensity: number;
}

/**
 * Ключ і контровий підсвіт — §10 брифу кристала.
 *
 * Живуть тут, а не літералами в JSX, з однієї причини: їх треба перевіряти.
 * Вимога «ключ домінує, решта — натяк» — це відношення між числами, і поки
 * числа розкидані по розмітці, жоден тест не може його стерегти. Саме так
 * точкове світло подіуму й виросло втричі за ключ, поки коментар над
 * напрямленими джерелами стверджував протилежне.
 *
 * Камера дивиться з +Z на початок координат, тож від'ємний X — це екранне
 * «ліворуч», де §10 і вимагає ключ.
 */
export const PORTAL_KEY_LIGHT = {
  position: [-3.4, 4, 2.2] as const,
  intensity: 1.9,
  /** Теплий рожево-білий. Не жовтий і не чисто білий. */
  color: '#ffeef2',
};

/** Прохолодний бузковий, навпроти ключа. Не другий ключ. */
export const PORTAL_RIM_LIGHT = {
  position: [3, 3.2, -3.2] as const,
  intensity: 0.26,
  color: '#cfc4f5',
};

export const PORTAL_AMBIENT_INTENSITY = 0.1;
export const PORTAL_HEMISPHERE_INTENSITY = 0.24;

/**
 * Куди дістає вогонь однієї лампи.
 *
 * Рівно до краю подіуму й не далі, на будь-якому віці стосунків. Було
 * `frame.distance * 1.35` — межа їхала за камерою, а камера відходить разом
 * із кристалом, тож у молодої пари вогонь не діставав навіть до половини
 * відстані, а у двадцятип'ятирічної мив геть усе разом із подіумом і кидав на
 * артефакт 0.15 помаранчевого (#ff8c34). §10 забороняє жовте джерело.
 *
 * Рахується від власної позиції лампи: лампи трохи втоплені всередину відносно
 * колон, тож константа колонади перелетіла б через край подіуму саме на цю
 * різницю.
 */
export function portalLampReach(
  lampPosition: readonly [number, number, number],
  daisScale: number,
): number {
  const fromCentre = Math.hypot(lampPosition[0], lampPosition[2]);
  const daisRadius = PORTAL_DAIS_TOP_RADIUS * Math.max(1, daisScale);
  // Донизу, а не до найближчого. Округлення до найближчого може перелетіти
  // край подіуму на кілька мікрон — нешкідливо на око, але тоді гарантія
  // «не дістає до артефакта» тримається в межах похибки, а не за побудовою,
  // і перший, хто змінить тут кількість знаків, зламає її мовчки.
  return Math.max(1, Math.floor((fromCentre - daisRadius) * 10_000) / 10_000);
}

/**
 * Портал — нічна сцена в обох темах: це декорація, всередині якої
 * світиться артефакт, а не «темний режим». Світла тема лише тепліша.
 * Ті самі ролі, що й у --portal-* токенах CSS, тільки для WebGL.
 */
export const PORTAL_PALETTES: Record<'light' | 'dark', PortalPalette> = {
  light: {
    fog: '#3b2b57',
    field: '#2e2244',
    dais: '#81523c',
    daisEmissive: '#180b0d',
    slab: '#5d5b6a',
    rune: '#2b1719',
    runeGlow: '#cf8cff',
    inlay: '#b65cff',
    pillar: '#6a5c8f',
    lamp: '#241d33',
    lampGlow: '#ff9c47',
    lampIntensity: 11,
    starOpacity: 0.85,
    daisLight: '#d7b7f2',
    // Світло від кореня, а не прожектор перед кристалом. Було 2.6 — виміряно
    // як найсильніше джерело сцени, сильніше за ключ удвічі-втричі там, де
    // кристал найширший. Див. розгортку в PortalEnvironment.
    daisLightIntensity: 0.5,
  },
  dark: {
    fog: '#221a33',
    field: '#1b1428',
    dais: '#5b362e',
    daisEmissive: '#10070a',
    slab: '#494757',
    rune: '#1d1115',
    runeGlow: '#b96ff2',
    inlay: '#9747d8',
    pillar: '#4b4070',
    lamp: '#1b1628',
    lampGlow: '#ff8c34',
    lampIntensity: 13,
    starOpacity: 1,
    daisLight: '#b891dd',
    daisLightIntensity: 0.42,
  },
};
