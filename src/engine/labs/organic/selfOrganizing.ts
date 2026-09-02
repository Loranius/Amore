// ============================================================
// Самоорганізаційний ріст: дерево виборює світло, а не тягнеться до точок.
// ------------------------------------------------------------
// ЩО БУЛО ДО ЦЬОГО І ЧОМУ ЙОГО ЗАМІНЕНО.
//
// `spaceColonization.ts` будував стовбур ОКРЕМО — рівною жердиною від землі
// вгору, — а тоді чіпляв до неї гілки, що тягнулись до заздалегідь
// розкладених атракторів. Виміряно на живому дереві, і кожне число тут із
// того виміру:
//
//   • Радіус стовбура — `baseRadius * (1 - t * 0.58)`, тобто ІДЕАЛЬНО ЛІНІЙНИЙ
//     конус. Він не знав про гілки взагалі: скільки б їх не відходило й де б
//     вони не сиділи, стовбур звужувався тим самим кроком 0.0046 на вибірку.
//   • Стрункість (висота / діаметр основи) — 9.2. У справжніх дерев 20-60.
//     Тому стовбур читався довбнею, а не стовбуром.
//   • Перша гілка — на висоті 2.96 з 5.37, тобто на 55% висоти. Нижче не було
//     нічого: жердина з мітлою нагорі.
//   • Гілок усього 13, і `maxGeneration: 3` тримало стелю жорстко.
//
// Жодну з цих вад не можна виправити числом: вони не в параметрах, а в тому,
// що модель нічого не знала про причину, з якої дерева взагалі мають форму.
//
// ЩО ТУТ НАТОМІСТЬ. Модель самоорганізації (Palubicki et al., SIGGRAPH 2009,
// «Self-organizing tree models for image synthesis»). Дерево не тягнеться до
// точок — воно змагається за світло саме з собою:
//
//   1. ТІНЬОВА СІТКА. Кожен листковий пуп'янок кидає вниз піраміду тіні,
//      значення `a·b^(-q)` на глибині `q` комірок. Тіні додаються. Світло
//      пуп'янка — це те, що лишилось: `max(0, 1 - shadow)`.
//   2. СВІТЛО ЗБИРАЄТЬСЯ ДО КОРЕНЯ. Кожен вузол знає суму світла всіх своїх
//      нащадків — це `Q` у статті.
//   3. СИЛА РОСТУ РОЗХОДИТЬСЯ НАЗАД. Від кореня вниз по дереву `v`
//      розподіляється між продовженням і бічним пагоном за розширеною
//      моделлю Борхерта-Хонди з коефіцієнтом верхівкового панування `λ`.
//      Високе `λ` — дерево тягнеться вгору; низьке — розкидається вбік.
//   4. ПОБІГИ. Пуп'янок дістає `floor(v)` міжвузлів; довжина кожного
//      підтягується до `v / floor(v)`, щоб дрібна сила не зникала безслідно.
//   5. РАДІУС ЗА ТРУБКОВОЮ МОДЕЛЛЮ. `r^n = Σ r_дитини^n` — те саме правило да
//      Вінчі. Стовбур тепер ЗНАЄ про свої гілки: він товщає рівно там, де їх
//      несе, і не звужується там, де їх немає. Саме цього бракувало.
//
// НАПРЯМОК ПАГОНА — зважена сума трьох: куди ріс досі, куди світліше
// (від'ємний градієнт тіньової сітки) і тропізм (сила тяжіння вниз, потяг до
// світла вгору). Плюс «вузлуватість»: випадковий доворот, ОБЕРНЕНО пропорційний
// радіусу — товстий стовбур майже не в'ється, тонка гілочка в'ється помітно.
// Це з розбору `ez-tree`, і воно й дає ту нерівність, без якої дерево
// виглядає надрукованим.
//
// ЩО НЕ ЗМІНИЛОСЬ: опублікований контракт. На виході той самий
// `OrganicSkeletonState` — плаский список вузлів із `branchId`, `parentId`,
// `generation`, `position`, `direction`, `radius`, `terminal`. Тому все нижче
// за течією (кадри кривих, композиція, крона, корені, меш, бюджети) працює
// без жодної правки. Замінено закон, а не межі томів.
//
// ДЕТЕРМІНІЗМ. Жодного `Math.random`. Кожен випадковий доворот — це
// `seededUnit(seed, salt)` з іменованою сіллю, і кожен обхід іде за стабільним
// порядком (черга за `sequence`, тоді за `id`), бо порядок обходу тут впливає
// на форму.
// ============================================================
import {
  add,
  clamp,
  clamp01,
  cross,
  dot,
  lengthSquared,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  seededUnit,
} from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';
import type {
  OrganicSkeletonNode,
  OrganicSkeletonState,
} from './types';

export interface SelfOrganizingConfig {
  /** Піднімати щоразу, коли міняється сама формула росту. */
  rulesVersion: string;

  /** Скільки циклів росту прожити. Один цикл — один рік стосунків. */
  cycles: number;

  /**
   * Сила, яку дерево дістає на цикл, коли рік не назвав власної.
   */
  vigourPerCycle: number;

