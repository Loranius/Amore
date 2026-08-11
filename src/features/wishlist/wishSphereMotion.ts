// ============================================================
// Кулі бажань рухаються — інерція, зіткнення, тертя.
// ------------------------------------------------------------
// Власник попросив повернути те, що було в бульбашок: кулю можна штовхнути,
// вона летить, б'є сусідів і поступово зупиняється — «як кулі в більярді».
//
// **Чому окремий чистий модуль.** Фізику неможливо перевірити знімком: чи
// зберігся імпульс, чи не проліз хтось крізь сусіда, чи все зупиняється —
// це властивості кроку, а не картинки. Тут вони під тестом, а компонент
// лишається тонким шаром, який кличе `stepWishSpheres` щокадру й пише
// результат у DOM.
//
// **Чому не фізичний рушій.** §18 брифу забороняє physics engine у цьому
// модулі прямим текстом, і він має рацію: тут щонайбільше шістнадцять кіл на
// площині. Перебір усіх пар — 120 перевірок на кадр; будь-яка бібліотека
// коштувала б більше самим фактом свого існування.
//
// **Чому крок чистий.** Той самий вхід дає той самий вихід, тож поведінку
// можна відтворити в тесті до числа. Стан живе у виклику, а не тут.
// ============================================================

export interface WishSphereBody {
  id: number;
  /** Положення центра в пікселях поля. */
  x: number;
  y: number;
  /** Швидкість у пікселях за секунду. */
  vx: number;
  vy: number;
  radius: number;
  /** Місце кулі в сузір'ї — те, яке дала розкладка. Сюди вона повертається. */
  homeX: number;
  homeY: number;
  /** Скільки секунд поспіль кулю ніхто не чіпав. */
  calm: number;
}

// Силует монарха більше не борт.
//
// Власник: «кристал має стати фоном, а не активним об'єктом у модулі
// вішліста». Поки куля від нього відскакувала, він був об'єктом столу — і саме
// з цього росли обидві виміряні тут вади: смуга праворуч від каменю вужча за
// кулю, тож легального місця там не існувало взагалі, і кулю доводилось
// виштовхувати вгору по схилу, щоб вона не застрягла назавжди.
//
// Тепер бортами лишились тільки краї кадру, а фон відсувають назад приглушення
// й розмиття — засоби презентації, а не фізики.

export interface WishSphereWorld {
  width: number;
  height: number;
  /** Куля, яку зараз тримає палець: вона не рухається сама, але штовхає інших. */
  held?: number | null | undefined;
}

/**
 * Скільки швидкості лишається за секунду вільного руху.
 *
 * Експонента, а не віднімання: крок кадру плаває від 8 до 20 мілісекунд, і
 * лінійне тертя робило б рух залежним від частоти кадрів — на швидкому екрані
 * куля котилась би далі. Той самий підхід, що в директора сцени (ADR-0022).
 */
const FRICTION_PER_SECOND = 0.12;

/** Скільки швидкості лишається після удару. Не гума й не пластилін. */
const RESTITUTION = 0.62;
/** Стінки кадру гасять сильніше за зіткнення: край — не куля. */
const WALL_RESTITUTION = 0.5;

/**
 * Нижче цієї швидкості куля вважається нерухомою, пікселів за секунду.
 *
 * Без порогу вона нескінченно повзе на мікрошвидкостях: очі цього не бачать,
 * а цикл кадрів працює вічно й тримає телефон розбудженим.
 */
const REST_SPEED = 4;

/** Найбільший крок інтегрування, секунди — захист від тунелювання. */
const MAX_STEP = 1 / 30;

/**
 * Найбільший крок відліку спокою, секунди.
 *
 * Відлік — годинник, а не інтегрування, тож він іде за справжнім часом, а не
 * за обрізаним кроком фізики. Виміряно на живому порталі: у безголовому
 * Chromium сцена малюється програмно і кадри йдуть по три на секунду, тобто
 * `MAX_STEP` обрізав кожен утричі — за дев'ять справжніх секунд «спокою»
 * набігала одна, і сузір'я не збиралось ніколи. На повільному телефоні
 * сталося б те саме, тільки м'якше.
 *
 * Стеля все одно потрібна: після довгої відсутності вкладки перший кадр
 * приносить величезну різницю часу, і без обмеження куля перестрибнула б усе
 * вікно спроби, так і не рушивши з місця.
 */
const MAX_CALM_STEP = 0.25;

// ── Повернення в сузір'я ──
//
// Власник: «щоб вони м'яко поверталися у своє сузір'я за кілька секунд
// спокою». Стіл лишається столом — кулі так само котяться й б'ються, — але
// розсипана композиція збирається сама, без окремої кнопки.

/** Скільки секунд спокою до того, як сузір'я почне збиратись. */
const RETURN_AFTER = 2.6;

