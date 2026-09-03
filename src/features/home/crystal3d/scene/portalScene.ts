// ============================================================
// portalScene — числа й геометрія порталу, без React і без стану.
// ------------------------------------------------------------
// Сцена навколо артефакта раніше жила в CSS: пласкі шари неба, диск
// підлоги в perspective() і два прямокутники-колони. Вони ніколи не
// могли зійтися з кристалом, бо кристал живе в іншій системі координат
// — у WebGL-камері. Тут та сама сцена перенесена в 3D і стоїть на тій
// самій площині, що й артефакт (CRYSTAL_GROUND_BASELINE).
//
// Модуль навмисно чистий: кадрування камери, палітра й вартість оточення —
// це арифметика, яку можна перевірити тестом без WebGL. Геометрію будує
// `portalCave.ts`, і саме тому THREE тут більше не імпортується.
// ============================================================
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import {
  CAVE_DRUSE_CLUSTERS,
  buildPortalCaveDruseGeometry,
  buildPortalCaveFloorGeometry,
  buildPortalCaveOculusGeometry,
  buildPortalCaveShellGeometry,
} from './portalCave';


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
 * (так само один) + арки + зорі/туманність + чотири декор-проходи: ґрунт,
 * колонада, кристальні маяки та небесні дуги.
 */
export const PORTAL_ENVIRONMENT_DRAW_CALLS = 4;

/**
 * СТЕЛЯ трикутників оточення, а не точне число.
 *
 * Було 22 992 плюс декор — прибите значення, яке звіряли рівністю. Печера
 * (ADR-0117) так не міряється: кількість кристалів у кущі друзи залежить
 * від насіння пари, тож точного числа, спільного на всіх, не існує.
 *
 * Тому тут стеля, і тест перевіряє САМЕ ЇЇ: реальна вартість на кількох
 * насіннях і всіх профілях якості мусить лишатись під нею. Рівність,
 * якої не буває, замінили на межу, яка буває, — і межа стереже те саме:
 * сцена не має права тихо роздутись.
 */
export const PORTAL_ENVIRONMENT_TRIANGLES = 6_000;

/**
 * Реальна вартість оточення — джерело правди для стелі вище.
 *
 * Будує ті самі чотири геометрії, які малює `PortalEnvironment`, і рахує
 * їхні трикутники. Дорого, і саме тому це функція для тесту, а не для
 * рантайму.
 */
export function measurePortalEnvironmentTriangles(
  seed = 1,
  quality: 'high' | 'balanced' | 'low' | 'fallback' = 'high',
): number {
  const pieces = [
    buildPortalCaveShellGeometry(seed),
    buildPortalCaveFloorGeometry(seed),
    buildPortalCaveOculusGeometry(seed),
    buildPortalCaveDruseGeometry(seed, CAVE_DRUSE_CLUSTERS[quality]),
  ];
  let total = 0;
  for (const piece of pieces) {
    total += piece.getAttribute('position').count / 3;
    piece.dispose();
  }
  return total;
}

const FOV = 42;
const DEG = Math.PI / 180;

/**
 * Висота кадру: скільки сцени камера тримає в полі зору.
 *
 * **Кадр більше НЕ йде за кристалом пропорційно, і в цьому вся зміна.**
 *
 * Було: `height = кристал / частка`, де частка повзла з 0.62 до 0.76. Це
 * означає, що відстань камери масштабувалась разом із кристалом, тож
 * той завжди займав ту саму частку екрана. Виміряно справжньою функцією
 * на справжній геометрії, частка ВИСОТИ ЕКРАНА на телефоні:
 *
 *   1 рік 68.6% · 3 роки 68.9% · 5 років 69.5% · 10 років 69.6%
 *
 * Тобто **за десять років кристал більшав на екрані на один пункт**.
 * Власник сказав це прямо: «кристал на три роки відносин має виглядати
 * як кристал на три роки, зараз він занадто великий». Рушій ростив його
 * у 3.4 раза за 24 роки; камера віддавала назад усе.
 *
 * Стало: висота кадру **афінна** — велика стала плюс невелика частка
 * самого кристала. Тоді частка екрана справді росте з віком:
 *
 *   1 рік ≈40% · 3 роки ≈50% · 10 років ≈62% · 25 років ≈75%
 *
 * Чому не проста стала висота кадру, хоча вона дала б найчистіший ріст:
 * її вже пробували й відкинули — трирічна пара займала 23% екрана й
 * губилась у порожній залі. Стала складова тримає молодий кристал
 * читабельним, змінна лишає ріст видимим. Обидві межі названі числом, а
 * не смаком.
 */
