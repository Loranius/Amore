import { round6, seededUnit } from '../growth/math';
import { childFootWidth, monarchFootWidth } from '../species/crystal/growthModel';
import type { GrowthBody } from '../growth';
import { rebuildCrystalMeshNormals } from './mesh';
import { intersectHalfSpaces, polytopeTolerance, type CrystalPolytope } from './polytope';
import type {
  CrystalBodyProfile,
  CrystalFacePlane,
  CrystalMeshBounds,
  CrystalMeshData,
  CrystalProfileRow,
} from './types';

/**
 * The quartz vein the druse grew out of.
 *
 * ADR-0003 made every crystal free-standing with its base sunk below y=0 and
 * its cap intact rather than trimmed. That is only sound while something
 * actually occludes the underside — this is that something. It is published as
 * geometry rather than left to the scene so it always scales with the druse it
 * has to cover, and so the artifact is self-contained.
 *
 * What it looks like has changed twice. It was a mound of earth, then a round
 * cut plate; visual review (2026-08-03) rejected both for the same reason — a
 * near-circular disc under the crystals reads as a grey pad somebody set them
 * on. It is now a vein: a mineral seam opened in the platform's stone, wide at
 * a node under the monarch and narrowing along branches that run out to the
 * year crystals.
 *
 * The surrounding stone is no longer this mesh's job at all. The portal's dais
 * already publishes a continuous stone top; the vein is only the quartz, which
 * is what makes two material zones out of what used to be one grey plate.
 */
export const CRYSTAL_SUBSTRATE_BODY_ID = 'crystal:substrate';

/**
 * Segments around the vein outline.
 *
 * The outline is no longer a circle, so this is sampling resolution for an
 * irregular curve rather than the facet count of a disc. Too few and a branch
 * comes out as a triangular spike; this is fine enough that it reads as a
 * tapering finger.
 */
const OUTLINE_SEGMENTS = 96;

/**
 * Rings across the top face, as a blend from the vein's outline in toward the
 * monarch's own footprint.
 *
 * A blend, not a scale — and that distinction is what makes the fissure
 * possible at all. Scaling the outline and then clamping the result to the
 * monarch's radius collapsed every interior ring onto one small circle: the top
 * face was a lip and a hole with nothing in between, so there was no vertex
 * anywhere that a trough could lower. The seam could only ever be flat.
 *
 * Blending keeps every ring the vein's own shape at its own distance in, so the
 * face has interior resolution everywhere and the floor can actually fall. The
 * innermost still lands on the monarch's footprint, which is what lets the face
 * close under her without the fan of large sectors review rejected as a
 * pinwheel.
 */
/*
 * Перше кільце — 0.92, а не 0.84, відколи в жеоди є стінка.
 *
 * Стінка живе на смузі `radial > GEODE_WALL_START` (0.84), а зовнішнє
 * кільце стоїть на `radial = 1`. Двох кілець вистачає, щоб стінка
 * ІСНУВАЛА, але не щоб її було видно такою, як вона порахована: між
 * ними натягується прямий скат, і згладжування підйому (`3-2t`) разом
 * із розломами зникає в одному трикутнику. Третє кільце посередині
 * смуги коштує 96 вершин і повертає стінці її форму.
 */
const TOP_RINGS: readonly number[] = [0.92, 0.84, 0.68, 0.52, 0.37, 0.23, 0.11];

/** How much wider the buried floor is than the outline at the surface. */
const FLOOR_FLARE = 1.06;

/**
 * How deep the fissure runs between the crystals, per unit of the node radius.
 *
 * The seam was a flat top and read as a pad somebody set the crystals on. A
 * crack is not flat: it stands proud at its lip and falls into shadow between,
 * and that shadow is what makes it look like something the crystals came *out
 * of* rather than something they stand *on*.
 *
 * Bounded by the vein's own floor in `buildCrystalSubstrateMesh`, so however
 * deep this asks for, the trough can never cut through the underside and open
 * the solid it is part of.
 */
const TROUGH_DEPTH = 1.3;

/**
 * How much of a crystal's own cover stays pinned at the lip before the floor
 * starts to fall, and how much further it takes to reach the bottom.
 *
 * The first number is ADR-0003 in this shape: a base cap sits below y=0, so the
 * surface above it may not sink. It can sit just inside one cover because the
 * cover already carries `BASE_MARGIN` — the cap itself reaches only `1/1.12` of
 * it — and the margin is what the rim spends.
 *
 * The second is how far past the rim the floor takes to reach the bottom. It
 * was a cover and a half, which left the fissure a sliver: nine percent of the
 * top face fell below the platform and the rest was lip, so the seam still read
 * flat. Shorter, and the crack is a crack.
 */
const RIM_HOLD = 0.94;
const TROUGH_FALL = 0.75;

/**
 * Стінка жеоди — порода, що встає по периметру.
 * ------------------------------------------------------------
 * Власник назвав умову: «кристал росте з жеоди». Шов, тріщина й губа
 * тут уже були, і вони справді читаються як розколотий камінь — але
 * камінь ПЛАСКИЙ. Жеода — порожнина: у неї є стінка, і кристали стоять
 * усередині неї, а не на ній.
 *
 * Губа, яка вже існує, стоїть навколо КОЖНОГО кристала (`RIM_HOLD`), а
 * зовнішній край натомість падає в тріщину. Тобто рельєф був
 * протилежний до потрібного, і стінку не можна було дістати
 * налаштуванням наявних чисел — її треба додати.
 *
 * Висота — частка довжини монарха, як і `VEIN_PROUD_OF_MONARCH_HEIGHT`,
 * і з тієї ж причини: прив'язка до товщини робила б стінку функцією
 * того, наскільки монарх гладкий, а не наскільки він великий.
 *
 * **0.15 → 0.085, і міряти це треба ДІТЬМИ, а не монархом.** Проти
 * монарха 15% звучали скромно; проти дітей це виявилось 60–76% їхньої
 * висоти — тобто кільце років, яке за ADR-0058 має читатись літописом,
 * стояло похованим на три чверті. Тепер ховається 43%.
 *
 * Нижче не пускає вимір, а не смак. Коли стінка підходить до губи
 * ближче ніж приблизно 1.85, розломи перестають читатись: їхнє дно
 * підпирає губа, і жеода змикається — `substrate.test.ts` ловить це
 * як «стінка зімкнена: жеода стала горщиком». Виміряна пара
 * 0.045/0.075 дає відношення 1.67 і вже падає.
 */
const GEODE_WALL_HEIGHT = 0.026;

/**
 * КОМІР ЖЕОДИ — порода, що встає ЗА колонією, а не між кристалами.
 * ------------------------------------------------------------
 * Стінка вище (`GEODE_WALL_HEIGHT`) тричі йшла вниз — 0.15 → 0.085 →
 * 0.026 — і щоразу з тієї самої причини: вона стоїть НА тому самому
 * контурі, на якому стоять діти, тож будь-яка помітна висота ховала
 * річне кільце, яке за ADR-0058 має читатись літописом. Тобто задача
 * була нерозв'язна в тому місці, де її розв'язували.
 *
 * Еталон (ADR-0114) показав, де вона розв'язна. У справжній жеоді порода
 * встає ЗА друзою: дрібні кристали стоять усередині порожнини, а стінка
 * — по краю конкреції, утричі далі від осі, ніж сам монарх. Виміряно:
 * еталон дає `rockSpread` 3.02 і `rockRise` 0.335, наша підкладка — 2.11
 * і 0.168, а рваність вінця 0.013 проти 0.155, тобто камінь лежить
 * ПЛАСКО.
 *
 * Тому комір — окреме кільце ЗОВНІ контуру. Шов, губа, тріщина й
 * ADR-0003 лишаються тим, чим були: комір нічого з них не торкається,
 * бо починається там, де вони кінчаються.
 */
const GEODE_COLLAR_REACH = 1.22;
/**
 * Куди сягає ПІДОШВА купи, коли гребінь стоїть на `GEODE_COLLAR_REACH`.
 *
 * Різниця між цими двома числами і є об'єм. При рівних (як було) зовнішня
 * стінка йде прямовисно, і камінь читається парканом навколо кристала, а
 * не купою, з якої той росте.
 *
 * 1.62 проти 1.22 — укіс близько 37°, тобто кут природного укосу битого
 * каменю. Крутіше — знову стінка, положистіше — розповзається в млинець.
 */
const GEODE_SKIRT_REACH = 1.62;
/**
 * Куди сягає САМА КУПА разом із камінням на ній.
 *
 * Дорівнює підошві укосу, і це не тавтологія, а межа: камінь лежить НА
 * купі й не має права робити її ширшою. ADR-0061 звузив підкладку
 * навмисно, а кадр порталу масштабується коробкою всіх мешів — тож
 * підкладка, що потовщала на три відсотки, відсуває камеру й крадає в
 * пари екран. Виміряно на першій редакції: чотирнадцятирічна пара
 * діставала 55.8% висоти замість 57.4%, і `кристал на екрані росте
 * разом із парою` це впіймав.
 *
 * Окремим іменем, а не `GEODE_SKIRT_REACH` на місці виклику: це різні
 * питання про одне число. Одне — куди йде кільце укосу; друге — куди не
 * можна каменю. Якщо колись перше зрушить, друге має зрушити свідомо.
 */
