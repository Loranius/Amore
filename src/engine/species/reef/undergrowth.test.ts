import { describe, expect, it } from 'vitest';
import { reefColonyLayout, reefHeadSize } from './colonyFormations';
import { reefStanding } from './reefStaging';
import {
  REEF_LIFE_COLOURS,
  reefUndergrowth,
  type ReefGrowth,
} from './undergrowth';
import {
  buildReefBladeMesh,
  buildReefPebbleMesh,
  buildReefTuftMesh,
  buildReefWeedMesh,
  TUFT_RINGS,
  TUFT_SIDES,
} from './undergrowthMesh';

const HEAD = reefHeadSize(12 * 365, 6);
const STANDING = reefStanding(HEAD);

function grown(years = 4, seed = 4242): ReefGrowth[] {
  return reefUndergrowth(HEAD, STANDING, years, seed);
}

function onHead(growths: ReefGrowth[]): ReefGrowth[] {
  return growths.filter((growth) => growth.point.y > 1e-6);
}

/** Значення рівняння купола: 1 — рівно на ідеальній поверхні. */
function domeValue(growth: ReefGrowth): number {
  const { x, y, z } = growth.point;
  return Math.sqrt(
    (x * x + z * z) / (HEAD.radius * HEAD.radius) + (y * y) / (HEAD.rise * HEAD.rise),
  );
}

describe('дрібнота сидить на СПРАВЖНІЙ поверхні', () => {
  it('точки лежать на зміщеному куполі, а не на ідеальному', () => {
    /*
     * Купол зміщений частками до ±30% радіуса. Перша редакція рахувала
     * місце з РІВНЯННЯ еліпсоїда — і на знімку дрібнота плавала над
     * куполом і тонула в ньому по черзі.
     *
     * Ознака проста й неспростовна: на ідеальній поверхні значення
     * рівняння дорівнює одиниці ЗАВЖДИ. Якщо воно гуляє — точки взяті
     * з меша; якщо стоїть на одиниці — з рівняння.
     */
    const values = onHead(grown()).map(domeValue);
    expect(values.length).toBeGreaterThan(20);
    const spread = Math.max(...values) - Math.min(...values);
    expect(spread, 'усе на ідеальному еліпсоїді').toBeGreaterThan(0.15);
    // І все ж це поверхня, а не хмара: розкид обмежений самим шумом.
    expect(Math.min(...values)).toBeGreaterThan(0.6);
    expect(Math.max(...values)).toBeLessThan(1.45);
  });

  it('нормаль дивиться назовні купола', () => {
    for (const growth of onHead(grown())) {
      const outward = growth.point.x * growth.normal.x
        + growth.point.y * growth.normal.y
        + growth.point.z * growth.normal.z;
      expect(outward, 'росте всередину').toBeGreaterThan(0);
      expect(Math.hypot(growth.normal.x, growth.normal.y, growth.normal.z)).toBeCloseTo(1, 4);
    }
  });
});

describe('дрібнота не заступає того, що щось означає', () => {
  it('не лізе в річні колонії', () => {
    /*
     * Колонії — єдине на цьому рифі, що несе історію. Заростити їх
     * дрібнотою означало б сховати літопис під текстурою.
     */
    const colonies = reefColonyLayout(HEAD, 4);
    for (const growth of onHead(grown())) {
      for (const colony of colonies) {
        const gap = Math.hypot(
          growth.point.x - colony.point.x,
          growth.point.y - colony.point.y,
          growth.point.z - colony.point.z,
        );
        expect(gap, 'дрібнота в колонії').toBeGreaterThan(0.05);
      }
    }
  });

  it('камінці лежать на піску, а не на куполі', () => {
    // Камінь лежить, а не тримається: галька на схилі купола читалась
    // би помилкою розкладки.
    for (const growth of grown()) {
      if (growth.kind !== 'pebble') continue;
      expect(growth.point.y, 'камінець на куполі').toBe(0);
    }
  });

  it('те, що на піску, лежить ЗА каменем', () => {
    /*
     * Камінь будується тим самим куполом, тож його край гуляє до +30%.
     * Перша редакція починала кільце з 0.95 радіуса — частина камінців
     * опинялась усередині каменю й стирчала з нього кутами.
     */
    for (const growth of grown()) {
      if (growth.point.y > 1e-6) continue;
      const distance = Math.hypot(growth.point.x, growth.point.z);
      expect(distance).toBeGreaterThan(STANDING.rock.radius * 1.3);
    }
  });
});

