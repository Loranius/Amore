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
     * Виміряно 2026-09-03: 0.106 / 0.148 / 0.249 на 1, 11 і 40 роках.
     * Розрив росте з віком — тіло з роками стає кремезнішим, а еталон
     * лишається призмою.
     */
    expect(crystalProfileDistance(reference, ours(1).crystal)).toBeLessThan(0.12);
    expect(crystalProfileDistance(reference, ours(11).crystal)).toBeLessThan(0.16);
    expect(crystalProfileDistance(reference, ours(40).crystal)).toBeLessThan(0.26);
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

  it('НАША ПРИЗМА РОЗШИРЮЄТЬСЯ ВГОРУ — записано, поки не виправлено', () => {
    /*
     * Вада, якої не було видно оком і яку назвав перший же вимір: від
     * підошви до плеча радіус росте на 18%. Тобто бокова поверхня —
     * конус, а не призма, і саме тому тіло читається виточеною формою.
     * Еталон на тій самій ділянці дає 1.00.
     */
    const profile = ours(11).crystal;
    const shoulderBand = Math.floor(profile.shoulderAt * profile.bands.length) - 1;
    const flare = profile.bands[shoulderBand]! / profile.bands[0]!;
    expect(flare).toBeGreaterThan(1.0);
    expect(flare).toBeLessThan(1.20);
  });

  it('ПОРОДА ЛЕЖИТЬ ПЛАСКО — вінця в неї фактично немає', () => {
    /*
     * Найгірше число цього файла й пряма відповідь на запит власника.
     * Еталон: порода встає на 0.335 висоти кристала, її верх гуляє по
     * колу на 0.155. Наша підкладка: 0.168 і 0.013 — тобто вдвічі
     * нижча й РІВНА, як тарілка. `GEODE_WALL_HEIGHT` у `substrate.ts`
     * дорівнює 0.026 довжини монарха, і на екрані її не видно взагалі.
     */
    const { monarch, rock } = ours(11);
    const setting = crystalSettingProfile(monarch, rock);
    expect(setting.rockRise).toBeGreaterThan(0.16);
    expect(setting.rimRoughness).toBeGreaterThan(0.012);
    // Межа, а не мета: доки вона стоїть, «кристал росте з жеоди» — слова.
    expect(setting.rimRoughness).toBeLessThan(0.05);
  });
});
