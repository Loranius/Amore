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
import { CRYSTAL_SUBSTRATE_BODY_ID } from '@/engine/geometry/substrate';
import {
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
  /** `PRISM_ASPECT` — довжина призми на ширину ВПОПЕРЕК ГРАНЕЙ. */
  prismAspect: 3.2,
  /** `PRISM_LENGTH / HEIGHT`, тобто де кінчається призма. */
  shoulderAt: 0.833,
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
function ours(years: number): Ours {
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
     * Скрипт оголошує 3.2 ВПОПЕРЕК ГРАНЕЙ, а силует бачить описане коло —
     * воно ширше в 2/√3 ≈ 1.155 раза лише в кутах, тож виміряне число
     * виходить трохи інше. Це не розходження: смуга нижче названа саме
     * тим, чим є, — оголошене число плюс геометрія шестикутника.
     */
    expect(crystal.aspect).toBeGreaterThan(DECLARED.prismAspect * 0.95);
    expect(crystal.aspect).toBeLessThan(DECLARED.prismAspect * 1.12);
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
     * Три виміри поспіль, і середній із них — найповчальніший:
     *
     *   перший вимір   0.106 / 0.148 / 0.249   на 1, 11 і 40 роках
     *   ADR-0118       0.098 / 0.175 / 0.281   боки стали паралельні
     *   ADR-0119       0.158 / 0.036 / 0.109   обхват став кварцовим
     *
     * На одинадцяти роках розрив спершу ВИРІС. Це була не втрата, а
     * видимість: доки боки розширювались угору, нижня половина стовбура
     * випадково лежала близько до еталонних смуг, і середня різниця
     * виходила меншою, ніж форма заслуговувала. Щойно стовбур став
     * рівним, мірка сказала те, що є: кристал товстий. Наступний крок
     * узяв обхват — і розрив упав уп'ятеро.
     *
     * На одному році він тепер найбільший (0.158), і це теж чесно:
     * молодий кристал ТОНШИЙ за еталон (3.81 проти 3.39), бо обхват
     * веде діяльність пари, а її на першому році мало. Еталон — доросла
     * друза, і сходитись із ним на першому році він не зобов'язаний.
     */
    expect(crystalProfileDistance(reference, ours(1).crystal)).toBeLessThan(0.17);
    expect(crystalProfileDistance(reference, ours(11).crystal)).toBeLessThan(0.05);
    expect(crystalProfileDistance(reference, ours(40).crystal)).toBeLessThan(0.13);
  });

  it('З ВІКОМ КРИСТАЛ КРЕМЕЗНІШАЄ — і нижче цього вже не опускається', () => {
    /*
     * Названа межа, не досягнення. Еталон дає 3.39 хай якого віку — у
     * кварцу стрункість не залежить від того, скільки він ріс. Наш іде
     * 3.04 → 2.61, тобто сорокарічний кристал на 23% кремезніший за
     * еталон і на 14% за себе однорічного.
     */
    expect(ours(1).crystal.aspect).toBeGreaterThan(3.0);
    expect(ours(40).crystal.aspect).toBeGreaterThan(2.55);
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
     * Еталон дає стрункість 3.39. Наш кристал ішов 3.25 / 2.89 / 2.62 на
     * 1, 11 і 40 роках; після ADR-0119 — 3.81 / 3.383 / 3.07.
     *
     * На одинадцяти й двадцяти роках це 3.383 проти 3.39, тобто збіг у
     * межах третього знака. Смуга навколо еталона свідомо тісна: саме
     * тут найлегше тихо повернути товщину, «трохи підправивши» щось
     * сусіднє.
     */
    expect(ours(11).crystal.aspect).toBeGreaterThan(3.3);
    expect(ours(11).crystal.aspect).toBeLessThan(3.5);

    /*
     * А на краях віку розходження ЗАЛИШЕНО, і воно навмисне.
     *
     * Молодий кристал тонший (3.81): обхват веде діяльність пари, і на
     * першому році її мало. Старий товщий (3.07): за ADR-0056 після
     * повного терміну історія показується шириною й новими гранями, бо
     * висота вже стала. Обидва — правила продукту, а не вади кварцу, і
     * підганяти їх під мінерал означало б зламати те, що власник просив.
     */
    expect(ours(1).crystal.aspect).toBeGreaterThan(3.6);
    expect(ours(40).crystal.aspect).toBeGreaterThan(3.0);
    expect(ours(40).crystal.aspect).toBeLessThan(ours(11).crystal.aspect);
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