/**
 * Скільки секунд триває спроба повернутись.
 *
 * Не косметика, а гарантія зупинки. Місця в сузір'ї можуть стояти впритул, і
 * дві кулі, які тягне додому крізь одна одну, штовхались би вічно — а разом із
 * ними вічно крутився б цикл кадрів. Після цього вікна куля лишається там, де
 * є: краще на пів кроку не вдома, ніж телефон, що не засинає.
 */
const RETURN_WINDOW = 7;

/**
 * Швидкість зближення з домівкою: частка відстані за секунду.
 *
 * Експонента, а не тривалість: куля за півкроку від місця не має летіти так
 * само довго, як куля з іншого краю кадру. Половина шляху за ~0.53 с.
 */
const RETURN_RATE = 1.3;

/** Стеля швидкості повернення — щоб здалеку це був дрейф, а не постріл. */
const RETURN_MAX_SPEED = 220;

/** Частка старої швидкості за секунду при переході на курс додому. */
const RETURN_BLEND = 0.02;

/**
 * Ближче за це до свого місця куля вважається вдома.
 *
 * Число не з голови, і першу спробу (3 px) виміряв тест: куля спинялась за
 * 3.7 px від місця й далі не йшла. Так і має бути — на короткій відстані
 * бажана швидкість повернення (`away * RETURN_RATE`, ще й пригальмована
 * тертям і переходом на курс) падає під поріг нерухомості, і тертя її обнуляє.
 * Реальний рубіж — близько 4.7 px, тож поріг має лежати вище, інакше «вдома»
 * не настане ніколи і цикл кадрів крутитиметься до кінця вікна спроби.
 *
 * Шість пікселів око не бачить: власний дрейф сфери й так 3–7 px.
 */
const HOME_SETTLE = 6;

/**
 * Вище цієї швидкості куля вважається такою, що нею грають, а не такою, що
 * повертається. Стеля повернення (220) з запасом нижча: власний рух додому
 * ніколи не скидає власний же відлік спокою.
 */
const RETURN_INTERRUPT_SPEED = 320;