const GEODE_HEAP_REACH = GEODE_SKIRT_REACH;
/** Скільки точок має хвиля підошви. Просте й ІНШЕ, ніж у гребеня. */
const GEODE_SKIRT_POINTS = 7;
/** Наскільки підошва може підбиратись назад до гребеня. */
const GEODE_SKIRT_RAGGED = 0.55;
/**
 * Висота гребеня коміра, частка довжини монарха.
 *
 * Проти дітей це вже не питання: гребінь стоїть за ними. Проти монарха
 * 0.2 дає виміряні `rockRise` близько третини його висоти — рівно те,
 * що оголошує еталон (`GEODE_WALL_SHARE = 0.34`).
 */
const GEODE_COLLAR_HEIGHT = 0.2;
/**
 * Наскільки рваний гребінь: найнижча його точка між розломами стоїть на
 * цю частку нижче найвищої.
 *
 * Без цього числа порода з рівним верхом читається ЧАШЕЮ — посудиною, у
 * яку кристал поставили, — і жоден інший розмір цього не рятує
 * (`amore-crystal-look`: гладка суцільна поверхня під кристалом
 * читається п'єдесталом, хай як її формувати).
 */
const GEODE_COLLAR_RAGGED = 0.32;
/** Скільки контрольних точок має рваність. Просте число, як і в контуру. */
const GEODE_COLLAR_POINTS = 11;
/**
 * На скільки рівнів квантується гребінь коміра.
 *
 * Це і є різниця між купою брил і хвилястим коміром. Див. `geodeCollarAt`.
 */
const GEODE_COLLAR_LEVELS = 5;

/**
 * Стеля гребеня, виміряна НАЙВИЩОЮ ДИТИНОЮ, а не монархом.
 *
 * Тут стоїть вибір, який `sharedRoot.test.ts` уже назвав відкритим:
 * §4 хоче породу, ADR-0058 хоче, щоб кожен рік лишався видимим. Комір
 * зробив вибір можливим замість неможливого — він стоїть ЗА кільцем
 * років, а не на ньому, — але на молодій колонії монарх усе одно
 * набагато більший за свою першу дитину, і 0.2 його довжини сховали б
 * найсильніший рік на 90%. Виміряно: 0.897 при дозволених 0.5.
 *
 * Тому гребінь бере менше з двох. На дорослій колонії вирішує монарх, на
 * молодій — діти, і літопис лишається читабельним у обох.
 */
const GEODE_COLLAR_CHILD_SHARE = 0.45;
/*
 * 0.15 → 0.085 → 0.026, услід за губою й у тій самій пропорції: правило
 * «стінка вища за губу принаймні в 1.8 раза» тримає розломи читабельними,
 * і без нього жеода змикається в горщик. Тепер це низький комір породи
 * на самому стику, а не вал навколо кристала.
 */

/**
 * Звідки стінка починає підійматись, у частках відстані до контуру.
 *
 * 0.62 → 0.84, і це вимір, а не смак. При 0.62 стінка починалась там,
 * де ще йде тріщина, і **засипала її**: `trough` у
 * `substrate.test.ts` став нулем, тобто западини між кристалами не
 * лишилось зовсім. А тріщина — це і є порожнина, з якої росте кристал;
 * жеода без неї стає тарілкою з бортиком.
 *
 * Тепер стінка починається за тріщиною, майже біля контуру, і робить
 * рівно те, чим є, — обідок розколотої породи.
 */
const GEODE_WALL_START = 0.84;

/**
 * Наскільки глибокі розломи в стінці.
 *
 * Жеода — це камінь, який РОЗКОЛОЛИ, а не чаша. Суцільне кільце сховало б
 * дітей і замкнуло б кристал у відро. Розломи опускають стінку майже до
 * шва, і саме крізь них видно, що всередині.
 *
 * 0 лишило б стінку суцільною, 1 зрізало б її дощенту.
 */
const GEODE_BREAK_DEPTH = 0.78;

/** Скільки розломів. Просте число, щоб вони не збіглися з сегментами. */
const GEODE_BREAK_COUNT = 3;

/**
 * За скільки покривів кристала стінка набирає повну силу.
 *
 * Перша редакція вимагала цілого зайвого покриву (`clearance - 1`), і
 * стінки не з'являлось узагалі: на контурі, де вона й мусить стояти,
 * запас над покривом невеликий, тож згладжування гасило її до значень
 * НИЖЧЕ губи. Виміряно: `proud` дорівнював губі на всіх кільцях.
 */
const GEODE_CLEAR_RUN = 0.35;

/**
 * Vein thickness above the platform's stone, per unit of the node radius.
 *
 * Settled by looking at it. The platform used to bury the seam entirely, so
 * this number had never actually been seen: the earlier renders only *looked*
 * like they had a vein because the stone was bowing in the vein's own shape
 * over the top of it. Once the burial was fixed, twice this read as a plinth
 * with a hard shadowed wall — a step the crystals stand on, which is the shape
 * the vein exists to be rid of.
 *
 * At this height the wall is a hairline and what carries the seam is the
 * colour of its top face against the stone, which is what a mineral seam
 * actually is.
 *
 * **A share of the monarch's height, not of her radius.** It was
 * `nodeRadius × 0.14`, and the comment above it claimed "under one percent of
 * the monarch's height" — wrong by roughly six times; measured, it produced
 * 4.3–7.3%, which happened to be the brief's §4 band of 4–8%. Happened to be:
 * the node radius is 1.6 monarch radii, so the root's height was a function of
 * how *thick* she was. When the owner halved her diameter (2026-08-10) the root
 * halved with her and fell to 2.1–6.8%, out of the band from below.
 *
 * §4 states the requirement against her height, so that is what this is now
 * measured against, and the coupling to her girth is gone. Mid-band, so
 * neither end of the couple's range can leave it.
 */
const VEIN_PROUD_OF_MONARCH_HEIGHT = 0.012;
/*
 * 0.055 → 0.045 → 0.012, і останній крок скасував смугу §4 (ADR-0062).
 *
 * Власник тричі поспіль вів в один бік і врешті сказав прямо: «опусти
 * основу кристала… щоб основи кристала монарха і кристалів дітей
 * торкались текстури платформи». Смуга «корінь стоїть на 4–8% висоти
 * монарха над каменем» і ця вимога взаємно виключні: перша каже, що
 * корінь СТОЇТЬ над каменем, друга — що кристали з нього виходять.
 *
 * ADR-0003 при цьому цілий, і це не припущення: низ жили −0.1051 проти
 * найглибшої базової кришки −0.0818, запас 0.023. Жила перестала
 * стояти над каменем, але накривати кришки не перестала — вони й були
 * НИЖЧЕ нуля, а тіло жили нікуди не поділось.
 */
// 0.055 → 0.045 разом зі стінкою: губа — це рівень, на якому стоять
// кристали, тож опустити саму лише стінку означало б підняти жеоду
// відносно дітей іншим числом. Смуга §4 (4–8% висоти монарха) тримається:
// виміряно 4.6%, тобто ближче до низу смуги, але всередині.

/**
 * Air between a crystal's base and the edge of the quartz around it.
 *
 * This is the ADR-0003 margin in its new form. The old plate took a single
 * footprint radius over the whole druse; the vein takes it per crystal, which
 * is what lets the shape be local instead of circular — and small, because a
 * generous constant here is what turned the first vein into a pale splash
 * covering the platform.
 */
const BASE_MARGIN = 1.14;
/*
 * 1.12 → 1.14, і промах був старий, а не новий.
 *
 * `baseCoverOf` міряє кришку від `renderedRadius` — це радіус до ГРАНІ.
 * Готове тіло ширше: анізотропія архетипу додає до 1.18, власний
 * розхил ще 1.05, і жоден із цих множників сюди не доходить. Поки
 * товщина дітей бралась навмання, найтовстіший кінець смуги випадав
 * рідко, і 1.12 вистачало щоразу.
 *
 * Відколи повний рік сідає на цей кінець свідомо (ADR-0065), не
 * вистачило: виміряно, жила 0.130207 проти дитини 0.130301 — недобір
 * **0.0001**, тобто ADR-0003 падав на одну десятитисячну. Тест
 * `reaches past the outermost daughter` упіймав це першим прогоном.
 */

/**
 * How wide the quartz has to be to swallow one crystal's base cap.
 *
 * Not `radius × constant`. A crystal leaning θ above the platform casts its
 * base disc as an ellipse whose long half-axis is `radius / sin θ` — a year
 * crystal at 45° needs 1.41 times its own radius, and a vertical one needs
 * exactly its radius. A single constant has to be the worst case for everybody,
 * which makes the vein wider than any crystal on it actually requires.
 */
function baseCoverOf(body: GrowthBody): number {
  const upward = Math.max(0.35, Math.abs(body.direction.y));
  return Math.max(1e-4, (body.renderedRadius / upward) * BASE_MARGIN);
}

/**
 * The node under the monarch, per unit of the monarch's own radius.
 *
 * 1.6 → 1.25 (ADR-0061) → 1.18. Останній крок — наслідок того, що діти
 * підсунулись до монарха впритул: коротші гілки менше витягують контур,
 * і жила знову поповзла до диска (виміряно шир/вузьк 1.93 при потрібних
 * 2.0). Вузол задає саме ВУЗЬКИЙ напрямок, тож стиснути його — це
 * повернути форму, не розсуваючи підкладку.
 *
 * Підлога тверда: вузол мусить накривати базову кришку монарха, а вона
 * потребує 1.12 його радіуса (`BASE_MARGIN`). Тобто 1.18 лишає шість
 * відсотків запасу, і саме `covers every crystal footprint` не дасть
 * піти нижче непоміченим.
 */
