// ============================================================
// Геометричні тести зовнішньої оболонки (Volume V).
// ------------------------------------------------------------
// Перевіряють вимоги профілю CRYSTAL_ATTACHMENT_INTEGRITY:
//   `CAI-REQ-005` — кришка основи дитини не є частиною зовнішньої оболонки;
//   `CAI-REQ-006` — стик зварений: відкрита межа лишається в масі;
//   `CAI-REQ-007` — сторонні перетини не видно;
//   `CAI-REQ-008` — проби знизу не бачать вивороту оболонки;
//   `V5-REQ-013..016` — детермінізм і коректність обробки стику.
//
// Тести ГЕОМЕТРИЧНІ, не скріншотні: вони читають буфери й пускають промені,
// тож результат не залежить ні від GPU, ні від освітлення.
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildMass, SEEDS, toShellEntries } from './fixture';
import { makeBranch, STRESS_MATERIAL } from './stress';
import { publishCrystal } from '../crystalPublication';
import { breatheMargin, isInsideHost } from '../geometry/hostBody';
import { triangleInside, worldVertices } from '../geometry/junctionTrim';
import {
  probeExterior,
  UNDERSIDE_DIRECTIONS,
  formatShellViolations,
  validateExternalShell,
} from '../geometry/validateShell';

/** Індекси вершин, що входять у грані кришки основи (ряд 0 профілю). */
function capFaceCount(mass: ReturnType<typeof buildMass>, key: string): number {
  const body = mass.bodies.find((b) => b.branch.key === key)!;
  const index = body.geometry.getIndex()!;
  const profileLen = body.solid.profile.points.length;
  let count = 0;
  for (let t = 0; t < index.count / 3; t++) {
    if (
      index.getX(t * 3) % profileLen === 0 ||
      index.getX(t * 3 + 1) % profileLen === 0 ||
      index.getX(t * 3 + 2) % profileLen === 0
    ) {
      count++;
    }
  }
  return count;
}

describe('external shell — `CAI-REQ-005` base caps', () => {
  it('знімає кришку основи в КОЖНОГО тіла з похованим кільцем', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      for (const body of mass.bodies) {
        if (!body.stats.capBuried) continue;
        checked++;
        expect(capFaceCount(mass, body.branch.key), `${seed}/${body.branch.key}`).toBe(0);
      }
    }
    // Тест мав би сенс і при checked===0, але тоді він нічого не доводить.
    expect(checked).toBeGreaterThan(20);
  });

  it('ЛИШАЄ кришку тілу, під яким нічого немає — інакше повертаються наскрізні діри', () => {
    // Перевіряється на СИНТЕТИЦІ, і навмисно. Попередня версія цього тесту
    // брала реальну масу й питала «чи лежить кільце основи всередині
    // ОДНОГО тіла» — але зріз працює інакше: він знімає ГРАНЬ, якщо та вся
    // в якомусь тілі. Дві різні умови збігалися доти, доки під друзою не
    // з'явилась основа-матриця; після неї тест почав хибно падати
    // (`city-Rome`), хоча оболонка була ціла.
    //
    // Тут умова однозначна: самотнє тіло, під яким немає нічого, мусить
    // зберегти кришку. Саме це й стереже регресію «дір знизу», заради якої
    // тест писався, і воно не залежить від того, що навколо.
    const lone = makeBranch({ key: 'lone', pos: [0, 0, 0], dir: [0, 1, 0], height: 1, radius: 0.2 });
    const p = publishCrystal([lone], STRESS_MATERIAL);
    const body = p.renderable[0]!;
    const index = body.geometry.getIndex()!;
    const profileLen = body.solid.profile.points.length;
    let capFaces = 0;
    for (let t = 0; t < index.count / 3; t++) {
      if (
        index.getX(t * 3) % profileLen === 0 ||
        index.getX(t * 3 + 1) % profileLen === 0 ||
        index.getX(t * 3 + 2) % profileLen === 0
      ) {
        capFaces++;
      }
    }
    expect(capFaces, 'самотнє тіло втратило кришку основи').toBeGreaterThan(0);
    expect(body.trim.capRemoved).toBe(false);
  });
});

