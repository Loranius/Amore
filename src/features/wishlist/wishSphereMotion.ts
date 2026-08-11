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
}

/** Силует монарха в пікселях поля — кулі від нього відбиваються. */
export interface WishSphereObstacle {
  centreX: number;
  /** Висота вершини; вище неї перешкоди немає. */
  tipY: number;
  /** Півширина біля вершини і біля низу кадру. */
  tipWidth: number;
  baseWidth: number;
}

export interface WishSphereWorld {
  width: number;
  height: number;
  obstacle?: WishSphereObstacle | undefined;
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

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Один крок світу куль.
 *
 * Порядок навмисний: тертя → рух → стінки → перешкода → зіткнення. Зіткнення
 * останні, бо саме вони мусять лишити картину без перекриттів; якби після них
 * ішов зсув від стінки, куля могла б знову опинитись у сусідові.
 */
export function stepWishSpheres(
  bodies: readonly WishSphereBody[],
  world: WishSphereWorld,
  delta: number,
): WishSphereBody[] {
  const dt = Math.min(MAX_STEP, Math.max(0, finite(delta, 0)));
  const width = Math.max(1, finite(world.width, 1));
  const height = Math.max(1, finite(world.height, 1));
  const held = world.held ?? null;

  const next = bodies.map((body) => {
    const radius = Math.max(1, finite(body.radius, 1));
    const item: WishSphereBody = {
      id: body.id,
      x: finite(body.x, width / 2),
      y: finite(body.y, height / 2),
      vx: finite(body.vx, 0),
      vy: finite(body.vy, 0),
      radius,
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

  // Монарх — теж борт, а не порожнє місце.
  //
  // Без цього куля, кинута в центр, лягала б просто на камінь: ієрархія
  // «монарх → бажання» трималась би лише доти, доки нікому не спало б на думку
  // щось кинути.
  const obstacle = world.obstacle;
  if (obstacle !== undefined) {
    const axis = finite(obstacle.centreX, width / 2);
    const tip = finite(obstacle.tipY, height);
    const near = Math.max(0, finite(obstacle.tipWidth, 0));
    const far = Math.max(near, finite(obstacle.baseWidth, 0));
    pushOutOfObstacle(next, { axis, tip, near, far, width, height, held, dt }, true);
  }

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

  // Перешкода ще раз, уже без відскоку.
  //
  // Зіткнення розсовують кулі після того, як силует перевірено, — і сусід
  // цілком може заштовхати когось назад на камінь. Виміряно тестом: без цього
  // проходу куля лишалась за десять пікселів усередині монарха. Тут лише
  // положення: швидкість свій відскок уже отримала.
  if (obstacle !== undefined) {
    pushOutOfObstacle(
      next,
      {
        axis: finite(obstacle.centreX, width / 2),
        tip: finite(obstacle.tipY, height),
        near: Math.max(0, finite(obstacle.tipWidth, 0)),
        far: Math.max(Math.max(0, finite(obstacle.tipWidth, 0)), finite(obstacle.baseWidth, 0)),
        width,
        height,
        held,
        dt,
      },
      false,
    );
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

interface ObstacleFrame {
  axis: number;
  tip: number;
  near: number;
  far: number;
  width: number;
  height: number;
  held: number | null;
  dt: number;
}

/** Як швидко камінь виштовхує кулю вгору, пікселів за секунду. */
const SLIDE_SPEED = 900;

/**
 * Виштовхує кулі із силуету монарха.
 *
 * Утримувана куля виняток: поки її веде палець, вона слухає палець, а не
 * камінь. Інакше перетягування через центр екрана відчувалось би як боротьба з
 * інтерфейсом. Щойно її відпустять, вона перестає бути винятком і наступний же
 * крок виставить її назовні.
 */
function pushOutOfObstacle(bodies: WishSphereBody[], frame: ObstacleFrame, bounce: boolean): void {
  for (const item of bodies) {
    if (item.id === frame.held) continue;
    if (item.y + item.radius < frame.tip) continue;
    const depth = Math.min(
      1,
      Math.max(0, (item.y - frame.tip) / Math.max(1e-6, frame.height - frame.tip)),
    );
    const halfWidth = frame.near + depth * (frame.far - frame.near) + item.radius;
    const offset = item.x - frame.axis;
    if (Math.abs(offset) >= halfWidth) continue;

    const side = offset === 0 ? (item.id % 2 === 0 ? -1 : 1) : Math.sign(offset);
    const wanted = frame.axis + side * halfWidth;
    if (wanted - item.radius >= 0 && wanted + item.radius <= frame.width) {
      item.x = wanted;
      if (bounce) item.vx = side * Math.abs(item.vx) * RESTITUTION;
      continue;
    }

    // Убік нема куди — і це не крайній випадок, а звичайний.
    //
    // Монарх стоїть правіше центру, тож смуга між ним і правим краєм вужча за
    // саму кулю: легального місця з того боку не існує взагалі. Виміряно —
    // куля застрягала там назавжди, за десять пікселів усередині каменю, бо
    // виштовхування вбік щоразу відміняв упор у край кадру.
    //
    // Камінь звужується догори, тож вихід є завжди — угору. Не стрибком:
    // куля з'їжджає по схилу, поки не звільниться, і це читається як
    // виштовхування, а не як телепорт крізь камінь.
    const ceiling = frame.tip - item.radius;
    if (item.y > ceiling) {
      item.y = Math.max(ceiling, item.y - SLIDE_SPEED * frame.dt);
      if (bounce) item.vy = Math.min(item.vy, -SLIDE_SPEED * 0.35);
    }
  }
}

/** Чи все зупинилось — цикл кадрів можна не крутити. */
export function wishSpheresAtRest(bodies: readonly WishSphereBody[]): boolean {
  return bodies.every((body) => body.vx === 0 && body.vy === 0);
}
