// ============================================================
// Вимір артефакта без порталу — кристал або дерево.
// ------------------------------------------------------------
// `amore-crystal-look`: кристал, який читається кристалом, має сусідні
// грані, що різняться на 30%+; нижче ~10% він виглядатиме гладкою
// формою, хай яким правильним буде решта. Досі це число можна було
// дістати лише через живий портал із логіном і мережею.
//
// Тут те саме число знімається з `crystal-lab.html` — тим самим ланцюгом
// станів і тією самою сценою, але без бекенда.
//
// НІЧОГО НЕ ДУБЛЮЄТЬСЯ. Браузер, SwiftShader, підміна профілю пристрою й
// приховані девтули — з `portal.mjs` (`openPortal({ login: false })`).
// Сама арифметика світла — з `luminance.mjs`: якщо вона розійдеться,
// вимір із лабораторії перестане означати те саме, що вимір із порталу.
//
//   node scripts/lab/artifact.mjs --years=11 --band=900-1100
//   node scripts/lab/artifact.mjs --species=tree --years=1
//   node scripts/lab/artifact.mjs --years=11 --az=0,4,8,12 --turn-off=sheenStrength
//
// `--az` — оберт нерухомим кадром: питання «як воно виглядає при обертанні»
// одним знімком не поставити. `--turn-off=<терм>` знімає другий кадр кожного
// ракурсу без названого терму й рахує зміну ЙОГО ВЛАСНОГО внеску — без цього
// між ракурсами рухаються межі граней, і вони перекривають усе решта
// (ADR-0161: 10.1% до правки й 10.4% після, тобто мірка не сказала нічого).
//
// Драйвер один на обидва види навмисно: браузер, SwiftShader, підміна
// профілю, контрольний кадр і арифметика світла мусять бути ті самі,
// інакше числа двох видів не можна класти поруч.
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServer, openPortal, readToneMapping } from '../live/portal.mjs';
import {
  decodePng, scanBand, findPlateaus, facetSeparations, pixelLuminance,
} from '../live/luminance.mjs';
import { artifactMask } from '../live/artifactSpan.mjs';
import { DEVICES, TIERS } from '../live/options.mjs';

const PORT = 5199;
const OUT = '.live';