  /**
   * Сила КОЖНОГО РОКУ окремо — і це те, заради чого все інше.
   *
   * Рік, у якому пара жила ширше, дає довші пагони й більше гілок; порожній
   * рік лишає по собі коротке міжвузля. Саме тут історія перестає бути
   * підписом під деревом і стає його формою: на силует можна показати
   * пальцем і сказати, який рік був який.
   *
   * Коротший за `cycles` список добирається `vigourPerCycle`.
   */
  vigourByCycle?: readonly number[];
  /*
   * ВЕРХІВКОВЕ ПАНУВАННЯ Й ПОКАЗНИК ТРУБИ — ПО ЦИКЛАХ, А НЕ ОДНЕ НА ВСЕ.
   *
   * Обидва стали віковими (ADR-0091), і обидва подавались одним числом на
   * всю симуляцію. Отже щороку ВСЯ історія дерева перерощувалась із новим
   * значенням: торішній цикл, який колись ішов за λ=0.70, цього року йшов за
   * 0.69, і далі розходження компаундувалось. Виміряно наслідок — популяція
   * гілок гуляла від 38 до 87 залежно від року, а за нею ширина крони
   * (падінь 8-14 із 43, найгірше ×0.71) і кількість листя (8-15, ×0.73).
   *
   * Це пряме порушення `PRODUCT.md` §2 «минуле не переписується»: закритий
   * рік мусить рости так, як він ріс.
   *
   * `vigourByCycle` цього ніколи не порушував — він від початку по циклах.
   * Тепер так само й ці двоє: цикл `k` бере значення того віку, який дерево
   * мало НА ТОМУ циклі.
   */
  apicalControlByCycle?: readonly number[];
  pipeExponentByCycle?: readonly number[];

  // --- тіньова сітка ---
  /**
   * Ребро комірки — у ДОВЖИНАХ МІЖВУЗЛЯ, а не в одиницях сцени.
   *
   * ЧОМУ ВІДНОСНО. Спершу тут стояло абсолютне ребро, і `internodeLength`
   * через це переставав бути розміром: за 0.34 виростало дерево з 39 гілок, за
   * 0.20 — ГОЛИЙ СТОВБУР без жодної. Причина не в рості: сітка лишалась тієї
   * самої грубості, тож менше дерево цілком уміщалось у власну тінь і
   * скидало все, що відходило вбік.
   *
   * Прив'язка до міжвузля робить модель незалежною від масштабу: дерево вдвічі
   * менше й затінює себе вдвічі дрібніше, а `internodeLength` лишається тим,
   * чим має бути, — чистим розміром.
   */
  cellSizeRatio: number;
  /** `a` у `a·b^(-q)`: наскільки густо затіняє сам пуп'янок. */
  shadowStrength: number;
  /** `b` у `a·b^(-q)`: як швидко тінь слабшає з глибиною. */
  shadowDecay: number;
  /** На скільки комірок углиб опускається піраміда тіні. */
  shadowDepth: number;

  // --- розподіл сили ---
  /** Верхівкове панування `λ` ∈ (0,1). Більше — вужче й вище дерево. */
  apicalControl: number;
  /** Нижче цього сили не вистачає навіть на одне міжвузля. */
  minimumVigour: number;
  /**
   * Скидання гілок: скільки світла МУСИТЬ ЗІБРАТИ гілка загалом, щоб жити.
   *
   * САМЕ ЦЕ РОБИТЬ СТОВБУР СТОВБУРОМ. Пазушний пуп'янок є на кожному
   * міжвузлі, тож перші гілки закладаються біля самої землі — і без скидання
   * дерево виходить кущем: виміряно, перша гілка на 3% висоти. Живе дерево
   * їх не «не вирощує», воно їх ГУБИТЬ, коли крона піднялась і затінила
   * низ. Тому чиста висота стовбура тут не задана числом — вона наслідок
   * того, наскільки густа крона над нею.
   */
  sheddingLight: number;
  /** Скільки циклів гілці дається, перш ніж її почне судити світло. */
  sheddingGraceCycles: number;
  /**
   * Скільки голоду гілка витримує, перш ніж відмерти.
   *
   * ЧОМУ НЕ ПРОСТО ПОРІГ. Перша редакція скидала гілку тієї ж миті, коли її
   * світло падало нижче межі, — і це виявилось обривом, а не правилом.
   * Виміряно: зміна ребра тіньової комірки з 0.400 на 0.408 (пів відсотка!)
   * перекидала чисту висоту стовбура з 18% на 76%. Причина в тому, що
   * більшість гілок — це один-два вузли, тож їхнє `Q` тримається на СВІТЛІ
   * ОДНОГО пуп'янка, а воно стрибає між циклами.
   *
   * Тут голод НАКОПИЧУЄТЬСЯ: рік у тіні додає, рік на світлі віднімає, і
   * гілка гине, лише коли пробула в тіні досить довго. Фізика та сама, але
   * згладжена в часі — як воно й буває з деревом, що не помирає від одного
   * похмурого літа.
   */
  sheddingTolerance: number;

  // --- пагони ---
  /** Довжина міжвузля за одиничної сили. */
  internodeLength: number;
  /** Кут відходу бічного пагона від продовження, радіани. */
  branchAngleRad: number;
  /** Наскільки тримається попереднього напрямку. */
  directionWeight: number;
  /** Наскільки слухає світло (від'ємний градієнт тіні). */
  lightWeight: number;
  /** Тропізм БІЧНИХ гілок: вертикальна складова — то гравітропізм. */
  tropism: GrowthVec3;
  /** Розмах вузлуватості — найбільший доворот пагона, радіани. */
  gnarliness: number;
  /**
   * Тропізм ВЕРХІВКИ — стовбура й кожного продовження першого порядку.
   *
   * Тут стояла «жорсткість»: думка була, що товста гілка тримає напрямок
   * упертіше за тонку, і вона діяла б, якби радіус на місці росту про товщину
   * щось знав. Виміряно, що не знає: значення 0, 0.5, 1, 2 і 4 давали дерево
   * ДО ВУЗЛА однакове. Причина проста й, озирнувшись, очевидна — трубкова
   * модель робить товстою основу, а росте дерево КІНЧИКОМ, і кінчик завжди
   * тонкий. Пагін, що росте, і справді гнучкий; жорсткість там міряти нічого.
   *
   * Стовбур тримається вертикально не жорсткістю, а від'ємним гравітропізмом:
   * верхівковий пагін росте ПРОТИ сили тяжіння. Бічні гілки, навпаки,
   * плагіотропні — вони хиляться вниз, і саме тому стара крона на знімку
   * вивалювалась набік: вниз хилилось усе, включно зі стовбуром.
   */
  apicalTropism: GrowthVec3;

