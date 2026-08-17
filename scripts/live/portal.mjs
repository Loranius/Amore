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
// ============================================================

const RELAY_HOSTS = ['**://*.supabase.co/**', '**://res.cloudinary.com/**'];

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
export async function openPortal({ baseUrl, device, tier, theme = null, headed = false, still = false }) {
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
  const logs = [];
  page.on('console', (message) => logs.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => logs.push({ type: 'pageerror', text: error.message }));

  await page.addInitScript(({ memory, cores, wanted }) => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => memory });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores });
    if (wanted !== null) {
      try { window.localStorage.setItem('amore:theme', wanted); } catch { /* приватний режим */ }
    }
  }, { memory: tier.memory, cores: tier.cores, wanted: theme });

  for (const pattern of RELAY_HOSTS) await page.route(pattern, relay);

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
  await page.evaluate((hash) => { window.location.hash = hash.replace(/^#/, ''); }, path);
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
