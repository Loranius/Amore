import { round6, seededUnit } from '../growth/math';
import type { GrowthBody } from '../growth';
import { rebuildCrystalMeshNormals } from './mesh';
import type {
  CrystalBodyProfile,
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
  const turns = angle / (Math.PI * 2);
  const scaled = (turns - Math.floor(turns)) * EDGE_NOISE_POINTS;
  const index = Math.floor(scaled);
  const t = scaled - index;
  const left = seededUnit(seed, `vein:edge:${index % EDGE_NOISE_POINTS}`);
  const right = seededUnit(seed, `vein:edge:${(index + 1) % EDGE_NOISE_POINTS}`);
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
  // Профіль оголошує НАЙВИЩУ точку тіла: висота стінки, а не губи. Інакше
  // споживачі профілю (обрізка, межі) вважали б жеоду нижчою, ніж вона є.
  const profile = veinProfile(widest, height + wallHeight, depth, veinBearings(bodies));

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

  const inner = Math.max(1e-4, monarchRadius * 0.92);
  /**
   * One ring. `toward` is 1 at the vein's outline and 0 at the monarch's
   * footprint; `y` of null means the ring follows the fissure's own floor.
   */
  const pushRing = (toward: number, y: number | null): void => {
    ringStarts.push(positions.length / 3);
    for (let segment = 0; segment < OUTLINE_SEGMENTS; segment += 1) {
      const angle = (segment / OUTLINE_SEGMENTS) * Math.PI * 2;
      const edge = outline[segment]!;
      const radius = edge <= inner ? edge : inner + (edge - inner) * toward;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      positions.push(round6(x), round6(y ?? topHeightAt(x, z)), round6(z));
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
  pushRing(FLOOR_FLARE, -depth);
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

  const triangleCount = indices.length / 3;
  return rebuildCrystalMeshNormals({
    meshVersion: 1,
    bodyId: CRYSTAL_SUBSTRATE_BODY_ID,
    hostBodyId: null,
    lod: 'high',
    profile: { ...profile, seamTriangleCount, seamRimHeight: height, geodeWallHeight: wallHeight },
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