function atHome(body: WishSphereBody): boolean {
  return Math.hypot(
    finite(body.homeX, body.x) - body.x,
    finite(body.homeY, body.y) - body.y,
  ) <= HOME_SETTLE;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Один крок світу куль.
 *
 * Порядок навмисний: тертя → повернення → рух → стінки → зіткнення. Зіткнення
 * останні, бо саме вони мусять лишити картину без перекриттів; якби після них
 * ішов зсув від стінки, куля могла б знову опинитись у сусідові.
 */
export function stepWishSpheres(
  bodies: readonly WishSphereBody[],
  world: WishSphereWorld,
  delta: number,
): WishSphereBody[] {
  const elapsed = Math.max(0, finite(delta, 0));
  const dt = Math.min(MAX_STEP, elapsed);
  const calmStep = Math.min(MAX_CALM_STEP, elapsed);
  const width = Math.max(1, finite(world.width, 1));
  const height = Math.max(1, finite(world.height, 1));
  const held = world.held ?? null;

  // Поки палець на столі, спокою немає ні в кого: відлік до повернення має
  // починатись тоді, коли грати перестали, а не коли перестала рухатись одна
  // конкретна куля.
  const playing = held !== null;

  const next = bodies.map((body) => {
    const radius = Math.max(1, finite(body.radius, 1));
    const x = finite(body.x, width / 2);
    const y = finite(body.y, height / 2);
    const item: WishSphereBody = {
      id: body.id,
      x,
      y,
      vx: finite(body.vx, 0),
      vy: finite(body.vy, 0),
      radius,
      homeX: finite(body.homeX, x),
      homeY: finite(body.homeY, y),
      calm: playing ? 0 : Math.max(0, finite(body.calm, 0)),
    };
    if (item.id === held || dt === 0) return item;

    // Тертя й рух.
    const keep = Math.pow(FRICTION_PER_SECOND, dt);
    item.vx *= keep;
    item.vy *= keep;
    if (Math.hypot(item.vx, item.vy) < REST_SPEED) {
      item.vx = 0;
      item.vy = 0;
    }

    // Спокій і повернення.
    //
    // Відлік іде від швидкості, а не від «події»: удар сусіда — теж дотик,
    // хоч пальця в ньому й немає. Поріг із запасом вищий за стелю самого
    // повернення, інакше куля, що летить додому, щокадру скидала б собі ж
    // відлік і не долітала б ніколи.
    //
    // До порога відлік іде справжнім часом, після порога — часом фізики. Це не
    // хитрість, а дві різні величини в одному лічильнику: «скільки кулю не
    // чіпали» питається про годинник на стіні, а «скільки вона вже летить
    // додому» — про той самий час, яким рухається сама куля. Змішай їх — і на
    // повільних кадрах вікно спроби спливе на півдорозі: виміряно, куля
    // спинялась за півтори сотні пікселів від місця.
    if (!playing && Math.hypot(item.vx, item.vy) <= RETURN_INTERRUPT_SPEED) {
      item.calm += item.calm >= RETURN_AFTER ? dt : calmStep;
    } else {
      item.calm = 0;
    }
    if (item.calm >= RETURN_AFTER && item.calm < RETURN_AFTER + RETURN_WINDOW) {
      const dx = item.homeX - item.x;
      const dy = item.homeY - item.y;
      const away = Math.hypot(dx, dy);
      if (away > HOME_SETTLE) {
        const wanted = Math.min(RETURN_MAX_SPEED, away * RETURN_RATE);
        // Курс не підмінює швидкість, а переймає її: куля, яку ще несе,
        // згортає до свого місця дугою, а не зламом.
        const take = 1 - Math.pow(RETURN_BLEND, dt);
        item.vx += ((dx / away) * wanted - item.vx) * take;
        item.vy += ((dy / away) * wanted - item.vy) * take;
      }
    }

    item.x += item.vx * dt;
    item.y += item.vy * dt;

    // Стінки кадру.
    if (item.x - item.radius < 0) {
      item.x = item.radius;
      item.vx = Math.abs(item.vx) * WALL_RESTITUTION;
    } else if (item.x + item.radius > width) {
      item.x = width - item.radius;
      item.vx = -Math.abs(item.vx) * WALL_RESTITUTION;
    }
    if (item.y - item.radius < 0) {
      item.y = item.radius;
      item.vy = Math.abs(item.vy) * WALL_RESTITUTION;
    } else if (item.y + item.radius > height) {
      item.y = height - item.radius;
      item.vy = -Math.abs(item.vy) * WALL_RESTITUTION;
    }

    return item;
  });

  // Зіткнення кожної пари. Маса за площею: велика куля не відлітає від малої.
  for (let a = 0; a < next.length; a += 1) {
    for (let b = a + 1; b < next.length; b += 1) {
      const left = next[a]!;
      const right = next[b]!;
      let dx = right.x - left.x;
      let dy = right.y - left.y;
      let distance = Math.hypot(dx, dy);
      const wanted = left.radius + right.radius;
      if (distance >= wanted) continue;

      // Два центри в одній точці — напрямок беремо детермінованим, інакше
      // нормаль ділиться на нуль і обидві кулі стають NaN.
      if (distance < 1e-6) {
        dx = left.id <= right.id ? 1 : -1;
        dy = 0;
        distance = 1;
      }
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = wanted - distance;

      const leftMass = left.radius * left.radius;
      const rightMass = right.radius * right.radius;
      const leftHeld = left.id === held;
      const rightHeld = right.id === held;
      // Утримувана куля має нескінченну масу: палець сильніший за інерцію.
      const leftShare = leftHeld ? 0 : rightHeld ? 1 : rightMass / (leftMass + rightMass);
      const rightShare = rightHeld ? 0 : leftHeld ? 1 : leftMass / (leftMass + rightMass);

      left.x -= nx * overlap * leftShare;
      left.y -= ny * overlap * leftShare;
      right.x += nx * overlap * rightShare;
      right.y += ny * overlap * rightShare;

      // Обмін швидкістю вздовж нормалі. Дотична складова не змінюється — це
      // і дає ковзання по дотичній, за яким удар читається ударом.
      const approach = (right.vx - left.vx) * nx + (right.vy - left.vy) * ny;
      if (approach >= 0) continue;
      const impulse = (-(1 + RESTITUTION) * approach)
        / ((leftHeld ? 0 : 1 / leftMass) + (rightHeld ? 0 : 1 / rightMass));
      if (!leftHeld) {
        left.vx -= (impulse / leftMass) * nx;
        left.vy -= (impulse / leftMass) * ny;
      }
      if (!rightHeld) {
        right.vx += (impulse / rightMass) * nx;
        right.vy += (impulse / rightMass) * ny;
      }
    }
  }

  // Останній штрих — повернути всіх у кадр.
  //
  // Зіткнення розсовують кулі, і крайню з них може виштовхнути за борт уже
  // після того, як стінку перевірено. Тут лише положення: швидкість чіпати не
  // можна, інакше удар об сусіда біля краю читався б як удар об стінку.
  for (const item of next) {
    item.x = Math.min(width - item.radius, Math.max(item.radius, item.x));
    item.y = Math.min(height - item.radius, Math.max(item.radius, item.y));
  }

  return next;
}

/**
 * Чи все зупинилось — цикл кадрів можна не крутити.
 *
 * Нерухомості замало відколи кулі повертаються: куля, яку відкотили вбік і
 * відпустили, стоїть нерухомо всі перші дві з половиною секунди, і зупинений
 * тут цикл просто ніколи б не дожив до повернення. Тож спокій — це «стоїть І
 * стоїть на своєму місці», а для тих, кому додому не дійти, — «спроба
 * скінчилась».
 */
export function wishSpheresAtRest(bodies: readonly WishSphereBody[]): boolean {
  return bodies.every((body) => (
    body.vx === 0
    && body.vy === 0
    && (atHome(body) || finite(body.calm, 0) >= RETURN_AFTER + RETURN_WINDOW)
  ));
}