describe('дрібнота — не літопис', () => {
  it('кількість не залежить від прожитих років', () => {
    /*
     * Це межа, яку легко перейти непомітно. Дрібнота робить поверхню
     * поверхнею; якби її ставало більше з роками, вона почала б
     * розповідати те саме, що й кільце колоній, тільки нечітко.
     *
     * СМУГА БУЛА 25%, І ВАДА СИДІЛА РІВНО ПІД НЕЮ (ADR-0185). Кандидат,
     * що впав у зону колонії, просто губився, тож при ОДНОМУ Й ТОМУ
     * САМОМУ куполі виходило 217 дрібниць на першому році й 162 на
     * двадцять п'ятому: двадцять п'ять колоній відкидають більше, ніж
     * одна. Тобто річний сигнал дрібнота таки несла — слабкий, зворотний
     * і ніким не задуманий, — а тест його пропускав, бо міряв смугою.
     *
     * Тепер відкинутий кандидат ЗАМІНЮЄТЬСЯ, і залежності немає за
     * побудовою. Тож і перевірка тут точна: РІВНІСТЬ, а не смуга. Число,
     * яке можна порівняти на рівність, не лишає місця, під яким сховатись.
     */
    const counts = [1, 4, 10, 20, 25, 40]
      .map((years) => reefUndergrowth(HEAD, STANDING, years, 7).length);
    for (const count of counts) expect(count).toBe(counts[0]);
  });

  it('більший риф укритий так само щільно', () => {
    const young = reefHeadSize(365, 2);
    const old = reefHeadSize(25 * 365, 6);
    const youngCount = reefUndergrowth(young, reefStanding(young), 1, 7).length;
    const oldCount = reefUndergrowth(old, reefStanding(old), 25, 7).length;
    expect(oldCount).toBeGreaterThan(youngCount);
  });

  it('усі кольори життя йдуть у діло', () => {
    const used = new Set(grown().filter((g) => g.kind !== 'pebble').map((g) => g.colourIndex));
    expect(used.size).toBe(REEF_LIFE_COLOURS.length);
  });

  it('та сама пара — та сама шкіра', () => {
    expect(grown(4, 11)).toEqual(grown(4, 11));
    expect(grown(4, 11)).not.toEqual(grown(4, 12));
  });
});

describe('водорість дає кадру вертикаль', () => {
  it('кущів кілька, і всі вони на піску', () => {
    /*
     * Водорість — єдине в цій сцені, що тягнеться вгору. Без неї риф
     * лежить пласко, хай яка густа на ньому дрібнота: це видно на
     * першому й третьому референсах, де стрічки йдуть від дна до верху
     * кадру.
     */
    const weeds = grown().filter((growth) => growth.kind === 'weed');
    expect(weeds.length).toBeGreaterThanOrEqual(7);
    for (const weed of weeds) {
      expect(weed.point.y, 'водорість не на піску').toBe(0);
      expect(Math.hypot(weed.point.x, weed.point.z)).toBeGreaterThan(STANDING.rock.radius * 1.3);
    }
  });

  it('кущ ВИЩИЙ за дрібноту в кілька разів', () => {
    const weeds = grown().filter((growth) => growth.kind === 'weed');
    const small = grown().filter((growth) => growth.kind === 'tuft');
    const tallest = Math.max(...small.map((growth) => growth.size));
    expect(Math.min(...weeds.map((growth) => growth.size))).toBeGreaterThan(tallest * 2);
  });

  it('кущ — не одна стрічка', () => {
    /*
     * Перша редакція давала єдину стрічку, і на знімку вона читалась
     * пласкою зеленою смугою, що висить у воді: у одної стрічки немає
     * ані об'єму, ані місця, де вона починається.
     */
    /*
     * Міряються НОРМАЛІ, а не азимути вершин. Перша редакція перевірки
     * брала азимути — і мутація «одна стрічка» проходила її повністю,
     * бо вздовж вигину азимут вершини й так гуляє. Кожна стрічка —
     * пласка, тож у неї рівно одна нормаль: скільки різних нормалей,
     * стільки й стрічок, і саме це відрізняє кущ від смуги.
     */
    const weed = buildReefWeedMesh();
    const facing = new Set<string>();
    for (let at = 0; at < weed.normals.length; at += 3) {
      facing.add(`${weed.normals[at]!.toFixed(3)}:${weed.normals[at + 2]!.toFixed(3)}`);
    }
    expect(facing.size, 'кущ дивиться в один бік — це смуга').toBeGreaterThanOrEqual(4);
  });

  it('корінь утоплений — кущ не висить над дюною', () => {
    const weed = buildReefWeedMesh();
    expect(weed.bounds.min.y).toBeLessThan(0);
  });
});

