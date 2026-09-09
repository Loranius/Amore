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
  decodePng, scanBand, findFacets, facetProfile, pixelLuminance,
} from '../live/luminance.mjs';
import { artifactMask, artifactSpan } from '../live/artifactSpan.mjs';
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
 * Смуга по X звужує вимір до частини тіла — наприклад, до одного
 * стовбура, коли в смузі стоять і дітки. Тіло від тла відділяє маска
 * (`artifactSpan`), тож перехід тіло↔тло в число не потрапляє й без цього
 * ключа; він лишається для питань на кшталт «а що робить саме ця грань».
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
const DEFAULT_BAND = { tree: '380-520' };
/*
 * СМУГА КРИСТАЛА БІЛЬШЕ НЕ ПРИБИТА ЧИСЛОМ, і це виправлення приладу, а не
 * зручність (ADR-0174).
 *
 * Стояло 900–1100 — смуга, яка на теперішньому кадрі проходить нижче
 * стовбура монарха, по дітках і по щебеню жеоди. Усі числа, зняті нею,
 * описували камінь: із двадцяти трьох плато кристалові належали два.
 *
 * Тепер смуга береться від САМОГО ТІЛА: контрольний кадр (`crystal=off`)
 * дає маску артефакта, маска — його верх і низ, і смуга лягає на пояс
 * 22–42% висоти від вістря. Це стовбур монарха: нижче починаються дітки,
 * вище — вінець. `--band=` як стояв, так і стоїть.
 */
