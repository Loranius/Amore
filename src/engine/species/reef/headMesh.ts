// ============================================================
// Голова колонії — купол, а не куля.
// ------------------------------------------------------------
// Власник обрав форму: «одна велика колонія голова». Це тіло, з якого
// ростуть річні колонії, і воно ж тримає весь силует рифа.
//
// ЧОМУ НЕ ГЛАДКИЙ ПІВЕЛІПСОЇД. Гладка поверхня обертання читається
// пластиковою мискою за тією ж причиною, з якої гладка сфера читається
// кулькою: у неї немає жодного місця, де світло поводиться інакше. Живий
// кораловий масив нерівний — він росте шарами й обростає сам себе.
//
// Тому купол зміщується СІДЛОПОДІБНИМ шумом: сума кількох синусоїд по
// азимуту й висоті з насінням пари. Це не «випадковість заради
// випадковості» — кожна складова має свою роль, і вони названі нижче.
//
// Контракт меша тут свій, а не `meshes/types.ts`: той прив'язаний до
// скелетів-трубок старої моделі, яку ця робота заміщує. Форма даних
// дзеркалить кристалову (позиції, нормалі, індекси), щоб два види
// лишались однією архітектурою.
// ============================================================
import { round6, seededUnit } from './math';
import type { ReefHeadSize } from './colonyFormations';

