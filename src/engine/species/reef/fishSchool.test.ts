import { describe, expect, it } from 'vitest';
import { buildReefPlan, type BuildReefPlanInput } from './reefAssembly';
import { FISH_MAX, FISH_MIN, REEF_FISH_COLOURS, reefFishSchool } from './fishSchool';
import { buildReefFishEyeMesh, buildReefFishMesh } from './fishMesh';

function planOf(overrides: Partial<BuildReefPlanInput> = {}): ReturnType<typeof buildReefPlan> {
  return buildReefPlan({
    relationshipStartedAt: '2022-12-26',
    asOf: '2026-08-25',
    leapDayPolicy: 'feb-28',
    seed: 4242,
    events: [],
    sharedDaysOff: [],
    theme: 'dark',
    ...overrides,
  });
}

const busy = Array.from({ length: 60 }, (_value, index) => ({
  occurredAt: `202${3 + (index % 4)}-0${1 + (index % 9)}-1${index % 10}`,
  module: (['calendar', 'plans', 'wishlist', 'map', 'memories', 'media'] as const)[index % 6]!,
}));

describe('зграя живе рифом, а не міряє його', () => {
  it('навіть порожній риф не безлюдний', () => {
    /*
     * Риба — не показник. Пара, у якої перший порожній рік, мусить
     * бачити живий риф, а не мертвий камінь: нуль риб означав би, що
     * порожнеча карається, а такого правила власник не називав.
     */
    const school = reefFishSchool(planOf({ asOf: '2022-12-27' }));
    expect(school.length).toBeGreaterThanOrEqual(FISH_MIN);
  });

  it('повніший риф — більша зграя, але не рій', () => {
    const quiet = reefFishSchool(planOf());
    const alive = reefFishSchool(planOf({ events: busy }));
    expect(alive.length).toBeGreaterThan(quiet.length);
    expect(alive.length).toBeLessThanOrEqual(FISH_MAX);
  });

  it('зграя різнокольорова, а не одноколірна', () => {
    // Дослівна вимога власника. Одна риба одного кольору — не зграя.
    const school = reefFishSchool(planOf({ events: busy }));
    expect(new Set(school.map((fish) => fish.colourIndex)).size)
      .toBe(REEF_FISH_COLOURS.length);
    for (const fish of school) {
      expect(REEF_FISH_COLOURS[fish.colourIndex]).toBeDefined();
    }
  });

  it('жодна риба не пливе крізь купол', () => {
    /*
     * Сцена не рахує зіткнень і не має рахувати. Тому кола мусять
     * лежати за головою ЗА ПОБУДОВОЮ — інакше риба періодично
     * пірнала б у камінь, і це виглядало б вадою рендерера.
     */
    for (const events of [[], busy]) {
      const plan = planOf({ events });
      for (const fish of reefFishSchool(plan)) {
        expect(fish.orbitRadius - fish.length * 0.5).toBeGreaterThan(plan.head.radius);
      }
    }
  });

  it('зграя пливе в обидва боки й на різних глибинах', () => {
    const school = reefFishSchool(planOf({ events: busy }));
    expect(school.some((fish) => fish.spinPerSecond > 0)).toBe(true);
    expect(school.some((fish) => fish.spinPerSecond < 0)).toBe(true);
    expect(new Set(school.map((fish) => fish.height)).size).toBeGreaterThan(school.length / 2);
  });

  it('та сама пара — та сама зграя; інша — інша', () => {
    expect(reefFishSchool(planOf())).toEqual(reefFishSchool(planOf()));
    expect(reefFishSchool(planOf({ seed: 7 }))).not.toEqual(reefFishSchool(planOf({ seed: 8 })));
  });
});

