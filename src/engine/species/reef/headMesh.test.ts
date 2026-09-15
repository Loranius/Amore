import { describe, expect, it } from 'vitest';
import { reefHeadSize } from './colonyFormations';
import { buildReefHeadMesh } from './headMesh';

const head = reefHeadSize(6 * 365, 5);

/*
 * Сегментів по колу стільки ж, скільки в самому меші (ADR-0193): тест
 * читає кільця вершин, тож розійтись цим числам не можна — інакше він
 * порівнював би шматки різних кілець і мовчав про це.
 */
const AZIMUTH = 36;

/** Радіуси всіх вершин одного кільця, за азимутом. */
/**
 * Радіуси одного кільця ґратки.
 *
 * **ІНДЕКСИ БЕРУТЬСЯ З МЕША, А НЕ МНОЖЕННЯМ (ADR-0195, крок 7).**
 *
 * Тут стояло `(ring * AZIMUTH + segment)`. Це було правдою, доки одна
 * вершина ґратки давала одну вершину буфера. Відколи твердість ребра живе
 * у формі, купол розщеплює вершини на справжніх складках — копії стають
 * ПОРУЧ і зсувають усе наступне, — і крок перестав збігатися з ґраткою.
 *
 * Найгірше, що перевірки від того НЕ ВПАЛИ: вони й далі рахували числа,
 * просто числа означали шматки різних кілець. Вада знайшлась лише тоді,
 * коли ті самі числа виміряли на шістдесяти насіннях і вони не збіглися
 * з арифметикою форми.
 */
function ringRadii(mesh: ReturnType<typeof buildReefHeadMesh>, ring: number): number[] {
  const lattice = mesh.latticeVertex;
  expect(lattice, 'меш не сказав, де його ґратка').toBeDefined();
  const radii: number[] = [];
  for (let segment = 0; segment < AZIMUTH; segment += 1) {
    const at = lattice![ring * AZIMUTH + segment]! * 3;
    radii.push(Math.hypot(mesh.positions[at]!, mesh.positions[at + 2]!));
  }
  return radii;
}

/** Скільки радіус гуляє по одному кільцю — частка від найбільшого. */
function ringSpread(mesh: ReturnType<typeof buildReefHeadMesh>, ring: number): number {
  const radii = ringRadii(mesh, ring);
  return (Math.max(...radii) - Math.min(...radii)) / Math.max(...radii);
}

/**
 * ШИП — це крок між СУСІДНІМИ вершинами кільця, а не розкид по всьому колу.
 *
 * Різниця не педантична, і вона одного разу вже мало не коштувала форми.
 * Купол має 36 сегментів; повільний нахил усієї брили в один бік і
 * тридцятишестизубчаста зірка дають ОДНАКОВИЙ розкид `ringSpread`, хоч
 * перше — це форма тіла, а друге — вада. Відрізняє їх швидкість зміни по
 * колу, тобто крок між сусідами.
 */
function ringSpike(mesh: ReturnType<typeof buildReefHeadMesh>, ring: number): number {
  const radii = ringRadii(mesh, ring);
  const mean = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  let worst = 0;
  for (let at = 0; at < radii.length; at += 1) {
    const next = radii[(at + 1) % radii.length]!;
    worst = Math.max(worst, Math.abs(next - radii[at]!) / mean);
  }
  return worst;
}

/** Візерунок кільця без його розміру: відхилення від власного середнього. */
function ringPattern(mesh: ReturnType<typeof buildReefHeadMesh>, ring: number): number[] {
  const radii = ringRadii(mesh, ring);
  const mean = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  return radii.map((value) => value / mean - 1);
}

/** Наскільки візерунки двох кілець — те саме з точністю до масштабу. */
function patternMatch(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, at) => sum + value * b[at]!, 0);
  return dot / Math.max(1e-12, Math.hypot(...a) * Math.hypot(...b));
}