const NODE_RADIUS = 1.18;

/** Short side fingers off the main branches. */
const SIDE_CRACK_MIN = 3;
const SIDE_CRACK_MAX = 4;

/**
 * How much of the outline the seeded edge noise may add.
 *
 * Additive and non-negative on purpose: the union below is the exact shape that
 * covers every base cap, so noise able to *subtract* could uncover one. This
 * can only ever make the vein rougher, never smaller.
 */
const EDGE_NOISE = 0.07;
/** Control points around the circle; prime so it never lines up with the segments. */
const EDGE_NOISE_POINTS = 13;

interface VeinCapsule {
  /** Far end, relative to the vein's centre. */
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

/**
 * Скільки гілка тягнеться за кристал, у частках відстані до нього.
 *
 * Це те, що лишає жилі неправильну форму: гілки виходять лише в
 * напрямках дітей, тож підкладка не диск. Без жодного вильоту вона
 * стала б рівно диском — тим, що власник відкинув («не круглої,
 * овальної чи радіально симетричної форми»).
 *
 * **Число впало з 0.6 до 0.18** разом із ADR-0061. Мітки карти більше
 * не подовжують гілку взагалі: `groundSpread` давав до +0.3 зверху, і
 * саме він робив підкладку ширшою за все, на чому вона стоїть. Пара,
 * яка багато подорожувала, отримувала не багатшу жеоду, а більшу
 * калюжу каменю.
 *
 * Межа знизу тверда й не залежить від цього числа: гілка мусить
 * накрити базову кришку дитини (`cover`), інакше падає ADR-0003.
 * Виліт — це те, що ПОНАД накриттям.
 */
const BRANCH_BASE_REACH = 0.18;

/** Smooth seeded noise around the circle, so the edge breaks without spiking. */
function edgeNoise(seed: number, angle: number): number {
  return smoothRing(seed, 'vein:edge', angle, EDGE_NOISE_POINTS);
}

/**
 * Гладкий насінний шум по колу — 0…1, без стрибка на замиканні.
 *
 * Винесено з `edgeNoise`, коли рваність вінця стала другим споживачем.
 * Мітка входить у насіння, тож два різні кільця шуму на тому самому
 * артефакті не збігаються — інакше вінець провалювався б рівно там, де
 * контур і так вужчий, і рваність читалася б як звуження.
 */
function smoothRing(seed: number, label: string, angle: number, points: number): number {
  const turns = angle / (Math.PI * 2);
  const scaled = (turns - Math.floor(turns)) * points;
  const index = Math.floor(scaled);
  const t = scaled - index;
  const left = seededUnit(seed, `${label}:${index % points}`);
  const right = seededUnit(seed, `${label}:${(index + 1) % points}`);
  const eased = t * t * (3 - 2 * t);
  return left + (right - left) * eased;
}

/**
 * The vein's skeleton, taken from where the crystals actually meet the stone.
 *
 * A capsule from the centre out to each crystal, plus short side fingers. The
 * union of capsules that all start at the centre is star-shaped about it, and
 * that is the property the whole mesh rests on: a star-shaped outline extrudes
 * into a closed solid with no self-intersection however irregular it gets, so
 * branches merge where they are close without any of the seams a set of
 * overlapping ribbons would leave.
 */
function veinCapsules(bodies: readonly GrowthBody[], artifactSeed: number): {
  capsules: VeinCapsule[];
  nodeRadius: number;
} {
  const monarch = bodies.reduce(
    (widest, body) => (body.renderedRadius > widest.renderedRadius ? body : widest),
    bodies[0]!,
  );
  const nodeRadius = Math.max(1e-4, monarch.renderedRadius * NODE_RADIUS);
  const capsules: VeinCapsule[] = [];

  for (const body of bodies) {
    if (body.id === monarch.id) continue;
    // Reach past the crystal, not merely up to it: the branch has to swallow
    // the whole base disc — that is ADR-0003, and it is the floor the vein
    // may never go below.
    const cover = baseCoverOf(body);
    capsules.push({ x: body.anchor.x, z: body.anchor.z, radius: cover });
    const distance = Math.hypot(body.anchor.x, body.anchor.z);
    if (distance <= 1e-6) continue;
    // The tip runs past the crystal and is thinner than the branch behind it,
    // so each direction tapers out into the stone rather than ending in a stub.
    const extension = cover + distance * BRANCH_BASE_REACH;
    const stretch = (distance + extension) / distance;
    capsules.push({
      x: body.anchor.x * stretch,
      z: body.anchor.z * stretch,
      radius: Math.max(1e-4, cover * 0.34),
    });
  }

  // Side fingers. Short and thin — the brief asks for a few restrained breaks,
  // not a starburst — and never longer than the branches they run beside.
  const reach = capsules.reduce(
    (longest, capsule) => Math.max(longest, Math.hypot(capsule.x, capsule.z)),
    nodeRadius,
  );
  const count = SIDE_CRACK_MIN + Math.floor(
    seededUnit(artifactSeed, 'vein:side-count') * (SIDE_CRACK_MAX - SIDE_CRACK_MIN + 1),
  );
  for (let index = 0; index < Math.min(SIDE_CRACK_MAX, count); index += 1) {
    const angle = seededUnit(artifactSeed, `vein:side-angle:${index}`) * Math.PI * 2;
    const length = reach * (0.26 + seededUnit(artifactSeed, `vein:side-length:${index}`) * 0.2);
    capsules.push({
      x: Math.sin(angle) * length,
      z: Math.cos(angle) * length,
      radius: nodeRadius * 0.09,
    });
  }

  return { capsules, nodeRadius };
}

/**
 * How far the vein reaches in one direction — the exact exit of a ray from the
 * centre through the union of capsules.
 *
 * Exact rather than a falloff curve, because this is what carries ADR-0003: a
 * crystal's base disc lies inside its own capsule by construction, so an
 * outline that is the true boundary of the union cannot leave a cap showing.
 */
function veinRadiusAt(
  angle: number,
  capsules: readonly VeinCapsule[],
  nodeRadius: number,
): number {
  const ux = Math.sin(angle);
  const uz = Math.cos(angle);
  let radius = nodeRadius;

  for (const capsule of capsules) {
    const length = Math.hypot(capsule.x, capsule.z);
    if (length <= 1e-9) {
      radius = Math.max(radius, capsule.radius);
      continue;
    }
    const along = capsule.x * ux + capsule.z * uz;
    const across = Math.abs(capsule.x * uz - capsule.z * ux);
    if (along <= 0) {
      // The ray runs away from this capsule; only its rounded start counts.
      if (across < capsule.radius) {
        radius = Math.max(radius, Math.sqrt(capsule.radius * capsule.radius - across * across));
      }
      continue;
    }
    // A capsule is convex, so the ray leaves it exactly once — through the side
    // while the exit still projects onto the shaft, and through the end cap
    // once it does not.
    if (across > 1e-9 && (capsule.radius * along) / across <= length) {
      radius = Math.max(radius, (capsule.radius * length) / across);
      continue;
    }
    if (across > capsule.radius) continue;
    radius = Math.max(
      radius,
      along + Math.sqrt(Math.max(0, capsule.radius * capsule.radius - across * across)),
    );
  }

  return radius;
}

function boundsOf(positions: readonly number[]): CrystalMeshBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset] ?? 0;
    const y = positions[offset + 1] ?? 0;
    const z = positions[offset + 2] ?? 0;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const center = {
    x: round6((minX + maxX) * 0.5),
    y: round6((minY + maxY) * 0.5),
    z: round6((minZ + maxZ) * 0.5),
  };
  let radius = 0;
  for (let offset = 0; offset < positions.length; offset += 3) {
    radius = Math.max(radius, Math.hypot(
      (positions[offset] ?? 0) - center.x,
      (positions[offset + 1] ?? 0) - center.y,
      (positions[offset + 2] ?? 0) - center.z,
    ));
  }
  return {
    min: { x: round6(minX), y: round6(minY), z: round6(minZ) },
    max: { x: round6(maxX), y: round6(maxY), z: round6(maxZ) },
    center,
    radius: round6(radius),
  };
}

/**
 * Висота стінки жеоди в напрямку `angle`, на відстані `radial` від осі
 * (у частках контуру).
 *
 * Розломи розставлені seed'ом, а не рівномірно: три однакові виїмки
 * через 120° читались би як деталь моделі, а не як тріщина.
 */
function geodeWallAt(
  radial: number,
  angle: number,
  wallHeight: number,
  seed: number,
): number {
  if (radial <= GEODE_WALL_START) return 0;
  const rise = Math.min(1, (radial - GEODE_WALL_START) / (1 - GEODE_WALL_START));
  const eased = rise * rise * (3 - 2 * rise);

  // Найглибший із розломів у цьому напрямку й вирішує.
  let openness = 0;
  for (let index = 0; index < GEODE_BREAK_COUNT; index += 1) {
    const at = seededUnit(seed, `geode:break:${index}`) * Math.PI * 2;
    const width = 0.32 + seededUnit(seed, `geode:break:${index}:width`) * 0.3;
    let delta = Math.abs(angle - at) % (Math.PI * 2);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    if (delta >= width) continue;
    const inside = 1 - delta / width;
    openness = Math.max(openness, inside * inside * (3 - 2 * inside));
  }

  return wallHeight * eased * (1 - GEODE_BREAK_DEPTH * openness);
}

