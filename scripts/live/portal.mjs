import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

// ============================================================
// Жива перевірка — браузерна частина.
// ------------------------------------------------------------
// Тут зібрано те, чого не видно з коду й що коштувало цьому проєкту кількох
// хибних висновків. Кожна пастка нижче — виміряна, і кожна колись видала
// знімок, який виглядав правдою й нею не був:
//
// 1. **Service worker.** PWA кешує збірку, і сторінка показує вчорашній код
//    попри свіжий сервер. Двічі поспіль перевірка «виправлено» була зроблена
//    на старому файлі. Тому `serviceWorkers: 'block'` — не налаштування, а
//    умова достовірності.
// 2. **Supabase й Cloudinary** зі сторінки в цьому середовищі недосяжні, тож
//    запити йдуть реле через Node. І до відповіді додається
//    `access-control-allow-origin: *` — без нього WebGL відмовляється брати
//    текстуру, і фото бажань не з'являються, хоча мережа каже «200».
// 3. **WebGL** у безголовому Chromium працює лише зі SwiftShader.
// 4. **Профіль пристрою** сторінка читає з `navigator`; безголовий браузер
//    повідомляє власні числа, і без підміни перевіряється завжди одна гілка
//    якості.
// 5. **Час.** Директор сцени веде камеру в позу маршруту близько секунди
//    (ADR-0022), а текстури доїжджають ще пізніше. Знімок, зроблений одразу
//    після появи полотна, показує кадр, якого користувач не бачить.
// 6. **Кнопка React Query Devtools** накриває правий край дока. Вона є лише
//    в dev-збірці, а харнес знімає саме dev-сервер — тож `--tap` по «Ще»
//    звітував про успіх і не відкривав меню: клік з'їдав девтул. Ховається
//    стилем нижче.
// ============================================================

/**
 * Зовнішні хости, які браузер харнесу дістає ЛИШЕ через Node.
 *
 * У пісочниці в безголового Chromium немає прямого виходу назовні, тож
 * будь-який сторонній домен віддає `TypeError: Failed to fetch` — і мовчки,
 * бо це не помилка сторінки, а обірвана мережа.
 *
 * **Додавати сюди треба КОЖНОГО нового зовнішнього постачальника.** Карта
 * спогадів це вже довела: MapLibre створив полотно, WebGL завівся, canvas
 * стояв на місці — і жодного запиту до тайлів не пішло взагалі. У коді
 * все виглядало правильно; видно було тільки те, що екран лишився з
 * написом «Завантажую карту…».
 */
const RELAY_HOSTS = [
  '**://*.supabase.co/**',
  '**://res.cloudinary.com/**',
  // Тайли й стиль карти спогадів (ADR-0039).
  '**://tiles.openfreemap.org/**',
  // Геокодер: пошук місця й підпис точки, поставленої пальцем.
  '**://nominatim.openstreetmap.org/**',
  // Вотчліст: сама TMDB (пошук, discover, жанри) і її постери. Без
  // постерів колода свайпу малює чорні прямокутники, і перевіряти на
  // ній заливку вердикту немає на чому.
  '**://api.themoviedb.org/**',
  '**://image.tmdb.org/**',
];

/**
 * Де взяти Chromium.
 *
 * Спершу змінна оточення, далі готові збірки Playwright у цьому образі, і аж
 * потім — те, що знайде сам playwright-core. Без цього скрипт на чужій машині
 * падав би з «Executable doesn't exist», хоча браузер стоїть поруч.
 */