  // --- товщина ---
  /** Радіус наймолодшої гілочки. */
  tipRadius: number;
  /** Показник трубкової моделі: `r^n = Σ r_дитини^n`. Класичне значення 2. */
  pipeExponent: number;

  // --- стелі ---
  maxNodes: number;
  maxGeneration: number;
}

/** Пуп'янок — єдине місце, де дерево може продовжитись. */
interface Bud {
  /** Вузол, з якого він росте. */
  nodeIndex: number;
  /** `true` — продовження гілки, `false` — новий бічний пагін. */
  apical: boolean;
  direction: GrowthVec3;
  /** Скільки світла дістався цьому пуп'янку останнім циклом. */
  light: number;
  /** Сила росту, розподілена йому цього циклу. */
  vigour: number;
  branchId: string;
  generation: number;
  /** Порядок закладання — ним і тільки ним визначається обхід. */
  sequence: number;
}

/** Вузол у процесі росту. Публікується вже без цих службових полів. */
interface GrowingNode {
  id: string;
  branchId: string;
  parentIndex: number | null;
  generation: number;
  sequence: number;
  position: GrowthVec3;
  direction: GrowthVec3;
  childIndices: number[];
  /** Індекс дитини, що є ПРОДОВЖЕННЯМ гілки (не бічним пагоном). */
  apicalChildIndex: number | null;
  radius: number;
  /** Зібране світло піддерева — `Q` у статті. */
  gathered: number;
  terminal: boolean;
  /** Цикл, на якому вузол виріс — щоб дати молодій гілці відстрочку. */
  bornCycle: number;
  /** Накопичений голод кореневого вузла гілки. */
  starvation: number;
  /** Скинута гілка: не росте, не збирає світло й не публікується. */
  shed: boolean;
}

/**
 * Тіньова сітка.
 *
 * Розріджена навмисно: крона займає малу частку куба, в який вписана, і
 * щільний масив на `cellSize = 0.25` при кроні 6×6×6 — це 13 824 комірки, з
 * яких зайнято кілька сотень. Мапа за ключем комірки коштує пошук, але не
 * коштує пам'яті й — головне — не обмежує дерево наперед заданим об'ємом:
 * рости воно може куди виросте.
 */
class ShadowGrid {
  private readonly cells = new Map<string, number>();

  constructor(private readonly config: SelfOrganizingConfig) {}

  private key(x: number, y: number, z: number): string {
    return `${x}|${y}|${z}`;
  }

  private get cellSize(): number {
    return Math.max(this.config.cellSizeRatio * this.config.internodeLength, 1e-3);
  }

  private index(position: GrowthVec3): { x: number; y: number; z: number } {
    const size = this.cellSize;
    return {
      x: Math.floor(position.x / size),
      y: Math.floor(position.y / size),
      z: Math.floor(position.z / size),
    };
  }

  /**
   * Кладе піраміду тіні під пуп'янком.
   *
   * Піраміда, а не стовп: на глибині `q` комірок вона розходиться на `q`
   * комірок убік. Саме тому нижні гілки затінені сильніше за периферію — і
   * саме тому дерево саме собою виходить ширшим унизу й вужчим угорі, без
   * жодного правила про «форму крони».
   */
  add(position: GrowthVec3): void {
    const origin = this.index(position);
    const { shadowStrength, shadowDecay, shadowDepth } = this.config;
    for (let q = 0; q <= shadowDepth; q += 1) {
      const value = shadowStrength * shadowDecay ** -q;
      if (value <= 1e-6) break;
      for (let dx = -q; dx <= q; dx += 1) {
        for (let dz = -q; dz <= q; dz += 1) {
          const key = this.key(origin.x + dx, origin.y - q, origin.z + dz);
          this.cells.set(key, (this.cells.get(key) ?? 0) + value);
        }
      }
    }
  }

  /** Тінь у точці, обрізана одиницею: темніше за «зовсім темно» не буває. */
  at(position: GrowthVec3): number {
    const cell = this.index(position);
    return Math.min(1, this.cells.get(this.key(cell.x, cell.y, cell.z)) ?? 0);
  }

  /**
   * Світло, яке лишилось пуп'янку, БЕЗ його власної тіні.
   *
   * ВАДА, ЯКУ ЦЕ ВИПРАВЛЯЄ. Піраміда тіні починається у власній комірці
   * пуп'янка — так у статті, бо листок займає ту комірку. Але тоді пуп'янок,
   * який сидить на цьому ж вузлі, затінює САМ СЕБЕ: світло кожного починалось
   * не з одиниці, а з `1 − a`. За `a = 0.55` це означало, що будь-який
   * пуп'янок одразу втрачав більше половини світла, а два сусідні вузли
   * гасили одне одного до нуля.
   *
   * Наслідок було видно в розгортці: числа стрибали НЕМОНОТОННО — за `a=0.35`
   * перша гілка виходила на 74% висоти, а за сильнішої `a=0.55` раптом на
   * 30%. Параметр, від якого результат залежить не по порядку, — це не тонке
   * налаштування, а ознака, що міряється не те.
   *
   * Тут власний внесок віднімається рівно один раз: пуп'янок затінюють ті,
   * хто НАД ним, а не він сам.
   */
  lightForBudAt(position: GrowthVec3): number {
    const shadow = Math.max(0, this.rawAt(position) - this.config.shadowStrength);
    return Math.max(0, 1 - Math.min(1, shadow));
  }