function arg(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

function band(text) {
  const match = /^(\d+)-(\d+)$/.exec(text);
  if (!match) throw new Error(`--band має вигляд 380-520, а не «${text}»`);
  return { y0: Number(match[1]), y1: Number(match[2]), x0: 0, x1: 0 };
}

const species = arg('species', 'crystal');
if (species !== 'crystal' && species !== 'tree') {
  throw new Error(`--species приймає crystal або tree, не «${species}».`);
}
const years = arg('years', '11');
/*
 * Обнулити один доданок і перезняти — уся техніка цього проєкту. Різниця
 * в профілі і є внесок того доданка.
 */
const off = arg('off', '');
/*
 * Смуга по X обмежує вимір ТІЛОМ. Без неї в медіану потрапляють переходи
 * тіло↔тло — вони завжди 80%+ і ховають справжнє число за собою, рівно
 * як і крайні плато, які `facetSeparations` уже відкидає.
 */
const xRange = arg('x', '');
const quality = arg('quality', 'high');
/*
 * Рівень деталізації окремо від профілю пристрою: телефон бачить `medium`,
 * і саме там живуть інші стелі (18 000 трикутників, 660 листків,
 * чотирирядкова пластинка листка). Дивитись на `high` і робити висновок про
 * телефон — це міряти одне дерево, а писати про інше.
 */
const lod = arg('lod', '');
/* Профіль заповнення модулів: найгірші просідання живуть не в лабораторній парі. */
const fill = arg('fill', '');
/*
 * Чиї бажання виконувались: `hers`, `his`, `shared`, `mix`.
 *
 * Колір кристала йде за подарунками (ADR-0151), а пісочниця робить усі
 * бажання спільними й безіменними — тобто без цієї ручки знімок показує
 * рівно один стан із чотирьох, і саме той, у якому кольору немає.
 */
const gifts = arg('gifts', '');
const theme = arg('theme', 'dark');
/*
 * Відстань камери, множник до кадру артефакта.
 *
 * Потрібна не для краси: кадр масштабується коробкою ВСІХ мешів, тож
 * будь-яка зміна підкладки посуває камеру, а вимір яскравості береться
 * зі СТАЛОЇ смуги пікселів. Без цієї ручки не можна спитати «а чи це
 * взагалі кристал змінився, чи просто камера під'їхала».
 */
const cam = arg('cam', '');
/*
 * ОБЕРТИ, У ГРАДУСАХ, ЧЕРЕЗ КОМУ — `--az=0,4,8`.
 *
 * Питання «чи переливається кристал, коли його крутять» не можна
 * поставити одним кадром, а обертання в порталі веде директор камери —
 * два ракурси доводилось ловити випадком. Ця ручка робить із переливу
 * пару НЕРУХОМИХ кадрів, які можна відняти один від одного (ADR-0161).
 */
/*
 * Який терм міряти окремо під обертом — `--turn-off=sheenStrength`.
 *
 * Не те саме, що `--off`: `--off` прибирає терм із ОБОХ кадрів і питає, як
 * без нього виглядає кристал. Цей прибирає його з ДРУГОГО кадру кожного
 * ракурсу, щоб відняти рух меж граней і лишити внесок самого терму.
 */
const offForTurn = arg('turn-off', '');

const bearings = arg('az', '')
  .split(',')
  .map((text) => text.trim())
  .filter((text) => text !== '')
  .map((text) => {
    const value = Number(text);
    if (!Number.isFinite(value)) throw new Error(`--az приймає градуси через кому, не «${text}»`);
    return value;
  });
/*
 * Смуга за замовчуванням — РІЗНА для двох видів, і це не примха.
 *
 * Одна спільна смуга 380–520 стояла доти, доки кадр кристала не переїхав:
 * на телефоні монарх тепер живе на 900–1100, а на 380–520 порожнє небо.
 * Оснастка чесно впала («кристала в кадрі немає»), але впала вона на
 * СВОЄМУ типовому виклику — тобто типовий вимір кристала був неможливий,
 * поки не вгадаєш смугу. Дерево на 380–520 стоїть кроною, тож там число
 * лишається тим, що було.
 */
const DEFAULT_BAND = { crystal: '900-1100', tree: '380-520' };
const rows = band(arg('band', DEFAULT_BAND[species]));

const server = await ensureServer(PORT, { silent: true });
const portal = await openPortal({
  baseUrl: server.url,
  device: DEVICES.phone,
  tier: TIERS[quality] ?? TIERS.high,
  theme,
  login: false,
});

try {
  const url = `${server.url}${species}-lab.html?years=${years}&quality=${quality}&theme=${theme}`
    + (lod ? `&lod=${lod}` : '')
    + (fill ? `&fill=${encodeURIComponent(fill)}` : '')
    + (gifts ? `&gifts=${encodeURIComponent(gifts)}` : '')
    + (cam ? `&cam=${cam}` : '')
    + (off === '' ? '' : `&off=${off}`);
  await portal.page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
  /*
   * Час ПІСЛЯ ознаки, а не замість неї. Полотно повідомляє, що стан
   * зібрано, але камера ще їде, а сцена ще не осіла; знімок до цього
   * показує кадр, якого не бачить ніхто.
   */
  await portal.page.waitForTimeout(9_000);

  mkdirSync(OUT, { recursive: true });
  const tag = off === '' ? 'base' : `off-${off.replace(/,/g, '+')}`;
  const file = join(OUT, `${species}-lab-${years}y-${quality}${lod ? `-${lod}` : ''}${fill ? `-${fill}` : ''}${gifts ? `-${gifts}` : ''}-${theme}-${tag}.png`);
  writeFileSync(file, await portal.page.screenshot());

  /*
   * ЧИ КРИСТАЛ УЗАГАЛІ НАМАЛЬОВАНИЙ — контрольним кадром у ТОМУ Ж прогоні.
   *
   * Без цієї перевірки оснастка вже брехала впевнено: коли бандл
   * виявився звільненим, сцена малювалась цілком — руїна, обеліски,
   * каміння, — і профіль звітував «ЧИТАЄТЬСЯ КРИСТАЛОМ, 85%», бо міряв
   * обеліск проти неба. Два прогони з трьох.
   *
   * Перша редакція цієї перевірки не спрацювала й теж чесно про це
   * каже: вона звіряла лічильник трикутників УСІЄЇ сцени (11 916 без
   * кристала, 12 472 з ним) із числом трикутників кристала (2 284) — і
   * 11 916 > 2 284 у будь-якому разі. Порівнювати треба сцену з собою,
   * а не з частиною себе.
   */
  const controlUrl = species === 'crystal' ? `${url}&crystal=off` : null;
  let controlColumns = null;
  if (controlUrl !== null) {
    await portal.page.goto(controlUrl, { waitUntil: 'load', timeout: 60_000 });
    await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
    await portal.page.waitForTimeout(9_000);
    const control = decodePng(await portal.page.screenshot());
    controlColumns = scanBand(
      control, { ...rows, x1: control.width }, await readToneMapping(portal.page),
    );
  }

  await portal.page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
  await portal.page.waitForTimeout(9_000);

  const tone = await readToneMapping(portal.page);
  const image = decodePng(await portal.page.screenshot());
  const columns = scanBand(image, { ...rows, x1: image.width }, tone);

  /*
   * Скільки стовпців смуги кристал справді змінив. Нуль означає, що його
   * в кадрі немає, хай яким здоровим виглядає профіль.
   */
  if (controlColumns !== null) {
    let changed = 0;
    for (let x = 0; x < Math.min(columns.length, controlColumns.length); x += 1) {
      if (Math.abs(columns[x] - controlColumns[x]) > 0.01) changed += 1;
    }
    if (changed < 20) {
      throw new Error(
        'Кристала в кадрі немає: контрольний знімок (crystal=off) відрізняється лише в '
        + `${changed} стовпцях зі ${columns.length}. Профіль не знімається.`,
      );
    }
    console.log(`кристал змінив ${changed} стовпців смуги зі ${columns.length}`);
  }
  const all = findPlateaus(columns);
  const bounds = /^(\d+)-(\d+)$/.exec(xRange);
  const plateaus = bounds
    ? all.filter((step) => step.from >= Number(bounds[1]) && step.to <= Number(bounds[2]))
    : all;
  const spread = facetSeparations(plateaus);

  console.log(`знімок  ${file}`);
  console.log(`тонування  ${JSON.stringify(tone)}`);
  console.log(`смуга  y ${rows.y0}–${rows.y1}, ширина ${image.width}`
    + (bounds ? `, тіло x ${bounds[1]}–${bounds[2]}` : '')
    + (off === '' ? '' : `, вимкнено: ${off}`));
  console.log(`плато  ${plateaus.length} (усього в смузі ${all.length})`);
  if (plateaus.length === 0 && all.length > 0) {
    for (const step of all) {
      console.log(`   [поза межами] x ${step.from}–${step.to}  ${step.luminance.toFixed(4)}`);
    }
  }
  for (const step of plateaus) {
    console.log(`   x ${String(step.from).padStart(4)}–${String(step.to).padStart(4)}  ${step.luminance.toFixed(4)}`);
  }
  if (spread.steps.length === 0) {
    console.log('РІЗНИЦЯ МІЖ СУСІДНІМИ ГРАНЯМИ: плато замало, щоб порівнювати.');
  } else {
    console.log(`усі переходи  ${spread.steps.map((s) => `${(s * 100).toFixed(0)}%`).join(', ')}`);
    console.log(`   з них МЕЖІ ГРАНЕЙ  ${spread.boundaries.map((s) => `${(s * 100).toFixed(0)}%`).join(', ')}`);
    console.log(`медіана всіх ${(spread.median * 100).toFixed(0)}%, медіана меж `
      + `${(spread.boundaryMedian * 100).toFixed(0)}%, найбільша ${(spread.max * 100).toFixed(0)}%`);
    /*
     * ВЕРДИКТ БЕРЕ МЕДІАНУ МЕЖ, а не медіану всіх переходів.
     *
     * Поріг 30% (`amore-crystal-look`) — про різницю двох СУСІДНІХ
     * ПЛОЩИН. Медіана всіх переходів відповідає на це питання лише тоді,
     * коли одна грань дає одне плато; при грані в 60–85 пікселів із
     * власним перепадом ~20% (ADR-0085) вона ріжеться на два-три плато, і
     * більшість пар — переходи ВСЕРЕДИНІ грані.
     *
     * Саме тому це число стрибало 6% → 47% від прогону до прогону при
     * незмінній формі, і саме тому за ним не можна було судити.
     */
    if (spread.boundaries.length === 0) {
      /*
       * Порожня вибірка — це НЕ нуль. Меж не знайдено або тому, що
       * поверхня справді рівна, або тому, що плато замало, щоб відрізнити
       * стрибок від схилу. Оголошувати «гладка форма» в обох випадках
       * означало б підмінити вимір здогадом.
       */
      console.log('МЕЖ ГРАНЕЙ НЕ ЗНАЙДЕНО: або поверхня рівна, або плато замало для судження.');
    } else {
      console.log(spread.boundaryMedian >= 0.3
        ? `ЧИТАЄТЬСЯ КРИСТАЛОМ (поріг 30% на межах граней, ${spread.boundaries.length} меж).`
        : spread.boundaryMedian >= 0.1
          ? `МЕЖА: нижче 30%, але не гладке (${spread.boundaries.length} меж).`
          : `ЧИТАЄТЬСЯ ГЛАДКОЮ ФОРМОЮ (нижче 10%, ${spread.boundaries.length} меж).`);
    }
  }
  /*
   * ПЕРЕЛИВ ПРИ ОБЕРТАННІ (ADR-0161).
   *
   * Профіль вище відповідає на «чи різняться дві сусідні грані ЗАРАЗ». Це
   * інше питання: «чи змінюється світло на тілі, коли кристал повертають».
   * Кристал може мати чудове розділення граней і при цьому бути нерухомим
   * під обертом — саме так тут і було, бо тон грані запечений за її РАНГОМ,
   * а не за кутом до ока.
   *
   * ПОВНИЙ КАДР ЦЬОГО НЕ КАЖЕ, і це виміряно, а не передбачено. Між двома
   * ракурсами рухаються самі межі граней, а межа — найконтрастніше місце
   * тіла; медіана по всьому тілу через це стоїть близько 10% незалежно від
   * того, є перелив чи немає. Перше вимірювання дало 10.1% до правки й
   * 10.4% після, тобто не сказало нічого.
   *
   * Тому з `--off=<терм>` знімається ДРУГИЙ кадр кожного ракурсу, і
   * рахується зміна ВНЕСКУ терму: (з ним − без нього) на одному ракурсі
   * проти того самого на другому. Рух меж стоїть в обох кадрах однаково й
   * віднімається начисто, лишається рівно те, що робить сам терм.
   */
  if (bearings.length > 1) {
    const shots = [];
    for (const bearing of bearings) {
      const frame = { bearing };
      for (const [slot, address] of [['with', url], ['without', `${url}&off=${off === '' ? '' : `${off},`}${offForTurn}`]]) {
        if (slot === 'without' && offForTurn === '') continue;
        await portal.page.goto(`${address}&az=${bearing}`, { waitUntil: 'load', timeout: 60_000 });
        await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
        await portal.page.waitForTimeout(9_000);
        const shot = await portal.page.screenshot();
        if (slot === 'with') {
          writeFileSync(join(OUT, `${species}-lab-az${bearing}.png`), shot);
        }
        frame[slot] = decodePng(shot);
      }
      frame.mask = artifactMask(frame.with);
      shots.push(frame);
    }

    console.log('\nПЕРЕЛИВ ПРИ ОБЕРТАННІ');
    if (offForTurn === '') {
      console.log('   (без --off=<терм> міряється весь кадр, а в ньому рух меж граней');
      console.log('    перекриває сам перелив — див. коментар у scripts/lab/artifact.mjs)');
    }
    const light = (image, at) => pixelLuminance(
      image.data[at], image.data[at + 1], image.data[at + 2], tone,
    );
    const full = [];
    const owned = [];
    for (let index = 0; index + 1 < shots.length; index += 1) {
      const a = shots[index];
      const b = shots[index + 1];
      const { width, height, channels } = a.with;
      const inside = (mask, x, y) => mask[y * width + x] === 1
        && mask[y * width + x - 1] === 1 && mask[y * width + x + 1] === 1
        && mask[(y - 1) * width + x] === 1 && mask[(y + 1) * width + x] === 1;
      const whole = [];
      const term = [];
      for (let y = 1; y + 1 < height; y += 1) {
        for (let x = 1; x + 1 < width; x += 1) {
          if (!inside(a.mask, x, y) || !inside(b.mask, x, y)) continue;
          const at = (y * width + x) * channels;
          const la = light(a.with, at);
          const lb = light(b.with, at);
          const mean = (la + lb) / 2;
          if (mean < 1e-4) continue;
          whole.push(Math.abs(la - lb) / mean);
          if (a.without !== undefined && b.without !== undefined) {
            // Внесок терму на кожному ракурсі, і різниця між внесками. Рух
            // меж стоїть в обох кадрах однаково, тож віднімається начисто.
            const ca = la - light(a.without, at);
            const cb = lb - light(b.without, at);
            term.push(Math.abs(ca - cb) / mean);
          }
        }
      }
      const median = (values) => {
        if (values.length === 0) return null;
        values.sort((one, other) => one - other);
        return values[Math.floor(values.length / 2)];
      };
      const wholeMedian = median(whole);
      const termMedian = median(term);
      if (wholeMedian === null) {
        console.log(`   ${a.bearing}° → ${b.bearing}°: спільних пікселів тіла немає`);
        continue;
      }
      full.push(wholeMedian);
      console.log(
        `   ${String(a.bearing).padStart(4)}° → ${String(b.bearing).padStart(4)}°`
        + `  весь кадр ${(wholeMedian * 100).toFixed(1)}%`
        + (termMedian === null ? '' : `  ·  сам ${offForTurn} ${(termMedian * 100).toFixed(2)}%`)
        + `  (${whole.length} спільних пікселів тіла)`,
      );
      if (termMedian !== null) owned.push(termMedian);
    }
    const median = (values) => {
      values.sort((one, other) => one - other);
      return values[Math.floor(values.length / 2)];
    };
    if (full.length > 0) {
      console.log(`   МЕДІАНА ПО ПАРАХ: весь кадр ${(median(full) * 100).toFixed(1)}%`
        + (owned.length > 0 ? `, сам ${offForTurn} ${(median(owned) * 100).toFixed(2)}%` : ''));
    }
  }

  const errors = portal.logs.filter((line) => /error|Error/.test(line));
  if (errors.length > 0) {
    console.log(`\nПОМИЛКИ СТОРІНКИ (${errors.length}):`);
    for (const line of errors.slice(0, 8)) console.log(`   ${line}`);
  }
} finally {
  await portal.close();
  await server.stop();
}