describe('купол голови — замкнене тіло', () => {
  const mesh = buildReefHeadMesh(head, 12345);

  it('нормалей стільки ж, скільки позицій, і всі числа скінченні', () => {
    expect(mesh.normals).toHaveLength(mesh.positions.length);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.normals.every(Number.isFinite)).toBe(true);
  });

  it('кожен індекс указує на наявну вершину', () => {
    const vertices = mesh.positions.length / 3;
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.every((index) => index >= 0 && index < vertices)).toBe(true);
  });

  it('кожне ребро належить рівно двом трикутникам', () => {
    /*
     * Це і є «замкнене». Перевірка не на око: у відкритої чаші знайдеться
     * ребро з одним сусідом, і саме там камера побачила б порожнечу
     * зсередини, коли опуститься під рівень основи.
     *
     * **РЕБРА КЛЮЧУЮТЬСЯ ПОЗИЦІЄЮ, А НЕ НОМЕРОМ ВЕРШИНИ (ADR-0195).**
     *
     * Доти це було те саме число: кожна позиція мала рівно одну вершину.
     * Відколи твердість ребра живе у формі, купол розводить вершини на
     * справжніх складках — на сьогоднішньому куполі таких уступів сорок
     * дев'ять, — і ребро вздовж уступу має ДВА номери на ту саму пару
     * точок.
     *
     * Тобто по номерах тіло виглядає діряве, хоч жодної дірки в ньому
     * немає. Міряти треба поверхню, а не буфер: замкненість — властивість
     * геометрії, а розщеплення вершини — властивість затінення.
     */
    const keyOf = (vertex: number): string => [
      mesh.positions[vertex * 3], mesh.positions[vertex * 3 + 1], mesh.positions[vertex * 3 + 2],
    ].join(',');
    const edges = new Map<string, number>();
    for (let at = 0; at < mesh.indices.length; at += 3) {
      const triangle = [
        keyOf(mesh.indices[at]!), keyOf(mesh.indices[at + 1]!), keyOf(mesh.indices[at + 2]!),
      ];
      for (let corner = 0; corner < 3; corner += 1) {
        const a = triangle[corner]!;
        const b = triangle[(corner + 1) % 3]!;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    const open = [...edges.values()].filter((count) => count !== 2);
    expect(open, 'купол не замкнений').toHaveLength(0);
  });

  it('маківка — найвища точка, і вона одна', () => {
    /*
     * Купол сходиться в одну корону. Якби маківка сіла нижче за верхнє
     * кільце, тіло вивернулось би всередину — замкненість цього не
     * помічає, бо ребра лишаються парними, а межі лишаються в допуску.
     */
    const apex = mesh.positions.length / 3 - 2; // передостання: за нею — центр кришки
    const apexY = mesh.positions[apex * 3 + 1]!;
    let highestRing = -Infinity;
    for (let vertex = 0; vertex < apex; vertex += 1) {
      highestRing = Math.max(highestRing, mesh.positions[vertex * 3 + 1]!);
    }
    expect(apexY).toBeGreaterThan(highestRing);
  });

  it('жоден трикутник не вироджений', () => {
    /*
     * Замкненість — умова топологічна, і сама по собі вона брехлива.
     *
     * Мутація «маківка знову кільцем» (`APEX_BAND = 1`) стягує все
     * верхнє кільце в одну точку: двадцять чотири вершини збігаються,
     * ребра далі мають рівно по два трикутники, і тест на замкненість
     * проходить — а це рівно та вада, через яку купол уже раз довелось
     * переробляти. Вироджений трикутник не має нормалі, і рендерер
     * дістає з нього NaN.
     */
    const scale = Math.max(head.radius, head.rise);
    let smallest = Infinity;
    for (let at = 0; at < mesh.indices.length; at += 3) {
      const corner = (k: number): [number, number, number] => {
        const v = mesh.indices[at + k]! * 3;
        return [mesh.positions[v]!, mesh.positions[v + 1]!, mesh.positions[v + 2]!];
      };
      const a = corner(0); const b = corner(1); const c = corner(2);
      const u: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w: [number, number, number] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cross = Math.hypot(
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      );
      smallest = Math.min(smallest, cross / 2);
    }
    expect(smallest / (scale * scale), 'є трикутники без площі').toBeGreaterThan(1e-4);
  });

  it('має нижню кришку, і вона дивиться вниз', () => {
    expect(mesh.baseCapTriangleCount).toBeGreaterThan(0);
    // Кришка йде ОСТАННЬОЮ, тож її трикутники — хвіст індексів.
    const capStart = mesh.indices.length - mesh.baseCapTriangleCount * 3;
    expect(capStart).toBeGreaterThan(0);
    for (let at = capStart; at < mesh.indices.length; at += 3) {
      const y = [0, 1, 2].map((k) => mesh.positions[mesh.indices[at + k]! * 3 + 1]!);
      // Уся кришка лежить на рівні основи або нижче за перше кільце.
      expect(Math.max(...y)).toBeLessThan(head.rise * 0.5);
    }
  });
});