/**
 * Висота гребеня коміра в напрямку `angle`, над `y = 0`.
 *
 * Ті самі розломи, що в стінки (`geodeWallAt`): вони описують один розкол
 * породи, і два різні набори тріщин на одному тілі читались би як дві
 * різні жеоди, вставлені одна в одну.
 */
function geodeCollarAt(angle: number, crest: number, seed: number): number {
  let openness = 0;
  for (let index = 0; index < GEODE_BREAK_COUNT; index += 1) {
    const at = seededUnit(seed, `geode:break:${index}`) * Math.PI * 2;
    const width = 0.32 + seededUnit(seed, `geode:break:${index}:width`) * 0.3;
    let delta = Math.abs(angle - at) % (Math.PI * 2);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    if (delta >= width) continue;
    const inside = 1 - delta / width;
    openness = Math.max(openness, inside * inside * (3 - 2 * inside));
  }
  // Множник завжди ≤ 1, щоб оголошена висота гребеня лишалась тим, що
  // виміряється: інакше гребінь подекуди вилазив би вище названого.
  const ragged = 1 - GEODE_COLLAR_RAGGED
    * smoothRing(seed, 'geode:collar', angle, GEODE_COLLAR_POINTS);
  /*
   * ВЕРХ КУПИ — СХОДИНКАМИ, А НЕ ХВИЛЕЮ.
   *
   * `smoothRing` дає плавну криву, і на укосі (ADR-0136) вона читалась
   * зіркою з плит: там, де гребінь високий, схил довгий, де низький —
   * короткий, і одинадцять точок хвилі перетворюються на одинадцять
   * трикутних променів. Власник назвав це так само — «радіальні плити».
   *
   * У битого каменю верх плаский на кожній брилі й стрибає між ними.
   * Квантування робить рівно це: сусідні сегменти, що потрапили в один
   * рівень, дають ПЛОСКИЙ верх, а перехід між рівнями — сходинку в один
   * сегмент (3.75° при 96 сегментах, тобто майже прямовисно).
   *
   * Рівнів п'ять, а не більше: на восьми плато вужчають до одного-двох
   * сегментів і сходинки знову зливаються в хвилю. Хвиля має одинадцять
   * точок — число просте, тож плато виходять різної ширини, а не
   * однаковими скибками.
   */
  const stepped = Math.round(ragged * GEODE_COLLAR_LEVELS) / GEODE_COLLAR_LEVELS;
  return crest * stepped * (1 - GEODE_BREAK_DEPTH * openness);
}

/**
 * Published profile. The vein is not a lathe, so this describes its envelope
 * rather than its construction — it exists because `CrystalMeshData` carries a
 * profile for every mesh, and readers use it for bounds and identity.
 */
function veinProfile(
  radius: number,
  height: number,
  depth: number,
  bearings: readonly number[],
): CrystalBodyProfile {
  const rows: CrystalProfileRow[] = [
    { t: -1, scale: FLOOR_FLARE },
    { t: 1, scale: 1 },
  ].map((step) => ({
    y: round6(step.t < 0 ? step.t * depth : step.t * height),
    radius: round6(step.scale * radius),
    radiusX: round6(step.scale * radius),
    radiusZ: round6(step.scale * radius),
    centerOffsetX: 0,
    centerOffsetZ: 0,
    rotation: 0,
    facetPhase: 0,
  }));

  return {
    profileVersion: 1,
    bodyId: CRYSTAL_SUBSTRATE_BODY_ID,
    archetype: 'vein',
    lod: 'high',
    segments: OUTLINE_SEGMENTS,
    extraSink: 0,
    geometryLength: round6(height + depth),
    geometryAnchor: { x: 0, y: 0, z: 0 },
    scaleX: 1,
    scaleZ: 1,
    twistTotal: 0,
    axisLeanX: 0,
    axisLeanZ: 0,
    burialStartY: 0,
    burialCompression: 1,
    rows,
    veinBearings: bearings.map(round6),
    signature: [
      'vein',
      radius.toFixed(4),
      height.toFixed(4),
      depth.toFixed(4),
      bearings.map((bearing) => bearing.toFixed(4)).join('/'),
    ].join(':'),
  };
}

/**
 * The directions the vein runs out in — one per crystal that pulled a branch,
 * strongest first, so a reader that wants only the main ones can take a prefix.
 *
 * Sorted by how much stone the branch moved rather than by angle: the year
 * crystals are the ones that opened the seam, and a plan crystal's chip should
 * not outrank them just because it happens to lie at a smaller bearing.
 */
function veinBearings(bodies: readonly GrowthBody[]): number[] {
  const monarch = bodies.reduce(
    (widest, body) => (body.renderedRadius > widest.renderedRadius ? body : widest),
    bodies[0]!,
  );
  return bodies
    .filter((body) => body.id !== monarch.id && Math.hypot(body.anchor.x, body.anchor.z) > 1e-6)
    .sort((left, right) => right.renderedRadius - left.renderedRadius)
    .map((body) => Math.atan2(body.anchor.x, body.anchor.z));
}

/**
 * Кільце жили звужується від контуру до підошви монарха, і `toward` каже,
 * де саме воно стоїть: 1 — на контурі, 0 — на підошві монарха, більше за
 * 1 — зовні контуру, там, де комір.
 *
 * Напрямки, у яких контур і так вужчий за підошву монарха, не рухаються
 * взагалі: інакше кільце вивернулось би назовні там, де жили просто немає.
 */
function veinRingRadius(edge: number, inner: number, toward: number): number {
  return edge <= inner ? edge : inner + (edge - inner) * toward;
}

/** Підошва монарха — те, до чого стягуються кільця верхньої поверхні. */
function veinInnerRadius(monarchRadius: number): number {
  return Math.max(1e-4, monarchRadius * 0.92);
}

/*
 * БРИЛИ — ОКРЕМІ ТІЛА, А НЕ ФОРМА ТОКАРНОГО ВЕРСТАТА.
 * ------------------------------------------------------------
 * ADR-0137 зробив комір блоковим квантуванням, і це допомогло — але
 * назвало власну межу: тіло обертання дає радіальні грані ЗА ПОБУДОВОЮ.
 * Скільки не квантуй виліт і висоту, кожна грань лишається клином від осі.
 *
 * `amore-crystal-look` каже, як це робиться правильно, і каже давно:
 * «брили — той самий перетин півпросторів, що й кристали; вони різняться
 * лише тим, що площини дивляться куди завгодно, а не тримають шестигранний
 * габітус. Не тягнись до зашумленої сфери: камінь ламається пласко, і саме
 * пласкі грані ловлять світло по-різному».
 *
 * Брили в рушії вже були — сорок чотири многогранники, насипані на шов, —
 * і пішли з ADR-0061/0063 разом із роллю, яку тоді віддали руїні: «битий
 * камінь у сцені тепер дає сама руїна». Руїни немає з ADR-0116. Роль
 * повертається туди, звідки її забрали.
 *
 * НАСИПАНІ НА ШОВ, А НЕ ЗАМІСТЬ НЬОГО. Шов і далі несе ADR-0003 — він те,
 * що досить широке й глибоке, щоб жодна базова кришка не була видна знизу.
 * Камінь, накиданий на гарантію, її не послаблює, і `seamTriangleCount`
 * тепер знову означає те, що каже: де кінчається шов і починається насип.
 */

/** Скільки брил насипається на комір. */
const GEODE_BOULDER_COUNT = 24;
/** Скільки площин ріже одну брилу. Менше — тетраедр, більше — галька. */
const GEODE_BOULDER_PLANES_MIN = 7;
const GEODE_BOULDER_PLANES_MAX = 9;
/**
 * Найбільша брила, у частках радіуса монарха.
 *
 * Розмір задає ЗАЗОР до найближчого кристала (див. нижче), а це — стеля
 * для тих місць, де зазор великий: брила, більша за монархову підошву,
 * читалась би валуном, у який кристал уперся, а не купою, з якої він росте.
 */
const GEODE_BOULDER_MAX = 0.9;
/**
 * Найменша брила, яку варто малювати, у частках її ж сектора.
 *
 * Дрібніша коштує двадцять трикутників і на екрані не читається каменем —
 * вона читається сміттям. Такі місця лишаються порожніми: у справжній купі
 * теж не кожна щілина забита.
 *
 * У ЧАСТКАХ СЕКТОРА, а не радіуса монарха. Старе число (0.18 радіуса
 * монарха) міряло камінь лінійкою, яка до купи не має стосунку: на
 * одинадцяти роках воно вимагало 0.0059 там, де найбільший просвіт на
 * всьому комірі — 0.0065, а після множення на частку зазору лишалось
 * 0.0047. Поріг був недосяжний за побудовою, і «відкидання за
 * близькістю» повернулось у код через розмір.
 */