export interface ReefMeshData {
  /** Плоский масив xyz. */
  positions: number[];
  /** Плоский масив нормалей, тієї самої довжини. */
  normals: number[];
  indices: number[];
  /**
   * Тон КОЖНОГО ТРИКУТНИКА — множник яскравості навколо 1.0.
   *
   * Необов'язковий навмисно: меш, який його не публікує (риба, дрібнота),
   * малюється рівно кольором свого матеріалу, як і досі. Це не «тихий
   * запас», а окремий канал: тіло, у якого є рельєф, має що сказати про
   * свою поверхню; у пласкої стрічки трави такого немає.
   *
   * Число, а не колір. Рушій не вирішує, ЯКИЙ це колір — він каже лише,
   * наскільки ця грань виступає з тіла; у колір це перекладає рендерер
   * (`reefGeometryOf`), де й живе решта матеріалу.
   */
  faceShade?: number[];
  /** Скільки трикутників у нижній кришці — вони дивляться в камінь. */
  baseCapTriangleCount: number;
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

/**
 * Скільки сегментів по колу й по висоті.
 *
 * **24×8 → 36×12 (ADR-0193), і це не «побільше красивостей».** Власник:
 * «риф виглядає грубо, як необтесане дерево з крутими геометричними
 * кутами полігонів». Число за цим таке: на куполі четвертого року
 * сусідні грані сходились під медіанним кутом **12.2°**, а найгостріші
 * ребра — під кутами, яких на живому масиві не буває.
 *
 * Стара примітка казала, що «24 — межа, за якою починає читатись
 * гранованість». Вона й читалась — просто виявилось, що читається вона
 * не як стиль, а як необтесаність. 36×12 зменшує грань удвічі за
 * площею й кут між сусідами до ~7°.
 *
 * Ціна названа й сплачена не з повітря: купол і камінь разом дорожчають
 * приблизно на 1 400 трикутників, і рівно на цю суму (і ще на дві
 * тисячі понад неї) здешевлене піщане дно, деталь якого лежала за
 * серпанком і не бачив її ніхто.
 */
const AZIMUTH_SEGMENTS = 36;
const HEIGHT_RINGS = 12;

/**
 * Три складові нерівності, і кожна робить своє.
 *
 * `LOBES` — великі частки, з яких масив і складається: корал росте не
 * рівномірно, а долями. `RIPPLE` — дрібніша хвиля поверх них, щоб частка
 * не читалась однією гладкою опуклістю. `SETTLE` — просідання до низу:
 * основа масиву ширша й пласкіша за верх, бо там він старший.
 */
const LOBE_COUNT = 5;
const LOBE_DEPTH = 0.13;
/*
 * Періодів хвилі менше, ніж дозволяє сітка, і це навмисно.
 *
 * Купол має 24 сегменти по колу, тож хвиля на 11 періодів лягала б по
 * 2.2 вибірки на період — на екрані це не хвиля, а вершини, що
 * стрибають через одну, і читається воно як помилка гранування, а не
 * як поверхня. Сім періодів дають 3.4 вибірки — хвилю видно хвилею.
 */
const RIPPLE_COUNT = 7;
const RIPPLE_DEPTH = 0.045;
const SETTLE = 0.08;

/**
 * НАСКІЛЬКИ ГРАНІ КУПОЛА РІЗНЯТЬСЯ ТОНОМ — і чому це число тут узагалі є.
 *
 * Власник сказав: «менш картонний, на фото видно трикутники на тілі,
 * звідки ростуть корали». Виміряно перед тим, як щось крутити
 * (`npm run live -- home --profile=500-530,330-560`, світла тема):
 * сусідні грані на голому боці купола різнились на **6% медіани, 10%
 * максимуму**. Правило `amore-crystal-look` зветься числом: нижче ~10%
 * тіло читається гладкою формою, хай яким правильним буде решта.
 *
 * Причина виміряна окремо, по самій геометрії: медіанний кут між
 * нормалями сусідніх граней — **12.2°**, і чистий ламберт дав би з нього
 * 12.7%. Тобто навіть БЕЗ жодного заповнювального світла форма не
 * дотягує до порога вдвічі, а розсіяне світло знімає ще половину.
 *
 * Звідси висновок, який кристал уже проходив: **світлом цього не
 * полагодити** — ×4 на ключове світло свого часу зрушило розділення
 * граней рівно ні на скільки. Поверхню треба МАЛЮВАТИ, як малюють її
 * референси рифа (ADR-0182 §2: «референс не освітлюють, його малюють»).
 *
 * Дві складові, і кожна робить своє:
 * - `RELIEF` — грань, що виступає з ідеального купола, світліша; западина
 *   темніша. Тон іде за формою, а не сиплеться на неї: це той самий
 *   принцип «колір заробляється», що й у кристала.
 * - `MOTTLE` — дрібна плямистість, не прив'язана до форми. Без неї на
 *   рівних ділянках сусіди знову однакові, а саме рівні ділянки й
 *   читались картоном.
 */
const FACE_RELIEF = 1.9;
const FACE_MOTTLE = 0.5;

/**
 * Пляма — не одна грань, а КІЛЬКА, і це різниця між обростанням і шумом.
 *
 * Тон, кинутий незалежно на кожну грань, дає рівномірну крупу: сусіди
 * різняться завжди й однаково, тобто поверхня читається шумом, а не
 * тілом. Обростання на живому кораловому масиві йде латками — кілька
 * граней однакові, а через дві-три все інше.
 *
 * Латка — дві грані по колу на одне кільце по висоті. Тобто межі латок
 * падають рівно на ребра, ніколи не перетинаючи грань. Це той самий
 * закон, що й у кристала: візерунок, який перетинає ребро, каже оку, що
 * дві площини — одна поверхня.
 *
 * **1 → 2 разом зі згладженням (ADR-0193).** Сітка стала вдвічі
 * густішою, і латка в одну грань разом із нею здрібніла до крупи:
 * плямистість читалась шумом, а не обростанням. Дві грані на латку
 * повертають плямі той самий розмір НА ЕКРАНІ, який вона мала до
 * згладження, — тобто число змінене, щоб картинка лишилась тією самою.
 */
const PATCH_SEGMENTS = 2;

/** Наскільки радіус у точці відходить від ідеального купола. */
function surfaceNoise(seed: number, azimuth: number, band: number): number {
  const lobePhase = seededUnit(seed, 'reef:head:lobe') * Math.PI * 2;
  const ripplePhase = seededUnit(seed, 'reef:head:ripple') * Math.PI * 2;
  const lobes = Math.sin(azimuth * LOBE_COUNT + lobePhase) * LOBE_DEPTH;
  // Хвиля ЗАКРУЧУЄТЬСЯ з висотою (`band * 4`), а частки — ні. Через це
  // візерунок на кожному рівні свій, і купол не читається профілем,
  // протягнутим угору. Тест на це дивиться порівнянням кілець.
  const ripple = Math.sin(azimuth * RIPPLE_COUNT + ripplePhase + band * 4) * RIPPLE_DEPTH;
  /*
   * Пояс: де нерівність узагалі має право бути.
   *
   * Біля основи її з'їдає камінь, на маківці вона мусить зійти на
   * НУЛЬ — і не абияк, а швидше, ніж купол звужується. Перша редакція
   * брала саму лише `sin(band * π)`, і на верхньому кільці лишалось
   * 0.38 пояса: горб на ньому підіймався на 4.6% ВИЩЕ за маківку.
   * Купол від того вивертався — корона сідала в ямку, а нормаль у ній
   * усе одно дивилась строго вгору. Множник `(1 - band)` гасить пояс
   * квадратично, `2` повертає середині купола її колишню силу.
   */
  const belt = Math.sin(band * Math.PI) * (1 - band) * 2;
  return 1 + (lobes + ripple) * belt - SETTLE * (1 - band);
}

/**
 * Справжня точка поверхні купола — та, на якій стоїть меш.
 *
 * ЧОМУ ЦЕ ОКРЕМА ФУНКЦІЯ. Купол зміщений частками й хвилею до ±30%
 * радіуса. Усе, що на ньому сидить, порахувавши ІДЕАЛЬНИЙ еліпсоїд,
 * половину часу висить у воді, а другу половину стирчить із каменю.
 * На знімку це видно одразу: дрібнота, розкладена по ідеальній
 * поверхні, плавала над куполом.
 *
 * Тому поверхня має рівно одне визначення, і воно тут — і для меша, і
 * для всього, що на нього сідає.
 *
 * @param azimuth радіани по колу
 * @param band 0 біля основи, 1 на маківці
 */
export function reefHeadSurfacePoint(
  head: ReefHeadSize,
  seed: number,
  azimuth: number,
  band: number,
): { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } } {
  const radius = Math.max(1e-4, head.radius);
  const rise = Math.max(1e-4, head.rise);
  const phi = band * (Math.PI / 2);
  const noise = surfaceNoise(seed, azimuth, band);
  const ring = Math.cos(phi) * noise;
  const x = radius * ring * Math.sin(azimuth);
  const z = radius * ring * Math.cos(azimuth);
  const y = rise * Math.sin(phi) * noise;

  const nx = x / (radius * radius);
  const ny = y / (rise * rise);
  const nz = z / (radius * radius);
  const length = Math.max(1e-9, Math.hypot(nx, ny, nz));

  return {
    point: { x: round6(x), y: round6(y), z: round6(z) },
    normal: { x: round6(nx / length), y: round6(ny / length), z: round6(nz / length) },
  };
}

