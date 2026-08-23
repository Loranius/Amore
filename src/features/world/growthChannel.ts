// ============================================================
// Канал «світ каже переднику, що виросло».
// ------------------------------------------------------------
// `artifactWorldContext.ts` описував, коли такий канал має з'явитися:
// «коли якийсь модуль справді попросить світ щось намалювати, канал
// з'явиться під ту вимогу». Вимога прийшла з протилежного боку — не
// модуль просить світ, а світ має що сказати, — і причина в §48:
// `.artifact-world` має `aria-hidden="true"`, тож текст усередині сцени
// для читача не існує. Отже приріст мусить дійти до `.home`, а це
// СУСІД сцени, не її нащадок.
//
// Каналів два, і це не педантизм. Сцена підписана лише на ПЕРЕДАВАЧ,
// який стабільний, а шапка — на ЗНАЧЕННЯ. Якби обидва жили в
// `ArtifactWorldValue`, поява підпису перемальовувала б усе полотно
// разом із його вмістом — одне зайве перемальовування важкої сцени
// заради одного рядка тексту.
// ============================================================
import { createContext, useContext } from 'react';
import type { GrowthSummary } from '../home/growthSinceLastVisit';

export type GrowthReporter = (summary: GrowthSummary | null) => void;

/** Що виросло з минулого візиту. `null` — конвеєр ще не сказав. */
export const WorldGrowthContext = createContext<GrowthSummary | null>(null);

export const WorldGrowthReportContext = createContext<GrowthReporter | null>(null);

/**
 * Приріст для переднього плану.
 *
 * `null` — цілком робочий стан, а не помилка: сцена могла ще не
 * зібратись, приросту могло не бути, або артефакт може бути тим, чий
 * конвеєр іще не звітує (дерево, риф). Шапка в усіх трьох випадках
 * просто мовчить.
 */
export function useWorldGrowth(): GrowthSummary | null {
  return useContext(WorldGrowthContext);
}

/**
 * Передавач для сцени.
 *
 * Кидає, а не мовчить: сцена, яка звітує в порожнечу, виглядала б
 * робочою й тихо позбавляла б пару єдиної відповіді на питання «чи
 * змінилось наше життя?».
 */
export function useWorldGrowthReporter(): GrowthReporter {
  const report = useContext(WorldGrowthReportContext);
  if (report === null) {
    throw new Error('useWorldGrowthReporter must be used inside <ArtifactWorldProvider>.');
  }
  return report;
}