export function resolveChromium() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM?.trim();
  if (explicit) return explicit;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() || '/opt/pw-browsers';
  if (!existsSync(root)) return null;
  const builds = readdirSync(root)
    .filter((name) => name.startsWith('chromium-'))
    .sort()
    .reverse();
  for (const build of builds) {
    for (const relative of ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const candidate = join(root, build, relative);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Хто заходить у портал.
 *
 * Ті самі змінні, що й у приймальному тесті (`VISUAL_USER_NAME` /
 * `VISUAL_USER_PIN`) — одна домовленість про облікові дані, а не дві. Локально
 * їх можна тримати в `.env.live`, який не потрапляє в git.
 */
export function readCredentials(cwd = process.cwd()) {
  const env = { ...process.env };
  const file = join(cwd, '.env.live');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (match === null) continue;
      const [, key, value] = match;
      if (env[key] === undefined) env[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  const name = env.VISUAL_USER_NAME?.trim();
  const pin = env.VISUAL_USER_PIN?.trim();
  if (!name || !pin) {
    throw new Error(
      'Немає облікових даних. Додай VISUAL_USER_NAME і VISUAL_USER_PIN у середовище '
      + 'або у файл .env.live (він у .gitignore).',
    );
  }
  if (!/^\d+$/.test(pin)) throw new Error('VISUAL_USER_PIN має складатись лише з цифр.');
  return { name, pin };
}

async function serverAnswers(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Піднімає dev-сервер, якщо його ще немає.
 *
 * Повертає функцію зупинки: чужий сервер лишається жити, свій — гаситься.
 * Тримати це в скрипті означає, що перевірка є однією командою, а не трьома.
 */
export async function ensureServer(port, { silent = true } = {}) {
  const url = `http://127.0.0.1:${port}/`;
  if (await serverAnswers(url)) return { url, stop: async () => {}, reused: true };

  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    stdio: silent ? 'ignore' : 'inherit',
    detached: false,
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Не вдалося підняти dev-сервер.');
    if (await serverAnswers(url)) {
      return {
        url,
        reused: false,
        stop: async () => { child.kill('SIGTERM'); },
      };
    }
    await new Promise((resolve) => { setTimeout(resolve, 400); });
  }
  child.kill('SIGTERM');
  throw new Error(`Dev-сервер не відповів на ${url} за 60 секунд.`);
}

async function relay(route) {
  const request = route.request();
  try {
    const response = await fetch(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postData() ?? undefined,
    });
    const body = Buffer.from(await response.arrayBuffer());
    // Заголовок додається завжди: полотно бере текстуру лише з дозволеного
    // джерела, і без нього фото мовчки не з'являються.
    const headers = { 'access-control-allow-origin': '*' };
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (['content-encoding', 'content-length', 'transfer-encoding', 'access-control-allow-origin'].includes(lower)) return;
      headers[lower] = value;
    });
    await route.fulfill({ status: response.status, headers, body });
  } catch {
    await route.abort();
  }
}

/**
 * Відкриває портал під справжнім користувачем і лишає сторінку готовою.
 *
 * Повертає сторінку, зібрані повідомлення консолі й функцію закриття.
 */
/**
 * Стан, який портал пам'ятає МІЖ візитами.
 *
 * Свіжий контекст браузера — це завжди «перший раз», і частина порталу
 * саме на цьому й побудована: підпис «У кристалі N нових митей»
 * порівнює події з тим, що пара бачила минулого разу, тож на першому
 * візиті його не буває взагалі. Без засіву знімок такої вади не покаже
 * — він покаже екран, на якому все правильно мовчить.
 *
 * Пишеться до завантаження застосунку, тим самим `addInitScript`, що й
 * тема: після старту гак уже прочитав сховище й другого разу не читає.
 */