describe('купол не є гладкою мискою', () => {
  it('радіус на одній висоті різниться по колу', () => {
    /*
     * Головне твердження форми. Гладка поверхня обертання читається
     * пластиковою мискою: у неї немає жодного місця, де світло
     * поводиться інакше. Живий масив росте долями.
     */
    /*
     * Міряється ОДНЕ кільце, а не вікно по висоті.
     *
     * Перша редакція брала всі вершини в смузі `y`, а туди потрапляють
     * різні кільця з різними базовими радіусами — і розкид виходив
     * більшим за справжню нерівність. Через це сусідня перевірка «не
     * зірка» падала на формі, яка зіркою не була. Вершини йдуть
     * кільцями по `AZIMUTH_SEGMENTS`, тож кільце береться зрізом.
     */
    /*
     * Підлога 0.18 — не «щось більше за нуль», а вимірене число.
     *
     * Перша редакція ставила 0.08, і мутація «частки прибрано»
     * (`LOBE_DEPTH = 0`) пройшла всі десять тестів: підлогу перекривала
     * сама дрібна хвиля. Виміряно на шістдесяти насіннях: із частками
     * розкид на кільці 4 лежить у 0.275–0.308, без них — у 0.089–0.090.
     * 0.18 стоїть між цими діапазонами й не належить жодному.
     */
    const spread = ringSpread(buildReefHeadMesh(head, 777), 4);
    expect(spread, 'купол ідеально круглий').toBeGreaterThan(0.18);
  });

  it('нерівність не робить із купола зірку', () => {
    /*
     * Межа з іншого боку: частки мають читатись долями масиву, а не
     * шипами.
     *
     * **МІРЯЄТЬСЯ ШИП, А НЕ РОЗКИД (ADR-0195, крок 7), і це виправлення
     * мірки, а не послаблення межі.** Тут стояв самий лише `ringSpread` —
     * розкид по всьому колу — з межею 0.40 при виміряних 0.349. Коли
     * куполу додали ДВОЧАСТКОВИЙ нахил (велика частка, якою брила
     * витягується в один бік), розкид уперся в межу негайно: повільний
     * нахил і тридцятишестизубчаста зірка дають те саме число.
     *
     * Але власна прозаїчна вимога цього тесту — «долями масиву, а НЕ
     * шипами», і шип відрізняється від нахилу швидкістю зміни по колу.
     * Тому головна межа тепер на кроці між сусідами; розкид лишається
     * запобіжником проти «раптом удвічі більше».
     *
     * **ОБИДВІ МЕЖІ ЗНЯТІ З ВИМІРУ НА ШІСТДЕСЯТИ НАСІННЯХ**, і вимір
     * показує, що двочастковий нахил зіркою не є:
     *
     *   без нахилу     шип 0.197   розкид 0.351
     *   нахил 0.13     шип 0.223   розкид 0.419
     *
     * Нахил підіймає шип на 13%, а розкид — на 19%: він майже не змінює
     * швидкості зміни по колу, бо два періоди на тридцять шість сегментів
     * — це найповільніше, що на цій сітці взагалі можна намалювати.
     *
     * Розкид 0.351 без нахилу збігається з числом, записаним у першій
     * редакції цього тесту (0.349), — і це заразом підтвердило, що
     * виміряно тепер ТЕ САМЕ, що й тоді, лише правильним обходом ґратки.
     *
     * Міряються ВСІ кільця й кілька насінь, а не три кільця одного
     * насіння: найбільший розкид сидить на кільці 3, якого перша
     * редакція не питала.
     */
    for (const seed of [1, 777, 4242]) {
      const mesh = buildReefHeadMesh(head, seed);
      for (let ring = 1; ring < 8; ring += 1) {
        expect(ringSpike(mesh, ring), `шип: насіння ${seed}, кільце ${ring}`)
          .toBeLessThan(0.28);
        expect(ringSpread(mesh, ring), `розкид: насіння ${seed}, кільце ${ring}`)
          .toBeLessThan(0.48);
      }
    }
  });

  it('візерунок не той самий на кожному рівні', () => {
    /*
     * Друга половина форми, і її розкид не ловить.
     *
     * Якби нерівність була самими лише частками, кожне кільце мало б
     * ОДИН І ТОЙ САМИЙ візерунок, тільки різного розміру — тобто купол
     * був би профілем, протягнутим угору, як точена ніжка. Хвиля
     * закручується з висотою, і від того рівні розходяться.
     *
     * Виміряно: збіг кільця 2 з кільцем 6 дорівнює 0.85; при
     * `RIPPLE_DEPTH = 0` він рівно 1.0000 — профіль повторюється точно.
     */
    const mesh = buildReefHeadMesh(head, 777);
    const match = patternMatch(ringPattern(mesh, 2), ringPattern(mesh, 6));
    expect(match, 'купол — протягнутий профіль').toBeLessThan(0.97);
  });

  it('різні пари мають різні куполи', () => {
    const a = buildReefHeadMesh(head, 1);
    const b = buildReefHeadMesh(head, 2);
    expect(a.positions).not.toEqual(b.positions);
  });

  it('та сама пара — той самий купол', () => {
    expect(buildReefHeadMesh(head, 99)).toEqual(buildReefHeadMesh(head, 99));
  });
});