describe('риба — силует, а не модель', () => {
  const fish = buildReefFishMesh();

  it('коштує десятки трикутників, а не сотні', () => {
    // Ціна зграї — це ціна риби, помножена на двадцять два. Двісті
    // трикутників на рибу означали б, що зграя дорожча за весь риф.
    expect(fish.indices.length / 3).toBeLessThanOrEqual(30);
    expect(fish.positions.length / 3).toBeLessThanOrEqual(16);
  });

  it('стиснута з боків, а не кругла', () => {
    // Риба збоку висока, згори вузька — саме це робить силует рибою.
    const height = fish.bounds.max.y - fish.bounds.min.y;
    const width = fish.bounds.max.x - fish.bounds.min.x;
    expect(height).toBeGreaterThan(width * 2);
  });

  it('ніс дивиться в +Z — це контракт зі сценою', () => {
    // Сцена повертає рибу по дотичній до кола. Якби вісь була інша,
    // зграя пливла б боком, і виглядало б це помилкою повороту.
    expect(fish.bounds.max.z).toBeCloseTo(0.5, 6);
    expect(fish.bounds.min.z).toBeCloseTo(-0.5, 6);
  });

  it('усі числа скінченні, індекси в межах', () => {
    const vertices = fish.positions.length / 3;
    expect(fish.positions.every(Number.isFinite)).toBe(true);
    expect(fish.indices.every((index) => index >= 0 && index < vertices)).toBe(true);
    expect(fish.indices.length % 3).toBe(0);
  });

  it('хвіст двобічний — риба, що розвернулась, не показує виворіт', () => {
    /*
     * У площини немає товщини. Якби хвіст був однобічний, половина
     * зграї на кожному кадрі світила б порожнечею — і це читалось би
     * вадою рендерера, а не форми.
     */
    const seen = new Map<string, number>();
    for (let at = 0; at < fish.indices.length; at += 3) {
      const key = [fish.indices[at]!, fish.indices[at + 1]!, fish.indices[at + 2]!]
        .slice().sort((left, right) => left - right).join(':');
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    expect([...seen.values()].filter((count) => count === 2).length).toBe(2);
  });
});

describe('око — чорна крапка, і їх дві', () => {
  const eyes = buildReefFishEyeMesh();

  it('дві крапки, по одній на бік', () => {
    const sides = new Set<number>();
    for (let at = 0; at < eyes.positions.length; at += 3) {
      sides.add(Math.sign(eyes.positions[at]!));
    }
    expect(sides.has(1)).toBe(true);
    expect(sides.has(-1)).toBe(true);
  });

  it('крапка виступає за борт риби, інакше її не видно', () => {
    const body = buildReefFishMesh();
    const widest = Math.max(...[...Array(body.positions.length / 3).keys()]
      .map((index) => Math.abs(body.positions[index * 3]!)));
    const eyeAt = Math.abs(eyes.positions[0]!);
    // Не глибше за борт: крапка на осі зникла б усередині тіла.
    expect(eyeAt).toBeGreaterThan(widest * 0.4);
  });

  it('крапку видно на загальному плані, а не лише в коді', () => {
    /*
     * Перша редакція давала око 0.035 довжини риби. Риба на екрані
     * завдовжки близько 0.1 одиниці сцени, тобто око виходило 0.004 —
     * менше за піксель, і на живому знімку його не було зовсім.
     * Вимога «замість ока чорна точка» не буває виконаною наполовину:
     * точка, якої не видно, — це прибрана точка.
     *
     * Міряється проти ВИСОТИ тіла, бо саме на тлі тіла крапку й видно.
     */
    const body = buildReefFishMesh();
    const halfHeight = (body.bounds.max.y - body.bounds.min.y) / 2;
    let lowest = Infinity;
    let highest = -Infinity;
    for (let at = 1; at < eyes.positions.length; at += 3) {
      lowest = Math.min(lowest, eyes.positions[at]!);
      highest = Math.max(highest, eyes.positions[at]!);
    }
    expect((highest - lowest) / halfHeight).toBeGreaterThan(0.4);
  });

  it('дешева: два шестикутники', () => {
    expect(eyes.indices.length / 3).toBe(12);
  });
});