export async function openPortal({ baseUrl, device, tier, theme = null, headed = false, still = false, seed = [], login = true }) {
  const executablePath = resolveChromium();
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: !headed,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader-webgl',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    hasTouch: device.touch,
    isMobile: device.touch,
    locale: 'uk-UA',
    // Не налаштування, а умова достовірності — див. коментар угорі.
    serviceWorkers: 'block',
    // Заморожена сцена — єдиний спосіб порівнювати знімки.
    //
    // Виміряно: два запуски ОДНОГО коду розходяться на 10% пікселів, бо
    // камінь дихає, іскри мерехтять і камера ледь дрейфує. На такому шумі
    // питання «чи щось змінилось» відповіді не має. Портал уже поважає
    // `prefers-reduced-motion` — тут ним і користуємось.
    ...(still ? { reducedMotion: 'reduce' } : {}),
  });

  const page = await context.newPage();

  /*
   * Пастка №6 зі списку вгорі: девтули React Query накривають док.
   *
   * Вона живе лише в dev-збірці — пара її ніколи не побачить, — але
   * харнес знімає саме dev-сервер. Виміряно `elementsFromPoint` у точці
   * кнопки «Ще» (376, 875): найвищим елементом там `button.tsqd-open-btn`,
   * а не пункт навігації. Тому `--tap` по «Ще» ЗВІТУВАВ про успіх і не
   * відкривав меню: клік з'їдав девтул.
   *
   * Це рівно та вада, від якої харнес і мусить берегти, — знімок, на
   * якому «нічого не сталось», виглядає як робочий екран. Ховаємо
   * стилем, а не прапорцем збірки: девтули лишаються доступні тому, хто
   * запустить `--headed` і сам їх покличе.
   */
  await page.addStyleTag({ content: '.tsqd-open-btn, .tsqd-parent-container { display: none !important; }' })
    .catch(() => { /* сторінка ще порожня — стиль додасться нижче */ });
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement('style');
      style.textContent = '.tsqd-open-btn, .tsqd-parent-container { display: none !important; }';
      document.head.append(style);
    };
    if (document.head) hide();
    else document.addEventListener('DOMContentLoaded', hide, { once: true });
  });

  const logs = [];
  page.on('console', (message) => logs.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => logs.push({ type: 'pageerror', text: error.message }));

  await page.addInitScript(({ memory, cores, wanted, entries }) => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => memory });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores });
    if (wanted !== null) {
      try { window.localStorage.setItem('amore:theme', wanted); } catch { /* приватний режим */ }
    }
    for (const [key, value] of entries) {
      try { window.localStorage.setItem(key, value); } catch { /* приватний режим */ }
    }
  }, { memory: tier.memory, cores: tier.cores, wanted: theme, entries: seed });

  /*
   * Реле вішається на КОНТЕКСТ, а не на сторінку.
   *
   * `page.route` не бачить запитів із Web Worker, а карта тягне тайли саме
   * звідти. Виглядало це так: стиль, спрайти й TileJSON приїхали по 200,
   * жодної помилки в консолі — і жодного запиту на `.pbf`, тобто карта
   * назавжди лишалась із написом «Завантажую карту…». `context.route`
   * покриває і сторінку, і воркери.
   */
  for (const pattern of RELAY_HOSTS) await context.route(pattern, relay);

  /*
   * Екран входу не можна зняти, поки скрипт сам через нього проходить.
   *
   * А знімати його треба: це ПЕРШЕ, що пара бачить при холодному
   * старті, і саме він найдовше лишався поза оглядом — усі перевірки
   * починались уже всередині порталу.
   */
  if (!login) {
    await page.goto(`${baseUrl}#/login`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(1200);
    return { page, logs, close: async () => { await browser.close(); } };
  }

  const credentials = readCredentials();
  await page.goto(`${baseUrl}#/login`, { waitUntil: 'load', timeout: 60_000 });
  const who = page.getByRole('button', { name: credentials.name, exact: true }).first();
  await who.waitFor({ timeout: 30_000 });
  await who.click();
  for (const digit of credentials.pin) {
    await page.getByRole('button', { name: digit, exact: true }).first().click();
    await page.waitForTimeout(90);
  }
  await page.waitForURL((url) => !url.hash.startsWith('#/login'), { timeout: 30_000 });

  return {
    page,
    logs,
    close: async () => { await browser.close(); },
  };
}

/**
 * Переходить на маршрут і чекає, поки світ справді стане тим, що побачить пара.
 *
 * Чекає не час, а ознаку: полотно повідомляє про готовність рантайму власним
 * атрибутом. Час додається лише після неї — на приїзд камери й текстур.
 */
