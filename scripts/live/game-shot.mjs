// Живий скриншот гри «Дєвочка в городі» (ADR-0239). Див. CLAUDE.md, розділ про гру.
// node scripts/live/game-shot.mjs wide|phone "village||js:<код з c = window.__lifeGame>"
// Кадри — у .live/game/ (не в git). Перед кадром заморожуй світ: c.worldFrame = function () {}.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = `${ROOT}.live/game`;
mkdirSync(OUT, { recursive: true });
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
for (let i = 0; i < 60; i += 1) { try { const r = await fetch('http://localhost:5199/game.html'); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }
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