/**
 * Купол голови як замкнене тіло.
 *
 * Замкнене, а не відкрита чаша: нижня кришка потрібна, бо камера рифа
 * може опускатись під рівень основи, і відкритий низ показав би
 * зсередини порожнечу. Кришка рахується окремо — рендерер має знати, які
 * трикутники дивляться в камінь.
 */
export function buildReefHeadMesh(head: ReefHeadSize, seed: number): ReefMeshData {
  const radius = Math.max(1e-4, head.radius);
  const rise = Math.max(1e-4, head.rise);

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  /* Рельєф кожної вершини — відхилення від ідеального купола. Грань бере
     середнє своїх трьох, тобто тон іде за формою, а не за вершиною. */
  const relief: number[] = [];

  const pushVertex = (azimuth: number, band: number): void => {
    const phi = band * (Math.PI / 2);
    const noise = surfaceNoise(seed, azimuth, band);
    relief.push(noise - 1);
    const ring = Math.cos(phi) * noise;
    const x = radius * ring * Math.sin(azimuth);
    const z = radius * ring * Math.cos(azimuth);
    const y = rise * Math.sin(phi) * noise;
    positions.push(round6(x), round6(y), round6(z));

    // Нормаль з градієнта еліпсоїда, як і у прив'язці колоній: купол
    // приплюснутий, і сферична нормаль тут збрехала б на ту саму
    // різницю між «росте вгору» і «росте вбік».
    const nx = x / (radius * radius);
    const ny = y / (rise * rise);
    const nz = z / (radius * radius);
    const length = Math.max(1e-9, Math.hypot(nx, ny, nz));
    normals.push(round6(nx / length), round6(ny / length), round6(nz / length));
  };

  /*
   * Кільця від основи до ПЕРЕДОСТАННЬОЇ смуги, а маківка — одна вершина.
   *
   * Перша редакція вела кільця до самої маківки, де `cos(phi)` дорівнює
   * нулю: двадцять чотири вершини сходились у ту саму точку, лишаючись
   * різними індексами. Тіло від того не замикалось — власний тест
   * знайшов рівно 24 ребра з одним сусідом, тобто дірку на вершині, а
   * трикутники між останніми двома кільцями були виродженими.
   */
  const APEX_BAND = (HEIGHT_RINGS - 1) / HEIGHT_RINGS;
  for (let ring = 0; ring < HEIGHT_RINGS; ring += 1) {
    const band = (ring / (HEIGHT_RINGS - 1)) * APEX_BAND;
    for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
      pushVertex((segment / AZIMUTH_SEGMENTS) * Math.PI * 2, band);
    }
  }

  /*
   * Тон грані рахується ТУТ, де ще відомі її кільце й сегмент: латка
   * визначена саме ними, а з голих індексів її довелось би відновлювати
   * зворотним рахунком — тобто вдруге знати те, що вже знаєш.
   */
  const faceShade: number[] = [];
  const patchTone = (ring: number, segment: number): number => seededUnit(
    seed,
    `reef:head:patch:${ring}:${Math.floor(segment / PATCH_SEGMENTS)}`,
  ) - 0.5;
  const pushFaceShade = (ring: number, segment: number, corners: readonly number[]): void => {
    const mean = corners.reduce((sum, at) => sum + (relief[at] ?? 0), 0) / corners.length;
    faceShade.push(round6(1 + mean * FACE_RELIEF + patchTone(ring, segment) * FACE_MOTTLE));
  };

  for (let ring = 0; ring < HEIGHT_RINGS - 1; ring += 1) {
    const low = ring * AZIMUTH_SEGMENTS;
    const high = (ring + 1) * AZIMUTH_SEGMENTS;
    for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
      const next = (segment + 1) % AZIMUTH_SEGMENTS;
      indices.push(low + segment, low + next, high + segment);
      indices.push(low + next, high + next, high + segment);
      pushFaceShade(ring, segment, [low + segment, low + next, high + segment]);
      pushFaceShade(ring, segment, [low + next, high + next, high + segment]);
    }
  }

  // Маківка: одна вершина й віяло на верхнє кільце.
  const apex = positions.length / 3;
  const apexNoise = surfaceNoise(seed, 0, 1);
  positions.push(0, round6(rise * apexNoise), 0);
  normals.push(0, 1, 0);
  relief.push(apexNoise - 1);
  const topRing = (HEIGHT_RINGS - 1) * AZIMUTH_SEGMENTS;
  for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
    const next = (segment + 1) % AZIMUTH_SEGMENTS;
    indices.push(topRing + segment, topRing + next, apex);
    pushFaceShade(HEIGHT_RINGS - 1, segment, [topRing + segment, topRing + next, apex]);
  }

  // Нижня кришка: центр основи плюс віяло на перше кільце.
  const capCenter = positions.length / 3;
  positions.push(0, 0, 0);
  normals.push(0, -1, 0);
  relief.push(0);
  for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
    const next = (segment + 1) % AZIMUTH_SEGMENTS;
    indices.push(capCenter, next, segment);
    // Кришка дивиться в камінь: тон їй ні до чого, але масив мусить
    // лишитись однієї довжини з трикутниками — інакше рендерер поїде.
    faceShade.push(1);
  }
  const baseCapTriangleCount = AZIMUTH_SEGMENTS;

  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let at = 0; at < positions.length; at += 3) {
    minX = Math.min(minX, positions[at]!); maxX = Math.max(maxX, positions[at]!);
    minY = Math.min(minY, positions[at + 1]!); maxY = Math.max(maxY, positions[at + 1]!);
    minZ = Math.min(minZ, positions[at + 2]!); maxZ = Math.max(maxZ, positions[at + 2]!);
  }

  return {
    positions,
    normals,
    indices,
    faceShade,
    baseCapTriangleCount,
    bounds: {
      min: { x: round6(minX), y: round6(minY), z: round6(minZ) },
      max: { x: round6(maxX), y: round6(maxY), z: round6(maxZ) },
    },
  };
}