  /** Тінь у комірці без обрізання одиницею — для віднімання власного внеску. */
  private rawAt(position: GrowthVec3): number {
    const cell = this.index(position);
    return this.cells.get(this.key(cell.x, cell.y, cell.z)) ?? 0;
  }

  /**
   * Куди світліше: від'ємний градієнт тіні, взятий шістьма пробами.
   *
   * НУЛЬОВИЙ ГРАДІЄНТ ПОВЕРТАЄ НУЛЬОВИЙ ВЕКТОР, А НЕ «ВГОРУ».
   *
   * Спершу тут при рівній тіні віддавалось `(0,1,0)` — мовляв, як ніщо не
   * затіняє, то найсвітліше вгорі. Звучить розумно, а на ділі це зробило
   * світло СТАЛИМ ПОТЯГОМ УГОРУ для всього дерева: сітка рідка, тож градієнт
   * нульовий майже скрізь, і кожна бічна гілка після першого ж міжвузля
   * повертала вертикально. На знімку вийшла не крона, а йоржик: вузька
   * колона листя вздовж стовбура, гілки притиснуті до нього.
   *
   * «Немає даних» має означати «немає впливу», а не «вгору»: тоді бічна
   * гілка зберігає той кут, під яким відійшла, а світло повертає її лише
   * там, де затінення справді нерівне.
   */
  brightestDirection(position: GrowthVec3): GrowthVec3 {
    const step = this.cellSize;
    const probe = (dx: number, dy: number, dz: number) => this.at({
      x: position.x + dx * step,
      y: position.y + dy * step,
      z: position.z + dz * step,
    });
    const gradient = {
      x: probe(1, 0, 0) - probe(-1, 0, 0),
      y: probe(0, 1, 0) - probe(0, -1, 0),
      z: probe(0, 0, 1) - probe(0, 0, -1),
    };
    if (lengthSquared(gradient) < 1e-12) return { x: 0, y: 0, z: 0 };
    return normalize(scale(gradient, -1), { x: 0, y: 0, z: 0 });
  }
}

/**
 * Золотий кут — той самий, яким живі рослини розводять листки навколо пагона
 * (філотаксис). Тут ним розводяться пазушні пуп'янки, щоб сусідні гілки не
 * дивились в один бік.
 */
const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));

/** Доворот навколо довільної осі — формула Родрігеса. */
function rotateAround(vector: GrowthVec3, axis: GrowthVec3, angle: number): GrowthVec3 {
  const k = normalize(axis, { x: 0, y: 1, z: 0 });
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return add(
    add(scale(vector, cos), scale(cross(k, vector), sin)),
    scale(k, dot(k, vector) * (1 - cos)),
  );
}

/**
 * Вузлуватість: доворот пагона на випадковий кут у випадковий бік, РАДІАНИ.
 *
 * Без неї кожна гілка виходить дугою циркуля, і дерево читається надрукованим.
 *
 * ЧОМУ ЦЕ ПРОСТО КУТ, А НЕ «ОБЕРНЕНО ПРОПОРЦІЙНО РАДІУСУ». Перша редакція
 * ділила на радіус — за зразком `ez-tree`, де товста гілка в'ється менше за
 * тонку. Але росте дерево КІНЧИКОМ, а кінчик за трубковою моделлю завжди
 * завтовшки з кінчик, тож ділення давало те саме число всім. Гірше: 0.028
 * поділити на 0.014 — це 2 радіани, і все впиралось у запобіжник 0.6.
 * Виміряно: 0.012, 0.028 і 0.05 давали дерево до вузла однакове — параметр
 * вдавав, що працює, а насправді був прибитий до стелі.
 *
 * Різниця «товсте в'ється менше» в цій моделі й так виходить сама: стовбур
 * дістає більше сили, отже довші міжвузля, отже той самий кут дає меншу
 * кривину на одиницю довжини.
 */
function gnarl(
  direction: GrowthVec3,
  amount: number,
  seed: number,
  salt: string,
): GrowthVec3 {
  if (amount <= 0) return direction;
  const { tangent, bitangent } = orthonormalBasis(direction);
  const angle = seededUnit(seed, `${salt}:angle`) * Math.PI * 2;
  const magnitude = (seededUnit(seed, `${salt}:magnitude`) * 2 - 1) * amount;
  const axis = add(scale(tangent, Math.cos(angle)), scale(bitangent, Math.sin(angle)));
  return normalize(rotateAround(direction, axis, magnitude), direction);
}

/** Напрямок бічного пагона: відхилити від батька й розвернути навколо нього. */
function lateralDirection(
  parent: GrowthVec3,
  angleRad: number,
  roll: number,
): GrowthVec3 {
  const { tangent, bitangent } = orthonormalBasis(parent);
  const axis = add(scale(tangent, Math.cos(roll)), scale(bitangent, Math.sin(roll)));
  return normalize(rotateAround(parent, axis, angleRad), parent);
}

