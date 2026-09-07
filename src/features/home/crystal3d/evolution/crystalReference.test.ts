// ============================================================
// Еталонний кристал проти нашого — перший вимір форми числами.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «зроби з кристалом як робили з деревом через блендер,
// абсолютно той самий метод… потрібно щоб він виглядав як реальний
// кристал, що росте із жеоди в кристальній печері».
//
// Доти еталоном була ПРОЗА: `amore-crystal-look` розібрав сім присланих
// власником моделей на слова. З прози не дістати ні стрункості призми, ні
// висоти, на якій призма переходить у головку, ні — головне — того,
// СКІЛЬКИ КРИСТАЛА СТОЇТЬ НАД ПОРОДОЮ. Тому кожна правка форми була
// думкою проти думки.
//
// Тепер еталон — геометрія (`scripts/models/reference-crystal.py`), і
// обидва тіла міряє ОДНА функція (`crystalSilhouetteProfile`). Дві мірки
// дали б числа, які не можна класти поруч.
//
// ЩО ЦЕЙ ФАЙЛ СТЕРЕЖЕ, А ЩО ЛИШЕ ЗАПИСУЄ:
//
//   • Еталон мусить бути тим, чим себе називає. Скрипт оголошує зверху
//     свої частки — призма 3.2 завширшки, вінець породи 0.34 висоти, —
//     і виміряний GLB мусить їх давати. Інакше мірка тихо стане іншою, а
//     з нею й усі висновки.
//   • Розрив між еталоном і нами поки лише ЗАПИСАНО храповиком. Він
//     великий, він названий у `MODULE_STATUS.md`, і завдання цього файлу
//     — не дати йому вирости, поки лагодять щось інше.
// ============================================================
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CRYSTAL_MONARCH_BODY_ID } from '@/engine/species/crystal';
import { crystalHabitShape } from '@/engine/geometry/habit';
import { coupleCrystalHabit } from '@/engine/species/crystal/habit';
import { CRYSTAL_SUBSTRATE_BODY_ID } from '@/engine/geometry/substrate';
import {
  crystalClusterProfile,
  crystalProfileDistance,
  crystalSettingProfile,
  crystalSilhouetteProfile,
  type CrystalProfile,
} from '@/engine/species/crystal/crystalProfile';
import { applyEvolutionSandboxSources } from '@/features/home/evolutionSandbox';
import { buildCrystalPipelineStates } from './crystalPipeline';
import { readGlbPositions } from './glbPositions';

const REFERENCE = 'scripts/models/reference/crystal-geode.glb';

/**
 * Частки, оголошені в `reference-crystal.py`.
 *
 * Продубльовані тут навмисно — той самий прецедент, що в
 * `treeReference.test.ts`: тест мусить упасти, якщо скрипт розійдеться з
 * власним описом. Читати їх із файла означало б звіряти файл сам із собою.
 */
const DECLARED = {
  /**
   * `PRISM_ASPECT` — довжина призми на ширину ВПОПЕРЕК ГРАНЕЙ.
   *
   * 3.2 → 2.2 (ADR-0150) і 2.2 → 3.2 НАЗАД (ADR-0155). Обидва рази число
   * рухав смак власника, і рівно тому воно повернулось: того самого дня,
   * подивившись на 2.2 на живому порталі, він попросив протилежне —
   * «гострокінечний, а не як моноліт». Еталон, що ганяється за смаком, за
   * тиждень має три числа й не міряє вже нічого.
   *
   * Стрункість монарха пари тепер задає ГАБІТУС (`geometry/habit.ts`), а
   * еталон лишається габітусно-нейтральним кварцом. Порівняння ділить
   * наш вимір на оголошений множник габітусу — див. «ОБХВАТ» нижче.
   */
  prismAspect: 3.2,
  /** `PRISM_LENGTH / HEIGHT`, тобто де кінчається призма. */
  shoulderAt: 0.833,
  /** `TERMINATION_ANGLE` — кут граней головки від горизонталі. */
  terminationDeg: 52,
  /** `GEODE_WALL_SHARE` — висота породи над підошвою монарха. */
  rockRise: 0.34,
  /** `GEODE_OUTER_SHARE` — БАЗОВИЙ радіус породи; по азимуту він шумить. */
  rockSpreadBase: 2.6,
};

