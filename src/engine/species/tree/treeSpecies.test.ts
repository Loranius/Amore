import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildOrganicSkeleton } from '../../labs/organic';
import { DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG, treeToOrganicField } from './organicAdapter';
import { buildTreeSpeciesBlueprint } from './treeSpecies';

const BASE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'calendar:proposal',
    episodeId: 'relationship:proposal',
    occurredAt: '2024-02-14T19:00:00+02:00',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.95, remembrance: 0.6, stability: 0.45 },
    portalActivity: 0.24,
  },
  {
    id: 'place:lviv',
    occurredAt: '2024-08-10T12:00:00+03:00',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.85, remembrance: 0.3, culture: 0.2 },
    portalActivity: 0.32,
  },
  {
    id: 'wish:camera',
    episodeId: 'wish:camera:fulfillment',
    occurredAt: '2025-01-05T14:00:00+02:00',
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.65, significance: 0.62, stability: 0.16 },
    portalActivity: 0.24,
  },
  {
    id: 'shopping:2025-01-06',
    occurredAt: '2025-01-06',
    source: 'shopping@1',
    evidence: 'verified',
    channels: { stability: 0.08 },
    portalActivity: 0.02,
  },
];

function buildArtifact(events: readonly EvolutionEventInput[] = BASE_EVENTS) {
  return buildArtifactBlueprint({
    coupleId: 'amore:test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
}

function buildTree(
  events: readonly EvolutionEventInput[] = BASE_EVENTS,
  asOf = '2025-07-01',
) {
  return buildTreeSpeciesBlueprint({
    artifact: buildArtifact(events),
    config: { asOf, rulesVersion: 'tree-1.0.0' },
  });
}

function withoutMaturity<T extends { maturity: number }>(value: T): Omit<T, 'maturity'> {
  const { maturity: _maturity, ...stable } = value;
  return stable;
}

describe('Tree Species', () => {
  it('is deterministic regardless of source event order', () => {
    expect(buildTree([...BASE_EVENTS].reverse())).toEqual(buildTree());
  });

  it('рік дає гілку, а подія — характер цієї гілки', () => {
    /*
     * ЩО ТУТ ЗАМІЩЕНО. Знімок описував закон «один рядок порталу = одна
     * гілка»: із чотирьох подій виростало чотири гілки від подій і одна
     * річна. Той самий закон ADR-0004 прибрав із кристала, коли
     * справжня пара дійшла до 104 подій, а дерево лишалось останнім
     * видом, який ним ріс, — і платило подвійним бюджетом трикутників.
     *
     * Тепер гілок рівно стільки, скільки років стосунків. Події
     * вирішують, ЯКОЮ буде гілка свого року: товщиною, кроною,
     * напрямом.
     */
    const tree = buildTree();

    expect({
      species: `${tree.species}@${tree.speciesBlueprintVersion}`,
      stage: tree.state.stage,
      annual: tree.diagnostics.annualInstructionCount,
      fromEvents: tree.diagnostics.eventInstructionCount,
      growth: tree.growth.map(
        (instruction) => `${instruction.id}:${instruction.tier}:${instruction.attractorCount}`,
      ),
    }).toMatchInlineSnapshot(`
      {
        "annual": 2,
        "fromEvents": 0,
        "growth": [
          "tree:annual:1:companion:5",
          "tree:annual:2:support:3",
        ],
        "species": "tree@1",
        "stage": "young",
      }
    `);
  });

  it('дописана подія міняє гілку СВОГО року й не чіпає інших', () => {
    /*
     * ЦЕ ЗАМІНА, А НЕ ПОСЛАБЛЕННЯ. Раніше тут стояло «жодна наявна
     * гілка не змінюється, коли дописано подію» — і воно було правдою
     * лише тому, що кожна подія приносила ВЛАСНУ гілку, ні на що не
     * впливаючи.
     *
     * За новим законом подія робить свій рік повнішим, тож гілка того
     * року товщає. Це та сама названа межа, що в кристала й рифа:
     * «заморожений» стосується ЧАСУ, а не вмісту — пара, яка прийшла на
     * портал пізніше, мусить мати змогу заповнити минулі роки.
     *
     * Незмінним лишається все інше: стовбур, і гілки років, до яких
     * дописане не має стосунку.
     */
    const base = buildTree(BASE_EVENTS.slice(0, 3));
    const extended = buildTree([
      ...BASE_EVENTS.slice(0, 3),
      {
        id: 'memory:summer',
        occurredAt: '2025-06-20',
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 0.45 },
        portalActivity: 0.12,
      },
    ]);

    expect(extended.structure).toEqual(base.structure);
    expect(extended.growth).toHaveLength(base.growth.length);

    // Подія від 2025-06-20 належить другому року (від 2024-01-01).
    const touched = extended.growth.filter((instruction, index) => (
      JSON.stringify(instruction) !== JSON.stringify(base.growth[index])
    ));
    expect(touched.map((instruction) => instruction.id)).toEqual(['tree:annual:2']);
    expect(touched[0]!.attractorCount)
      .toBeGreaterThan(base.growth.find((g) => g.id === 'tree:annual:2')!.attractorCount);
  });

  it('lets time add annual growth and maturity without moving old morphology', () => {
    const earlier = buildTree(BASE_EVENTS, '2025-07-01');
    const later = buildTree(BASE_EVENTS, '2026-07-01');

    /*
     * СТРУКТУРА ТЕПЕР РОСТЕ, І ЦЕ НЕ ПОРУШЕННЯ ЗАМОРОЗКИ.
     *
     * Раніше тут стояло `toEqual`, і воно було правдою лише тому, що
     * розмір дерева не залежав від віку взагалі. Власник попросив
     * протилежного: «1 рік — росток; 2 — видно стовбур; 3 — є гілки і
     * стовбур грубший…» Справжнє дерево щороку додає кільце й тоді,
     * коли вгору вже не йде.
     *
     * Заморозка минулого від цього не страждає: вона про ГІЛКИ закритих
     * років, і нижче цей же тест її й перевіряє. Кристал поводиться так
     * само — `monarchAxialScale(daysTogether)` росте з часом.
     */
    expect(later.structure.trunkHeight).toBeGreaterThan(earlier.structure.trunkHeight);
    expect(later.structure.baseRadius).toBeGreaterThan(earlier.structure.baseRadius);
    expect(later.structure.crownRadius).toBeGreaterThan(earlier.structure.crownRadius);
    // Насіння вирішує, ЯКЕ це дерево; вік — наскільки воно виросло.
    expect(later.structure.seed).toBe(earlier.structure.seed);
    expect(later.structure.trunkStep).toBe(earlier.structure.trunkStep);
    // Гілок стільки, скільки років стосунків, включно з тим, що триває.
    expect(earlier.diagnostics.annualInstructionCount).toBe(2);
    expect(later.diagnostics.annualInstructionCount).toBe(3);

    /*
     * ЗАМОРОЗКА, І ЇЇ МЕЖА.
     *
     * Рік, який на ранню дату вже ЗАКРИВСЯ, не міняється від плину
     * часу: ані товщина, ані крона, ані напрям.
     *
     * А рік, який тоді ще тривав, — міняється, і мусить: він росте до
     * своєї річниці, як і поточна дитина кристала. Перша редакція цього
     * тесту вимагала незмінності від УСІХ гілок і на новому законі
     * падала саме на році, що тривав, — тобто вимагала, щоб поточний
     * рік не жив.
     */
    const closedEarlier = earlier.growth.filter((instruction) => instruction.maturity >= 1);
    expect(closedEarlier.length).toBeGreaterThan(0);
    for (const before of closedEarlier) {
      const after = later.growth.find((instruction) => instruction.id === before.id);
      expect(after, before.id).toBeDefined();
      expect(withoutMaturity(after!), before.id).toEqual(withoutMaturity(before));
      expect(after!.maturity).toBeGreaterThanOrEqual(before.maturity);
    }

    // А той, що тривав, за рік таки виріс.
    const running = earlier.growth.find((instruction) => instruction.maturity < 1);
    expect(running).toBeDefined();
    const grown = later.growth.find((instruction) => instruction.id === running!.id)!;
    expect(grown.maturity).toBeGreaterThan(running!.maturity);
  });

  it('diagnoses future and zero-pressure facts without growing branches from them', () => {
    const tree = buildTree([
      ...BASE_EVENTS,
      {
        id: 'future:trip',
        occurredAt: '2027-01-01',
        source: 'plans@1',
        evidence: 'verified',
        channels: { exploration: 1 },
      },
      {
        id: 'activity-only',
        occurredAt: '2025-02-01',
        source: 'legacy@1',
        evidence: 'historical-estimate',
        channels: {},
        portalActivity: 0.2,
      },
    ]);

    expect(tree.diagnostics.futureEventIds).toEqual(['future:trip']);
    expect(tree.diagnostics.zeroPressureEventIds).toEqual(['activity-only']);
    expect(tree.growth.some((instruction) => instruction.sourceEventId === 'future:trip')).toBe(false);
    expect(tree.growth.some((instruction) => instruction.sourceEventId === 'activity-only')).toBe(false);
    expect(tree.state.eventCount).toBe(BASE_EVENTS.length + 1);
  });

  it('новий рік дописується в кінець, не рухаючи попередніх', () => {
    /*
     * Додавання ЧАСОМ, а не подією — і це виправлення, а не спрощення.
     *
     * Перша редакція дописувала подію й вимагала, щоб префікс поля
     * притягачів не зрушив. За старим законом це виконувалось само
     * собою: подія приносила власну гілку в кінець. За новим подія
     * робить свій рік повнішим, тобто законно міняє його гілку — і
     * дописування в кінець тепер робить саме ЧАС, як воно й є з
     * деревом.
     */
    const earlier = treeToOrganicField(buildTree(BASE_EVENTS, '2025-07-01'));
    const later = treeToOrganicField(buildTree(BASE_EVENTS, '2026-07-01'));

    const closedPrefix = earlier.attractors.filter(
      (attractor) => attractor.id.startsWith('tree:annual:1:'),
    );
    expect(closedPrefix.length).toBeGreaterThan(0);

    /*
     * ЩО САМЕ ТУТ ІНВАРІАНТ, ПІСЛЯ ПОЯВИ РОСТУ.
     *
     * Раніше стояло `toEqual` по координатах, і воно трималось лише тому,
     * що дерево не росло. Власник попросив протилежного, і дослівно:
     * «третій рік стовбур стає грубшим, гілки підтягуються вище до
     * крони». Тобто в його моделі дерево росте ЦІЛКОМ, а не додає нові
     * гілки над нерухомими старими.
     *
     * Інваріант, який лишається й важить: дописування в КІНЕЦЬ. Склад і
     * порядок притягачів закритого року не міняються — новий рік не
     * втручається в старі й не переставляє їх. Саме це й ловило ваду,
     * заради якої тест писався.
     */
    const laterYearOne = later.attractors.filter(
      (attractor) => attractor.id.startsWith('tree:annual:1:'),
    );

    /*
     * ГІЛКА ЗАКРИТОГО РОКУ РОСТЕ ДАЛІ — і це вимога власника, дослівно:
     * «4 рік стовбур стає грубшим, гілки стають грубшими». Справжня
     * гілка не завмирає: вона товщає й видовжується десятиліттями.
     *
     * Тому заморозка тут означає не «координати не рухаються», а
     * «запис року не переписується»: ті самі притягачі, у тому самому
     * порядку, з тим самим початком. Новий рік дописується в КІНЕЦЬ і не
     * втручається в старі — саме та вада, заради якої тест писався.
     *
     * Кристал заморожує свої річні тіла цілком, і це не суперечність:
     * кристал по формуванні не росте, дерево росте. Вид відповідає за
     * власну біологію, спільним лишається рік.
     */
    expect(laterYearOne.length).toBeGreaterThanOrEqual(closedPrefix.length);
    expect(laterYearOne.slice(0, closedPrefix.length).map((a) => a.id))
      .toEqual(closedPrefix.map((a) => a.id));
    expect(later.attractors.slice(0, laterYearOne.length).map((a) => a.id))
      .toEqual(laterYearOne.map((a) => a.id));

    const earlierSkeleton = buildOrganicSkeleton({
      seed: earlier.seed,
      attractors: closedPrefix,
      config: earlier.skeletonConfig,
    });
    const laterSkeleton = buildOrganicSkeleton({
      seed: later.seed,
      attractors: laterYearOne.slice(0, closedPrefix.length),
      config: later.skeletonConfig,
    });
    /*
     * ТОПОЛОГІЯ та сама, РОЗМІР більший. Гілка того самого року лишається
     * тією самою гілкою — стільки ж вузлів, той самий батьківський
     * ланцюг, — але виросла. Порівнювати вузли дослівно означало б
     * вимагати, щоб гілка завмерла, чого власник прямо не просив: «гілки
     * стають грубішими».
     */
    /*
     * Вузлів стало БІЛЬШЕ (6 проти 4), і це не збій: крок росту сталий, а
     * стовбур подовшав — «2 рік вже видно маленький стовбур, що тягнеться
     * догори». Інваріант тут — надмножина: те, що було, лишилось на
     * місці в ланцюгу, і зверху дописалось нове.
     */
    expect(laterSkeleton.nodes.length).toBeGreaterThanOrEqual(earlierSkeleton.nodes.length);
    expect(laterSkeleton.nodes.slice(0, earlierSkeleton.nodes.length).map((node) => node.parentId))
      .toEqual(earlierSkeleton.nodes.map((node) => node.parentId));
    const before = earlierSkeleton.nodes.at(-1)!.position;
    const after = laterSkeleton.nodes.at(-1)!.position;
    expect(Math.hypot(after.x, after.y, after.z))
      .toBeGreaterThan(Math.hypot(before.x, before.y, before.z));
  });

  it('truncates only the newest instructions at an explicit adapter budget', () => {
    const field = treeToOrganicField(buildTree(), {
      rulesVersion: 'test-cap',
      maxAttractors: 4,
      maxNodes: 80,
      maxGeneration: 3,
      maxBranchSegments: 8,
      elevationFan: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.elevationFan,
      radialFan: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.radialFan,
      yearVigourBase: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.yearVigourBase,
      yearVigourSpan: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.yearVigourSpan,
      yearVigourKnee: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.yearVigourKnee,
      yearVigourMaximum: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.yearVigourMaximum,
      apicalControlYoung: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.apicalControlYoung,
      apicalControlMature: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.apicalControlMature,
      apicalControlCoupleSpan: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.apicalControlCoupleSpan,
      pipeExponentYoung: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.pipeExponentYoung,
      pipeExponentMature: DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.pipeExponentMature,
    });

    /*
     * Обрізається НАЙНОВІШЕ, і тепер це видно чистіше: найстарший рік
     * віддає свої притягачі перший, а рік, що триває, зникає повністю.
     */
    expect(field.attractors).toHaveLength(4);
    expect(field.attractors.map((attractor) => attractor.id)).toEqual([
      'tree:annual:1:attractor:0',
      'tree:annual:1:attractor:1',
      'tree:annual:1:attractor:2',
      'tree:annual:1:attractor:3',
    ]);
    /*
     * Обидва роки в списку, і це правильно: перший віддав чотири
     * притягачі з п'яти, другий — жодного. «Обрізаний» означає «щось
     * втратив», а не «зник цілком».
     */
    expect(field.diagnostics.truncatedInstructionIds)
      .toEqual(['tree:annual:1', 'tree:annual:2']);
  });
});

/*
 * ВІКОВЕ ПОСЛАБЛЕННЯ ЛІДЕРА (ADR-0091).
 *
 * Верхівкове панування λ — це частка річної сили, яку забирає лідер. Доки
 * воно було сталим, сорокарічне дерево вирощувало голу лозину й лишало всю
 * крону спідницею біля землі: 88% листя сиділо в нижній п'ятій частині
 * висоти. Живе дерево так поводиться лише замолоду (ексурентна крона), а з
 * віком лідер губиться серед рівних йому гілок (декурентна).
 */
describe('Tree Species — верхівкове панування з віком', () => {
  const apicalAt = (asOf: string) =>
    treeToOrganicField(buildTree(BASE_EVENTS, asOf)).selfOrganizingConfig.apicalControl;

  it('слабшає з роками, а не лишається сталим', () => {
    const young = apicalAt('2025-07-01');
    const middle = apicalAt('2040-07-01');
    const old = apicalAt('2064-07-01');

    expect(young).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(old);
  });

  it('лишається в межах молодого й зрілого значень', () => {
    const { apicalControlYoung, apicalControlMature, apicalControlCoupleSpan } =
      DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG;

    for (const asOf of ['2024-07-01', '2030-07-01', '2050-07-01', '2100-07-01']) {
      const lambda = apicalAt(asOf);
      expect(lambda).toBeLessThanOrEqual(apicalControlYoung);
      expect(lambda).toBeGreaterThanOrEqual(apicalControlMature - apicalControlCoupleSpan);
    }
  });

  /*
   * ЗАСТЕРЕЖЕННЯ, А НЕ ПРИКРАСА. Виміряно: за зрілого λ 0.56 сорокарічне
   * дерево ОСІДАЄ до висоти 6.3 — нижче за власне чотирирічне, бо крона
   * затінює ослаблого лідера й скидає його. 0.60 стоїть рівно на цьому краю,
   * тож тест ловить саме перехід межі, а не «значення змінилось».
   */
  it('не опускає зріле значення нижче межі осідання', () => {
    expect(DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.apicalControlMature).toBeGreaterThanOrEqual(0.6);
  });
});
