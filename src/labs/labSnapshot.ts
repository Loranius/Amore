// Синтетична пара для лабораторій росту: сталий день початку, тож різні
// віки — та сама пара, що підросла, а не різні пари.
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';

const START = '1990-03-14';

/** Синтетична пара: `fill` подій на рік, рівно розкиданих по модулях і місяцях. */
export function labSnapshot(years: number, fill: number): CrystalV2Snapshot {
  const startYear = Number(START.slice(0, 4));
  const asOf = `${startYear + years}-03-20`;
  const at = (year: number, k: number) => {
    const month = String(1 + ((k * 5 + year) % 12)).padStart(2, '0');
    const day = String(2 + ((k * 7) % 26)).padStart(2, '0');
    return `${startYear + year + (Number(month) < 3 ? 1 : 0)}-${month}-${day}`;
  };
  const memories: { id: number; date: string }[] = [];
  const plans: { id: number; date: string }[] = [];
  const wishes: { id: number; date: string; isShared: boolean }[] = [];
  const places: { id: number; date: string }[] = [];
  const media: { id: number; date: string }[] = [];
  let id = 0;
  for (let year = 0; year < years; year += 1) {
    for (let k = 0; k < fill; k += 1) {
      const date = at(year, k);
      if (date > asOf) continue;
      const kind = (year + k) % 5;
      if (kind === 2) wishes.push({ id: id++, date, isShared: true });
      else [memories, plans, memories, places, media][kind]!.push({ id: id++, date });
    }
  }
  return { startDate: START, asOf, partners: { red: 2, blue: 1 }, memories, plans, wishes, places, media };
}