describe('external shell — `CAI-REQ-007` hidden faces', () => {
  it('після зрізу жодна грань не лежить цілком усередині чужого тіла', () => {
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      for (const body of mass.bodies) {
        const index = body.geometry.getIndex()!;
        const world = worldVertices(body.geometry, body.solid);
        for (let t = 0; t < index.count / 3; t++) {
          const a = world[index.getX(t * 3)]!;
          const b = world[index.getX(t * 3 + 1)]!;
          const c = world[index.getX(t * 3 + 2)]!;
          for (const other of mass.solids.values()) {
            if (other.key === body.solid.key) continue;
            expect(
              triangleInside(a, b, c, other, breatheMargin(body.solid, other)),
              `${seed}: грань ${t} тіла ${body.branch.key} захована в ${other.key}`,
            ).toBe(false);
          }
        }
      }
    }
  }, 10_000);

  it('зріз реально працює: сира маса порушення МАЄ, зрізана — ні', () => {
    for (const seed of SEEDS) {
      const raw = validateExternalShell(toShellEntries(buildMass(seed, { skipTrim: true })));
      const trimmed = validateExternalShell(toShellEntries(buildMass(seed)));
      expect(raw.length, `${seed}: валідатор нічого не ловить на сирій масі`).toBeGreaterThan(0);
      expect(formatShellViolations(trimmed)).toBe('external shell: 0 порушень');
    }
  });
});

describe('external shell — `CAI-REQ-008` underside probes', () => {
  it('знизу не видно вивороту оболонки (та сама «діра без текстури»)', () => {
    for (const seed of SEEDS) {
      const violations = probeExterior(toShellEntries(buildMass(seed)), UNDERSIDE_DIRECTIONS);
      expect(formatShellViolations(violations), seed).toBe('external shell: 0 порушень');
    }
  });

  it('проба не вакуумна: на масі БЕЗ кришок торців вона порушення знаходить', () => {
    // Вирізаємо кришки в УСІХ тіл — рівно та регресія, від якої страхує
    // умовність `CAI-REQ-005`. Проба знизу мусить це побачити.
    const mass = buildMass(SEEDS[0]);
    for (const body of mass.bodies) {
      const index = body.geometry.getIndex()!;
      const profileLen = body.solid.profile.points.length;
      const kept: number[] = [];
      for (let t = 0; t < index.count / 3; t++) {
        const tri = [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)];
        if (tri.some((v) => v % profileLen === 0 || v % profileLen === profileLen - 1)) continue;
        kept.push(...tri);
      }
      body.geometry.setIndex(kept);
    }
    expect(probeExterior(toShellEntries(mass), UNDERSIDE_DIRECTIONS).length).toBeGreaterThan(0);
  });
});

describe('external shell — детермінізм і масштаб', () => {
  it('`V5-REQ-013`: та сама маса двічі → побайтово ті самі індекси й позиції', () => {
    for (const seed of SEEDS) {
      const a = buildMass(seed);
      const b = buildMass(seed);
      expect(b.bodies.map((x) => x.branch.key)).toEqual(a.bodies.map((x) => x.branch.key));
      for (let i = 0; i < a.bodies.length; i++) {
        const x = a.bodies[i]!;
        const y = b.bodies[i]!;
        expect(Array.from(y.geometry.getIndex()!.array), `${seed}/${x.branch.key} index`).toEqual(
          Array.from(x.geometry.getIndex()!.array),
        );
        expect(Array.from(y.geometry.getAttribute('position').array as Float32Array)).toEqual(
          Array.from(x.geometry.getAttribute('position').array as Float32Array),
        );
        expect(y.stats).toEqual(x.stats);
      }
    }
  });

  it('дрібні тіла (4-6 сегментів) обробляються так само коректно, як великі', () => {
    let small = 0;
    for (const seed of SEEDS) {
      const mass = buildMass(seed);
      for (const body of mass.bodies) {
        if (body.solid.profile.segments > 6) continue;
        small++;
        // Кожна вціліла вершина, що входить у грань, лишається поза
        // господарем або рівно на його межі — жодних «недорізаних» тіл.
        const host = body.branch.hostKey === null ? undefined : mass.solids.get(body.branch.hostKey);
        if (host === undefined) continue;
        const index = body.geometry.getIndex()!;
        if (index.count === 0) continue;
        const world = worldVertices(body.geometry, body.solid);
        const margin = breatheMargin(body.solid, host);
        const allInside = Array.from({ length: index.count }, (_, i) => index.getX(i)).every((v) =>
          isInsideHost(world[v]!, host, margin),
        );
        expect(allInside, `${seed}/${body.branch.key}: вціліле тіло цілком у господарі`).toBe(false);
      }
    }
    expect(small).toBeGreaterThan(10);
  });
});