const SHAFT_FROM = 0.22;
const SHAFT_TO = 0.42;
const explicitBand = arg('band', '');
let rows = explicitBand === ''
  ? (species === 'crystal' ? null : band(DEFAULT_BAND[species]))
  : band(explicitBand);

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
  /*
   * ОДИН ЗНІМОК — І ЗБЕРЕЖЕНИЙ, І ВИМІРЯНИЙ.
   *
   * Було два: один у файл, другий у вимір. Поки між ними стояла ще й
   * навігація на контрольний кадр, це виглядало неминучим, але вадою було
   * не місце, а сам факт: сцена жива, іскри мерехтять, і два знімки
   * підряд — це два різні кадри. Виміряно (ADR-0174): звіт казав «5
   * граней, найслабша пара 24%», а у збереженому файлі їх шість і
   * найслабша 32%. Тобто число описувало кадр, якого ніхто не бачив, і
   * перевірити його по файлу було неможливо.
   */
  const shot = await portal.page.screenshot();
  writeFileSync(file, shot);

  /*
   * ЧИ КРИСТАЛ УЗАГАЛІ НАМАЛЬОВАНИЙ — З ЛІЧИЛЬНИКА, А НЕ З ПІКСЕЛІВ.
   *
   * Стояв контрольний кадр `crystal=off`, і його пікселі віднімались від
   * основного. Це не працює й не могло працювати: камера вписує КОРОБКУ
   * ВСІХ МЕШІВ, тож без кристала вона під'їжджає, і зсунутий острів
   * відрізняється від себе самого по всьому кадру. Виміряно на живому
   * прогоні (ADR-0174): «тіло» вийшло заввишки 1400 пікселів із 1830 —
   * тобто маскою став увесь острів разом із небом.
   *
   * Лабораторія вже публікує обидва числа сама, і вони точні: скільки
   * трикутників має бути за станом геометрії й скільки намальовано.
   * Питання «чи кристал у кадрі» ставиться їм, а не растру.
   */
  const counted = await portal.page.evaluate(() => {
    const stage = document.querySelector('[data-lab-expected-triangles]');
    return {
      expected: Number(stage?.getAttribute('data-lab-expected-triangles') ?? 0),
      drawn: Number(stage?.getAttribute('data-lab-drawn-triangles') ?? 0),
    };
  });
  if (counted.drawn < counted.expected) {
    throw new Error(
      `Кристал намальований не весь: ${counted.drawn} трикутників із ${counted.expected}. `
      + 'Профіль не знімається.',
    );
  }
  console.log(`трикутників  ${counted.drawn} із ${counted.expected}`);

  const tone = await readToneMapping(portal.page);
  const image = decodePng(shot);

  /*
   * МАСКА ТІЛА — НАЙБІЛЬША ЗВ'ЯЗНА ПЛЯМА СВОГО ВІДТІННУ.
   *
   * Без маски стовпець смуги усереднює всю її висоту: небо над тілом, мох
   * і брили під ним, і саме тіло — усе одним числом. Скільки це коштувало,
   * виміряно (ADR-0174): у смузі 900–1100 із двадцяти трьох плато
   * кристалові належали два, а «медіана меж 18%», якою мірялись усі
   * ablation'и, описувала камінь острова.
   *
   * ЦІНА НАЗВАНА: вікно відтінку 285–345° — рожеве. Колір кристала
   * заслужений (ADR-0151), і при `--gifts=shared` тіло піде в зелень;
   * тоді маска не знайде тіла й вимір ЗУПИНИТЬСЯ з цим повідомленням, а
   * не збреше. Вікно рухається ключем `--hue=від-до`.
   */
  /*
   * Дерево міряється без маски, і це сказано вголос. Вікно відтінку тут
   * рожеве, крона зелена, і мовчазне «маска нічого не знайшла» коштувало
   * б рівно тієї брехні, від якої ця маска й з'явилась.
   */
  const hueWindow = /^(\d+)-(\d+)$/.exec(arg('hue', '285-345'));
  if (!hueWindow) throw new Error('--hue має вигляд 285-345');
  const hues = { hueFrom: Number(hueWindow[1]), hueTo: Number(hueWindow[2]) };
  const blob = species === 'crystal' ? artifactSpan(image, null, hues) : null;
  if (species === 'crystal' && (blob === null || blob.pixels < 500)) {
    throw new Error(
      `Тіла в кадрі не видно: у вікні відтінку ${hues.hueFrom}–${hues.hueTo}° `
      + `найбільша пляма — ${blob?.pixels ?? 0} пікселів. Спробуйте --hue=від-до.`,
    );
  }
  let wide = null;
  if (blob !== null) {
    wide = artifactMask(image, null, hues);
    // Поза плямою маска гаситься: інтерфейс, іскри над вістрям і будь-що
    // рожеве в кадрі тілом не є (той самий доказ, що й в `artifactSpan`).
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const inside = x >= blob.left && x <= blob.right && y >= blob.top && y <= blob.bottom;
        if (!inside) wide[y * image.width + x] = 0;
      }
    }
    console.log(`тіло  x ${blob.left}–${blob.right}, y ${blob.top}–${blob.bottom}, ${blob.pixels} пікселів`);
    if (rows === null) {
      rows = {
        y0: Math.round(blob.top + blob.height * SHAFT_FROM),
        y1: Math.round(blob.top + blob.height * SHAFT_TO),
      };
    }
  }

  const columns = scanBand(
    image, { ...rows, x0: 0, x1: image.width }, tone,
    wide === null ? {} : { mask: wide },
  );
  if (wide !== null) {
    const owned = columns.filter((value) => Number.isFinite(value)).length;
    if (owned < 20) {
      throw new Error(
        `Кристала в смузі немає: тілу належать лише ${owned} стовпців зі ${columns.length}. `
        + 'Профіль не знімається.',
      );
    }
    console.log(`тілу належать ${owned} стовпців смуги зі ${columns.length}`);
  }

  const bounds = /^(\d+)-(\d+)$/.exec(xRange);
  const inside = (entry) => !bounds
    || (entry.from >= Number(bounds[1]) && entry.to <= Number(bounds[2]));
  const facets = findFacets(columns).filter(inside);
  const profile = facetProfile(facets);

  console.log(`знімок  ${file}`);
  console.log(`тонування  ${JSON.stringify(tone)}`);
  console.log(`смуга  y ${rows.y0}–${rows.y1}, ширина ${image.width}`
    + (bounds ? `, тіло x ${bounds[1]}–${bounds[2]}` : '')
    + (off === '' ? '' : `, вимкнено: ${off}`));

  /*
   * ГРАНІ, А НЕ ПЛАТО, і це заміна самого приладу (ADR-0174).
   *
   * `findPlateaus` шукає пробіг, рівний у межах 8%. На цьому кристалі таких
   * пробігів нуль — не тому, що граней немає, а тому, що грань має власний
   * перепад ~20% (ADR-0085) і по ній розсипані іскри. Виміряно: у смузі
   * стовбура прилад звітував «плато замало, щоб порівнювати» там, де око
   * бачить п'ять граней із кроками 34–48%.
   *
   * `findFacets` шукає РЕБРА й бере те, що між ними, а яскравість грані
   * рахує медіаною — іскра медіану не рухає.
   */
  console.log(`граней  ${facets.length}`);
  for (const facet of facets) {
    console.log(`   x ${String(facet.from).padStart(4)}–${String(facet.to).padStart(4)}  ${facet.luminance.toFixed(4)}`);
  }
  if (profile.steps.length === 0) {
    console.log('РІЗНИЦЯ МІЖ СУСІДНІМИ ГРАНЯМИ: граней замало, щоб порівнювати.');
  } else {
    console.log(`кроки  ${profile.steps.map((step) => `${(step * 100).toFixed(0)}%`).join(', ')}`);
    console.log(`найслабша пара ${(profile.weakest * 100).toFixed(0)}%, медіана `
      + `${(profile.median * 100).toFixed(0)}%, найбільша ${(profile.strongest * 100).toFixed(0)}%`);
    /*
     * ВЕРДИКТ БЕРЕ НАЙСЛАБШУ ПАРУ, а не медіану.
     *
     * Поріг 30% (`amore-crystal-look`) — про дві СУСІДНІ площини. Одна
     * пара, що збіглася, читається оком як одна велика площина, хай яка
     * добра медіана: саме так ламались усі три попередні ключі тонування
     * (ADR-0086), і саме цього медіана не показувала.
     */
    console.log(profile.weakest >= 0.3
      ? `ЧИТАЄТЬСЯ КРИСТАЛОМ (поріг 30% на найслабшій парі, ${facets.length} граней).`
      : profile.weakest >= 0.1
        ? `МЕЖА: найслабша пара нижче 30% (${facets.length} граней).`
        : `ЧИТАЄТЬСЯ ГЛАДКОЮ ФОРМОЮ (найслабша пара нижче 10%, ${facets.length} граней).`);
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
