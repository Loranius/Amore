// ============================================================
// Острівці на тлі входу (ADR-0228) — вигадана пара, щоразу інша.
// ------------------------------------------------------------
// Власник: «на фон додати літаючі острівці з деревами, рифом чи
// кристалом, що процедурно генеруються щоразу, як демонстрація того, що
// очікує користувача всередині».
//
// Острівці ростуть ТИМИ САМИМИ моделями, що й артефакт пари: вигадана
// історія (дата початку, спогади, бажання, віхи) іде в `buildXxxModel`, і
// кристал, дерево чи риф на тлі — справжній вид, а не картинка. Дані пари
// сюди не потрапляють: до входу їх і не видно (брама членства), і
// показувати чужим людям не можна.
//
// Нове зерно — щоразу (`freshSeed` у `entropy.ts`, косметика); сама
// побудова із зерна детермінована, тож її можна перевірити тестом.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';

export type DemoSpecies = 'crystal' | 'tree' | 'reef';

export interface DemoIsland {
  species: DemoSpecies;
  snapshot: CrystalV2Snapshot;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Історія вигаданої пари: від одного до дванадцяти років, помірно насичена. */
export function demoSnapshot(seed: string, asOfYear: number): CrystalV2Snapshot {
  const years = 1 + Math.floor(unit(seed, 'years') * 12);
  const startYear = asOfYear - years;
  const startDate = isoDay(startYear, 1 + Math.floor(unit(seed, 'm') * 12), 1 + Math.floor(unit(seed, 'd') * 28));
  const day = (tag: string) => {
    const y = Math.min(asOfYear, startYear + Math.floor(unit(seed, `${tag}:y`) * (years + 1)));
    // У рік «сьогодні» — не пізніше листопада: `asOf` стоїть на 20 грудня.
    const months = y === asOfYear ? 11 : 12;
    return isoDay(y, 1 + Math.floor(unit(seed, `${tag}:m`) * months), 1 + Math.floor(unit(seed, `${tag}:d`) * 28));
  };
  const many = (tag: string, max: number) => Array.from(
    { length: Math.floor(unit(seed, `${tag}:n`) * max * years) },
    (_, k) => ({ id: k + 1, date: day(`${tag}${k}`) }),
  );
  return {
    startDate,
    asOf: `${asOfYear}-12-20`,
    partners: { red: 2, blue: 1 },
    memories: many('memory', 6),
    plans: many('plan', 3),
    // Бажання з виконавцем фарбують кристал: хто кому здійснив.
    wishes: many('wish', 4).map((w, k) => ({
      ...w,
      isShared: unit(seed, `wish${k}:shared`) < 0.3,
      ownerId: unit(seed, `wish${k}:owner`) < 0.5 ? 1 : 2,
      fulfilledById: unit(seed, `wish${k}:done`) < 0.6 ? (unit(seed, `wish${k}:by`) < 0.5 ? 1 : 2) : null,
    })),
    events: many('event', 2).map((e, k) => ({ ...e, isMilestone: unit(seed, `event${k}:mile`) < 0.3 })),
    places: many('place', 2),
    media: many('media', 3),
  };
}

/** Три острівці: кожен вид по разу, порядок і історії — із зерна. */
export function demoIslands(seed: string, asOfYear: number): DemoIsland[] {
  const order: DemoSpecies[] = ['crystal', 'tree', 'reef'];
  // Детермінований тасувальник Фішера — Єйтса на хеші зерна.
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(unit(seed, `order${i}`) * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.map((species, k) => ({ species, snapshot: demoSnapshot(`${seed}:${k}`, asOfYear) }));
}