describe('три форми мають об’єм', () => {
  it('у кульки є БІК, а не тільки маківка', () => {
    /*
     * Перша перевірка міряла висоту до ширини — і мутація «два кільця
     * замість чотирьох» її проходила: маківка лишалась на місці, тож
     * відношення не мінялось. А ламалось саме те, чого відношення не
     * бачить: у форми з двох кілець немає боку, вона читається пласким
     * папірцем під будь-яким світлом.
     *
     * Міряється те, що зламалось: скільки різних висот має силует.
     */
    const tuft = buildReefTuftMesh();
    const levels = [...new Set(
      Array.from({ length: tuft.positions.length / 3 }, (_v, index) => (
        Math.round(tuft.positions[index * 3 + 1]! * 1000) / 1000
      )),
    )].sort((left, right) => left - right);
    const height = tuft.bounds.max.y - tuft.bounds.min.y;
    let widestGap = 0;
    for (let at = 1; at < levels.length; at += 1) {
      widestGap = Math.max(widestGap, levels[at]! - levels[at - 1]!);
    }
    /*
     * Не кількість рівнів, а найбільший ПРОМІЖОК між ними.
     *
     * Кількість мутацію «два кільця» не ловила: у кожного кільця й так
     * два рівні через голки, тож їх лишалось шість. А ламалось те, що
     * між верхнім кільцем і маківкою з'являлась одна довга грань на
     * пів висоти — вона й читається пласким папірцем.
     */
    expect(widestGap / height, 'силует без боку: одна довга грань').toBeLessThan(0.25);
    const width = tuft.bounds.max.x - tuft.bounds.min.x;
    expect(height / width).toBeGreaterThan(0.8);
  });

  it('ребро кульки йде ВЗДОВЖ тіла, а не зиґзаґом через кільця', () => {
    /*
     * **РЕГРЕСІЯ ADR-0194.** Тут стояло `(side + ring) % 2`: радіус
     * стрибав через вершину і по колу, і по кільцях, тобто зсув ішов
     * діагоналлю в обидва боки. Це буквально схема, якою складають
     * папір, — і на живому порталі кульки лежали на камені зіжмаканими
     * обгортками.
     *
     * Виміряно зануленням по одному терму: тон у нуль кадру не змінив,
     * `TUFT_SPIKE` у нуль прибрав папір повністю. Тобто винна була саме
     * форма, і саме її діагональ.
     *
     * Міряється не глибина ребра, а те, що зламалось: чи однаковий
     * профіль радіуса на КОЖНОМУ кільці. У губки, актинії та їжака
     * борозни тягнуться від основи до маківки; щойно профіль почне
     * залежати від кільця — тіло знову згорнеться папером.
     *
     * Сусідній тест «у кульки є БІК» цього НЕ ловив: він міряє висоти
     * вершин, а діагональ їх навіть згущує — саме тому він і проходив
     * усі ці місяці на зіжмаканому тілі.
     */
    const tuft = buildReefTuftMesh();
    // Кільця йдуть підряд від основи; маківка й денце — дві останні
    // вершини, тож їх треба відкинути, інакше «кільце» захопить їх.
    const points = Array.from({ length: tuft.positions.length / 3 }, (_v, index) => ({
      x: tuft.positions[index * 3]!,
      y: tuft.positions[index * 3 + 1]!,
      z: tuft.positions[index * 3 + 2]!,
    }));
    /*
     * Довжина кільця береться З МЕША, а не рахується тут. Зріз, що знає
     * розмір напам'ять, після першої ж зміни сітки міряє шматки РІЗНИХ
     * кілець — і мовчки проходить (ADR-0193 §4).
     */
    const rings: number[][] = [];
    for (let ring = 0; ring < TUFT_RINGS; ring += 1) {
      const slice = points.slice(ring * TUFT_SIDES, (ring + 1) * TUFT_SIDES);
      expect(slice, `кільце ${ring} неповне`).toHaveLength(TUFT_SIDES);
      // Маківка й денце стоять на осі: якщо котрась із них потрапила в
      // зріз, кільця поїхали, і міряти далі немає сенсу.
      for (const point of slice) {
        expect(Math.hypot(point.x, point.z), `кільце ${ring} захопило вісь`).toBeGreaterThan(0);
      }
      rings.push(slice.map((point) => Math.hypot(point.x, point.z)));
    }

    const profile = (ring: readonly number[]): number[] => {
      const mean = ring.reduce((sum, value) => sum + value, 0) / ring.length;
      return ring.map((value) => value / mean);
    };
    const first = profile(rings[0]!);
    for (let ring = 1; ring < rings.length; ring += 1) {
      const here = profile(rings[ring]!);
      for (let side = 0; side < TUFT_SIDES; side += 1) {
        expect(
          here[side]!,
          `кільце ${ring}, сторона ${side}: профіль радіуса розійшовся з нижнім кільцем`,
          /*
           * П'ять знаків, а не шість: координати мешу записані через
           * `round6`, тож частка радіуса розходиться на ~5e-7 самим
           * округленням. Діагональ, проти якої стоїть цей тест, дає
           * розбіжність близько 0.2 — на п'ять порядків більшу.
           */
        ).toBeCloseTo(first[side]!, 5);
      }
    }
  });

  it('камінець приплюснутий — інакше він не камінець', () => {
    const pebble = buildReefPebbleMesh();
    const height = pebble.bounds.max.y - pebble.bounds.min.y;
    const width = pebble.bounds.max.x - pebble.bounds.min.x;
    expect(height).toBeLessThan(width * 0.75);
  });

  it('стрічка вузька — трава, а не папір', () => {
    /*
     * Перша редакція мала ширину 0.13 при висоті 1, і на знімку пучок
     * читався клаптем паперу. Пучок мусить бути ВИЩИМ за себе завширшки
     * настільки, щоб у ньому видно було окремі стрічки.
     */
    const blade = buildReefBladeMesh();
    const height = blade.bounds.max.y - blade.bounds.min.y;
    expect(height).toBeGreaterThan(0.9);

    /*
     * І ШИРИНА САМОЇ СТРІЧКИ, а не пучка. Перша редакція міряла лише
     * висоту — мутація «стрічка знову широка» проходила її повністю,
     * хоч це і є та вада, яку тест описує. Стрічки лежать четвірками
     * вершин, тож перші дві дають ширину основи.
     */
    let widest = 0;
    for (let blade4 = 0; blade4 < blade.positions.length / 3; blade4 += 4) {
      const at = blade4 * 3;
      widest = Math.max(widest, Math.hypot(
        blade.positions[at]! - blade.positions[at + 3]!,
        blade.positions[at + 1]! - blade.positions[at + 4]!,
        blade.positions[at + 2]! - blade.positions[at + 5]!,
      ));
    }
    expect(widest / height, 'стрічка завширшки як папір').toBeLessThan(0.12);
  });

  it('усі три дешеві й коректні', () => {
    for (const [name, mesh] of [
      ['пучок', buildReefBladeMesh()],
      ['кулька', buildReefTuftMesh()],
      ['камінець', buildReefPebbleMesh()],
    ] as const) {
      const vertices = mesh.positions.length / 3;
      expect(mesh.indices.length / 3, `${name}: задорого`).toBeLessThanOrEqual(64);
      expect(mesh.positions.every(Number.isFinite), name).toBe(true);
      expect(mesh.normals).toHaveLength(mesh.positions.length);
      expect(mesh.indices.every((index) => index >= 0 && index < vertices), name).toBe(true);
    }
  });
});