describe('купол лишається в межах голови', () => {
  it('не переростає свого радіуса й підйому надто сильно', () => {
    // Нерівність зміщує поверхню, тож точні межі трохи більші за
    // номінальні — але саме «трохи»: інакше розкладка колоній, яка
    // рахує прив'язки з номінального купола, сіла б у повітря.
    const mesh = buildReefHeadMesh(head, 4242);
    const widest = Math.max(
      Math.abs(mesh.bounds.min.x), Math.abs(mesh.bounds.max.x),
      Math.abs(mesh.bounds.min.z), Math.abs(mesh.bounds.max.z),
    );
    expect(widest).toBeLessThan(head.radius * 1.2);
    expect(mesh.bounds.max.y).toBeLessThan(head.rise * 1.2);
    expect(mesh.bounds.min.y).toBeGreaterThanOrEqual(-1e-6);
  });

  it('трикутників небагато: купол видно загальним планом', () => {
    /*
     * СТЕЛЯ ПІДНЯТА 500 → 1000 (ADR-0193), і за неї заплачено, а не
     * списано. Власник: «риф виглядає грубо, як необтесане дерево з
     * крутими кутами полігонів». Сітка 24×8 давала 384 трикутники й
     * медіанний кут між сусідніми гранями 12.2°; 36×12 дає 864 і ~7°.
     *
     * Ціна повернута з піщаного дна, де деталь лежала за серпанком: дно
     * малюється ДВІЧІ (сам пісок і каустика поверх нього), тож кожен
     * зрізаний там трикутник коштує вдвічі. Разом сцена стала ЛЕГШОЮ —
     * числа в ADR-0193 §4.
     *
     * Стеля лишається стелею: купол і далі видно загальним планом, і
     * ділити його на тисячі граней нема заради чого.
     */
    const mesh = buildReefHeadMesh(head, 1);
    expect(mesh.indices.length / 3).toBeLessThan(1000);
  });
});