/**
 * Збирає світло від пуп'янків до кореня.
 *
 * Вузли лежать у порядку створення, а батько завжди створений раніше за
 * дитину, тож один прохід у зворотному порядку — і кожен вузол уже має суму
 * своїх нащадків. Рекурсія тут не потрібна й була б гіршою: дерево на
 * п'ятнадцять років дає тисячі вузлів, а глибина стека не безкоштовна.
 */
function gatherLight(nodes: GrowingNode[], buds: readonly Bud[]): void {
  for (const node of nodes) node.gathered = 0;
  for (const bud of buds) {
    const node = nodes[bud.nodeIndex];
    if (node && !node.shed) node.gathered += bud.light;
  }
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]!;
    if (node.parentIndex === null || node.shed) continue;
    nodes[node.parentIndex]!.gathered += node.gathered;
  }
}

/**
 * Розподіляє силу росту від кореня до пуп'янків — розширена модель
 * Борхерта-Хонди.
 *
 * Вузол, що має і продовження, і бічний пагін, ділить свою силу так:
 *
 *   v_верх = v · (λ·Q_верх) / (λ·Q_верх + (1−λ)·Q_бік)
 *   v_бік  = v · ((1−λ)·Q_бік) / (λ·Q_верх + (1−λ)·Q_бік)
 *
 * Тобто ділиться пропорційно зібраному світлу, але з перекосом на користь
 * верхівки. `λ = 0.5` — чесна пропорція; вище — дерево тягнеться вгору,
 * нижче — розкидається вшир. Це ОДНЕ число задає різницю між тополею й
 * яблунею, і саме тому воно тут іменоване, а не вписане в формулу.
 */
function distributeVigour(
  nodes: readonly GrowingNode[],
  buds: readonly Bud[],
  rootVigour: number,
  apicalControl: number,
): Map<number, number> {
  const vigour = new Map<number, number>();
  if (nodes.length === 0) return vigour;
  vigour.set(0, rootVigour);

  const lambda = clamp(apicalControl, 0.01, 0.99);
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    const own = vigour.get(index) ?? 0;
    if (own <= 0 || node.childIndices.length === 0) continue;

    if (node.childIndices.length === 1) {
      vigour.set(node.childIndices[0]!, own);
      continue;
    }

    const apicalIndex = node.apicalChildIndex;
    let weightTotal = 0;
    const weights = node.childIndices.map((childIndex) => {
      const child = nodes[childIndex]!;
      const share = childIndex === apicalIndex ? lambda : 1 - lambda;
      const weight = share * child.gathered;
      weightTotal += weight;
      return weight;
    });

    // Світла нема ніде — ділимо порівну, щоб сила не зникла в нулі.
    if (weightTotal <= 1e-9) {
      const even = own / node.childIndices.length;
      for (const childIndex of node.childIndices) vigour.set(childIndex, even);
      continue;
    }
    node.childIndices.forEach((childIndex, order) => {
      vigour.set(childIndex, (own * weights[order]!) / weightTotal);
    });
  }

  // Пуп'янок дістає силу того вузла, на якому сидить.
  const budVigour = new Map<number, number>();
  for (const bud of buds) budVigour.set(bud.sequence, vigour.get(bud.nodeIndex) ?? 0);
  return budVigour;
}

/**
 * Скидання гілок: те, що робить стовбур стовбуром.
 *
 * Гілка, яка збирає замало світла на вузол, відмирає разом з усім, що на ній
 * росло. Це не прибирання «зайвого» — це причина, з якої в лісового дерева є
 * чиста висота стовбура, а в дерева серед поля гілки йдуть майже від землі.
 * Висота стовбура тут НЕ ЗАДАНА: вона виходить із того, наскільки густа крона
 * над низом.
 *
 * Молодій гілці дається відстрочка (`sheddingGraceCycles`): у рік, коли вона
 * щойно з'явилась, вона ще не встигла нічого зібрати, і судити її світлом
 * означало б убивати все одразу після появи.
 *
 */
function shedStarvedBranches(
  nodes: GrowingNode[],
  cycle: number,
  sheddingLight: number,
  graceCycles: number,
  tolerance: number,
): number {
  if (sheddingLight <= 0) return 0;

  /*
   * Судиться ПОВНЕ зібране світло гілки, а не світло на вузол.
   *
   * Перша редакція ділила на кількість вузлів — і вийшло навпаки: довга
   * здорова гілка збирає більше світла, але й вузлів має більше, тож «на
   * вузол» виглядала гіршою за однвузловий пеньок. Виміряно: гілок лишалось
   * 24 зі 118, а перша — аж на 69% висоти, тобто та сама жердина з мітлою,
   * тільки здобута з іншого боку. `Q` піддерева — і є та величина, якою
   * стаття міряє, чи гілка себе окупає.
   */
  const branchRoot = new Map<string, GrowingNode>();
  for (const node of nodes) {
    if (node.shed) continue;
    if (!branchRoot.has(node.branchId)) branchRoot.set(node.branchId, node);
  }

  /*
   * Судяться лише гілки, що встигли ВИРОСТИ. Пуп'янок, який ще жодного разу
   * не отримав сили, — це сплячий пуп'янок, а не голодна гілка: він нічого не
   * коштує дереву й може прокинутись, коли над ним звільниться світло.
   * Судити його світлом означало б вбивати сплячі бруньки за те, що вони
   * сплять.
   */
  const branchSize = new Map<string, number>();
  for (const node of nodes) {
    if (node.shed) continue;
    branchSize.set(node.branchId, (branchSize.get(node.branchId) ?? 0) + 1);
  }

  const doomed = new Set<string>();
  for (const [branchId, root] of branchRoot) {
    if (branchId === 'organic:trunk') continue;
    if (cycle - root.bornCycle < graceCycles) continue;
    if ((branchSize.get(branchId) ?? 0) < 2) continue;
    // Голод накопичується в тіні й розсмоктується на світлі.
    root.starvation = Math.max(0, root.starvation + (sheddingLight - root.gathered));
    if (root.starvation > tolerance) doomed.add(branchId);
  }
  if (doomed.size === 0) return 0;

  // Помирає гілка — помирає й усе, що на ній виросло. Батько завжди раніший
  // за дитину, тож одного прямого проходу досить.
  let shed = 0;
  for (const node of nodes) {
    if (node.shed) continue;
    const parent = node.parentIndex === null ? null : nodes[node.parentIndex]!;
    if (doomed.has(node.branchId) || (parent !== null && parent.shed)) {
      node.shed = true;
      shed += 1;
    }
  }
  return shed;
}

