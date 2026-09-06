import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG, buildCrystalMaterialState } from '../material';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
import { buildCrystalGeometry } from './engine';
import { CRYSTAL_SUBSTRATE_BODY_ID, crystalVeinBuriedRadiusAt } from './substrate';
import { childFootWidth, monarchFootWidth } from '../species/crystal/growthModel';
import type { CrystalMeshData } from './types';

// The brief's section 4, and the last line of section 3, held as assertions.
//
// One shared root the whole colony grows out of: 4–8% of the monarch's height,
// reaching past the ring of daughters, the same colour as the crystals standing
// in it but darker. And the daughters sunk into it by 8–14% of their own
// length — enough that they grow out of the root, not so much that they are
// stubs set into it.

const MONARCH_ID = 'crystal:mother';

function colony(years: number, eventCount: number) {
  const events: EvolutionEventInput[] = Array.from({ length: eventCount }, (_, index) => ({
    id: `root-${index}`,
    occurredAt: `${2001 + Math.floor((index / eventCount) * years)}-0${(index % 8) + 1}-14T09:00:00Z`,
    source: index % 3 === 0 ? 'memories@1' : index % 3 === 1 ? 'map@1' : 'plans@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.6, exploration: 0.4, achievement: 0.5 },
    portalActivity: 0.5,
  }));
  const artifact = buildArtifactBlueprint({
    coupleId: `shared-root:${years}:${eventCount}`,
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2000-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: `${2000 + years}-06-04T09:00:00Z`, rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({
    growth,
    config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: 'high' },
  });
  return { growth, geometry, material };
}

/** Colony sizes from the first month to well past the thirty-year term. */
const SIZES: readonly (readonly [number, number])[] = [
  [1, 6],
  [3, 24],
  [7, 40],
  [14, 90],
  [25, 160],
  [30, 200],
  [40, 300],
];

function verticalSpan(mesh: CrystalMeshData): { low: number; high: number } {
  let low = Infinity;
  let high = -Infinity;
  for (let index = 1; index < mesh.positions.length; index += 3) {
    const y = mesh.positions[index]!;
    if (y < low) low = y;
    if (y > high) high = y;
  }
  return { low, high };
}

function widestRadius(mesh: CrystalMeshData): number {
  let radius = 0;
  for (let index = 0; index < mesh.positions.length; index += 3) {
    radius = Math.max(radius, Math.hypot(mesh.positions[index]!, mesh.positions[index + 2]!));
  }
  return radius;
}

describe('the root the whole colony grows out of (crystal cluster brief §4)', () => {
  it('лишається швом: видно, але не сходинка', () => {
    // The band the brief names. It is a seam, not a plinth: much lower and the
    // crystals read as set down on the floor, much higher and the root becomes
    // a step they stand on — which is the shape the vein exists to be rid of.
    for (const [years, count] of SIZES) {
      const { geometry } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const monarch = geometry.meshes.find((mesh) => mesh.bodyId === MONARCH_ID)!;
      const monarchSpan = verticalSpan(monarch);
      // **The seam, not the mesh's highest point.** Broken rock stands on the
      // root — that is what stops the seam reading as a plinth — so the mesh's
      // top is a boulder, and measuring it answers "how tall is the tallest
      // stone" rather than "how much root is showing". This test measured the
      // bounding box and passed for as long as the two happened to be close;
      // it failed the moment the rubble was allowed to sit further out and
      // grew taller. Geometry publishes `seamTriangleCount` for exactly this.
      /*
       * Губа береться з профілю, а не з найвищої точки шва.
       *
       * Той самий крок, який цей тест уже робив раніше: коли на шов
       * поклали брили, «найвища точка меша» перестала означати «шов», і
       * вимір звузили до `seamTriangleCount`. Тепер повторилось на
       * рівень глибше — у жеоди з'явилась СТІНКА по периметру, тож
       * найвища точка самого шва це стінка, а не губа.
       *
       * Смуга 4–8% боронить від «сходинки, на якій стоять кристали», а
       * це властивість шва ПІД КРИСТАЛАМИ. Стінка встає осторонь від
       * них і на цю властивість не впливає — за те, щоб вона не
       * поглинула дітей, відповідає наступний тест.
       */
      const seamTop = root.profile.seamRimHeight;
      expect(seamTop, `${years}y публікує губу`).toBeGreaterThan(0);
      /*
       * Ділиться на ВИДИМУ висоту монарха, а не на повний проліт меша.
       *
       * §4 каже «стоїть на 4–8% висоти монарха **над каменем**», і
       * закопана частина до цього не належить ні за словами вимоги, ні
       * за суттю: її не видно. Повний проліт містить її, тож той самий
       * незмінний шов давав різне число щоразу, коли мінялось
       * занурення монарха.
       *
       * Виміряно на обох зануреннях (0.10 і 0.16), п'ять розмірів
       * колонії:
       *
       *   губа / повний проліт    0.0415 → 0.0386   (повзе)
       *   губа / видима висота    0.0457 → 0.0457   (стала)
       *
       * Тобто основа була не просто менш зручна — вона рухалась від
       * зміни, яка нічого видимого не міняє. Це не послаблення
       * перевірки: смуга та сама, змінився знаменник, і на новій основі
       * значення сидить рівно посередині.
       */
      const share = seamTop! / monarchSpan.high;
      /*
       * СМУГА ЗМІНЕНА: 4–8% → 0.8–2.5%, і це рішення власника, а не
       * підгонка під зелений тест.
       *
       * Він тричі поспіль вів в один бік — «опускай жеоду нижче»,
       * «опусти сам кристал нижче», і врешті прямо: «опусти основу
       * кристала… щоб основи кристала монарха і кристалів дітей
       * торкались текстури платформи». Смуга 4–8% і ця вимога не
       * можуть виконуватись обидві: перша каже, що корінь СТОЇТЬ над
       * каменем, друга — що кристали з нього виходять.
       *
       * Що при цьому НЕ змінилось і чому це головне: ADR-0003 цілий.
       * Базові кришки лежать нижче нуля, а тіло жили нікуди не
       * поділось — виміряно, низ жили −0.1051 проти найглибшої кришки
       * −0.0818, тобто запас 0.023. Жила перестала СТОЯТИ над каменем,
       * але не перестала кришки накривати.
       *
       * Смуга лишається смугою, а не «більше нуля»: нижня межа боронить
       * від зникнення шва (тоді стик читається різаним колом каменю),
       * верхня — від повернення сходинки. Виміряно 1.2% на п'яти
       * розмірах колонії. Див. ADR-0062.
       */
      expect(share, `${years}y`).toBeGreaterThanOrEqual(0.008);
      expect(share, `${years}y`).toBeLessThanOrEqual(0.025);
    }
  });

  it('стінка жеоди не поглинає жодного кристала', () => {
    /*
     * Обіцянка, яку дає попередній тест, коли бере губу з профілю
     * замість найвищої точки шва: стінка законно стоїть вище губи, але
     * лише ОСТОРОНЬ від кристалів.
     *
     * Перевіряється на всіх розмірах колонії, а не лише на трьох роках,
     * бо ризик росте саме з кількістю дітей: що їх більше, то ближче
     * зовнішнє кільце підходить до контуру жили — і то ймовірніше, що
     * порода встане просто на дитині. Виміряний випадок: 0.057 при губі
     * 0.0246, тобто камінь удвічі вищий за губу на самому кристалі.
     */
    for (const [years, count] of SIZES) {
      const { geometry, growth } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const rim = root.profile.seamRimHeight;
      expect(rim, `${years}y публікує губу`).toBeGreaterThan(0);
      const seamTriangles = root.profile.seamTriangleCount!;
      for (let slot = 0; slot < seamTriangles * 3; slot += 1) {
        const index = root.indices[slot]!;
        const x = root.positions[index * 3]!;
        const y = root.positions[index * 3 + 1]!;
        const z = root.positions[index * 3 + 2]!;
        for (const body of growth.bodies) {
          const reach = Math.hypot(x - body.anchor.x, z - body.anchor.z);
          if (reach > body.renderedRadius) continue;
          expect(y, `${years}y ${body.id}: порода піднялась усередині сліду`)
            .toBeLessThanOrEqual(rim! + 1e-6);
        }
      }
    }
  });

  it('reaches past the outermost daughter, and covers every base', () => {
    // "Reaches the daughter ring" is a floor, not a target: a root that stopped
    // short would leave a crystal standing on bare stone, and ADR-0003's
    // guarantee — no base cap ever visible, including from underneath — would
    // go with it.
    for (const [years, count] of SIZES) {
      const { geometry } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const rootSpan = verticalSpan(root);
      const rootRadius = widestRadius(root);

      for (const mesh of geometry.meshes) {
        if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
        expect(rootRadius, `${years}y ${mesh.bodyId} reach`).toBeGreaterThan(widestRadius(mesh));
        expect(rootSpan.low, `${years}y ${mesh.bodyId} depth`)
          .toBeLessThanOrEqual(verticalSpan(mesh).low);
      }
    }
  });

  it('жодна закопана точка не виходить із каменю (ADR-0003, вимір ADR-0126)', () => {
    /*
     * Пряме твердження ADR-0003, поміряне на СПРАВЖНІЙ геометрії.
     *
     * Два тести вже стережуть накриття, і обидва міряють приблизно.
     * `covers every crystal footprint` обходить коло радіусом
     * `renderedRadius` — а це радіус до грані, і готове тіло ширше за
     * нього до півтора раза (ADR-0125). `reaches past the outermost
     * daughter` порівнює НАЙБІЛЬШИЙ радіус жили з НАЙБІЛЬШИМ радіусом
     * тіла, тобто числа з різних висот і різних напрямків: воно
     * проходить і тоді, коли конкретна кришка звисає з краю збоку.
     *
     * Тут беруться всі опубліковані вершини нижче нуля — тобто саме те,
     * що камінь мусить сховати, — і кожна звіряється зі своїм власним
     * кутом.
     *
     * Межа — кільце коміра, а не контур верхньої поверхні: жила
     * розширюється донизу, і контур оголосив би ваду там, де її немає.
     * Виміряно на семи розмірах колонії: за контур кришки виходять на
     * 0.3–1.5% висоти монарха, і всі до одної лежать усередині коміра
     * із запасом 0.9–4.5%.
     */
    for (const [years, count] of SIZES) {
      const { geometry, growth } = colony(years, count);
      let tightest = Number.POSITIVE_INFINITY;
      let tightestId = '';
      for (const mesh of geometry.meshes) {
        if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
        for (let index = 0; index < mesh.positions.length; index += 3) {
          const x = mesh.positions[index]!;
          const y = mesh.positions[index + 1]!;
          const z = mesh.positions[index + 2]!;
          if (y > 0) continue;
          const gap = crystalVeinBuriedRadiusAt(
            growth.bodies,
            growth.artifactSeed,
            Math.atan2(x, z),
          ) - Math.hypot(x, z);
          if (gap < tightest) {
            tightest = gap;
            tightestId = mesh.bodyId;
          }
        }
      }
      expect(Number.isFinite(tightest), `${years}y має закопані точки`).toBe(true);
      expect(tightest, `${years}y ${tightestId} стирчить із каменю`).toBeGreaterThan(0);
    }
  });

  it('жеода не ховає кільце років', () => {
    /*
     * Те, на що власник показав пальцем — і що виявилось гіршим, ніж
     * виглядало.
     *
     * Стінка була 0.15 довжини монарха, і проти НЬОГО це звучало
     * скромно. Але кільце років міряється не монархом: діти заввишки
     * 0.07–0.28 при монарху до 1.27, тож та сама стінка ховала
     * **65–71% висоти навіть найвищої дитини** на всіх розмірах
     * колонії. За ADR-0058 кільце має читатись літописом — видно, який
     * рік був сильніший; на дві третини похованим воно не читається.
     *
     * Межа записана через ДІТЕЙ, а не через монарха: число, узяте від
     * монарха, вже один раз збрехало саме тут.
     *
     * Виміряно після 0.085: 37–40% на всіх розмірах, тобто величина
     * стала ще й сталою. Стеля 0.5 лишає запас і валить стару пару.
     */
    for (const [years, count] of SIZES) {
      const { geometry } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const bodies = geometry.meshes.filter((mesh) => mesh.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);
      const monarch = bodies.reduce((tallest, mesh) => (
        mesh.bounds.max.y > tallest.bounds.max.y ? mesh : tallest
      ));
      const children = bodies.filter((mesh) => mesh !== monarch);
      expect(children.length, `${years}y має бути кільце`).toBeGreaterThan(0);

      /*
       * Міряється НАЙВИЩА дитина, і це названа межа перевірки, а не
       * зручність. Найнижча дитина тоне: 50% на першому році, 84% на
       * сьомому, 111% на чотирнадцятому — тобто зі ~12 року найслабші
       * роки зникають під каменем цілком.
       *
       * Це не лікується цим числом. Стінка масштабується монархом
       * (0.085 його довжини), а слабкий рік застигає назавжди на 40%
       * ТОГОЧАСНОГО монарха, тож із роками камінь неминуче переростає
       * його. Причому вирішує вже не стінка, а губа: на 14 роках сама
       * губа ховає 59% найслабшої дитини, а стінці потрібно ще 1.8 від
       * неї, щоб читались розломи.
       *
       * Отже, вибір між §4 («корінь стоїть на 4–8% висоти монарха») і
       * ADR-0058 («кожен рік лишається видимим») на великих колоніях
       * доведеться робити власникові. Тут зафіксовано те, що правда
       * СЬОГОДНІ, і названо те, що ні.
       */
      const tallestChild = Math.max(...children.map((mesh) => mesh.bounds.max.y));
      expect(tallestChild).toBeGreaterThan(0);
      expect(
        root.bounds.max.y / tallestChild,
        `${years}y жеода ховає найсильніший рік`,
      ).toBeLessThan(0.5);
    }
  });

  it('БРИЛИ Є, і жодна не лізе в кристал (ADR-0138)', () => {
    /*
     * Записане правило, і воно записане саме так, бо протилежне вже
     * пробували: «обрізай брилу до щілини, а не відкидай її за те, що
     * вона в щілині. Відкидання за близькістю викидало п'ять із шести й
     * лишало два камені на голому шві».
     *
     * Отже гарантія стоїть над РОЗМІРОМ, а не над місцем: камінь може
     * лежати впритул до кристала, але жодна його вершина не має бути
     * всередині тіла. Мала каменюка біля підошви — рівно те, що показує
     * еталон; велика там — порушення.
     *
     * Брили лежать ПІСЛЯ шва, тож `seamTriangleCount` знову означає те,
     * що каже, і тест бере саме хвіст.
     */
    for (const [years, count] of SIZES) {
      const { geometry, growth } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const seam = root.profile.seamTriangleCount!;
      const total = root.indices.length / 3;
      expect(total - seam, `${years}y насип є`).toBeGreaterThan(0);

      let worst = Number.POSITIVE_INFINITY;
      for (let slot = seam * 3; slot < root.indices.length; slot += 1) {
        const index = root.indices[slot]!;
        const x = root.positions[index * 3]!;
        const z = root.positions[index * 3 + 2]!;
        for (const body of growth.bodies) {
          /*
           * Півширина підошви, а не оголошений радіус: той менший за
           * справжнє тіло до півтора раза (ADR-0125), і гарантія, взята
           * від нього, була б гарантією на папері.
           */
          const foot = body.renderedRadius * (body.kind === 'crystal:mother'
            ? monarchFootWidth(String(body.attributes.archetype ?? 'prismatic'))
            : childFootWidth(String(body.attributes.archetype ?? 'prismatic')));
          worst = Math.min(
            worst,
            Math.hypot(x - body.anchor.x, z - body.anchor.z) - foot,
          );
        }
      }
      expect(worst, `${years}y брила залізла в кристал`).toBeGreaterThan(0);
    }
  });

  it('насип не підіймає купу вище за її ж гребінь', () => {
    /*
     * Те, що знайшов тест `жеода не ховає кільце років`, і що коштувало
     * двох відкочених спроб. Брила, посаджена НА гребінь, підіймала
     * найвищу точку меша — на першому році до 0.64 при межі 0.5.
     *
     * Правило, яке з цього вийшло: камінь ЛЕЖИТЬ на купі, а не стоїть
     * над нею. Тут воно й перевіряється прямо, щоб наступна правка
     * посадки не поверталась до тієї межі через ADR-0058.
     */
    for (const [years, count] of SIZES) {
      const { geometry } = colony(years, count);
      const root = geometry.meshes.find((mesh) => mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const seam = root.profile.seamTriangleCount!;
      let seamTop = Number.NEGATIVE_INFINITY;
      let rubbleTop = Number.NEGATIVE_INFINITY;
      for (let slot = 0; slot < root.indices.length; slot += 1) {
        const y = root.positions[root.indices[slot]! * 3 + 1]!;
        if (slot < seam * 3) seamTop = Math.max(seamTop, y);
        else rubbleTop = Math.max(rubbleTop, y);
      }
      expect(rubbleTop, `${years}y насип вище за шов`).toBeLessThanOrEqual(seamTop + 1e-6);
    }
  });

  it('жила — комір навколо дітей, а не калюжа під ними', () => {
    /*
     * ADR-0061 назвав ваду, ADR-0125 полагодив вимір.
     *
     * Вада: підкладка виходила в 1.58 раза ширшою за самі кристали, бо
     * виліт гілки давав 0.6 відстані плюс до 0.3 від міток карти. На
     * екрані це читалось як осип аметисту, що накриває п'єдестал руїни
     * й вихлюпується на підлогу.
     *
     * Вимір: тест брав НАЙШИРШУ ТОЧКУ МЕША й називав її жилою. Це було
     * правдою рівно доти, доки зовні контуру не став комір (ADR-0115),
     * а він за побудовою ширший — `collarRadius` множить відстань від
     * монарха до контуру на 1.22. Тобто число росло разом із колонією
     * не тому, що кварц розповзався, а тому, що порода стоїть далі,
     * і стояти далі — це її робота (`rockSpread` в засувках еталона).
     *
     * Виміряно на семи розмірах колонії, БЕЗ жодної зміни в розкладці:
     *
     *   роки    межа меша / кристали    контур / кристали
     *      1              1.179                 1.019
     *      3              1.151                 0.990
     *      7              1.296                 1.088
     *     14              1.337                 1.086
     *     25              1.345                 1.100
     *     30              1.400                 1.133
     *     40              1.378                 1.104
     *
     * Стара межа 1.35 падала на тридцяти роках сама по собі — її просто
     * ніхто не міряв, бо список розмірів кінчався на двадцяти п'яти.
     * Число, що тримається лише на вибраних розмірах, це не інваріант,
     * а запис одного заміру; тому тут і додано 30 та 40 років.
     *
     * Контур же стоїть: 0.99–1.13 від першого місяця до сорока років.
     * Саме він і є тим кварцем, про який ADR-0061 писав «рівно
     * настільки, щоб накрити їхні кришки».
     *
     * Нижня межа не сторожує ADR-0003 — за накриття кришок відповідає
     * `reaches past the outermost daughter` вище, і воно міряє кришки, а
     * не найширшу точку тіла (нахилена дитина найширша десь угорі, а не
     * в п'яті, тож 0.99 тут — це не діра в камені).
     */
    for (const [years, count] of SIZES) {
      const { geometry } = colony(years, count);
      let crystals = 0;
      let root: CrystalMeshData | undefined;
      for (const mesh of geometry.meshes) {
        if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) root = mesh;
        else crystals = Math.max(crystals, widestRadius(mesh));
      }
      const outline = root!.profile.seamOutlineRadius!;
      expect(outline, `${years}y публікує контур`).toBeGreaterThan(0);
      expect(outline / crystals, `${years}y кварц відстав від колонії`).toBeGreaterThan(0.95);
      expect(outline / crystals, `${years}y кварц розповзся`).toBeLessThan(1.2);
      // А комір стоїть ЗОВНІ контуру — те, заради чого він є.
      expect(widestRadius(root!), `${years}y комір усередині контуру`).toBeGreaterThan(outline);
    }
  });

  it('КАМІНЬ, а не кристал темніше — але камінь саме цієї пари', () => {
    /*
     * ПРАВИЛО ЗМІНЕНЕ ВЛАСНИКОМ (ADR-0136), і попереднє записано тут же,
     * бо воно було правильним для свого часу.
     *
     * Було: «той самий тон, менша яскравість». Це замінило три сталі
     * константи (0.245 / 0.238 / 0.283), які давали підкладці власний
     * лавандовий тон і мовчки розходились із палітрою — виміряно, її
     * червоно-синє відношення 0.885 проти монархових 1.267, тобто на 43%
     * синіше. Похідний колір цю ваду закрив і закриває далі.
     *
     * Стало: підкладка — це ПОРОДА, з якої кристал росте, а не ложе того
     * самого мінералу. Власник, побачивши жеоду на екрані: «зміни його
     * колір на більш сірий, якийсь камінний, бо він зараз виглядає тупо
     * забором навколо кристала».
     *
     * Що лишилось незмінним і чому це головне: колір і далі ПОХІДНИЙ від
     * оболонки. Знебарвлення — це крок від неї, а не заміна її сталою;
     * рівно та вада, від якої тікав попередній запис, повернутись не
     * може.
     */
    for (const [years, count] of SIZES) {
      const { material } = colony(years, count);
      const root = material.bodies.find((body) => body.bodyId === CRYSTAL_SUBSTRATE_BODY_ID)!;
      const monarch = material.bodies.find((body) => body.bodyId === MONARCH_ID)!;

      const value = (color: { r: number; g: number; b: number }) => (color.r + color.g + color.b) / 3;
      const saturation = (color: { r: number; g: number; b: number }) => {
        const high = Math.max(color.r, color.g, color.b);
        const low = Math.min(color.r, color.g, color.b);
        return high > 1e-6 ? (high - low) / high : 0;
      };

      // КАМІНЬ: насиченість підкладки — мала частка кристалової. Це і є
      // те, що власник назвав «сірим, якимось камінним».
      const bleach = saturation(root.baseColor) / Math.max(1e-6, saturation(monarch.baseColor));
      expect(bleach, `${years}y знебарвлення`).toBeLessThan(0.2);

      // САМЕ ЦІЄЇ ПАРИ: слід тону лишається й дивиться в той самий бік.
      // Нуль тут означав би, що колір перестав бути похідним — тобто
      // повернення до сталої, від якої тікали.
      expect(saturation(root.baseColor), `${years}y слід тону`).toBeGreaterThan(0);
      const lean = (color: { r: number; g: number; b: number }) => color.r / Math.max(1e-6, color.b);
      expect(
        (lean(root.baseColor) - 1) * (lean(monarch.baseColor) - 1),
        `${years}y бік тону`,
      ).toBeGreaterThan(0);

      // Яскравість не переглядалась: вона виміряна проти підлоги двома
      // невдачами (втричі — біла пляма, менш ніж удвічі — тінь).
      const darkness = value(root.baseColor) / value(monarch.baseColor);
      expect(darkness, `${years}y value`).toBeGreaterThan(0.4);
      expect(darkness, `${years}y value`).toBeLessThan(0.7);
    }
  });
});

describe('daughters sunk into the root (crystal cluster brief §3)', () => {
  it('buries every daughter 8–14% of her own length', () => {
    // The rule this replaces was `radialScale * 0.9` — a fixed multiple of the
    // body's *radius* — so how deep a crystal sat depended on how fat it was
    // rather than how tall. Measured across these same five colonies it buried
    // the slender year crystals 10.5–13.2% of their length and the stout skirt
    // bodies 26.9%, the same 26.9% at every colony size: a constant that never
    // knew what it was measuring. A quarter of a body underground is a stub set
    // into a root, not a crystal grown out of one.
    //
    // Measured along each body's own axis, which is the axis it was buried
    // along. The first version of this test divided the anchor's *vertical*
    // drop by the body's length and failed at 0.0775 on a fourteen-year colony:
    // a crystal leaning θ drops by `burial · cos θ`, so the vertical reading
    // understates the burial by its own cos θ and a body at the floor of the
    // band reads as below it. The body's own frame is the only frame this
    // quantity is defined in — the same lesson the silhouette pass learned by
    // measuring a leaning body's width from the world origin.
    for (const [years, count] of SIZES) {
      const { growth } = colony(years, count);
      for (const body of growth.bodies) {
        if (body.id === MONARCH_ID) continue;
        // Recovered exactly rather than approximated. A ground body is anchored
        // at `surfacePoint - direction · burial` with the surface point on
        // y = 0, so dividing the anchor's depth by the axis's own vertical
        // component undoes the projection and gives back the burial along the
        // axis — no small-angle assumption anywhere in it.
        const burial = -body.anchor.y / Math.max(1e-6, body.direction.y);
        expect(burial, `${years}y ${body.id} has a burial at all`).toBeGreaterThan(0);
        const share = burial / body.renderedLength;
        expect(share, `${years}y ${body.id}`).toBeGreaterThanOrEqual(0.08);
        expect(share, `${years}y ${body.id}`).toBeLessThanOrEqual(0.14);
      }
    }
  });
});