export async function goToRoute(page, path, { settle }) {
  /*
   * ПАСТКА №9: маршрут із запитом мовчки втрачав запит.
   *
   * Тут стояв лише `window.location.hash = …`, бо портал маршрутизується
   * хешем. Для `#/plans` це правда, а для `/?treeLod=low` — ні: рядок запиту
   * у хеш не потрапляє, сторінка лишається з тим `location.search`, з яким
   * завантажилась (тобто порожнім), і знімок показує ЗОВСІМ ІНШУ гілку, ніж
   * просили.
   *
   * Коштувало це хибного висновку рівно один раз: три прогони з
   * `?treeLod=low|medium|high` дали три однакові розклади сцени, і з цього
   * мало не народилось «прапорець LOD у дерева мертвий». Насправді мертвим
   * був перехід — у рушії LOD міняє сітку втричі (2 328 / 7 553 / 9 474
   * трикутники стовбура).
   *
   * Тому запит — це повне перезавантаження. Сесія переживає його в
   * localStorage, тож логін не втрачається.
   */
  const query = path.startsWith('?') || path.startsWith('/?');
  if (query) {
    await page.evaluate((href) => { window.location.href = href; }, path);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  } else {
    await page.evaluate((hash) => { window.location.hash = hash.replace(/^#/, ''); }, path);
  }
  await page.waitForTimeout(400);

  // Спершу ознака, і аж потім час.
  //
  // Полотно саме каже, коли конвеєр зібрано (`data-evolution-preview="ready"`)
  // і коли зонд рантайму дорахував draw calls (`data-evolution-runtime`).
  // Перша редакція питала `count()` одразу після переходу — а полотно тоді ще
  // не змонтоване, тож перевірка мовчки пропускалась і метрики виходили
  // порожніми. Тому спершу коротке очікування самої появи вузла.
  const mounted = await page
    .waitForSelector('[data-evolution-preview]', { timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (mounted) {
    await page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 30_000 }).catch(() => {});
    await page.waitForSelector('[data-evolution-runtime="ready"]', { timeout: 20_000 }).catch(() => {});
  }

  // «Наш шлях» — власна сцена з власним полотном, тож і власна ознака.
  //
  // Запас часу тут навмисно великий, і це наслідок пастки №6: сцена чекає, поки
  // доїде скайбокс, прилетить камера й народяться всі зірки, а під SwiftShader
  // кадри йдуть по три на секунду. Те, що на телефоні займе три секунди, тут
  // триває півхвилини — тому чекати треба ознаку, а не «розумний» ліміт.
  // Двадцять секунд на саму ПОЯВУ вузла, а не на готовність сцени.
  //
  // Було три, і цього не вистачало: маршрут лінивий, модуль сцени великий, а
  // dev-сервер компілює його на першому заході. Вузол не встигав змонтуватись,
  // перевірка мовчки пропускалась — і знімок виходив із недобудованої сцени,
  // яку потім читали як ваду. Рівно та пастка, від якої цей файл і застерігає.
  const journey = await page
    .waitForSelector('[data-journey]', { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (journey) {
    await page.waitForSelector('[data-journey="ready"]', { timeout: 180_000 }).catch(() => {});
  }

  // Зображення теж ознака: недовантажене фото дає порожню сферу, і знімок
  // виглядає як вада верстки. Виміряно — саме так і трапилось одного разу.
  await page
    .waitForFunction(
      () => Array.from(document.images).every((image) => image.complete),
      undefined,
      { timeout: 8_000 },
    )
    .catch(() => {});

  // Час лишається — але вже тільки на те, чого ознакою не спитаєш: приїзд
  // камери в позу маршруту (ADR-0022) і власне дихання сцени.
  await page.waitForTimeout(settle);
}

/** Те, що сцена публікує про себе — без цього доводиться вгадувати з картинки. */
export async function readSceneMetrics(page) {
  return page.evaluate(() => {
    const node = document.querySelector('[data-evolution-preview]');
    if (node === null) return null;
    const attr = (name) => node.getAttribute(name);
    return {
      quality: attr('data-evolution-quality'),
      bodies: attr('data-evolution-bodies'),
      meshes: attr('data-evolution-meshes'),
      triangles: attr('data-evolution-triangles'),
      drawCalls: attr('data-evolution-draw-calls'),
      renderedTriangles: attr('data-evolution-rendered-triangles'),
    };
  });
}

/**
 * Із чого складається сцена — по об'єктах, а не однією сумою.
 *
 * `gl.info.render.triangles` каже СКІЛЬКИ намальовано й не каже ЧИМ, а
 * бюджетна робота питає саме друге. Тут це вже коштувало хибного висновку:
 * гіпотеза «листя, терен і трава — головні витрати дерева» обіцяла −40%,
 * дала −5%, бо всі троє разом важили менше за четвертого, якого ніхто не
 * зважував. Обхід сцени робить таку помилку неможливою: видно всіх.
 *
 * Читає `window.__amoreEvolutionScene`, який `EvolutionRuntimeProbe` кладе
 * тільки в dev-збірці. У продакшні його немає, і функція чесно поверне null
 * замість того, щоб вигадати число.
 *
 * Рахує ГЕОМЕТРІЮ, а не намальоване: інстанси множаться на `count`, невидиме
 * (`visible === false`) позначається окремо, бо воно є в пам'яті й нема в
 * кадрі. Сума по видимих має сходитись із `renderedTriangles` — розбіжність
 * означає, що щось малюється двічі або відсікається камерою, і це теж знахідка.
 */
export async function readSceneBreakdown(page) {
  return page.evaluate(() => {
    const scene = window.__amoreEvolutionScene;
    if (!scene) return null;
    const rows = [];
    scene.traverse((object) => {
      const geometry = object.geometry;
      if (!geometry) return;
      const index = geometry.index;
      const position = geometry.attributes?.position;
      if (!position) return;
      const perInstance = index ? index.count / 3 : position.count / 3;
      const instances = typeof object.count === 'number' ? object.count : 1;
      let visible = object.visible;
      for (let node = object.parent; node && visible; node = node.parent) {
        if (!node.visible) visible = false;
      }
      // Ім'я рідко ставлять руками, тож беремо перше, що є: власне ім'я,
      // ім'я найближчого названого предка, інакше матеріал і вид геометрії —
      // «Mesh» на тридцяти рядках не відповідає ні на що.
      let label = object.name;
      if (!label) {
        for (let node = object.parent; node && !label; node = node.parent) {
          if (node.name) label = `${node.name}/${object.type}`;
        }
      }
      if (!label) {
        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        const parts = [geometry.type, material?.name || material?.type].filter(Boolean);
        label = parts.join(' · ') || object.type;
      }
      rows.push({
        name: label,
        type: object.type,
        instances,
        triangles: Math.round(perInstance * instances),
        visible,
      });
    });
    rows.sort((left, right) => right.triangles - left.triangles);
    const total = rows.reduce((sum, row) => sum + (row.visible ? row.triangles : 0), 0);
    const hidden = rows.reduce((sum, row) => sum + (row.visible ? 0 : row.triangles), 0);
    return { rows, total, hidden };
  });
}

/**
 * Те, що публікує про себе сцена «Нашого шляху».
 *
 * Окремо від `readSceneMetrics`, бо це інше полотно з іншим набором чисел:
 * там тіла й меші рушія, тут зірки, промені й кадрування камери.
 */
export async function readJourneyMetrics(page) {
  return page.evaluate(() => {
    const node = document.querySelector('[data-journey]');
    if (node === null) return null;
    const attr = (name) => node.getAttribute(name);
    return {
      state: attr('data-journey'),
      mode: attr('data-journey-mode'),
      focus: attr('data-journey-focus'),
      bloom: attr('data-journey-bloom'),
      quality: attr('data-journey-quality'),
      pixelRatio: attr('data-journey-pixel-ratio'),
      stars: attr('data-journey-stars'),
      edges: attr('data-journey-edges'),
      reach: attr('data-journey-reach'),
      radial: attr('data-journey-radial'),
      axial: attr('data-journey-axial'),
      span: attr('data-journey-span'),
      timeAxis: attr('data-journey-time-axis'),
      distance: attr('data-journey-distance'),
      drawCalls: attr('data-journey-draw-calls'),
      triangles: attr('data-journey-triangles'),
    };
  });
}

/** Скільки таких елементів на екрані і де вони — те, що доводилось міряти руками. */
export async function probeSelectors(page, selectors) {
  if (selectors.length === 0) return {};
  return page.evaluate((list) => {
    const result = {};
    for (const selector of list) {
      const nodes = Array.from(document.querySelectorAll(selector));
      result[selector] = {
        count: nodes.length,
        boxes: nodes.slice(0, 24).map((node) => {
          const box = node.getBoundingClientRect();
          return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
        }),
      };
    }
    return result;
  }, selectors);
}

/**
 * Колір елемента — числом, а не оком.
 *
 * Це існує тому, що око вже помилялось: бузкову кнопку в світлій темі
 * я двічі оголосив «рожевою» на знімку й один раз — «фіолетовою», не
 * маючи жодного числа. `--probe` міряє геометрію, і поки колір міряти
 * було нічим, кожен висновок про тему був здогадом.
 *
 * Повертає чорнило, тло під ним (перше НЕпрозоре вгору по предках) і
 * контраст між ними за WCAG — тобто рівно те, чим тема або доводиться,
 * або спростовується.
 */
export async function probeInk(page, selectors) {
  if (selectors.length === 0) return {};
  return page.evaluate((list) => {
    /*
     * Тільки `rgb()`/`rgba()`. Перша редакція брала будь-які числа з
     * рядка — і на `color-mix(in srgb, …)`, який Chromium подеколи не
     * згортає, вигрібала «82» з відсотка й звітувала майже чорне
     * чорнило там, де воно рожеве. Невідома форма має СКАЗАТИ, що вона
     * невідома, а не вгадатись.
     */
    const parse = (value) => {
      const text = value.trim();
      const rgb = /^rgba?\(([^)]+)\)/.exec(text);
      if (rgb) {
        const nums = (rgb[1].match(/[\d.]+/g) ?? []).map(Number);
        if (nums.length < 3) return null;
        return { r: nums[0], g: nums[1], b: nums[2], a: nums.length > 3 ? nums[3] : 1 };
      }
      /*
       * `color(srgb r g b)` — саме цю форму Chromium повертає для
       * `color-mix(in srgb, …)`, а портал будує нею майже кожен колір
       * модуля. Канали тут 0…1, не 0…255.
       */
      const srgb = /^color\(srgb ([^)]+)\)/.exec(text);
      if (srgb) {
        const nums = (srgb[1].match(/[\d.]+/g) ?? []).map(Number);
        if (nums.length < 3) return null;
        return {
          r: nums[0] * 255,
          g: nums[1] * 255,
          b: nums[2] * 255,
          a: nums.length > 3 ? nums[3] : 1,
        };
      }
      return null;
    };

    const opaqueBehind = (node) => {
      let current = node;
      while (current) {
        const colour = parse(getComputedStyle(current).backgroundColor);
        if (colour && colour.a >= 0.95) return colour;
        current = current.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };

    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const hex = ({ r, g, b }) =>
      `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

    /** Відтінок у градусах: саме він відрізняє фіолет від троянди. */
    const hue = ({ r, g, b }) => {
      const [R, G, B] = [r / 255, g / 255, b / 255];
      const max = Math.max(R, G, B);
      const min = Math.min(R, G, B);
      const d = max - min;
      if (d === 0) return null;
      let h;
      if (max === R) h = ((G - B) / d) % 6;
      else if (max === G) h = (B - R) / d + 2;
      else h = (R - G) / d + 4;
      return Math.round(((h * 60) + 360) % 360);
    };

    const result = {};
    for (const selector of list) {
      const node = document.querySelector(selector);
      if (!node) {
        result[selector] = null;
        continue;
      }
      const raw = getComputedStyle(node).color;
      const ink = parse(raw);
      if (!ink) {
        result[selector] = { unresolved: raw };
        continue;
      }
      const back = opaqueBehind(node);
      const light = luminance(ink);
      const dark = luminance(back);
      const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
      result[selector] = {
        ink: hex(ink),
        inkHue: hue(ink),
        background: hex(back),
        contrast: Math.round(ratio * 100) / 100,
      };
    }
    return result;
  }, selectors);
}

/**
 * Тап по КООРДИНАТІ, а не по селектору.
 *
 * Для сцени це єдиний спосіб: зірки живуть у полотні, і селектора в них немає.
 * Йде повним циклом `down → up`, бо сцена розрізняє дотик і перетягування саме
 * за рухом між ними.
 */
export async function tapPoint(page, { x, y }, { after = 1200 } = {}) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(after);
  return true;
}

/** Тап по першому збігу — те саме, що робить палець, разом із очікуванням. */
export async function tapSelector(page, selector, { after = 1200 } = {}) {
  const box = await page.evaluate((css) => {
    const node = document.querySelector(css);
    if (node === null) return null;
    const rect = node.getBoundingClientRect();
    return [rect.x + rect.width / 2, rect.y + rect.height / 2];
  }, selector);
  if (box === null) return false;
  await page.mouse.click(box[0], box[1]);
  await page.waitForTimeout(after);
  return true;
}