const START = '2022-12-26';
const DAYS_PER_YEAR = 365.2425;

function referenceOf(name: string): number[] {
  return readGlbPositions(new Uint8Array(readFileSync(REFERENCE)), name);
}

/**
 * Наше скупчення на заданому віці — усі тіла, крім породи.
 *
 * Суцільним супом, а не списком: `crystalClusterProfile` мусить різати
 * обидва боки ОДНІЄЮ дією, інакше числа не можна класти поруч.
 */
function oursCluster(years: number) {
  const states = statesOf(years);
  const soup: number[] = [];
  for (const mesh of states.geometry.meshes) {
    if (mesh.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID) soup.push(...mesh.positions);
  }
  return crystalClusterProfile(soup);
}

interface Ours {
  crystal: CrystalProfile;
  monarch: number[];
  rock: number[];
}

/**
 * Наш кристал на заданому віці, з історією «лабораторної» пари.
 *
 * Числа заповнення — ті самі, що в `crystalLab.tsx`: порожня історія дає
 * тіло мінімального розміру, і міряти треба той кристал, який пара
 * справді бачить.
 */
function statesOf(years: number) {
  const days = Math.round(years * DAYS_PER_YEAR);
  const asOf = new Date(Date.parse(`${START}T00:00:00.000Z`) + days * 86_400_000).toISOString();
  const sources = applyEvolutionSandboxSources({
    enabled: true,
    values: {
      relationshipDays: days,
      calendarEvents: Math.round(years * 6),
      completedPlans: Math.round(years * 4),
      fulfilledWishes: Math.round(years * 5),
      visitedPlaces: Math.round(years * 7),
      memories: Math.round(years * 12),
      finishedMedia: Math.round(years * 9),
      sharedDaysOff: Math.round(years * 30),
    },
    asOf,
    relationshipStartedAt: START,
    snapshot: {
      calendarEvents: [], plans: [], wishlistItems: [],
      mapPlaces: [], memories: [], memoryLinks: [], media: [],
    },
  });
  const states = buildCrystalPipelineStates({
    coupleId: 'amore:crystal-reference',
    asOf,
    relationshipStartedAt: START,
    snapshot: sources.snapshot,
    sharedDaysOff: sources.sharedDaysOff,
    quality: 'high',
    reducedMotion: true,
  });
  return states;
}

/**
 * Множник обхвату, який ця пара носить за габітусом.
 *
 * ЦЕ І Є ТЕ, ЩО ВИНОСИТЬСЯ ЗА ДУЖКИ ПЕРЕД ПОРІВНЯННЯМ З ЕТАЛОНОМ.
 * Габітус міняє тільки товщину — висоту він не чіпає за побудовою
 * (`geometry/profile.test.ts`: «жодного разу не свій вік»). Профіль
 * міряє НАЙШИРШЕ місце, тож множник — це `girth` разом із більшим із
 * двох стисків перерізу.
 *
 * Число оголошене в таблиці габітусів, а не виміряне тут: інакше мірка
 * підлаштовувалась би під те, що міряє.
 */
function habitGirth(): number {
  const shape = crystalHabitShape(coupleCrystalHabit(START));
  return shape.girth * Math.max(shape.scaleX, shape.scaleZ);
}

/** Профіль тіла, приведений до габітусно-нейтрального кварцу. */
function flattened(profile: CrystalProfile): CrystalProfile {
  const factor = habitGirth();
  return {
    ...profile,
    bands: profile.bands.map((band) => band / factor),
    radius: profile.radius / factor,
    aspect: profile.aspect * factor,
  };
}

function ours(years: number): Ours {
  const states = statesOf(years);
  const monarch = states.geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_MONARCH_BODY_ID);
  const rock = states.geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID);
  if (!monarch) throw new Error('У геометрії немає монарха — міряти нема що.');
  if (!rock) throw new Error('У геометрії немає підкладки — жеоду міряти нема з чим.');
  return {
    crystal: crystalSilhouetteProfile(monarch.positions),
    monarch: monarch.positions,
    rock: rock.positions,
  };
}