/**
 * Товщина за трубковою моделлю: `r^n = Σ r_дитини^n`.
 *
 * Правило да Вінчі — сума перерізів гілок дорівнює перерізу того, з чого вони
 * ростуть. Один прохід у зворотному порядку, як і збирання світла.
 *
 * САМЕ ЦЕ Й БУЛО ГОЛОВНОЮ ВАДОЮ СТАРОЇ МОДЕЛІ. Там радіус був заданий
 * наперед лінійним спадом і про гілки не знав нічого. Тут він НАСЛІДОК
 * гілок: стовбур товстий там, де несе багато, і тоншає рівно на тому місці,
 * де гілка відійшла.
 */
function applyPipeModel(nodes: GrowingNode[], tipRadius: number, exponent: number): void {
  const n = Math.max(1, exponent);
  for (const node of nodes) node.radius = tipRadius;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]!;
    if (node.shed) continue;
    let total = 0;
    let living = 0;
    for (const childIndex of node.childIndices) {
      const child = nodes[childIndex]!;
      if (child.shed) continue;
      total += child.radius ** n;
      living += 1;
    }
    if (living === 0) continue;
    node.radius = Math.max(tipRadius, total ** (1 / n));
  }
}

export interface BuildSelfOrganizingSkeletonInput {
  seed: number;
  config: SelfOrganizingConfig;
}

/**
 * Вирощує дерево циклами й публікує той самий скелет, що й раніше.
 *
 * Один цикл — один рік. Це не метафора для звіту: цикл ДОДАЄ пагони до вже
 * вирослого, нічого не переписуючи, тож минулі роки лишаються там, де
 * виросли, — рівно те, чого вимагає «минуле не переписується».
 */