const FRAME_BASE_HEIGHT = 0.985;
const FRAME_PER_ARTIFACT = 1.079;

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

/**
 * The bearing and rise a camera actually stands at — the inverse of the two
 * angular halves of `portalCameraView`.
 *
 * The director needs this to notice what the couple's finger did: orbit
 * controls move the camera themselves, and the only way to keep a hand turn
 * instead of overwriting it is to read back the difference between where the
 * camera is and where the director last put it (ADR-0022).
 *
 * Distance is not returned because nothing changes it — orbiting is rotation
 * and zoom is disabled — so reading it back would only feed rounding error
 * into a value the atlas owns.
 */
export function portalCameraTurn(
  position: readonly [number, number, number],
  target: readonly [number, number, number],
): { azimuth: number; elevation: number } {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const distance = Math.hypot(dx, dy, dz);
  return {
    azimuth: Math.atan2(dx, dz),
    elevation: distance > 1e-9 ? dy / distance : 0,
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

  // Афінна, а не пропорційна: див. `FRAME_BASE_HEIGHT`. Саме через це
  // кристал на екрані росте разом із парою, а не лишається одного розміру.
  const height = FRAME_BASE_HEIGHT + FRAME_PER_ARTIFACT * safeHeight;
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

/*
 * ТУТ ЖИВ ХРАМ — І ЙОГО БІЛЬШЕ НЕМАЄ.
 * ------------------------------------------------------------
 * Дев'ятсот сімдесят п'ять рядків: подіум, ритуальна плита з тріщинами,
 * дванадцять рун, інкрустація, вісімнадцять колон із розкладкою й
 * арками, підлога храму, чаші вогню на колонах і зоряне небо. Плюс п'ять
 * сусідніх файлів — `portalColonnadeMesh`, `portalRelicPedestal`,
 * `portalPlatformMesh`, `portalSceneDecor`, `platformTexture` — і їхні
 * тести.
 *
 * Світом кристала стала печера (ADR-0116, ADR-0117). Жодне з цього більше
 * не малюється, а мертвий код із тестами гірший за відсутній: тести
 * стережуть форму, якої ніхто не бачить, і кожен, хто читає цей файл,
 * витрачає час на храм, якого немає.
 *
 * Повертається одним `git revert`, якщо власник передумає.
 */


// ── Палітра ─────────────────────────────────────────────────

export interface PortalPalette {
  /** Імла зали. Не небо: печера — це замкнений простір. */
  fog: string;
  /* ── Печера (ADR-0117) ────────────────────────────────────
     Камінь, підлога, друза по стінах і розлом у склепінні. Кожна роль є
     в обох порах доби, бо тема міняє світло, а не продукт.

     У печері немає полудня, тож світла тема — не «той самий храм при
     сонці», а та сама печера під ДЕННИМ ПРОМЕНЕМ крізь розлом. Звідси
     дві різниці, які не виводяться множенням нічних чисел: удень
     світиться розлом, а не друза, і туман удень — кам'яна імла. */
  /** Камінь стін і склепіння. */
  caveRock: string;
  /** Підлога зали — темніша за стіни: на неї падає найменше з розлому. */
  caveFloor: string;
  /** Кварц, що росте зі стін. Той самий мінерал, що артефакт. */
  caveDruse: string;
  /** Скільки друза світиться сама. Уночі — джерело, удень — камінь. */
  caveDruseEmissive: number;
  /** Що видно крізь розлом у склепінні. */
  oculus: string;
  /** Сила світла, яке падає з розлому вниз. */
  oculusIntensity: number;
  /* ── Світло сцени ─────────────────────────────────────────
     Позиції ключа й заливки спільні на обидві пори доби
     (`PORTAL_KEY_LIGHT`, `PORTAL_RIM_LIGHT`): §10 каже, звідки падає
     ключ, і це композиція сцени, а не властивість пори доби. */
  ambient: number;
  hemisphere: number;
  keyIntensity: number;
  keyColour: string;
  rimIntensity: number;
  rimColour: string;
  /**
   * Слабке світло від кореня артефакта (§10 брифу).
   *
   * Називалось `daisLight`, поки під кристалом стояв подіум. Подіуму
   * немає (ADR-0117), а світло лишилось — воно й було не про подіум, а
   * про те, що жила світиться знизу.
   */
  rootLight: string;
  rootLightIntensity: number;
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
};

/** Заливка навпроти ключа. Не другий ключ. */
export const PORTAL_RIM_LIGHT = {
  position: [3, 3.2, -3.2] as const,
};

/**
 * Дві пори доби одного місця.
 *
 * Раніше портал був нічною сценою в обох темах, а світла лише теплішою.
 * Власник попросив інше: «нехай це буде чистий грецький храм з блакитним
 * небом». Тож світла тема — це полудень у тому самому храмі, а не
 * підсвітлена ніч: небо блакитне, мармур білий, зорі згасли, вогонь у
 * чашах лишився, але при сонці його майже не видно.
 *
 * Що НЕ змінюється — §10 брифу. Ключ теплий і згори-ліворуч, заливка
 * прохолодна й навпроти, ключ домінує над усією заливкою разом уздовж
 * усього кристала, жодне жовте джерело до артефакта не дістає.
 * `portalLighting.test.ts` перевіряє це для обох пор доби окремо.
 *
 * Ті самі ролі, що й у --portal-* токенах CSS, тільки для WebGL.
 */
export const PORTAL_PALETTES: Record<'light' | 'dark', PortalPalette> = {
  // ── Печера під денним променем ────────────────────────────
  light: {
    /*
     * Туман — КАМ'ЯНА ІМЛА, а не небо.
     *
     * Тут стояв `#cfe3f4` із поясненням «удалині храм має танути в небі,
     * і це те, що робить сцену відкритою, а не залою». Відколи сцена
     * САМЕ ЗАЛА, небесний туман працює точно навпаки: він вимиває дальню
     * стіну до кольору неба, і печера читається відкритим простором.
     */
    fog: '#9d94a8',
    // Камінь удень видно, але це камінь у печері: сірий із теплим
    // підпалом від променя, а не білий мармур.
    caveRock: '#8a8090',
    caveFloor: '#736a7e',
    caveDruse: '#c2a9e6',
    // Удень друза не світиться: при денному промені світний кристал на
    // стіні читається лампою, а не мінералом.
    caveDruseEmissive: 0.2,
    oculus: '#e8f1fb',
    oculusIntensity: 2.1,
    // Денна заливка вчетверо сильніша за нічну. Ключ піднятий разом із
    // нею: §10 вимагає відношення, а не абсолютного числа.
    ambient: 0.42,
    hemisphere: 0.55,
    keyIntensity: 3.4,
    /** Сонце: тепле біле. Не жовте — §10. */
    keyColour: '#fff1ec',
    rimIntensity: 0.3,
    /** Відбите небо: прохолодне блакитне, навпроти сонця. */
    rimColour: '#cfe0ff',
    rootLight: '#dfd6ee',
    // Світло від кореня, а не прожектор перед кристалом. Було 2.6 —
    // виміряно як найсильніше джерело сцени, сильніше за ключ
    // удвічі-втричі там, де кристал найширший.
    rootLightIntensity: 0.5,
  },
  // ── Печера при світлі жеоди ───────────────────────────────
  dark: {
    fog: '#221a33',
    /*
     * ЧОМУ КАМІНЬ СВІТЛІШИЙ, НІЖ «ніч у печері».
     *
     * Перша пара була `#241d33` / `#1a1526`, і кадр показав чорноту:
     * базовий колір множиться на яскравість грані (0.4–1.0) і ще раз
     * гаситься туманом, який на дальній стіні дає близько третини. Три
     * множники поспіль — і темний камінь стає нулем.
     */
    caveRock: '#4b3f6b',
    caveFloor: '#382f52',
    caveDruse: '#a670e8',
    /*
     * 1.4 → 0.55. Друза світилась як ЛАМПА: при такій емісії кристал на
     * стіні яскравіший за камінь навколо вчетверо й перестає читатись
     * мінералом. Уночі в печері має світитись артефакт; друза лише ловить
     * його світло й трохи тримає власне, щоб не зникнути в тіні.
     */
    caveDruseEmissive: 0.55,
    // Нічне небо в розломі: майже темрява, але не чорнота — інакше
    // розлом читається дірою в моделі.
    oculus: '#2a2444',
    oculusIntensity: 0.32,
    ambient: 0.1,
    hemisphere: 0.24,
    keyIntensity: 1.9,
    /** Теплий рожево-білий. Не жовтий і не чисто білий. */
    keyColour: '#ffeef2',
    rimIntensity: 0.26,
    /** Прохолодний бузковий. */
    rimColour: '#cfc4f5',
    rootLight: '#b891dd',
    rootLightIntensity: 0.42,
  },
};
