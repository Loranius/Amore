// Живий скриншот гри «Дєвочка в городі» (ADR-0239). Див. CLAUDE.md, розділ про гру.
// node scripts/live/game-shot.mjs wide|phone "village||js:<код з c = window.__lifeGame>"
// Кадри — у .live/game/ (не в git). Перед кадром заморожуй світ: c.worldFrame = function () {}.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = `${ROOT}.live/game`;
mkdirSync(OUT, { recursive: true });
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
for (let i = 0; i < 60; i += 1) { try { const r = await fetch('http://localhost:5199/game.html'); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
// Аркуш усіх персонажів (сценарій `lineup:<ім'я>`): виконується в сторінці гри.
// Аркуші PixelLab і ще 16-піксельні мешканці й перехожі (до етапу 2) —
// в одному світовому масштабі (4 пікселі екрана на світовий), тож видно, хто
// з ким не в парі; Лєна з міні-ігор — там само. Для «до й після», коли
// перемальовуються люди.
async function lineup() {
  const P = await import('/src/features/game/life/render/people.ts');
  const H = await import('/src/features/game/life/render/peopleHd.ts');
  const R = await import('/src/features/game/life/render/residents.ts');
  const D = await import('/src/features/game/life/render/dog.ts');
  const X = await import('/src/features/game/life/render/pixel.ts');
  const K = await import('/src/features/game/life/games/kit.ts');
  const FL = await import('/src/features/game/life/games/farmLena.ts');
  const { rngFor } = await import('/src/features/game/life/sim/rng.ts');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hd = [['Лєна мала', P.LENA_KID], ['Лєна-підліток', P.LENA_TEEN], ['Лєна доросла', P.LENA_ADULT], ['Мама', P.MOM], ['Діма', P.DIMA], ['Оля мала', { ...P.OLYA, kid: true }], ['Оля-підліток', P.OLYA]];
  const lenas = [P.LENA_KID, P.LENA_TEEN, P.LENA_ADULT];
  for (let k = 0; k < 80 && !(hd.every(([, l]) => H.hasHdLook(l)) && lenas.every((l) => H.hasHdPoses(l))); k += 1) await sleep(100);
  const S = 4;
  const W = 1500;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = 4000;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#86c46a';
  g.fillRect(0, 0, W, c.height);
  // Basia 32×32 вантажиться при першому малюванні на щільності 2.
  X.setDensity(g, 2);
  D.drawDog(g, -50, -50, 0, false, 0);
  X.setDensity(g, 1);
  await sleep(600);
  let y = 0;
  const title = (t) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#1b1420';
    g.fillRect(0, y, W, 44);
    g.fillStyle = '#fff6e0';
    g.font = '800 24px Nunito, sans-serif';
    g.fillText(t, 16, y + 30);
    y += 56;
  };
  const label = (t, x, yy) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = '800 15px Nunito, sans-serif';
    g.fillStyle = '#1b1420';
    g.fillText(t, x, yy);
  };
  // Світові координати: (ox, oy) — точка між стопами на екрані.
  const at = (ox, oy, d, draw) => {
    g.setTransform(S, 0, 0, S, ox, oy);
    X.setDensity(g, d);
    draw();
    X.setDensity(g, 1);
    g.setTransform(1, 0, 0, 1, 0, 0);
  };
  const shadow = (look) => X.ellipse(g, 0, 0, look.kid ? 4 : 5, 2, 'rgba(28,20,40,0.28)');
  const px16 = (look, dir, frame) => () => {
    shadow(look);
    const img = P.sheetFor(look)[dir][frame];
    g.drawImage(img, Math.round(-img.width / 2), Math.round(-img.height + 2));
  };
  const pxHd = (look, dir, frame) => () => {
    shadow(look);
    H.drawPersonHd(g, look, 0, 0, dir, frame > 0, frame > 0 ? (frame - 1) / 8 + 0.01 : 0);
  };
  const CELL = 22 * S;
  const ROW = 40 * S;
  const strip = (name, x0, frames) => {
    label(name, x0, y + 18);
    frames.forEach((f, i) => at(x0 + CELL / 2 + i * CELL, y + ROW - 8, f.d, f.draw));
  };
  const DIRS = [0, 1, 2, 3];
  title('PixelLab 32×32 (вниз, ліворуч, праворуч, угору, далі хода вниз)');
  for (let i = 0; i < hd.length; i += 2) {
    for (let j = 0; j < 2 && i + j < hd.length; j += 1) {
      const [name, look] = hd[i + j];
      strip(name, 16 + j * 740, [...DIRS.map((d) => ({ d: 2, draw: pxHd(look, d, 0) })), ...[1, 2, 3].map((f) => ({ d: 2, draw: pxHd(look, 0, f) }))]);
    }
    y += ROW + 10;
  }
  strip('Бася', 16, DIRS.map((d) => ({ d: 2, draw: () => D.drawDog(g, 0, 0, d, false, 0) })));
  y += ROW + 10;
  title('Ще 16×16 до етапу 2: мешканці (вниз і праворуч)');
  const res = Object.entries(R.RESIDENT_LOOKS);
  for (let i = 0; i < res.length; i += 5) {
    res.slice(i, i + 5).forEach(([id, look], j) => strip(id, 16 + j * 296, [{ d: 1, draw: px16(look, 0, 0) }, { d: 1, draw: px16(look, 2, 0) }, { d: 1, draw: px16(look, 0, 1) }]));
    y += ROW + 10;
  }
  title('Перехожі (16×16, випадкові)');
  const folk = Array.from({ length: 16 }, (_, k) => P.townsfolkLook(rngFor(7, 'lineup', k)));
  strip('', 16, folk.map((look) => ({ d: 1, draw: px16(look, 0, 0) })));
  y += ROW + 10;
  title('У 32×32 поруч: Лєна й мама з PixelLab, мешканці — 16-піксельні');
  const mixed = [[P.LENA_ADULT, true], [R.RESIDENT_LOOKS.hanna, false], [R.RESIDENT_LOOKS.petro, false], [P.MOM, true], [R.RESIDENT_LOOKS.sofia, false], [P.DIMA, true], [R.RESIDENT_LOOKS.marko, false], [folk[3], false]];
  strip('', 16, mixed.map(([look, isHd]) => ({ d: isHd ? 2 : 1, draw: isHd ? pxHd(look, 0, 0) : px16(look, 0, 0) })));
  y += ROW + 10;
  title('Міні-ігри (як на телефоні): сад, курник угорі й унизу, рибалка, мама в городі');
  const kc = document.createElement('canvas');
  kc.width = 957;
  kc.height = 450;
  const kg = kc.getContext('2d');
  const kit = new K.Kit();
  kit.begin(kg, kc.width, kc.height, 1, 0);
  kit.rect(0, 0, kit.W, kit.H, '#9ed4ef');
  kit.rect(0, kit.H - 8, kit.W, 8, '#78c25a');
  FL.drawLenaFront(kit, P.LENA_KID, 28, kit.H - 6, false, 0, ['#e0402e', '#5a3a8a', '#c8d24a'], 2);
  FL.drawLenaCoop(kit, P.LENA_TEEN, 76, kit.H - 6, 'ur', ['#fbf3e4', '#fbf3e4'], 2);
  FL.drawLenaCoop(kit, P.LENA_ADULT, 176, kit.H - 6, 'dl', ['#fbf3e4'], 2);
  FL.drawLenaFishing(kit, P.LENA_ADULT, 222, kit.H - 6, 2);
  FL.drawPersonFarm(kit, P.MOM, 292, kit.H - 6, 2, 2);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(kc, 16, y);
  y += kc.height + 16;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = y;
  out.getContext('2d').drawImage(c, 0, 0);
  return out.toDataURL('image/png');
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const dev = process.argv[2] ?? 'phone';
const size = dev === 'wide' ? { width: 1280, height: 800 } : { width: 412, height: 915 };
const page = await browser.newPage({ viewport: size, deviceScaleFactor: dev === 'wide' ? 1 : 2, hasTouch: dev !== 'wide' });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://localhost:5199/game.html');
await page.waitForTimeout(4000);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${dev}-${name}.png` }); console.log('shot', name); };
await shot('title');
const scenarios = (process.argv[3] ?? 'village').split('||');
const setup = async (fn, arg) => page.evaluate(([src, a]) => { const c = window.__lifeGame; return new Function('c', 'a', src)(c, a); }, [fn, arg]);
for (const sc of scenarios) {
  // png:<ім'я>:<пора року> — уся поточна мапа одним PNG без людей: піксель
  // малюнка (32×32 на клітинку) — один піксель файлу. Екран вміщає лише ~20
  // клітинок, а текстури треба порівнювати по всьому подвір'ю разом.
  if (sc.startsWith('png:')) {
    const [, name, season = 'summer'] = sc.split(':');
    const url = await page.evaluate(async ([season]) => {
      const S = await import('/src/features/game/life/render/scene.ts');
      const c = window.__lifeGame;
      const d = 2;
      const W = c.map.w * 16 * d;
      const H = c.map.h * 16 * d;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      S.renderScene(cv.getContext('2d'), c.map, [], { season, minute: 660, time: 0, weather: 'clear' }, { w: W, h: H, scale: d, camX: 0, camY: 0, dpr: 1 }, { target: null, near: null, pets: [] });
      return cv.toDataURL('image/png');
    }, [season]);
    writeFileSync(`${OUT}/${dev}-map-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('map', name);
    continue;
  }
  // lineup:<ім'я> — усі персонажі одним аркушем (функція `lineup` вище).
  if (sc.startsWith('lineup:')) {
    const [, name = 'all'] = sc.split(':');
    const url = await page.evaluate(lineup);
    writeFileSync(`${OUT}/${dev}-lineup-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('lineup', name);
    continue;
  }
  if (sc === 'village') await setup(`void c.newGame(7, 'sadok')`);
  await page.waitForTimeout(500);
  // Прогорнути вступні діалоги.
  for (let k = 0; k < 8; k += 1) { await setup(`if (c.ui.dialog) c.advanceDialog(); if (c.ui.card) c.closeCard();`); await page.waitForTimeout(150); }
  if (sc.startsWith('city:')) {
    const [, city, day, minute] = sc.split(':');
    await setup(`c.life = { ...c.life, day: Number(a.day), minute: Number(a.minute), city: a.city }; c.enterCity(a.city, 'station'); c.emit();`, { city, day, minute });
  }
  if (sc === 'village') await setup(`c.enterCity('zhylyntsi', 'home');`);
  if (sc === 'home') await setup(`c.life = { ...c.life, decor: { rug: 'rugPink', plant: 'plant', lamp: 'lamp', shelf: 'shelf', pet: 'kitten' } }; c.enterHome('wake');`);
  if (sc.startsWith('panel:')) {
    const [, kind, view] = sc.split(':');
    await setup(`c.life = { ...c.life, day: 120 }; c.openPanel({ kind: a.kind });`, { kind });
    await page.waitForTimeout(800);
    if (view) await page.getByRole('tab', { name: view }).click();
  }
  if (sc.startsWith('js:')) { await setup(sc.slice(3)); }
  if (sc.startsWith('game:')) {
    const [, kind, id, level] = sc.split(':');
    await setup(`void c.runActivity([{ kind: a.kind, id: a.id, title: a.id, level: Number(a.level), key: 'shot:' + a.id }], 'Перевірка'); c.startActivity();`, { kind, id, level });
    await page.waitForTimeout(1500);
    await page.mouse.click(size.width / 2, size.height * 0.75);
  }
  await page.waitForTimeout(2500);
  // Ім'я файлу — з початку сценарію (довгі сценарії перевищують межу ФС).
  await shot(sc.replace(/:/g, '_').replace(/[\/]/g, '_').slice(0, 90));
}
await browser.close();
try { process.kill(-vite.pid); } catch {}
process.exit(0);
