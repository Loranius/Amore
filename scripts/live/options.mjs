// ============================================================
// Жива перевірка — розбір аргументів і пресети.
// ------------------------------------------------------------
// Винесено окремо від браузерної частини навмисно: це єдине тут, що можна
// перевірити тестом, і саме тут помилка коштує найдорожче. Помилка в розборі
// не падає — вона тихо знімає не той екран, і на знімок дивляться як на
// правду.
// ============================================================

/**
 * Екрани, на яких дивляться портал.
 *
 * `phone` — те, чим користується пара; решта є перевіркою, що нічого не
 * розсипалось. Ширини й щільність збігаються з приймальним тестом
 * (`playwright.config.ts`), щоб два шляхи не показували різні кадри.
 */
export const DEVICES = {
  phone: { width: 412, height: 915, scale: 2, touch: true },
  pixel: { width: 448, height: 998, scale: 2, touch: true },
  tablet: { width: 834, height: 1112, scale: 2, touch: true },
  wide: { width: 1280, height: 800, scale: 1, touch: false },
};

/**
 * Профілі пристрою, які підсовуються сторінці.
 *
 * Рушій вибирає якість із `navigator.deviceMemory` і `hardwareConcurrency`
 * (`resolveCrystalRendererQuality`). Безголовий Chromium повідомляє власні
 * числа, тож без підміни перевірка йшла б завжди по одному профілю — і
 * «низька» гілка не бачила б жодного ока.
 */
export const TIERS = {
  high: { memory: 8, cores: 8 },
  balanced: { memory: 8, cores: 6 },
  low: { memory: 4, cores: 4 },
};

/**
 * Короткі імена маршрутів — рівно ті, що є в `src/app/nav.ts`.
 *
 * Список закритий навмисно: помилка в назві має падати одразу, а не
 * відкривати головну через `*` і давати знімок «усе гаразд» для екрана,
 * якого ніхто не бачив.
 */
export const ROUTES = {
  home: '#/',
  wishlist: '#/wishlist',
  plans: '#/plans',
  shopping: '#/shopping',
  memories: '#/memories',
  journey: '#/journey',
  calendar: '#/calendar',
  schedule: '#/schedule',
  media: '#/media',
  culinary: '#/culinary',
  whereto: '#/whereto',
  game: '#/game',
  login: '#/login',
};

export const DEFAULTS = {
  port: 5199,
  out: '.live',
  device: 'phone',
  tier: 'high',
  /**
   * Скільки чекати після появи сцени, мілісекунди.
   *
   * Не примха: директор сцени веде камеру в позу маршруту близько секунди
   * (ADR-0022), а текстури бажань доїжджають ще пізніше. Знімок, зроблений
   * раніше, показує кадр, якого користувач ніколи не бачить.
   */
  settle: 4500,
};

class OptionError extends Error {}

/**
 * Смуга для профілю світла: `y0-y1` або `y0-y1,x0-x1`, у пікселях знімка.
 *
 * Без діапазону по X береться вся ширина — тіло однаково знаходиться за
 * плато, а тло стає крайніми плато й відкидається як силует.
 */
export function parseBand(value) {
  const parts = String(value ?? '').split(',');
  const range = (text, what) => {
    const match = /^(\d+)-(\d+)$/.exec(String(text).trim());
    if (!match) throw new OptionError(`--profile: ${what} має вигляд 100-200, а не «${text}».`);
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (to <= from) throw new OptionError(`--profile: ${what} — кінець має бути більшим за початок.`);
    return [from, to];
  };
  const [y0, y1] = range(parts[0], 'смуга по Y');
  if (parts.length === 1) return { y0, y1, x0: null, x1: null };
  const [x0, x1] = range(parts[1], 'смуга по X');
  return { y0, y1, x0, x1 };
}

function pick(map, value, what) {
  if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
  throw new OptionError(
    `Невідомий ${what}: «${value}». Доступні: ${Object.keys(map).join(', ')}.`,
  );
}

/** Маршрут → шлях із хешем. Невідоме коротке ім'я — помилка, а не здогадка. */
export function routePath(route) {
  const value = String(route).trim();
  if (value === '') throw new OptionError('Порожній маршрут.');
  if (value.startsWith('#') || value.startsWith('/?') || value.startsWith('?')) return value;
  if (Object.prototype.hasOwnProperty.call(ROUTES, value)) return ROUTES[value];
  if (value.startsWith('/')) return `#${value}`;
  throw new OptionError(
    `Невідомий маршрут: «${value}». Або одне з: ${Object.keys(ROUTES).join(', ')}, `
    + 'або шлях виду «#/wishlist?tab=partner».',
  );
}

/**
 * Ім'я файлу знімка — з маршруту, пристрою, профілю й того, чи сцена жива.
 *
 * Заморожений кадр має власний суфікс, і це не охайність: живий і застиглий
 * знімки того самого екрана відрізняються на десяту частину пікселів, і
 * переплутати їх означає порівняти шум із сигналом.
 */
export function shotName(route, device, tier, { still = false } = {}) {
  const slug = String(route)
    .replace(/^#\/?/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const base = slug === '' ? 'home' : slug;
  const withTier = tier === DEFAULTS.tier ? `${base}-${device}` : `${base}-${device}-${tier}`;
  return still ? `${withTier}-still` : withTier;
}

/** «120,340» → { x: 120, y: 340 }. CSS-пікселі від лівого верхнього кута кадру. */
function parsePoint(value) {
  const parts = String(value).split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
    throw new OptionError(`--tap-at приймає «x,y» у пікселях; дано «${value}».`);
  }
  return { x: parts[0], y: parts[1] };
}

