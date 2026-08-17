// ============================================================
// Правила змісту сузір'я — окремо від будь-якої геометрії.
// ------------------------------------------------------------
// Тут живе те, що не залежить від подачі: хто в сузір'ї ядро, якої ваги подія
// і в якому порядку події стоять у ланцюгу. Розкладка (двовимірна вона чи
// тривимірна) читає ці відповіді й лише розставляє точки.
//
// Розділено після переїзду модуля в 3D: коли правила лежали в одному файлі з
// розміщенням, заміна подачі означала або переписати правила заново, або
// тягти за собою мертву геометрію. Ані те, ані те не годиться — правило «ядро
// це одруження, а поки його немає, початок відносин» описує стосунки пари, а
// не піксель на екрані.
// ============================================================
import type { EventSignificance } from '@/types';

/** Вага зірки в кадрі: три рівні, три розміри, три орбіти. */
export type ConstellationLevel = 'key' | 'important' | 'regular';

export interface ConstellationEvent {
  id: number;
  /** ISO `YYYY-MM-DD`. Порівнюється як рядок — без локалі. */
  date: string;
  significance: EventSignificance;
}

export function levelOf(event: { significance: EventSignificance }): ConstellationLevel {
  if (event.significance === 'marriage' || event.significance === 'relationship_start') return 'key';
  return event.significance === 'important' ? 'important' : 'regular';
}

/**
 * Ядро — роль, а не подія: одруження забирає центр у початку відносин.
 *
 * Стосунки ростуть, і головна дата пари з часом змінюється. Поки одруження
 * немає, центр належить початку відносин; щойно воно з'являється, центр
 * переходить до нього, а початок відносин лишається ключовим і йде в бік.
 * Рівень, який поставила пара, при цьому не чіпається.
 */
export function coreIdOf(events: readonly ConstellationEvent[]): number | null {
  const marriage = events.find((event) => event.significance === 'marriage');
  if (marriage) return marriage.id;
  return events.find((event) => event.significance === 'relationship_start')?.id ?? null;
}

/** Хронологія: ISO-дата, далі `id` — щоб порядок був повним і стабільним. */
export function byChronology(
  a: ConstellationEvent,
  b: ConstellationEvent,
): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id - b.id;
}

/**
 * Кількість діб між двома ISO-датами.
 *
 * Рахується з UTC-полудня, а не з півночі: дати в базі без часу, і будь-який
 * зсув поясу на півночі перекидає добу туди-сюди. Полудень лишає запас у
 * дванадцять годин на обидва боки — цього досить для всіх поясів Землі.
 */
export function daysBetween(from: string, to: string): number {
  const parse = (iso: string): number => {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}