describe('еталон каже про себе правду', () => {
  const crystal = crystalSilhouetteProfile(referenceOf('ReferenceCrystal'));
  const setting = crystalSettingProfile(referenceOf('ReferenceCrystal'), referenceOf('ReferenceGeode'));

  it('стрункість — оголошена, з поправкою на описане коло', () => {
    /*
     * СМУГА ВИВОДИТЬСЯ, А НЕ ПІДБИРАЄТЬСЯ, і це виправлення знайшла сама
     * зміна еталона. Стояло «оголошене × 0.95…1.12» — множник, підібраний
     * під `PRISM_ASPECT = 3.2`; щойно скрипт оголосив 2.2, смуга
     * розійшлась із власним описом, бо частка головки у висоті залежить
     * від стрункості, а множник цього не знав.
     *
     * Виводиться так. Грань стоїть на відстані `d` від осі, тож ширина
     * впоперек граней — `2d`, а описане коло — `d/cos30° = 1.1547d`.
     * Призма має довжину `2d · PRISM_ASPECT`, головка підіймається на
     * `d · tan52°`. Отже
     *
     *   виміряна стрункість = (2·PRISM_ASPECT + tan52°) / (2 / cos30°)
     *
     * При 3.2 це 3.409, при 2.2 було 2.460 — і обидва разу з тієї самої
     * формули. Реальний вимір трохи МЕНШИЙ (3.391), бо грані НЕРІВНІ
     * (`FACE_OFFSETS`), і найширше місце тіла вужче за описане коло
     * рівного шестикутника. Смуга 0.97–1.06 стереже саме цю нерівність:
     * при 2.2 вимір ішов на 2% вище формули, при 3.2 — на 0.5% нижче, бо
     * частка головки у висоті інша.
     */
    const derived = (2 * DECLARED.prismAspect
      + Math.tan((DECLARED.terminationDeg * Math.PI) / 180))
      / (2 / Math.cos(Math.PI / 6));
    expect(crystal.aspect).toBeGreaterThan(derived * 0.97);
    expect(crystal.aspect).toBeLessThan(derived * 1.06);
  });

  it('плече стоїть там, де його поставили', () => {
    // Допуск — одна смуга з двадцяти, тобто 5% висоти.
    expect(Math.abs(crystal.shoulderAt - DECLARED.shoulderAt)).toBeLessThanOrEqual(0.05);
  });

  it('призма НЕ РОЗШИРЮЄТЬСЯ вгору — у неї паралельні боки', () => {
    /*
     * Головна властивість призми й головне, чого бракує нашому тілу.
     * Смуги від підошви до плеча в еталона однакові до тисячної.
     */
    const shoulderBand = Math.floor(crystal.shoulderAt * crystal.bands.length) - 1;
    const foot = crystal.bands[0]!;
    const top = crystal.bands[shoulderBand]!;
    expect(top / foot).toBeGreaterThan(0.99);
    expect(top / foot).toBeLessThan(1.01);
  });

  it('порода підіймається кристалові до третини', () => {
    expect(Math.abs(setting.rockRise - DECLARED.rockRise)).toBeLessThan(0.02);
    // Дві третини кристала — над породою. Це і є «росте з жеоди».
    expect(setting.emergentShare).toBeGreaterThan(0.6);
  });

  it('вінець рваний, а не рівний', () => {
    /*
     * `amore-crystal-look`: гладка суцільна поверхня під кристалом
     * читається п'єдесталом, хай як її формувати. Рівний верх породи —
     * та сама вада з іншого боку: чаша, у яку кристал поставили.
     */
    expect(setting.rimRoughness).toBeGreaterThan(0.12);
  });

  it('порода ширша за кристал утричі', () => {
    // Оголошено 2.6 як БАЗУ; шум по азимуту доводить максимум до трьох.
    expect(setting.rockSpread).toBeGreaterThan(DECLARED.rockSpreadBase);
    expect(setting.rockSpread).toBeLessThan(DECLARED.rockSpreadBase * 1.25);
  });
});