function asList(value) {
  return String(value).split(',').map((item) => item.trim()).filter((item) => item !== '');
}

/**
 * `--seed=ключ=значення` → пара для `localStorage`.
 *
 * Значення може містити знак рівності (JSON-масив ключів, наприклад), тож
 * ділимо рівно один раз — по першому.
 */
export function parseSeed(raw) {
  const at = raw.indexOf('=');
  if (at <= 0) {
    throw new OptionError('--seed приймає форму ключ=значення, напр. --seed=amore:theme=light.');
  }
  return [raw.slice(0, at), raw.slice(at + 1)];
}

/**
 * Розбирає рядок команди.
 *
 * Усе, що не починається з `--`, є маршрутом. Прапорці приймають форму
 * `--ключ=значення`; повторювані (`--probe`) складаються.
 */
export function parseShotArgs(argv) {
  const routes = [];
  const devices = [];
  const probes = [];
  const inks = [];
  const taps = [];
  const tapPoints = [];
  const seed = [];
  const options = {
    tier: DEFAULTS.tier,
    port: DEFAULTS.port,
    out: DEFAULTS.out,
    settle: DEFAULTS.settle,
    theme: null,
    keepServer: false,
    headed: false,
    still: false,
    login: true,
    breakdown: false,
    profile: null,
  };

  for (const raw of argv) {
    if (!raw.startsWith('--')) {
      routes.push(routePath(raw));
      continue;
    }
    const [key, ...rest] = raw.slice(2).split('=');
    const value = rest.join('=');
    switch (key) {
      case 'device': devices.push(...asList(value)); break;
      case 'probe': probes.push(...asList(value)); break;
      // Колір числом: чорнило, тло й контраст. Око вже помилялось із темою.
      case 'ink': inks.push(...asList(value)); break;
      case 'tier': options.tier = value; break;
      case 'tap': taps.push(...asList(value)); break;
      // Дотик по координаті, а не по селектору. Для сцени це єдиний спосіб:
      // зірки живуть у полотні, і селектора в них немає.
      case 'tap-at': tapPoints.push(parsePoint(value)); break;
      case 'theme': options.theme = value; break;
      // Сховище ДО запуску застосунку: свіжий контекст браузера — це завжди
      // «перший раз», а частина порталу побудована саме на пам'яті між
      // візитами (підпис «У кристалі N нових митей» на першому візиті мовчить
      // за задумом). Без засіву знімок такої гілки не покаже взагалі.
      case 'seed': seed.push(parseSeed(value)); break;
      case 'out': options.out = value; break;
      case 'port': options.port = Number(value); break;
      case 'settle': options.settle = Number(value); break;
      case 'still': options.still = value !== 'false'; break;
      // Не входити в портал: єдиний спосіб зняти сам екран входу.
      case 'no-login': options.login = value === 'false'; break;
      // Розклад сцени по об'єктах. Сума трикутників не каже, куди вони пішли,
      // а бюджетна робота питає саме це — і вже раз помилилась, бо не питала.
      case 'breakdown': options.breakdown = value !== 'false'; break;
      // Профіль світла по смузі: `--profile=y0-y1` або `--profile=y0-y1,x0-x1`.
      case 'profile': options.profile = parseBand(value); break;
      case 'keep-server': options.keepServer = value !== 'false'; break;
      case 'headed': options.headed = value !== 'false'; break;
      default:
        throw new OptionError(`Невідомий прапорець --${key}.`);
    }
  }

  if (routes.length === 0) routes.push(ROUTES.home);
  if (devices.length === 0) devices.push(DEFAULTS.device);
  if (!Number.isFinite(options.port) || options.port <= 0) {
    throw new OptionError('--port має бути додатним числом.');
  }
  if (!Number.isFinite(options.settle) || options.settle < 0) {
    throw new OptionError('--settle має бути невід’ємним числом мілісекунд.');
  }
  if (options.theme !== null && options.theme !== 'dark' && options.theme !== 'light') {
    throw new OptionError('--theme приймає лише dark або light.');
  }

  const viewports = devices.map((name) => ({ name, ...pick(DEVICES, name, 'пристрій') }));
  const tier = pick(TIERS, options.tier, 'профіль');

  return {
    routes,
    devices: viewports,
    probes,
    inks,
    tier: { name: options.tier, ...tier },
    port: options.port,
    out: options.out,
    settle: options.settle,
    taps,
    tapPoints,
    seed,
    theme: options.theme,
    keepServer: options.keepServer,
    headed: options.headed,
    still: options.still,
    breakdown: options.breakdown,
    profile: options.profile,
    login: options.login,
  };
}

/** Скільки знімків дасть цей запуск — щоб CLI сказав це до, а не після. */
export function plannedShots(parsed) {
  const shots = [];
  for (const route of parsed.routes) {
    for (const device of parsed.devices) {
      shots.push({
        route,
        device: device.name,
        name: shotName(route, device.name, parsed.tier.name, { still: parsed.still }),
      });
    }
  }
  return shots;
}

export { OptionError };