describe('тон грані: купол перестає читатись картоном', () => {
  /*
   * **ВИМОГА (ADR-0190), і вона названа числом до того, як щось крутили.**
   * Власник: «корал робимо більш кораловим і менш картонним, на фото
   * видно трикутники на тілі, звідки ростуть корали».
   *
   * Виміряно на живому порталі (`npm run live -- home --theme=light
   * --profile=500-530,330-560`): сусідні грані на голому боці купола
   * різнились на **6% медіани**. Правило `amore-crystal-look` зветься
   * числом: нижче ~10% тіло читається гладкою формою, хай яким
   * правильним буде решта.
   *
   * Виміряно й ПРИЧИНУ, по самій геометрії: медіанний кут між нормалями
   * сусідніх граней 12.2°, чистий ламберт дав би з нього 12.7%, а
   * розсіяне світло знімає ще половину. Тобто світлом цього не
   * полагодити — поверхню треба малювати.
   */
  const mesh = buildReefHeadMesh(head, 12345);

  it('тон є на кожну ВЕРШИНУ, і жодного зайвого', () => {
    /*
     * **БУЛО НА ГРАНЬ, СТАЛО НА ВЕРШИНУ (ADR-0195, крок 3).**
     *
     * Довжина мусить збігатися з кількістю вершин, а не трикутників, і це
     * не перейменування: тон на грані — це латка сталого кольору з
     * твердим краєм, тобто клаптик паперу. На вершині те саме число
     * інтерполюється між сусідами й ребра створити не може.
     */
    expect(mesh.tint).toBeDefined();
    expect(mesh.tint!.length).toBe(mesh.positions.length / 3);
  });

  it('тон лишається множником, а не вимикає тіло', () => {
    // Нуль дав би чорну вершину, а від'ємне — сміття в буфері кольору.
    for (const tone of mesh.tint!) {
      expect(Number.isFinite(tone)).toBe(true);
      expect(tone).toBeGreaterThan(0.3);
      expect(tone).toBeLessThan(1.7);
    }
  });

  it('тон іде за РЕЛЬЄФОМ, а не сиплеться на тіло плямами', () => {
    /*
     * **МЕЖУ ПЕРЕВЕРНУТО, І ОСЬ ЧИМ ЦЕ ПЛАЧЕНО.**
     *
     * Тут стояло «сусідні латки мусять різнитись більше ніж на 12%», і
     * воно було слушним, поки затінення було ПЛАСКИМ: тоді різниця тону
     * читалась граністю. ADR-0190 і ADR-0191 піднімали це число навмисно.
     *
     * Затінення більше не пласке (ADR-0195, крок 2), і лінійка твердості
     * краю виміряла наслідок: на голій породі гладке затінення ЗБІЛЬШИЛО
     * щільність твердих сходинок — 5.38 → 6.15 на сто пікселів. Латка,
     * яка доти видавала себе за грань, стала тим, чим є: клаптем паперу.
     *
     * Тому вимога тепер протилежна за формою й та сама за суттю: тон
     * мусить ЙТИ ЗА ФОРМОЮ. Точка, що виступає з ідеального купола,
     * світліша; западина темніша. Це перевіряється кореляцією тону з
     * відстанню вершини від центру, а не різницею сусідів — бо сусіди на
     * гладкому тілі й МУСЯТЬ бути схожими.
     */
    const tint = mesh.tint!;
    const radii: number[] = [];
    for (let vertex = 0; vertex < tint.length; vertex += 1) {
      const at = vertex * 3;
      radii.push(Math.hypot(
        mesh.positions[at]! / head.radius,
        mesh.positions[at + 1]! / head.rise,
        mesh.positions[at + 2]! / head.radius,
      ));
    }
    // Беремо лише бічні вершини: центр основи й вісь мають радіус нуль і
    // рельєфу не несуть.
    const pairs = radii
      .map((radius, at) => ({ radius, tone: tint[at]! }))
      .filter((pair) => pair.radius > 0.5);
    expect(pairs.length, 'бічних вершин').toBeGreaterThan(100);
    const meanRadius = pairs.reduce((sum, p) => sum + p.radius, 0) / pairs.length;
    const meanTone = pairs.reduce((sum, p) => sum + p.tone, 0) / pairs.length;
    let cov = 0; let varR = 0; let varT = 0;
    for (const pair of pairs) {
      cov += (pair.radius - meanRadius) * (pair.tone - meanTone);
      varR += (pair.radius - meanRadius) ** 2;
      varT += (pair.tone - meanTone) ** 2;
    }
    const correlation = cov / Math.sqrt(Math.max(1e-12, varR * varT));
    expect(correlation, 'тон не йде за рельєфом').toBeGreaterThan(0.9);
  });

  it('тон нікуди не зривається між сусідніми вершинами', () => {
    /*
     * ЩО ЦЕ СТЕРЕЖЕ І ЧОМУ МЕЖА 0.45.
     *
     * Тон лежить на вершині, тож на екрані він завжди ramp, а не край:
     * твердого краю в кольорі тут не буває за побудовою. Справжню
     * твердість міряє лінійка на живому кадрі
     * (`scripts/live/edgeHardness.mjs`) — вона і є присудом.
     *
     * Тут стоїть запобіжник проти ПОМИЛКИ, а не проти крутизни. 0.35 було
     * знято тоді, коли тон купола ніс один градієнт — рельєф. Тепер їх
     * три, і кожен на місці: рельєф (крок 3), тінь дотику при підошві
     * (крок 6) і двочастковий нахил брили (крок 7). На одному ребрі
     * трикутника вони перемножуються; виміряно найгіршу пару — 0.392.
     */
    const tint = mesh.tint!;
    let worst = 0;
    for (let at = 0; at < mesh.indices.length; at += 3) {
      for (let corner = 0; corner < 3; corner += 1) {
        const a = tint[mesh.indices[at + corner]!]!;
        const b = tint[mesh.indices[at + ((corner + 1) % 3)]!]!;
        worst = Math.max(worst, Math.abs(a - b) / Math.max(a, b));
      }
    }
    expect(worst, 'тон зірвався між сусідніми вершинами').toBeLessThan(0.45);
  });

  it('та сама пара бачить той самий рельєф, інша — інший', () => {
    // Детермінізм: тон іде з насіння пари, а не з випадковості.
    expect(buildReefHeadMesh(head, 12345).tint).toEqual(mesh.tint);
    expect(buildReefHeadMesh(head, 99).tint).not.toEqual(mesh.tint);
  });
});