describe('тон грані: дрібнота перестає бути папером', () => {
  /*
   * **ВИМОГА (ADR-0191).** ADR-0190 дав тон куполу й коралам і чесно
   * назвав, чого не зробив: «дрібнота досі читається папером». На кадрі
   * це жовті й бірюзові клапті на камені — пласкі, кожен одного кольору
   * на все тіло, бо колір у них приходив лише ззовні, на інстанс.
   *
   * Тепер кожен рід несе свій тон, і тон іде за ЙОГО формою: у кульки
   * світлішають голки, у камінця різняться боки, у водорості блідне
   * кінчик. Стрічка — виняток, і саме він тут під сторожем: усі чотири
   * її грані (лице й виворіт) мусять мати ОДИН тон, інакше гойдання
   * читалось би блиманням.
   */
  const meshes = {
    стрічка: buildReefBladeMesh(),
    кулька: buildReefTuftMesh(),
    камінець: buildReefPebbleMesh(),
    водорість: buildReefWeedMesh(),
  } as const;

  it('тон є в кожного роду, і рівно на кожну ВЕРШИНУ', () => {
    /*
     * **БУЛО НА ГРАНЬ, СТАЛО НА ВЕРШИНУ (ADR-0195, крок 3).** Тон на
     * грані — це латка сталого кольору з твердим краєм, тобто клаптик
     * паперу; на вершині те саме число інтерполюється між сусідами й
     * ребра створити не може.
     */
    for (const [name, mesh] of Object.entries(meshes)) {
      expect(mesh.tint, name).toBeDefined();
      expect(mesh.tint!.length, name).toBe(mesh.positions.length / 3);
      for (const tone of mesh.tint!) {
        expect(Number.isFinite(tone), name).toBe(true);
        expect(tone, name).toBeGreaterThan(0.3);
        expect(tone, name).toBeLessThan(1.7);
      }
    }
  });

  it('кожен рід оголошує свій кут зламу, і камінь твердіший за живе', () => {
    /*
     * **ТВЕРДІСТЬ ПЕРЕЇХАЛА З МАТЕРІАЛУ У ФОРМУ (ADR-0195, крок 2).**
     *
     * Доти її задавав `flatShading` — один прапорець на весь матеріал
     * дрібноти, тобто наказ зробити КОЖЕН трикутник пласкою плямою. Тепер
     * кожен рід каже своє, і різниця між родами — не смак:
     *
     *   живе тіло згладжується цілком, бо в м'якого тіла ребер немає;
     *   камінь лишається гранованим, бо камінь ламається по площинах, а
     *   згладжена галька — це грудка.
     *
     * Тест стереже саме цей ПОРЯДОК, а не самі числа: щойно камінь стане
     * м'якшим за живе, правило перевернулось, і це треба помітити.
     */
    expect(meshes.камінець.creaseAngleDeg, 'камінь').toBeLessThan(45);
    for (const kind of ['кулька', 'стрічка', 'водорість'] as const) {
      expect(meshes[kind].creaseAngleDeg, kind).toBeGreaterThan(90);
      expect(meshes[kind].creaseAngleDeg, kind).toBeGreaterThan(meshes.камінець.creaseAngleDeg);
    }
    /*
     * Сто вісімдесят заборонені всім: при них зварилися б і дві грані,
     * спрямовані одна проти одної, а їхні нормалі в сумі дають нуль —
     * тобто чорну пляму. У стрічки такі грані є за побудовою (лице й
     * виворіт), і саме на цьому вже почорніли денця кульки й камінця,
     * коли затінення вперше ввімкнули.
     */
    for (const mesh of Object.values(meshes)) {
      expect(mesh.creaseAngleDeg).toBeLessThan(180);
    }
  });

  it('у кульки гребінь світліший за борозну — це її форма, сказана кольором', () => {
    /*
     * Межа 1.3 була знята з тону на ГРАНІ, де стрибок між сусідами й був
     * метою. Тепер це градієнт по вершинах, і той самий розмах він дає
     * плавно: від найтемнішої борозни біля основи до найсвітлішого
     * гребеня біля кінчика.
     */
    const tones = buildReefTuftMesh().tint!;
    expect(Math.max(...tones) / Math.min(...tones)).toBeGreaterThan(1.3);
  });

  it('тон кульки НІДЕ не стрибає між сусідніми вершинами', () => {
    /*
     * Пряма перевірка того, за що взявся цей зріз: на гладкому тілі не
     * має бути жодного твердого краю в кольорі. Сусідніми тут вважаються
     * вершини, що ділять ребро трикутника, — тобто саме ті пари, між
     * якими колір інтерполюється на екрані.
     */
    const mesh = buildReefTuftMesh();
    const tint = mesh.tint!;
    let worst = 0;
    for (let at = 0; at < mesh.indices.length; at += 3) {
      for (let corner = 0; corner < 3; corner += 1) {
        const a = tint[mesh.indices[at + corner]!]!;
        const b = tint[mesh.indices[at + ((corner + 1) % 3)]!]!;
        worst = Math.max(worst, Math.abs(a - b) / Math.max(a, b));
      }
    }
    expect(worst, 'стрибок тону між сусідніми вершинами').toBeLessThan(0.3);
  });

  it('лице й виворіт стрічки тримають ОДИН тон', () => {
    /*
     * Різні тони на боках однієї стрічки під течією дали б блимання —
     * найгірший рід руху, бо він виглядає поломкою рендерера.
     *
     * Міряється по ПОЗИЦІЇ, а не по номеру вершини: лице й виворіт тепер
     * мають різні вершини в тих самих точках (їхні нормалі протилежні й
     * не можуть ділити одну). Саме тому перевірка стала змістовнішою —
     * вона питає «чи однаковий тон у двох різних вершин однієї точки», а
     * доти питала про ту саму вершину.
     */
    const mesh = buildReefBladeMesh();
    const byPoint = new Map<string, number[]>();
    for (let vertex = 0; vertex < mesh.tint!.length; vertex += 1) {
      const key = [
        mesh.positions[vertex * 3], mesh.positions[vertex * 3 + 1], mesh.positions[vertex * 3 + 2],
      ].join(',');
      const bucket = byPoint.get(key);
      if (bucket) bucket.push(mesh.tint![vertex]!);
      else byPoint.set(key, [mesh.tint![vertex]!]);
    }
    let shared = 0;
    for (const tones of byPoint.values()) {
      if (tones.length < 2) continue;
      shared += 1;
      for (const tone of tones) expect(tone).toBeCloseTo(tones[0]!, 6);
    }
    expect(shared, 'жодна точка не ділиться між лицем і виворотом').toBeGreaterThan(0);
  });

  it('сусідні стрічки в пучку різні — інакше пучок знову один клапоть', () => {
    expect(new Set(buildReefBladeMesh().tint!).size).toBeGreaterThan(2);
  });
});