const GEODE_BOULDER_MIN = 0.3;
/**
 * Ширина брили в частках СЕКТОРА, який їй належить по колу насипу.
 *
 * ТУТ СТОЯЛО `GEODE_BOULDER_GAP_SHARE = 0.72` — «брила займає 72% зазору
 * до найближчого кристала», — і саме воно робило насип порожнім.
 *
 * Зазор між кільцем коміра й підошвами кристалів на одинадцяти роках —
 * 0.0032…0.0065. Помножений на 0.72, він давав брилу 0.0023…0.0046 при
 * насипі 0.096 завширшки й 0.052 заввишки. Тобто кожен камінь виходив у
 * двадцять разів дрібнішим за купу, на якій лежить, і поріг «менше
 * 0.18 радіуса монарха — це сміття» відкидав геть усі. Виміряно: з
 * оголошених двадцяти двох брил малювалось НУЛЬ на 1, 2, 4, 8 і 11
 * роках, три на 25 і шістнадцять на 40.
 *
 * Файл при цьому сам собі написав правило й сам його порушив: «обрізай
 * брилу до щілини, а не відкидай її за те, що вона в щілині». Зазор
 * каже, КУДИ каменю не можна, а не ЯКИМ йому бути. Тепер розмір
 * береться з насипу — з сектора по колу, — а щілину тримають площини
 * обрізки (`crystalClips`), тобто рівно так, як записано.
 *
 * 1.1, а не 1: сусідні камені мусять заходити один на одного, інакше між
 * ними лишається щілина, крізь яку видно те саме токарне кільце.
 */
const GEODE_BOULDER_SECTOR_SHARE = 1.1;
/** На яку частку свого розміру брила втоплена в комір. */
const GEODE_BOULDER_SINK = 0.42;
/**
 * На яку частку свого розміру камінь стоїть ВИЩЕ укосу під ним.
 *
 * Без цього камені лягають урівень із поверхнею коміра, тобто ховаються
 * в ній повністю: на екрані лишаються ті самі радіальні плити тіла
 * обертання, заради яких усе це й робиться.
 */
const GEODE_BOULDER_PROUD = 0.62;
/**
 * Найбільша брила як частка зросту НАЙКОРОТШОГО тіла колонії.
 *
 * Зазор міряється по горизонталі, а ховає кристал висота — див.
 * `buildCrystalSubstrateMesh`.
 */
const GEODE_BOULDER_NEIGHBOUR_SHARE = 0.5;

/**
 * Одна брила: опуклий многогранник із площин, що дивляться куди завгодно.
 *
 * Напрямки беруться зі спіралі Фібоначчі з насіненим зсувом, а не з
 * випадкових векторів: випадкові збиваються в купки, і тоді половина
 * площин ріже одну й ту саму сторону, а протилежна лишається відкритою —
 * многогранник виходить необмеженим і `intersectHalfSpaces` вертає null.
 */