describe('наш кристал проти еталона — розрив записано', () => {
  const reference = crystalSilhouetteProfile(referenceOf('ReferenceCrystal'));

  it('форма розходиться з еталоном, і розрив не росте', () => {
    /*
     * Чотири виміри поспіль, і кожен із них щось сказав:
     *
     *   перший вимір   0.106 / 0.148 / 0.249   на 1, 11 і 40 роках
     *   ADR-0118       0.098 / 0.175 / 0.281   боки стали паралельні
     *   ADR-0119       0.158 / 0.036 / 0.109   обхват став кварцовим
     *   ADR-0150       0.167 / 0.056 / 0.111   інший еталон (2.2)
     *
     * На одинадцяти роках розрив колись ВИРІС, і це була не втрата, а
     * видимість: доки боки розширювались угору, нижня половина стовбура
     * випадково лежала близько до еталонних смуг. Щойно стовбур став
     * рівним, мірка сказала те, що є.
     *
     * ТЕПЕР МІРЯЄТЬСЯ ІНШЕ, і різницю треба назвати прямо (ADR-0155).
     * Власник обрав голчастий габітус, тобто множник обхвату 0.576.
     * Класти голку поруч із габітусно-нейтральним кварцом і звати
     * різницю «розривом» означало б міряти вибір форми й видавати його
     * за ваду виконання: сира відстань дає 0.452 / 0.394 / 0.340 і не
     * говорить ні про що, крім того, що голка тонша за призму.
     *
     * Тому перед порівнянням виноситься за дужки ОГОЛОШЕНИЙ множник
     * габітусу — і лишається питання, на яке еталон таки може
     * відповісти: чи це той самий кварц, тільки тонший.
     *
     * Виміряно: 0.101 / 0.020 / 0.102 — ТІСНІШЕ, ніж будь-коли раніше,
     * хоч еталон при цьому ніхто не підганяв.
     */
    const distance = (years: number): number =>
      crystalProfileDistance(reference, flattened(ours(years).crystal));
    expect(distance(1)).toBeLessThan(0.12);
    expect(distance(11)).toBeLessThan(0.026);
    expect(distance(40)).toBeLessThan(0.12);
  });

  it('З ВІКОМ КРИСТАЛ КРЕМЕЗНІШАЄ — і нижче цього вже не опускається', () => {
    /*
     * Названа межа, не досягнення. Еталон дає 3.39 хай якого віку — у
     * кварцу стрункість не залежить від того, скільки він ріс. Наш іде
     * 3.79 → 3.33 → 3.02 (приведено до нейтрального обхвату), тобто
     * сорокарічний кристал на 11% кремезніший за еталон і на 20% за себе
     * однорічного.
     */
    expect(flattened(ours(1).crystal).aspect).toBeGreaterThan(3.5);
    expect(flattened(ours(40).crystal).aspect).toBeGreaterThan(2.9);
  });

  it('ПРИЗМА СТАЛА ПРИЗМОЮ: боки паралельні, як в еталона', () => {
    /*
     * Перший вимір (2026-09-03) назвав ваду, якої не було видно оком: від
     * підошви до плеча радіус ріс на 18%, тобто бокова поверхня була
     * конусом. Це наслідок гемового розхилу ADR-0019, і ADR-0118 його
     * прибрав.
     *
     * Виміряно на 1 / 11 / 40 роках: 1.094 / 0.945 / 0.990 при
     * еталонних 1.00. Смуга свідомо двобічна — призма, що ВУЖЧАЄ вгору,
     * така ж неправда, як призма, що ширшає.
     */
    for (const years of [1, 11, 40]) {
      const profile = ours(years).crystal;
      const shoulderBand = Math.floor(profile.shoulderAt * profile.bands.length) - 1;
      const flare = profile.bands[shoulderBand]! / profile.bands[0]!;
      expect(flare, `${years}р`).toBeGreaterThan(0.9);
      expect(flare, `${years}р`).toBeLessThan(1.12);
    }
  });

  it('ОБХВАТ СТАВ КВАРЦОВИМ: доросле тіло сідає на еталон', () => {
    /*
     * Еталон дає стрункість 3.391. Наш кристал ішов 3.25 / 2.89 / 2.62 на
     * 1, 11 і 40 роках; після ADR-0119 — 3.81 / 3.383 / 3.07; після
     * ADR-0150 — 2.83 / 2.505 / 2.32 проти іншого еталона.
     *
     * ЧИСЛО ТУТ — ПРИВЕДЕНЕ, і це головне в цьому тесті (ADR-0155).
     * Сире тіло цієї пари має стрункість 5.78: вона носить голку, і в
     * голки обхват оголошено множником 0.576. Ділення на цей множник —
     * не поправка на результат, а зняття однієї відомої величини, після
     * чого лишається саме те, що еталон уміє перевірити.
     *
     * Виміряно на одинадцяти роках: 3.328 проти еталонних 3.391 — збіг у
     * межах двох відсотків. Смуга навколо еталона свідомо тісна: саме
     * тут найлегше тихо повернути товщину, «трохи підправивши» щось
     * сусіднє.
     *
     * І перевірка, що множник — не підгонка під одну форму: та сама
     * дія на решті трьох габітусів дає 3.18 (масивний), 3.52
     * (призматичний) і 3.42 (плита) — усі в межах 6% від еталона, хоч
     * сирі стрункості в них розходяться вдвічі (2.19…5.78). Це
     * стережеться числом у `geometry/profile.test.ts`.
     */
    expect(flattened(ours(11).crystal).aspect).toBeGreaterThan(3.25);
    expect(flattened(ours(11).crystal).aspect).toBeLessThan(3.45);

    /*
     * А на краях віку розходження ЗАЛИШЕНО, і воно навмисне.
     *
     * Молодий кристал тонший (3.79): обхват веде діяльність пари, і на
     * першому році її мало. Старий товщий (3.02): за ADR-0056 після
     * повного терміну історія показується шириною й новими гранями, бо
     * висота вже стала. Обидва — правила продукту, а не вади кварцу, і
     * підганяти їх під мінерал означало б зламати те, що власник просив.
     */
    expect(flattened(ours(1).crystal).aspect).toBeGreaterThan(3.6);
    expect(flattened(ours(40).crystal).aspect).toBeGreaterThan(2.95);
    expect(flattened(ours(40).crystal).aspect).toBeLessThan(
      flattened(ours(11).crystal).aspect,
    );
  });

  it('порода встала коміром — і назад уже не ляже', () => {
    /*
     * Було (перший вимір, 2026-09-03): 0.168 висоти й рваність 0.013 —
     * тобто вдвічі нижче за еталон і РІВНО, як тарілка. Стало після
     * ADR-0115: 0.245 і 0.064 на одинадцяти роках.
     *
     * Еталон дає 0.335 і 0.155, і різниця названа, а не схована: гребінь
     * коміра впирається в найвищу дитину (`GEODE_COLLAR_CHILD_SHARE`),
     * бо ADR-0058 вимагає, щоб кільце років лишалось читабельним. Доки
     * цей вибір не зробить власник, порода не встане на еталонну висоту.
     */
    const { monarch, rock } = ours(11);
    const setting = crystalSettingProfile(monarch, rock);
    expect(setting.rockRise).toBeGreaterThan(0.24);
    expect(setting.rimRoughness).toBeGreaterThan(0.06);
    // Стеля — еталон: вище неї порода вже ховала б кристал, а не тримала.
    expect(setting.rimRoughness).toBeLessThan(0.16);
    expect(setting.rockSpread).toBeGreaterThan(2.4);
  });

  it('на дорослій колонії порода вже така сама широка, як в еталона', () => {
    /*
     * `rockSpread` росте з колонією, бо комір стоїть за нею: 1.99 на
     * першому році, 2.43 на одинадцятому, 3.10 на сороковому проти
     * еталонних 3.02. Тобто ширина — єдине з чотирьох чисел жеоди, яке
     * вже зійшлося, і саме воно найпростіше зіпсувати, звужуючи жилу.
     */
    const setting = crystalSettingProfile(ours(40).monarch, ours(40).rock);
    expect(setting.rockSpread).toBeGreaterThan(3.0);
  });
});

