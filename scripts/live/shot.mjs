#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULTS, OptionError, ROUTES, parseShotArgs, shotName } from './options.mjs';
import {
  ensureServer,
  goToRoute,
  openPortal,
  probeSelectors,
  readJourneyMetrics,
  readSceneMetrics,
  tapPoint,
  tapSelector,
} from './portal.mjs';

// ============================================================
// npm run live -- <маршрут…> [прапорці]
// ------------------------------------------------------------
// Одна команда замість «підняти сервер, залогінитись, дочекатись сцени, зняти
// екран» щоразу заново. Знімки лягають у `.live/` (у .gitignore), а поруч із
// ними в консоль іде те, що інакше довелось би міряти руками: метрики сцени,
// кількість і координати елементів, помилки сторінки.
// ============================================================

const USAGE = `
Жива перевірка порталу.

  npm run live -- <маршрут…> [прапорці]

Маршрути: ${Object.keys(ROUTES).join(', ')} — або шлях виду «#/wishlist?tab=partner».

Прапорці:
  --device=phone|pixel|tablet|wide   можна кілька через кому (типово phone)
  --tier=high|balanced|low           профіль пристрою (типово high)
  --theme=dark|light                 тема порталу
  --probe=<css>                      порахувати й обміряти елементи; можна кілька
  --tap=<css>                        тапнути перший збіг і зняти кадр; можна кілька,
                                     вони йдуть послідовно (модалка → її вміст)
  --settle=<мс>                      скільки чекати після появи сцени (типово ${DEFAULTS.settle})
  --out=<тека>                       куди складати знімки (типово ${DEFAULTS.out})
  --port=<порт>                      dev-сервер (типово ${DEFAULTS.port})
  --keep-server                      не гасити піднятий сервер після роботи
  --still                            заморозити сцену (для порівняння знімків)
  --headed                           показати вікно браузера

Приклади:
  npm run live -- wishlist --probe=.wl-sphere
  npm run live -- home wishlist --device=phone,wide
  npm run live -- wishlist --tap=.wl-sphere --tier=low
  npm run live -- home --still --out=.live/before    # для live:diff

Облікові дані: VISUAL_USER_NAME і VISUAL_USER_PIN у середовищі або у .env.live.
`.trim();

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return;
  }

  const options = parseShotArgs(argv);
  const outDir = resolve(process.cwd(), options.out);
  mkdirSync(outDir, { recursive: true });

  const server = await ensureServer(options.port);
  console.log(
    `${server.reused ? 'Використовую' : 'Підняв'} dev-сервер на ${server.url}`,
  );

  let failures = 0;
  try {
    for (const device of options.devices) {
      const portal = await openPortal({
        baseUrl: server.url,
        device,
        tier: options.tier,
        theme: options.theme,
        headed: options.headed,
        still: options.still,
      });
      try {
        for (const route of options.routes) {
          const name = shotName(route, device.name, options.tier.name, { still: options.still });
          await goToRoute(portal.page, route, { settle: options.settle });

          const file = `${outDir}/${name}.png`;
          await portal.page.screenshot({ path: file });

          const metrics = await readSceneMetrics(portal.page);
          const journey = await readJourneyMetrics(portal.page);
          const probes = await probeSelectors(portal.page, options.probes);

          console.log(`\n${route}  ·  ${device.name} ${device.width}×${device.height}@${device.scale}  ·  ${options.tier.name}`);
          console.log(`  знімок  ${file}`);
          if (metrics !== null) {
            const value = (raw) => (raw === null || raw === '' ? '—' : raw);
            console.log(
              `  сцена   якість ${value(metrics.quality)}, тіл ${value(metrics.bodies)},`
              + ` мешів ${value(metrics.meshes)}, draw calls ${value(metrics.drawCalls)},`
              + ` трикутників ${value(metrics.renderedTriangles)}`,
            );
          }
          if (journey !== null) {
            const value = (raw) => (raw === null || raw === '' ? '—' : raw);
            console.log(
              `  шлях    ${value(journey.state)} (${value(journey.quality)},`
              + ` ×${value(journey.pixelRatio)}), зірок ${value(journey.stars)},`
              + ` променів ${value(journey.edges)}, радіус ${value(journey.radial)},`
              + ` півдовжина ${value(journey.axial)}, камера ${value(journey.distance)},`
              + ` вісь часу ${value(journey.timeAxis)}`,
            );
            console.log(
              `          draw calls ${value(journey.drawCalls)},`
              + ` трикутників ${value(journey.triangles)}`,
            );
          }
          for (const [selector, found] of Object.entries(probes)) {
            console.log(`  ${selector} × ${found.count}`);
            if (found.count > 0) console.log(`    ${JSON.stringify(found.boxes)}`);
          }

          // Дотики по координаті — для сцени, де селектора немає.
          for (const [index, point] of options.tapPoints.entries()) {
            await tapPoint(portal.page, point);
            const suffix = options.tapPoints.length > 1 ? `-at${index + 1}` : '-at';
            const tapFile = `${outDir}/${name}${suffix}.png`;
            await portal.page.screenshot({ path: tapFile });
            const after = await readJourneyMetrics(portal.page);
            console.log(`  дотик   ${point.x},${point.y} → ${tapFile}`);
            if (after !== null) {
              console.log(`          режим ${after.state === null ? '—' : after.mode ?? '—'},`
                + ` подія ${after.focus === '' || after.focus === null ? '—' : after.focus}`);
            }
          }

          // Тапи йдуть послідовно: другий шукає те, що з'явилось після
          // першого. Один тап не діставав до вмісту, який відкривається
          // всередині модалки — акордеон значення події перевірити було нічим.
          for (const [index, selector] of options.taps.entries()) {
            const hit = await tapSelector(portal.page, selector);
            if (!hit) {
              console.log(`  тап     ${selector} — не знайдено`);
              break;
            }
            const suffix = options.taps.length > 1 ? `-tap${index + 1}` : '-tap';
            const tapFile = `${outDir}/${name}${suffix}.png`;
            await portal.page.screenshot({ path: tapFile });
            console.log(`  тап     ${selector} → ${tapFile}`);
            if (options.probes.length > 0) {
              const after = await probeSelectors(portal.page, options.probes);
              for (const [probe, found] of Object.entries(after)) {
                console.log(`    після тапу ${probe} × ${found.count}`);
                if (found.count > 0) console.log(`      ${JSON.stringify(found.boxes)}`);
              }
            }
          }

          // Помилки сторінки друкуються завжди: мовчазна консоль — теж
          // результат, і його треба бачити поруч зі знімком.
          const errors = portal.logs
            .filter((entry) => entry.type === 'error' || entry.type === 'pageerror')
            .map((entry) => entry.text);
          const notable = errors.filter((text) => !/websocket|ERR_CONNECTION_RESET/i.test(text));
          if (notable.length > 0) {
            failures += notable.length;
            console.log(`  ПОМИЛКИ (${notable.length}):`);
            for (const text of notable.slice(0, 5)) console.log(`    ${text.slice(0, 180)}`);
          }
          portal.logs.length = 0;
        }
      } finally {
        await portal.close();
      }
    }
  } finally {
    if (!options.keepServer) await server.stop();
  }

  console.log(`\nГотово. Знімки: ${outDir}`);
  if (failures > 0) console.log(`Сторінка повідомила про ${failures} помилок — подивись вище.`);
}

main().catch((error) => {
  if (error instanceof OptionError) {
    console.error(`\n${error.message}\n`);
    console.error(USAGE);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