function boulderPolytope(
  artifactSeed: number,
  tag: string,
  radius: number,
  clips: readonly CrystalFacePlane[] = [],
): CrystalPolytope | null {
  const count = GEODE_BOULDER_PLANES_MIN + Math.floor(
    seededUnit(artifactSeed, `${tag}:planes`)
    * (GEODE_BOULDER_PLANES_MAX - GEODE_BOULDER_PLANES_MIN + 1),
  );
  const planes: CrystalFacePlane[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const spin = seededUnit(artifactSeed, `${tag}:spin`) * Math.PI * 2;
  for (let index = 0; index < count; index += 1) {
    const y = 1 - ((index + 0.5) / count) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = spin + index * golden
      + (seededUnit(artifactSeed, `${tag}:jitter:${index}`) - 0.5) * 0.7;
    /*
     * Зсув грані — від 0.58 до 1.0 радіуса. Саме НЕРІВНІ зсуви роблять
     * камінь каменем: рівні дали б правильний многогранник, тобто
     * гранований м'ячик.
     *
     * ЗВУЖЕННЯ СМУГИ ВИМІРЯНО Й ВІДКИНУТО. 0.74…1.0 мало прибрати
     * випадок, коли дві майже протилежні грані сходяться до середини й
     * камінь виходить пласкою скалкою. На екрані вийшло гірше: камені
     * стали більшими в усіх напрямках одразу, розповзлись і злились у
     * суцільні полотнища. Розкид тут — не вада, а те, чим купа битого
     * каменю є.
     */
    const offset = radius * (0.58 + seededUnit(artifactSeed, `${tag}:offset:${index}`) * 0.42);
    planes.push({
      normal: { x: round6(Math.cos(angle) * ring), y: round6(y), z: round6(Math.sin(angle) * ring) },
      offset: round6(offset),
      kind: 'prism',
    });
  }
  /*
   * Площини обрізки приходять останніми й нічим не відрізняються від
   * власних граней каменю — у цьому й сенс. Камінь, зрізаний об підошву
   * кристала, дістає пласку грань саме там, де кристал його спинив; так
   * виглядає порода, крізь яку кристал пробився, а не камінь, який
   * злякався кристала й став дрібним.
   */
  return intersectHalfSpaces([...planes, ...clips], polytopeTolerance(radius));
}

/**
 * Найближчий до центру виліт по цьому азимуту, на якому центр каменю вже
 * вільний від усіх підошв.
 *
 * Камінь може лежати впритул до кристала й навіть бути об нього зрізаним,
 * але його ЦЕНТР мусить бути зовні: інакше площини обрізки відрізали б
 * усе тіло й лишали порожнечу. `null` означає, що вільного місця на цьому
 * азимуті немає до самого краю купи.
 */
function clearReachAt(
  bodies: readonly GrowthBody[],
  angle: number,
  from: number,
  to: number,
): number | null {
  const steps = 48;
  for (let step = 0; step <= steps; step += 1) {
    const at = from + ((to - from) * step) / steps;
    const x = Math.sin(angle) * at;
    const z = Math.cos(angle) * at;
    let clear = true;
    for (const body of bodies) {
      const archetype = typeof body.attributes.archetype === 'string'
        ? body.attributes.archetype
        : 'prismatic';
      const foot = body.renderedRadius * (body.id === bodies[0]!.id
        ? monarchFootWidth(archetype)
        : childFootWidth(archetype));
      if (Math.hypot(x - body.anchor.x, z - body.anchor.z)
        <= Math.max(foot, baseCoverOf(body))) {
        clear = false;
        break;
      }
    }
    if (clear) return at;
  }
  return null;
}

/**
 * Площини, якими насип обрізається об кристали.
 *
 * Одна на кожне тіло, що ближче до центру каменю, ніж САМИЙ ДАЛЕКИЙ ЙОГО
 * КУТ: нормаль дивиться на кристал, зсув — відстань до його ПІДОШВИ.
 * Далі тіла не чіпають нічого й площини не дістають.
 *
 * Півширина підошви береться тим самим контрактом, що й посадка колонії
 * (ADR-0125), і не менша за накриття базової кришки: камінь не сміє лягти
 * ні на кристал, ні на те, що ховає його кришку (ADR-0003).
 *
 * `null` означає, що каменю тут немає місця взагалі — його центр уже
 * всередині чиєїсь підошви. Такий сектор лишається порожнім; у справжній
 * купі теж не кожна щілина забита.
 */
function crystalClips(
  bodies: readonly GrowthBody[],
  x: number,
  z: number,
  reach: number,
): CrystalFacePlane[] | null {
  const clips: CrystalFacePlane[] = [];
  for (const body of bodies) {
    const dx = body.anchor.x - x;
    const dz = body.anchor.z - z;
    const away = Math.hypot(dx, dz);
    if (away <= 1e-6) return null;
    const archetype = typeof body.attributes.archetype === 'string'
      ? body.attributes.archetype
      : 'prismatic';
    const foot = body.renderedRadius * (body.id === bodies[0]!.id
      ? monarchFootWidth(archetype)
      : childFootWidth(archetype));
    const room = away - Math.max(foot, baseCoverOf(body));
    if (room <= 0) return null;
    if (room >= reach) continue;
    clips.push({
      normal: { x: round6(dx / away), y: 0, z: round6(dz / away) },
      /*
       * Униз, а не до найближчого: `round6` міг зсунути площину НАЗОВНІ
       * на півмільйонну, і саме стільки камінь заходив у кристал
       * (виміряно −7.1e-7 при межі нуль). Гарантія ADR-0003 не має
       * запасу за побудовою, тож округлення тут може бути лише в її бік.
       */
      offset: Math.floor(room * 1e6) / 1e6,
      kind: 'prism',
    });
  }
  return clips;
}

/**
 * Builds the vein as a closed solid: an irregular top face, a wall down to a
 * slightly drawn-in floor, and a floor cap. Returns null when there is nothing
 * to carry.
 */
export function buildCrystalSubstrateMesh(
  bodies: readonly GrowthBody[],
  artifactSeed: number,
  meshes: readonly CrystalMeshData[] = [],
): CrystalMeshData | null {
  if (bodies.length === 0) return null;

  const { capsules, nodeRadius } = veinCapsules(bodies, artifactSeed);
  const monarchRadius = bodies.reduce(
    (widest, body) => Math.max(widest, body.renderedRadius),
    0,
  );

  // The outline, sampled once and reused by every ring so the top face keeps
  // the vein's shape all the way in rather than becoming a disc inside it.
  const outline: number[] = [];
  for (let segment = 0; segment < OUTLINE_SEGMENTS; segment += 1) {
    const angle = (segment / OUTLINE_SEGMENTS) * Math.PI * 2;
    const exact = veinRadiusAt(angle, capsules, nodeRadius);
    outline.push(exact * (1 + edgeNoise(artifactSeed, angle) * EDGE_NOISE));
  }
  const widest = outline.reduce((most, value) => Math.max(most, value), 0);

  // Barely proud of the stone: the brief asks for a seam lying practically
  // flush with the platform, not an inlay set on top of it.
  //
  // The monarch's own length is the root's ruler. She is the first body — the
  // colony's root in the growth sense — so this needs nothing the builder does
  // not already hold.
  const monarchLength = Math.max(1e-6, bodies[0]!.renderedLength);
  const height = round6(monarchLength * VEIN_PROUD_OF_MONARCH_HEIGHT);
  // Depth is not cosmetic. Every crystal keeps its base cap and sinks it below
  // y=0; if the vein stops short of the deepest of them, that cap is exposed
  // from below and ADR-0003's guarantee breaks.
  //
  // Measured from the published meshes where they are available, because a body
  // can reach deeper than its anchor: the monarch's own profile sinks her into
  // the vein, and an attached body extends backward past its anchor as well.
  // Anchors remain the floor, so a caller that has no meshes yet still gets a
  // vein that covers every anchor.
  const deepestBurial = Math.min(
    0,
    ...bodies.map((body) => body.anchor.y),
    ...meshes.map((mesh) => mesh.bounds.min.y),
  );
  const depth = round6(Math.max(nodeRadius * 0.6, -deepestBurial + nodeRadius * 0.35));
  // How far the fissure sinks between the crystals. Bounded by the vein's own
  // floor with a margin, so the trough can never cut through the underside and
  // open the solid it is part of.
  const troughDepth = round6(Math.min(nodeRadius * TROUGH_DEPTH, depth * 0.55));
  // Стінка жеоди — порода, що встає по периметру. Див. `GEODE_WALL_HEIGHT`.
  const wallHeight = round6(monarchLength * GEODE_WALL_HEIGHT);

  /*
   * Гребінь коміра: менше з двох — частка монарха й частка найвищої
   * дитини. Див. `GEODE_COLLAR_CHILD_SHARE`.
   */
  const monarchId = bodies[0]!.id;
  let tallestChild = 0;
  for (const mesh of meshes) {
    if (mesh.bodyId === monarchId || mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
    tallestChild = Math.max(tallestChild, mesh.bounds.max.y);
  }
  const crest = round6(tallestChild > 0
    ? Math.min(monarchLength * GEODE_COLLAR_HEIGHT, tallestChild * GEODE_COLLAR_CHILD_SHARE)
    : monarchLength * GEODE_COLLAR_HEIGHT);
  const collarHeights: number[] = [];
  for (let segment = 0; segment < OUTLINE_SEGMENTS; segment += 1) {
    const angle = (segment / OUTLINE_SEGMENTS) * Math.PI * 2;
    collarHeights.push(round6(geodeCollarAt(angle, crest, artifactSeed)));
  }
  /*
   * Профіль оголошує ДОСЯГНУТУ вершину, а не задуману.
   *
   * Гребінь рваний, тож жодна точка не сягає повних `crest`. Читачі
   * профілю звіряють із цим числом РІВНІСТЬ («чи є на тілі точка на
   * вершині породи»), і номінальне значення зробило б таку перевірку
   * недосяжною за побудовою.
   */
  const collarTop = collarHeights.reduce((most, value) => Math.max(most, value), 0);
  // Профіль оголошує НАЙВИЩУ точку тіла: висота стінки, а не губи. Інакше
  // споживачі профілю (обрізка, межі) вважали б жеоду нижчою, ніж вона є.
  /*
   * Профіль оголошує НАЙШИРШУ й НАЙВИЩУ точку тіла. Відколи є комір,
   * обидві — його: підкладка сягає далі за контур і встає вище за губу.
   * Оголосити старі числа означало б сказати споживачам профілю (обрізка,
   * межі сцени, п'єдестал порталу), що жеоди немає.
   */
  const collarRadius = round6(
    Math.max(1e-4, monarchRadius * 0.92)
    + (widest - Math.max(1e-4, monarchRadius * 0.92)) * GEODE_COLLAR_REACH,
  );
  const profile = veinProfile(
    collarRadius,
    Math.max(height + wallHeight, collarTop),
    depth,
    veinBearings(bodies),
  );

  const positions: number[] = [];
  const indices: number[] = [];
  const ringStarts: number[] = [];

  // How far a point on the top face sits from the nearest crystal's base, as a
  // share of that crystal's own cover. Zero right at a crystal, one well away.
  const clearanceOf = (x: number, z: number): number => {
    let closest = Number.POSITIVE_INFINITY;
    for (const body of bodies) {
      const cover = baseCoverOf(body);
      closest = Math.min(
        closest,
        Math.hypot(x - body.anchor.x, z - body.anchor.z) / Math.max(1e-6, cover),
      );
    }
    return Number.isFinite(closest) ? closest : 1;
  };

  /**
   * Height of the top face at a point — the whole reason the seam has depth.
   *
   * A flat top read as a pad the crystals were set on. A fissure is not flat:
   * the stone stands proud at its lip and falls away into shadow between, and
   * the crystals come *out* of that shadow.
   *
   * The rim around each crystal is the part that cannot move. Every base cap
   * sits below y=0 and is ADR-0003's whole guarantee, so the surface holds at
   * the lip wherever a cap needs covering and only starts falling outside the
   * cover — which is exactly the shape of a crack with crystals growing from it.
   */
  const topHeightAt = (x: number, z: number): number => {
    const clearance = clearanceOf(x, z);
    const seam = clearance <= RIM_HOLD
      ? height
      : (() => {
        const fall = Math.min(1, (clearance - RIM_HOLD) / TROUGH_FALL);
        // Eased, so the rim rolls into the trough instead of stepping into it.
        const eased = fall * fall * (3 - 2 * fall);
        return height - (height + troughDepth) * eased;
      })();

    /*
     * Стінка жеоди додається ПОВЕРХ шва, а не замість нього: `Math.max`
     * нижче, бо це дві різні речі про одну поверхню. Шов каже, де
     * камінь тримається біля кристала й де провалюється між ними;
     * стінка — де порода встає по краю. Де вони сперечаються, виграє
     * вища: жеода не може бути нижчою за власну губу.
     *
     * Але стінка відступає там, де стоїть кристал.
     *
     * Без цього вона залазила на базову кришку зовнішньої дитини:
     * виміряно 0.057 при губі 0.0246, тобто порода підіймалась на
     * висоту, удвічі більшу за губу, просто тому, що дитина стоїть
     * близько до контуру. Для ADR-0003 це не порушення — кришка
     * лишається закопаною, — але виглядало б як кристал, наполовину
     * проковтнутий каменем.
     *
     * Тому та сама відстань, якою міряється губа (`clearanceOf`),
     * тримає й стінку: усередині власного покриву кристала її немає
     * зовсім, і повну висоту вона набирає лише на подвійному покриві.
     */
    if (clearance <= 1) return seam;
    const room = Math.min(1, (clearance - 1) / GEODE_CLEAR_RUN);
    const angle = Math.atan2(x, z);
    const edge = veinRadiusAt(angle, capsules, nodeRadius)
      * (1 + edgeNoise(artifactSeed, angle) * EDGE_NOISE);
    const radial = Math.hypot(x, z) / Math.max(1e-6, edge);
    const wall = geodeWallAt(radial, angle, wallHeight, artifactSeed)
      * (room * room * (3 - 2 * room));
    /*
     * Стінка діє ЛИШЕ вище губи.
     *
     * Без цієї межі вона мовчки засипала тріщину: на схилі й у розломах
     * вона дає малі додатні значення, і `Math.max` підіймав ними дно
     * западини до нуля, не перевищивши при цьому губи. Виміряно —
     * `trough` у `substrate.test.ts` став нулем при незмінному `proud`,
     * тобто фісури не стало, а стінки так і не з'явилось.
     *
     * Правило, яке це виражає: нижче губи — порожнина жеоди, і порода
     * там не будується. Вище губи — стінка.
     */
    if (wall <= height) return seam;
    return Math.max(seam, wall);
  };

  const inner = veinInnerRadius(monarchRadius);
  /**
   * One ring. `toward` is 1 at the vein's outline and 0 at the monarch's
   * footprint; `y` of null means the ring follows the fissure's own floor.
   */
  const pushRing = (
    toward: number | ((segment: number) => number),
    y: number | ((angle: number, segment: number) => number) | null,
  ): void => {
    ringStarts.push(positions.length / 3);
    for (let segment = 0; segment < OUTLINE_SEGMENTS; segment += 1) {
      const angle = (segment / OUTLINE_SEGMENTS) * Math.PI * 2;
      const edge = outline[segment]!;
      const reach = typeof toward === 'function' ? toward(segment) : toward;
      const radius = veinRingRadius(edge, inner, reach);
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const height = typeof y === 'function' ? y(angle, segment) : y;
      positions.push(round6(x), round6(height ?? topHeightAt(x, z)), round6(z));
    }
  };

  // Floor, then the wall top, then the top face shrinking inward.
  //
  // The floor is *wider* than the top, and that is a lighting decision as much
  // as a geological one. Tapering the other way — floor narrower — leans the
  // wall outward as it rises, which points its normal downward, and a
  // downward-facing face sees none of the key light: the seam came out ringed
  // in a hard black outline that read as a plinth the crystals stand on. Wider
  // below, the same wall leans inward and catches the light as a bevel. It also
  // means the vein is broadest exactly where the base caps are buried.
  /*
   * КОМІР ІДЕ ПЕРШИМ, І САМЕ ВІН НЕСЕ ПІДОШВУ.
   *
   * Найнижче кільце — це опублікована базова кришка (`baseCapTriangleCount`
   * нижче рахує саме його трикутники), тож розширити треба його, а не
   * додати щось під ним: інакше кришка лишилась би всередині коміра й
   * жеода мала б дно в двох місцях.
   */
  /*
   * ЗОВНІШНІЙ УКІС — те, без чого комір читався ПАРКАНОМ.
   *
   * Було два кільця: підошва на 1.22×1.06 і гребінь на 1.22. Зовнішня
   * стінка йшла майже прямовисно, і власник сказав рівно те, що з цього
   * виходить: «плоский, йому не вистачає об'єму, він просто як заборчик
   * закриває дно кристала».
   *
   * НАЙШИРШЕ МІСЦЕ — БІЛЯ ЗЕМЛІ, А НЕ НА ДНІ, і це не смак. Перша
   * редакція розсунула саме нижнє кільце, на глибині, — і тест
   * `stays inside the frame at every bearing` упав: підкладка виходила за
   * кадр по вертикалі на 2.3%. Далі число підбиралось униз і не
   * сходилось: 1.52 давало 1.011, 1.45 → 1.002, навіть 1.38 → 1.003.
   * Причина в тому, ЩО саме розсовувалось: найдальша точка стояла на
   * найнижчому рівні, тобто найдалі від центру кадру по обох осях.
   *
   * У купи битого каменю найширше місце й так біля землі, а нижче вона
   * підбирається. Тепер: підошва вузька (як була), одразу над нею
   * найширше кільце, далі укіс до гребеня. Об'єм той самий, габарит —
   * менший.
   */
  /*
   * ПІДОШВА КУПИ НЕРІВНА Й ПО КОЛУ, а не тільки по висоті.
   *
   * Квантований гребінь зробив верх сходинками, і це допомогло — але
   * плити все одно розходились променями. Причина не в числах: тіло
   * обертання дає радіальні грані ЗА ПОБУДОВОЮ, і рівний круглий контур
   * підошви лишав кожну грань клином від центру.
   *
   * Тепер виліт підошви теж квантований і теж по своїй хвилі: одні брили
   * виступають далі, інші тонуть у сусідах. У плані контур стає рваним, і
   * грань перестає бути клином на всю висоту.
   *
   * Хвилі різні (`geode:skirt` проти `geode:collar`) і числа точок теж —
   * 7 проти 11, обидва прості. Однакова хвиля дала б брилу, у якої верх і
   * виліт ростуть разом, тобто конус із зубцями замість купи.
   */
  const skirtReach = (segment: number): number => {
    const angle = (segment / OUTLINE_SEGMENTS) * Math.PI * 2;
    const wave = smoothRing(artifactSeed, 'geode:skirt', angle, GEODE_SKIRT_POINTS);
    const stepped = Math.round(wave * GEODE_COLLAR_LEVELS) / GEODE_COLLAR_LEVELS;
    return GEODE_COLLAR_REACH
      + (GEODE_SKIRT_REACH - GEODE_COLLAR_REACH) * (1 - GEODE_SKIRT_RAGGED * stepped);
  };

  pushRing(GEODE_COLLAR_REACH * FLOOR_FLARE, -depth);
  pushRing(skirtReach, () => 0);
  pushRing(
    (segment) => GEODE_COLLAR_REACH + (skirtReach(segment) - GEODE_COLLAR_REACH) * 0.45,
    (_angle, segment) => collarHeights[segment]! * 0.5,
  );
  pushRing(GEODE_COLLAR_REACH, (_angle, segment) => collarHeights[segment]!);
  // The outer lip is the one top ring pinned flat: it is where the crack meets
  // the platform, and a lip that wandered would read as a torn edge rather than
  // as stone that split.
  // Зовнішнє кільце більше не пласке: саме воно й несе стінку жеоди, тож
  // його висота береться з тієї самої функції, що й уся верхня поверхня.
  pushRing(1, null);
  for (const toward of TOP_RINGS) pushRing(toward, null);

  const floorCenter = positions.length / 3;
  positions.push(0, round6(-depth), 0);
  const topCenter = positions.length / 3;
  positions.push(0, round6(topHeightAt(0, 0)), 0);

  // Floor cap first, so its triangles are the published base cap.
  const floorStart = ringStarts[0]!;
  for (let segment = 0; segment < OUTLINE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % OUTLINE_SEGMENTS;
    indices.push(floorCenter, floorStart + next, floorStart + segment);
  }
  const baseCapTriangleCount = OUTLINE_SEGMENTS;

  // Wall and top face: every consecutive pair of rings, one winding throughout.
  for (let ring = 0; ring < ringStarts.length - 1; ring += 1) {
    const currentStart = ringStarts[ring]!;
    const nextStart = ringStarts[ring + 1]!;
    for (let segment = 0; segment < OUTLINE_SEGMENTS; segment += 1) {
      const next = (segment + 1) % OUTLINE_SEGMENTS;
      const a = currentStart + segment;
      const b = currentStart + next;
      const c = nextStart + segment;
      const d = nextStart + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  const innerStart = ringStarts[ringStarts.length - 1]!;
  for (let segment = 0; segment < OUTLINE_SEGMENTS; segment += 1) {
    const next = (segment + 1) % OUTLINE_SEGMENTS;
    indices.push(innerStart + segment, innerStart + next, topCenter);
  }

  // Everything up to here is the seam itself. Counted in **triangles** rather
  // than vertices, because the mesh is split before it is drawn and the split
  // gives every triangle its own copies — vertex indices do not survive it,
  // while triangle order does, one for one.
  const seamTriangleCount = indices.length / 3;

  /*
   * НАСИП — ПІСЛЯ ШВА, і саме тому `seamTriangleCount` рахується вище.
   *
   * Брили кладуться на комір: азимут із насіненим кроком, виліт між
   * гребенем і підошвою укосу, висота — сам гребінь у цьому напрямку.
   *
   * РОЗМІР ЗАДАЄ ЗАЗОР, а не константа, і це записане правило: «обрізай
   * брилу до щілини, а не відкидай її за те, що вона в щілині. Відкидання
   * за близькістю викидало п'ять із шести й лишало два камені на голому
   * шві». Мала каменюка біля підошви кристала — рівно те, що показує
   * еталон; велика там — порушення.
   */
  const shortestBody = bodies.reduce(
    (least, body) => Math.min(least, body.renderedLength),
    Number.POSITIVE_INFINITY,
  );
  for (let index = 0; index < GEODE_BOULDER_COUNT; index += 1) {
    const tag = `geode:boulder:${index}`;
    const angle = ((index + seededUnit(artifactSeed, `${tag}:spread`) * 0.8)
      / GEODE_BOULDER_COUNT) * Math.PI * 2;
    const edge = veinRadiusAt(angle, capsules, nodeRadius);
    const reach = veinRingRadius(edge, inner, GEODE_COLLAR_REACH);
    const spread = veinRingRadius(edge, inner, GEODE_SKIRT_REACH) - reach;
    /*
     * Виліт — по всьому укосу, а не по одному кільцю.
     *
     * Кільце дало намисто: камені стояли на гребені, а схил під ними
     * лишався токарним. Тепер частина сідає всередину гребеня, частина
     * на підошву укосу, і купа має товщину.
     */
    const out = seededUnit(artifactSeed, `${tag}:out`);
    const wanted = reach + spread * (out * 1.3 - 0.3);
    const heapAt = veinRingRadius(edge, inner, GEODE_HEAP_REACH);
    /*
     * Сектор, який належить цьому каменю по колу насипу. Він і задає
     * розмір: камінь має бути завбільшки з те місце, яке він займає в
     * купі, а не з щілину між кристалами.
     */
    const sector = (2 * Math.PI * reach) / GEODE_BOULDER_COUNT;

    /*
     * ДРУГА МЕЖА — ЗРІСТ СУСІДА, і її знайшов тест, а не око.
     *
     * Сектор каже, скільки місця камінь займає по колу; він нічого не
     * каже про висоту, а ховає кристал саме висота. На першому році тіла
     * дрібні, і брила, що чесно вкладалась у своє місце, накривала 64%
     * річного кристала при межі 50% (`жеода не ховає кільце років`,
     * ADR-0058: рік має читатись літописом).
     *
     * Мірка — НАЙКОРОТШЕ тіло колонії, а не найближче. Найближчим до
     * брили часто виявляється монарх, і тоді камінь біля її підошви
     * виростав їй до зросту — а ховав при цьому дітей на іншому боці
     * купи. Купа не має ховати найменше, що біля неї стоїть.
     */
    const size = Math.min(
      monarchRadius * GEODE_BOULDER_MAX,
      shortestBody * GEODE_BOULDER_NEIGHBOUR_SHARE,
      sector * GEODE_BOULDER_SECTOR_SHARE,
    );
    if (size < sector * GEODE_BOULDER_MIN) continue;

    /*
     * Щілина до кристалів більше не стискає камінь — вона його ріже.
     * Див. `crystalClips`; `null` означає «тут місця немає взагалі».
     *
     * ДВА ПРОХОДИ, І ЦЕ НЕ ОБЕРЕЖНІСТЬ. Кут многогранника лежить далі
     * від центру, ніж будь-яка його грань: площини стоять на 0.58…1.0
     * розміру, а вершина, де сходяться три з них, виходить у півтора
     * раза далі. Перший прохід питали «чи ближче кристал за розмір?» —
     * і кристал, що стояв між розміром і кутом, площини не діставав.
     * Тест ADR-0138 упіймав це числом: камінь заліз у кристал на 0.0018.
     *
     * Тому спершу будується сам камінь, у нього питається справжній
     * виліт, і лише тоді відбираються кристали, до яких він дотягується.
     */
    const bare = boulderPolytope(artifactSeed, tag, size);
    if (bare === null) continue;
    let reachOut = 0;
    for (const vertex of bare.vertices) {
      reachOut = Math.max(reachOut, Math.hypot(vertex.x, vertex.y, vertex.z));
    }
    /*
     * Скільки кутів у розмірі. Многогранник масштабується разом із
     * радіусом, тож ця частка не залежить від розміру й дає перевести
     * «скільки місця є» в «яким камінь може бути».
     */
    const corner = reachOut / Math.max(1e-6, size);

    const minAt = clearReachAt(bodies, angle, inner, heapAt);
    if (minAt === null) continue;
    const fits = Math.min(size, (heapAt - minAt) / corner);
    if (fits < sector * GEODE_BOULDER_MIN) continue;

    /*
     * КАМІНЬ НЕ РОЗСОВУЄ КУПУ. Виліт кладеться так, щоб найдальший кут
     * каменю лягав рівно на підошву укосу, а не за неї.
     *
     * Без цього камені додавали до габариту підкладки ±3%, і цього
     * вистачило, щоб зламати `кристал на екрані росте разом із парою`:
     * кадр камери масштабується коробкою ВСІХ мешів, тож ширша купа
     * відсуває камеру, і чотирнадцятирічна пара діставала менше екрана,
     * ніж десятирічна (55.8% проти 57.4%). ADR-0061 звузив підкладку
     * навмисно; додати їй ширини попутно з формою каменів не можна.
     *
     * Місце для каменів узялось не з габариту, а з кільця: укіс
     * відступив із 1.62 на 1.42 (`GEODE_HEAP_REACH`), і зовнішню смугу
     * купи тепер тримає камінь, а не токарне кільце. Купа та сама
     * завширшки — комір і є камені.
     */
    const at = Math.max(minAt, Math.min(wanted, heapAt - corner * fits));
    const x = Math.sin(angle) * at;
    const z = Math.cos(angle) * at;

    const clips = crystalClips(bodies, x, z, corner * fits);
    if (clips === null) continue;

    const stone = clips.length === 0 && fits === size
      ? bare
      : boulderPolytope(artifactSeed, tag, fits, clips);
    if (stone === null) continue;

    /*
     * БРИЛА ЛЕЖИТЬ НА КУПІ, А НЕ СТОЇТЬ НАД НЕЮ.
     *
     * Перша редакція садила камінь на гребінь і топила його на частку
     * розміру — тобто верх каменю виходив ВИЩЕ гребеня. Тест
     * `жеода не ховає кільце років` упіймав наслідок одразу: він міряє
     * найвищу точку всього меша проти найвищої дитини, і на першому році
     * вона стрибнула до 0.64 при межі 0.5.
     *
     * Обмежувати розмір марно — я спробував двома способами (зростом
     * найближчого тіла, потім найкоротшого), і обидва рази верх усе одно
     * підіймався: справа не в тому, ЯКА брила, а в тому, що вона стоїть
     * ПОВЕРХ.
     *
     * Тепер кожен камінь ставиться так, щоб його найвища точка лягла
     * рівно на гребінь у своєму напрямку (з насіненим просіданням). Тобто
     * брили не додаються до купи згори — вони і Є її поверхня. Висота
     * підкладки лишається тим, чим була, а профіль ADR-0058 не зачеплений.
     */
    let stoneTop = Number.NEGATIVE_INFINITY;
    for (const vertex of stone.vertices) stoneTop = Math.max(stoneTop, vertex.y);
    /*
     * Верхівка каменю лягає на поверхню коміра В СВОЄМУ МІСЦІ, а не на
     * гребінь. Гребінь для каменя, що лежить на підошві укосу, — це
     * півметра порожнечі під ним: він завис би над схилом, і купа
     * розсипалась би на намисто й окремо схил.
     *
     * Укіс іде від гребеня біля кільця до нуля на спідниці — тими самими
     * трьома кільцями, з яких він побудований, тож лінійна частка тут не
     * наближення, а їхнє власне правило.
     */
    const down = Math.min(1, Math.max(0, (at - reach) / Math.max(1e-6, spread)));
    const ridge = geodeCollarAt(angle, crest, artifactSeed);
    /*
     * Камінь СТИРЧИТЬ із укосу, а не лежить урівень із ним. Урівень —
     * означає похований: перша спроба поклала верхівку рівно на поверхню
     * коміра, і камені зникли всередині неї, лишивши на екрані ті самі
     * токарні плити.
     *
     * СТЕЛЯ ЛИШАЄТЬСЯ ГРЕБЕНЕМ, і вона не косметична: найвища точка меша
     * міряється проти найвищої дитини (`жеода не ховає кільце років`,
     * ADR-0058). Камінь на схилі може стояти вище свого схилу рівно доти,
     * доки не переріс гребінь — а гребінь уже стоїть під цією межею.
     */
    const top = Math.min(ridge, ridge * (1 - down) + size * GEODE_BOULDER_PROUD);
    const base = top - stoneTop - size * GEODE_BOULDER_SINK
      * seededUnit(artifactSeed, `${tag}:settle`);
    const first = positions.length / 3;
    for (const vertex of stone.vertices) {
      positions.push(round6(x + vertex.x), round6(base + vertex.y), round6(z + vertex.z));
    }
    for (const face of stone.faces) {
      for (let corner = 1; corner + 1 < face.loop.length; corner += 1) {
        indices.push(
          first + face.loop[0]!,
          first + face.loop[corner]!,
          first + face.loop[corner + 1]!,
        );
      }
    }
  }

  const triangleCount = indices.length / 3;
  return rebuildCrystalMeshNormals({
    meshVersion: 1,
    bodyId: CRYSTAL_SUBSTRATE_BODY_ID,
    hostBodyId: null,
    lod: 'high',
    /*
     * `geodeWallHeight` — «вершина породи по периметру» (ADR-0060). Відколи
     * порода встає коміром ЗА колонією, вершина — його, а не низького
     * коміра на самому стику: старе число сказало б споживачам профілю,
     * що жеоди немає.
     */
    profile: {
      ...profile,
      seamTriangleCount,
      seamRimHeight: height,
      geodeWallHeight: collarTop,
      seamOutlineRadius: round6(widest),
    },
    positions,
    normals: [],
    indices,
    sourceTriangleCount: triangleCount,
    visibleTriangleCount: triangleCount,
    removedTriangleCount: 0,
    baseCapTriangleCount,
    baseCapRemoved: false,
    occluderBodyIds: [],
    bounds: boundsOf(positions),
  });
}

/**
 * The vein's branch bearings, read off published geometry.
 *
 * The portal's stone bows over the seam, so it has to know where the seam runs.
 * Reading it from the published profile rather than recomputing it means the
 * scene and the artifact cannot disagree — and means the scene never touches
 * growth state, which is not its to read.
 */
export function crystalVeinBearings(meshes: readonly CrystalMeshData[]): readonly number[] {
  const substrate = meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID);
  return substrate?.profile.veinBearings ?? [];
}

/**
 * Півширина жили НА ГЛИБИНІ — консервативна межа для всього, що лежить
 * нижче нуля.
 *
 * Навіщо окремо від `crystalVeinRadiusAt`. Той вертає контур верхньої
 * поверхні, а тіло жили розширюється донизу: кільце коміра стоїть на
 * гребені (×`GEODE_COLLAR_REACH`), підошва ще ширша (×`FLOOR_FLARE`).
 * Тобто точка нижче нуля може бути ЗОВНІ контуру й усередині каменю, і
 * читач, який має лише контур, оголосив би ваду там, де її немає.
 *
 * Виміряно рівно це: базові кришки виходять за контур верхньої поверхні
 * на 0.3–1.5% висоти монарха (шість розмірів колонії), і всі до одної
 * лежать усередині коміра із запасом 0.9–4.5%. Тобто недобір
 * `baseCoverOf`, названий у ADR-0125 §7 відкритим, накритий тим, що
 * ADR-0115 поставив зовні контуру.
 *
 * Береться гребінь, а не підошва: гребінь вужчий, тож число лишається
 * межею, під яку не можна підлізти, а не найкращим випадком.
 */
export function crystalVeinBuriedRadiusAt(
  bodies: readonly GrowthBody[],
  artifactSeed: number,
  angle: number,
): number {
  if (bodies.length === 0) return 0;
  const monarchRadius = bodies.reduce((widest, body) => Math.max(widest, body.renderedRadius), 0);
  return veinRingRadius(
    crystalVeinRadiusAt(bodies, artifactSeed, angle),
    veinInnerRadius(monarchRadius),
    GEODE_COLLAR_REACH,
  );
}

/**
 * The vein's reach in a direction, without rebuilding the mesh. The portal uses
 * it to keep its stone and its gold rings clear of the seam.
 */
export function crystalVeinRadiusAt(
  bodies: readonly GrowthBody[],
  artifactSeed: number,
  angle: number,
): number {
  if (bodies.length === 0) return 0;
  const { capsules, nodeRadius } = veinCapsules(bodies, artifactSeed);
  return veinRadiusAt(angle, capsules, nodeRadius)
    * (1 + edgeNoise(artifactSeed, angle) * EDGE_NOISE);
}