describe('дрібнота розкладена по ПЛОЩІ, а не по дузі', () => {
  /*
   * ВИМОГА (ADR-0186): дрібнота має лежати рівномірно по ПОВЕРХНІ купола.
   *
   * ЧОМУ ЦЕ НЕ ТЕ САМЕ, ЩО «рівномірно по смузі». Площа кільця на
   * куполі-півеліпсоїді залежить від кута: біля основи кільце широке,
   * біля маківки вироджується в точку. Дрібнота ж бралась
   * `radicalInverse2` прямо по `band`, тобто рівно по КУТУ.
   *
   * Виміряно на куполі четвертого року (R=0.632, H=0.451) — кількість на
   * одиницю площі по п'яти смугах знизу вгору:
   *
   *   було:  49.8  56.6  62.3  86.1  164.5   → маківка втричі густіша
   *   стало: 62.2  76.7  66.5  71.3   41.1   → розкид у межах двох разів
   *
   * І це не косметика: смуга 0.0–0.2 — найбільша за площею, і саме вона
   * та передня грань купола, яка на кадрі читалась голою.
   */
  const areaBetween = (radius: number, rise: number, from: number, to: number): number => {
    const steps = 2000;
    let sum = 0;
    for (let index = 0; index < steps; index += 1) {
      const band = from + ((index + 0.5) / steps) * (to - from);
      const phi = band * (Math.PI / 2);
      const dPhi = ((to - from) / steps) * (Math.PI / 2);
      sum += Math.cos(phi) * Math.hypot(radius * Math.sin(phi), rise * Math.cos(phi)) * dPhi;
    }
    return sum;
  };

  it('маківка більше не втричі густіша за основу', () => {
    /*
     * Смуга відновлюється з ІДЕАЛЬНОГО купола (`asin(y / rise)`), а точки
     * сидять на зміщеному — тож сама ця мірка приблизна, і вимагати від
     * неї рівності було б вимагати точності, якої в неї немає. Тому межа
     * названа як «у межах трьох разів між найгустішою та найрідшою
     * смугою»: до зміни лише крайні дві відрізнялись у 3.3 раза.
     */
    for (const years of [1, 4, 25]) {
      const head = reefHeadSize(years * 365.2425, 6);
      const onHead = reefUndergrowth(head, reefStanding(head), years, 4242)
        .filter((growth) => growth.kind !== 'weed' && growth.point.y > 1e-6);
      const densities: number[] = [];
      for (let slice = 0; slice < 5; slice += 1) {
        const from = slice / 5;
        const to = (slice + 1) / 5;
        const count = onHead.filter((growth) => {
          const band = Math.asin(Math.min(1, Math.max(0, growth.point.y / head.rise)))
            / (Math.PI / 2);
          return band >= from && band < to;
        }).length;
        densities.push(count / areaBetween(head.radius, head.rise, from, to));
      }
      const spread = Math.max(...densities) / Math.max(1e-9, Math.min(...densities));
      expect(spread, `рік ${years}`).toBeLessThan(3);
    }
  });

  it('найбільша за площею смуга не найрідша', () => {
    // Саме вона — велика передня грань купола, і саме її голизну видно
    // на кадрі першою.
    const head = reefHeadSize(4 * 365.2425, 6);
    const onHead = reefUndergrowth(head, reefStanding(head), 4, 4242)
      .filter((growth) => growth.kind !== 'weed' && growth.point.y > 1e-6);
    const inSlice = (from: number, to: number): number => onHead.filter((growth) => {
      const band = Math.asin(Math.min(1, Math.max(0, growth.point.y / head.rise))) / (Math.PI / 2);
      return band >= from && band < to;
    }).length;
    const bottom = inSlice(0, 0.2) / areaBetween(head.radius, head.rise, 0, 0.2);
    const top = inSlice(0.8, 1) / areaBetween(head.radius, head.rise, 0.8, 1);
    expect(bottom).toBeGreaterThan(top * 0.9);
  });

  it('таблиця площі не залежить від насіння — лише від форми купола', () => {
    // Детермінізм: та сама голова дає ту саму розкладку, скільки не клич.
    const head = reefHeadSize(4 * 365.2425, 6);
    const once = reefUndergrowth(head, reefStanding(head), 4, 4242);
    const twice = reefUndergrowth(head, reefStanding(head), 4, 4242);
    expect(twice.map((g) => g.point.y)).toEqual(once.map((g) => g.point.y));
  });
});
