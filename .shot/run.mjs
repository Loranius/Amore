import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const TIER = process.env.TIER ?? 'device';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

if (TIER === 'high') {
  // Only the two probes `readQuality` reads. Nothing else about the render
  // changes — this makes the container claim a desktop rather than a phone.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 16 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 32 });
  });
}

await page.route('**://*.supabase.co/**', async (route) => {
  const request = route.request();
  try {
    const response = await fetch(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postData(),
    });
    route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: Buffer.from(await response.arrayBuffer()),
    });
  } catch (error) {
    logs.push('relay failed: ' + String(error));
    route.abort();
  }
});

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(2500);
await page.getByText('Діма', { exact: true }).first().click();
await page.waitForTimeout(1200);
for (const digit of '26122022') {
  const key = page.getByRole('button', { name: digit, exact: true }).first();
  if (await key.count() > 0) await key.click(); else await page.keyboard.press(digit);
  await page.waitForTimeout(90);
}
await page.waitForTimeout(9000);

const canvas = await page.$('canvas');
const box = await canvas.boundingBox();
writeFileSync(`/home/user/Amore/.shot/${TIER}-0.png`, await page.screenshot());

// Turn the portal with a drag, the way a couple does, and shoot each quarter.
for (const [label, dx] of [['90', 0.25], ['180', 0.25], ['270', 0.25]]) {
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(
      box.x + box.width * 0.5 + (box.width * dx * 4 * step) / 12,
      box.y + box.height * 0.55,
    );
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(1800);
  writeFileSync(`/home/user/Amore/.shot/${TIER}-${label}.png`, await page.screenshot());
}

const diag = await page.evaluate(() => {
  const out = {};
  for (const el of document.querySelectorAll('*')) {
    for (const name of el.getAttributeNames()) {
      if (name.startsWith('data-evolution')) out[name] = el.getAttribute(name);
    }
  }
  return out;
});
console.log(JSON.stringify({ tier: TIER, diag, logs: logs.slice(0, 5) }, null, 1));
await browser.close();