export function buildSelfOrganizingSkeleton(
  input: BuildSelfOrganizingSkeletonInput,
): OrganicSkeletonState {
  const { seed, config } = input;
  const rulesVersion = config.rulesVersion.trim();
  if (!rulesVersion) {
    throw new Error('Self-organizing skeleton requires a non-empty rulesVersion.');
  }

  const nodes: GrowingNode[] = [];
  let grid = new ShadowGrid(config);
  let budSequence = 0;
  let branchSequence = 0;

  const root: GrowingNode = {
    id: 'organic:trunk:0',
    branchId: 'organic:trunk',
    parentIndex: null,
    generation: 0,
    sequence: 0,
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 1, z: 0 },
    childIndices: [],
    apicalChildIndex: null,
    radius: config.tipRadius,
    gathered: 0,
    terminal: false,
    bornCycle: -1,
    starvation: 0,
    shed: false,
  };
  nodes.push(root);

  let buds: Bud[] = [{
    nodeIndex: 0,
    apical: true,
    direction: { x: 0, y: 1, z: 0 },
    light: 1,
    vigour: 0,
    branchId: 'organic:trunk',
    generation: 0,
    sequence: budSequence++,
  }];

  const maxNodes = Math.max(2, Math.floor(config.maxNodes));
  let shedNodes = 0;
  const cycles = Math.max(0, Math.floor(config.cycles));
  let truncatedByNodeCap = false;

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    if (buds.length === 0) break;

    /*
     * 1. Тінь перекладається наново — від ЖИВИХ ПУП'ЯНКІВ, а не від усього,
     *    що колись виросло.
     *
     * ВАДА, ЯКУ ЦЕ ВИПРАВЛЯЄ, І ВОНА БУЛА ГОЛОВНОЮ. Перша редакція додавала
     * тінь у сітку на КОЖНЕ створене міжвузля й ніколи її не прибирала. Але
     * тінь у моделі кидає ЛИСТЯ, а не деревина: здерев'янілий стовбур
     * затіняв сам себе колоною вглиб, і кожна нижня гілка помирала від
     * нестачі світла, щойно над нею виростало кілька міжвузлів стовбура.
     *
     * Видно було це так: за будь-якої сили тіні перша гілка виходила на
     * 73-77% висоти. Тобто дерево вперто відтворювало ту саму жердину з
     * мітлою, заради позбавлення від якої модель і замінювалась.
     *
     * Тепер сітка щоцикла складається заново з тих місць, де СЬОГОДНІ є
     * пуп'янки. Заразом зникає й наближення, яким довелось би виправдовуватись:
     * тінь скинутої гілки більше нікого не затіняє, бо її просто немає.
     *
     * ЧЕСНО ПРО МЕЖУ ЦЬОГО ВИПРАВЛЕННЯ. Виміряно те було за швидкого спаду
     * тіні (1.6), коли колона стовбура справді переважала все інше. За
     * нинішнього повільного спаду (1.05) різниця майже зникла: накопичувальна
     * сітка й ця дають однакове число скинутих вузлів (203 проти 203 на
     * дев'яти циклах) і близьку кількість гілок. Тобто на СЬОГОДНІШНІХ числах
     * це вже не виправлення вади, а те, як модель має бути влаштована за
     * статтею. Тесту, який стеріг би саме цю різницю, немає — і його НЕ
     * написано навмисно, бо він проходив би з випадкової причини.
     */
    grid = new ShadowGrid(config);
    for (const bud of buds) grid.add(nodes[bud.nodeIndex]!.position);
    for (const bud of buds) {
      bud.light = grid.lightForBudAt(nodes[bud.nodeIndex]!.position);
    }

    // 2. Світло збирається до кореня.
    gatherLight(nodes, buds);

    // 2a. Голодні гілки відмирають — і аж тоді ділиться сила, щоб та, що
    // дісталась би мертвій, дісталась живим.
    shedNodes += shedStarvedBranches(
      nodes, cycle, config.sheddingLight, config.sheddingGraceCycles, config.sheddingTolerance,
    );
    buds = buds.filter((bud) => !nodes[bud.nodeIndex]!.shed);
    if (buds.length === 0) break;
    gatherLight(nodes, buds);

    // 3. Сила розходиться назад.
    const cycleVigour = config.vigourByCycle?.[cycle] ?? config.vigourPerCycle;
    const budVigour = distributeVigour(
      nodes,
      buds,
      Math.max(0, cycleVigour),
      config.apicalControlByCycle?.[cycle] ?? config.apicalControl,
    );

    // Порядок обходу впливає на форму, тож він заданий явно й стабільно.
    const ordered = [...buds].sort((left, right) => left.sequence - right.sequence);
    const nextBuds: Bud[] = [];
    /** Сплячі: сили не вистачило, але вони лишаються чекати наступного року. */
    const dormant: Bud[] = [];

    for (const bud of ordered) {
      bud.vigour = budVigour.get(bud.sequence) ?? 0;
      if (nodes[bud.nodeIndex]!.shed) continue;
      if (bud.generation > config.maxGeneration) continue;

      /*
       * ПУП'ЯНОК, ЯКОМУ НЕ ВИСТАЧИЛО СИЛИ, ЧЕКАЄ — А НЕ ГИНЕ.
       *
       * Це була найгірша вада першої редакції, і вона ховалась за одним
       * `continue`: пуп'янок, що не дотягнув до порога, просто не потрапляв
       * у список наступного циклу, тобто зникав назавжди. Отже щороку дерево
       * втрачало всі свої сплячі бруньки, і те, що з нього виростало,
       * залежало від того, хто саме цьогоріч опинився по потрібний бік
       * порога.
       *
       * У розгортці це було видно як ХАОС: за силою тіні 0.22 виходило 38
       * гілок, за 0.35 — дві, за 0.55 — знову 25. Параметр, від якого
       * результат стрибає в рази без порядку, нічого не налаштовує; це
       * означало, що зламано не число, а механізм.
       *
       * У живого дерева сплячі бруньки саме тому й сплячі: вони чекають
       * роками й прокидаються, коли над ними звільниться світло.
       */
      const metamers = Math.floor(bud.vigour);
      if (bud.vigour < config.minimumVigour || metamers < 1) {
        dormant.push(bud);
        continue;
      }
      // Сила, що не дотягла до цілого міжвузля, не зникає — вона подовжує ті,
      // що є. Інакше дерево з силою 1.9 росло б рівно як дерево з силою 1.0.
      const lengthScale = bud.vigour / metamers;

      let parentIndex = bud.nodeIndex;
      let direction = bud.direction;
      let stopped = false;
      // Пазушні пуп'янки закладаються на КОЖНОМУ міжвузлі, а не один на пагін.
      const axillary: { nodeIndex: number; direction: GrowthVec3; step: number }[] = [];

      for (let step = 0; step < metamers; step += 1) {
        if (nodes.length >= maxNodes) { truncatedByNodeCap = true; stopped = true; break; }
        const parent = nodes[parentIndex]!;
        const salt = `so:${bud.branchId}:${bud.sequence}:${cycle}:${step}`;

        // Напрямок: пам'ять + світло + тропізм, тоді вузлуватість. Товста
        // гілка тримається свого напрямку тим упертіше, чим вона товща.
        const towardsLight = grid.brightestDirection(parent.position);
        // Верхівка тягнеться вгору, бічні гілки хиляться вниз.
        const tropism = bud.generation === 0 ? config.apicalTropism : config.tropism;
        let next = normalize(add(
          add(scale(direction, config.directionWeight), scale(towardsLight, config.lightWeight)),
          tropism,
        ), direction);
        next = gnarl(next, config.gnarliness, seed, salt);

        const segmentLength = config.internodeLength * lengthScale;
        const position = roundVec(add(parent.position, scale(next, segmentLength)));
        // Дерево не росте в землю: гілка, що пішла нижче нуля, зупиняється.
        if (position.y < 0) { stopped = true; break; }

        const nodeIndex = nodes.length;
        nodes.push({
          id: `${bud.branchId}:${nodeIndex}`,
          branchId: bud.branchId,
          parentIndex,
          generation: bud.generation,
          sequence: nodeIndex,
          position,
          direction: roundVec(next),
          childIndices: [],
          apicalChildIndex: null,
          radius: config.tipRadius,
          gathered: 0,
          terminal: false,
          bornCycle: cycle,
          starvation: 0,
          shed: false,
        });
        parent.childIndices.push(nodeIndex);
        // Продовження гілки — це дитина того ж `branchId`; бічні пагони
        // отримають свій, і саме на цій різниці тримається `λ`.
        if (parent.branchId === bud.branchId) parent.apicalChildIndex = nodeIndex;

        /*
         * ПАЗУШНИЙ ПУП'ЯНОК НА КОЖНОМУ МІЖВУЗЛІ.
         *
         * Перша редакція закладала один бічний пагін на весь пагін, і дерево
         * на три роки виходило з чотирма гілками — тобто тією самою мітлою,
         * лише виміряною інакше. У живого дерева пазуха є в КОЖНОГО листка,
         * і саме тому гілок сотні.
         *
         * Вибухом це не загрожує, і не через стелю: пуп'янок, якому не
         * дісталось сили на ціле міжвузля, просто не росте. Кількість гілок
         * обмежує світло, а не лічильник, — у цьому й уся суть моделі.
         *
         * Кут повороту йде золотим кутом: у живих рослин листки саме так і
         * розходяться (філотаксис), і це заразом не дає двом сусіднім
         * пазухам дивитись в один бік.
         */
        axillary.push({
          nodeIndex,
          direction: lateralDirection(
            next,
            config.branchAngleRad,
            (nodes.length * GOLDEN_ANGLE_RAD)
              + seededUnit(seed, `${salt}:roll`) * 0.4,
          ),
          step,
        });

        parentIndex = nodeIndex;
        direction = next;
      }

      if (stopped && nodes.length >= maxNodes) break;

      // Верхівковий пуп'янок їде далі на кінець свого ж пагона.
      nextBuds.push({
        nodeIndex: parentIndex,
        apical: true,
        direction,
        light: 0,
        vigour: 0,
        branchId: bud.branchId,
        generation: bud.generation,
        sequence: budSequence++,
      });

      // І кожне міжвузля лишає по себе пазушний пуп'янок.
      if (bud.generation < config.maxGeneration) {
        for (const pending of axillary) {
          branchSequence += 1;
          nextBuds.push({
            nodeIndex: pending.nodeIndex,
            apical: false,
            direction: pending.direction,
            light: 0,
            vigour: 0,
            branchId: `organic:branch:${branchSequence}`,
            generation: bud.generation + 1,
            sequence: budSequence++,
          });
        }
      }
    }

    /*
     * Товщина перераховується ЩОЦИКЛА, а не лише наприкінці.
     *
     * ДВІ ВАДИ, ЯКІ ЦЕ ЗАКРИВАЄ, І ОБИДВІ БУЛИ НЕВИДИМІ. Доти трубкова модель
     * бігла один раз, після всього росту, — а отже ПІД ЧАС росту радіус
     * кожного вузла дорівнював радіусу кінчика. Від радіуса ж залежать двоє:
     *
     *   • жорсткість (товста гілка тримає напрямок) — вона просто не діяла:
     *     виміряно, значення 0, 0.5, 1, 2 і 4 давали дерево до вузла однакове;
     *   • вузлуватість, що ділиться на радіус, — тобто стовбур в'юнився
     *     рівно так само норовливо, як найтонша гілочка, хоч увесь сенс був
     *     у протилежному.
     *
     * Один зворотний прохід на цикл коштує стільки ж, скільки збирання
     * світла, і робить обидва числа справжніми.
     */
    applyPipeModel(
      nodes,
      config.tipRadius,
      config.pipeExponentByCycle?.[cycle] ?? config.pipeExponent,
    );

    // Сплячі йдуть у наступний цикл нарівні з новими.
    buds = [...nextBuds, ...dormant].sort((left, right) => left.sequence - right.sequence);
  }

  /*
   * Останній прохід іде показником ПОТОЧНОГО віку: товщина дерева — це те,
   * яке воно зараз, а не яким було на середині свого життя. Ріст же кожного
   * циклу відбувся за своїм — див. `pipeExponentByCycle`.
   */
  applyPipeModel(
    nodes,
    config.tipRadius,
    config.pipeExponentByCycle?.at(-1) ?? config.pipeExponent,
  );

  // Кінцевий вузол гілки — той, у кого немає дитини з тим самим `branchId`.
  for (const node of nodes) {
    node.terminal = !node.childIndices.some((childIndex) => {
      const child = nodes[childIndex]!;
      return !child.shed && child.branchId === node.branchId;
    });
  }

  const living = nodes.filter((node) => !node.shed);
  const published: OrganicSkeletonNode[] = living.map((node) => ({
    id: node.id,
    branchId: node.branchId,
    parentId: node.parentIndex === null ? null : nodes[node.parentIndex]!.id,
    attractorId: null,
    sequence: node.sequence,
    generation: node.generation,
    position: node.position,
    direction: node.direction,
    radius: round6(node.radius),
    terminal: node.terminal,
  }));

  return {
    organicSkeletonVersion: 1,
    rulesVersion,
    seed,
    nodes: published,
    diagnostics: {
      consumedAttractorIds: [],
      unresolvedAttractorIds: [],
      truncatedAttractorIds: truncatedByNodeCap ? ['self-organizing:node-cap'] : [],
      shedNodeCount: shedNodes,
      fallbackHostAttractorIds: [],
      maxGeneration: published.reduce((max, node) => Math.max(max, node.generation), 0),
    },
  };
}

/** Стеля світла в комірці — щоб тести могли спиратись на неї, а не вгадувати. */
export const SHADOW_CELL_MAXIMUM = 1;

export { clamp01 };
