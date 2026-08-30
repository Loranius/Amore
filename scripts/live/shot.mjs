#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { DEFAULTS, OptionError, ROUTES, parseShotArgs, shotName } from './options.mjs';
import {
  TONE_MAPPING_ACES,
  TONE_MAPPING_NONE,
  decodePng,
  facetSeparations,
  findPlateaus,
  scanBand,
} from './luminance.mjs';
import {
  ensureServer,
  goToRoute,
  openPortal,
  probeInk,
  probeSelectors,
  readJourneyMetrics,
  readSceneBreakdown,
  readSceneMetrics,
  readToneMapping,
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
  --ink=<css>                        колір елемента числом: чорнило, тло, контраст, відтінок
  --tap=<css>                        тапнути перший збіг і зняти кадр; можна кілька,
                                     вони йдуть послідовно (модалка → її вміст)
  --settle=<мс>                      скільки чекати після появи сцени (типово ${DEFAULTS.settle})
  --out=<тека>                       куди складати знімки (типово ${DEFAULTS.out})
  --port=<порт>                      dev-сервер (типово ${DEFAULTS.port})
  --keep-server                      не гасити піднятий сервер після роботи
  --seed=<ключ>=<значення>           записати в localStorage до запуску застосунку;
                                     можна кілька (напр. пам'ять минулого візиту)
  --no-login                         не входити в портал (щоб зняти сам екран входу)
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
        seed: options.seed,
        login: options.login,
      });
      try {
        for (const route of options.routes) {
          const name = shotName(route, device.name, options.tier.name, { still: options.still });
          await goToRoute(portal.page, route, { settle: options.settle });

          const file = `${outDir}/${name}.png`;
          await portal.page.screenshot({ path: file });

          const metrics = await readSceneMetrics(portal.page);
          const journey = await readJourneyMetrics(portal.page);
          const breakdown = options.breakdown
            ? await readSceneBreakdown(portal.page)
            : null;
          const tone = options.profile ? await readToneMapping(portal.page) : null;
          const probes = await probeSelectors(portal.page, options.probes);
          const inks = await probeInk(portal.page, options.inks);

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
          if (options.breakdown) {
            if (breakdown === null) {
              console.log('  розклад —  сцена не віддала себе: ручка є лише в dev-збірці.');
            } else {
              console.log(
                `  розклад  видимих ${breakdown.total} трикутників`
                + (breakdown.hidden > 0 ? `, прихованих ${breakdown.hidden}` : ''),
              );
              for (const row of breakdown.rows) {
                if (row.triangles === 0) continue;
                const share = breakdown.total > 0
                  ? ` ${(row.triangles / breakdown.total * 100).toFixed(1)}%`
                  : '';
                const many = row.instances > 1 ? ` ×${row.instances}` : '';
                const dark = row.visible ? '' : ' (приховано)';
                console.log(`    ${String(row.triangles).padStart(6)}${share.padStart(7)}  ${row.name}${many}${dark}`);
              }
            }
          }
          if (options.profile) {
            const image = decodePng(readFileSync(file));
            const band = {
              y0: Math.max(0, Math.min(image.height - 1, options.profile.y0)),
              y1: Math.max(1, Math.min(image.height, options.profile.y1)),
              x0: Math.max(0, options.profile.x0 ?? 0),
              x1: Math.min(image.width, options.profile.x1 ?? image.width),
            };
            const curve = tone?.toneMapping ?? TONE_MAPPING_NONE;
            const exposure = tone?.toneMappingExposure ?? tone?.exposure ?? 1;
            const columns = scanBand(image, band, { toneMapping: curve, exposure });
            const report = facetSeparations(findPlateaus(columns));
            const named = curve === TONE_MAPPING_ACES
              ? `ACES, експозиція ${exposure}`
              : curve === TONE_MAPPING_NONE
                ? 'без кривої'
                : `крива №${curve} — НЕ обернена, числа нижче в байтах екрана`;
            console.log(`  профіль  смуга y${band.y0}..${band.y1}, x${band.x0}..${band.x1} · ${named}`);
            if (report.plateaus.length === 0) {
              console.log('           жодного плато: у цій смузі тіла немає або воно все в градієнті');
            } else {
              for (const plateau of report.plateaus) {
                console.log(
                  `    x${String(plateau.from + band.x0).padStart(4)}..${String(plateau.to + band.x0).padEnd(4)}`
                  + `  яскравість сцени ${plateau.luminance.toFixed(4)}`,
                );
              }
              const percents = report.steps.map((step) => `${(step * 100).toFixed(0)}%`);
              console.log(`           між сусідніми гранями: ${percents.join(' · ') || '—'}`);
              console.log(
                `           МЕДІАНА ${(report.median * 100).toFixed(0)}%`
                + `, МАКСИМУМ ${(report.max * 100).toFixed(0)}%`
                + `  (кристал читається кристалом від 30%)`,
              );
            }
          }
          for (const [selector, found] of Object.entries(probes)) {
            console.log(`  ${selector} × ${found.count}`);
            if (found.count > 0) console.log(`    ${JSON.stringify(found.boxes)}`);
          }
          for (const [selector, ink] of Object.entries(inks)) {
            if (ink === null) {
              console.log(`  колір   ${selector} — не знайдено`);
              continue;
            }
            if (ink.unresolved) {
              console.log(`  колір   ${selector} — не розібрано: ${ink.unresolved}`);
              continue;
            }
            console.log(
              `  колір   ${selector}: ${ink.ink} (відтінок ${ink.inkHue ?? '—'}°)`
              + ` на ${ink.background}, контраст ${ink.contrast}:1`,
            );
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
            // Колір теж перевимірюється після тапу: те, що треба зважити,
            // здебільшого з'являється саме тут — архів, модалка, аркуш.
            if (options.inks.length > 0) {
              const after = await probeInk(portal.page, options.inks);
              for (const [selector, ink] of Object.entries(after)) {
                if (ink === null) {
                  console.log(`    після тапу колір ${selector} — не знайдено`);
                  continue;
                }
                if (ink.unresolved) {
                  console.log(`    після тапу колір ${selector} — не розібрано: ${ink.unresolved}`);
                  continue;
                }
                console.log(
                  `    після тапу колір ${selector}: ${ink.ink}`
                  + ` (відтінок ${ink.inkHue ?? '—'}°) на ${ink.background},`
                  + ` контраст ${ink.contrast}:1`,
                );
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