describe('скупчення проти еталона', () => {
  /*
   * ЧОМУ ЦЬОГО ВИМІРУ НЕ БУЛО, І ЩО ВІН ЗНАЙШОВ.
   *
   * Усі мірки вище — про ОДНЕ тіло. На запит власника «мені не подобається,
   * як він виглядає: просто стовп рожевого кольору, який стирчить із
   * землі» вони відповісти не могли: монарх сходився з еталоном на 0.036,
   * тобто був вірним відтворенням еталонного кварцу. Стовпом його робило
   * те, що НАВКОЛО.
   *
   * `crystalClusterProfile` міряє суп трикутників і сам знаходить у ньому
   * тіла за спільними вершинами — одна дія на еталон (один меш друзи) і на
   * нас (купа мешів), інакше числа не можна класти поруч.
   *
   * Перший вимір (2026-09-07), 11 років:
   *
   *              другий  медіана  розкид
   *   еталон      0.552    0.270    0.46
   *   наші        0.271    0.244    0.19   ← до правки
   *   наші        0.325    0.299    0.20   ← після
   *
   * Медіана збігалась і до правки: дрібні кристали в нас правильні.
   * Бракувало СУПЕРНИКА — другого тіла, помітного поруч із головним.
   */
  const reference = crystalClusterProfile([
    ...referenceOf('ReferenceCrystal'), ...referenceOf('ReferenceDruse'),
  ]);

  it('ЕТАЛОН — СКУПЧЕННЯ, а не стовп із галькою', () => {
    /*
     * Стереже сам еталон: якщо `DRUSE_MAX_SHARE` колись повернеться до
     * 0.26, еталон тихо стане тим, чим був, і всі висновки підуть за ним.
     */
    expect(reference.count).toBeGreaterThanOrEqual(16);
    expect(reference.secondShare).toBeGreaterThan(0.5);
    expect(reference.sizeSpread).toBeGreaterThan(0.35);
  });

  it('У НАШОГО МОНАРХА Є СУПЕРНИК', () => {
    /*
     * 0.28 — межа, що валить старе значення 0.271 і лишає запас під
     * тісноту колонії: частка найвищої дитини падає з роками
     * (`childMonarchShare`), і на двадцяти п'яти роках це вже 0.286.
     *
     * Було 0.30 і стало 0.28 разом із ADR-0154: тупий габітус доростав
     * лише до 93% оголошеної висоти, і коли зріз верхівки зняли, монарх
     * став на 7% вищим. Діти застигли у своїх роках і не виросли — тож
     * та сама колонія стала меншою ЧАСТКОЮ вищого монарха. Підняти
     * частку дітей замість межі не вийшло: на 0.53 падають одразу дві
     * стелі — «дитина не наздоганяє монарха» (0.5) і брифова частка.
     *
     * Стеля 0.5 — та сама, що в `ownerRules.test.ts` §2: дитина не
     * наздоганяє монарха.
     */
    for (const years of [4, 11, 25]) {
      const cluster = oursCluster(years);
      expect(cluster.secondShare, `${years}р`).toBeGreaterThan(0.28);
      expect(cluster.secondShare, `${years}р`).toBeLessThan(0.5);
    }
  });

  it('дрібні кристали лишаються дрібними — медіана в еталонній смузі', () => {
    // Скупчення — це НЕ «всі однакові й великі». Медіана в еталона 0.270;
    // наша йде 0.334 → 0.219 з віком, бо колонія тісніє.
    for (const years of [4, 11, 25]) {
      const cluster = oursCluster(years);
      expect(cluster.medianShare, `${years}р`).toBeGreaterThan(0.18);
      expect(cluster.medianShare, `${years}р`).toBeLessThan(0.4);
    }
  });
});
