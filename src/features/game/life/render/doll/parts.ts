// ============================================================
// Модульні люди (ADR-0239, поправка 2026-11-01): частини тіла — піксельні
// сітки, однакові для всіх. Зріст, голова, руки, ноги, вуха й очі в Лєни,
// Діми й будь-кого в грі одні й ті самі: відрізняються лише кольори
// (шкіра, очі, брови) й обличчя (`face`), а згодом — зачіска й одяг.
//
// Ключі сітки (матеріал «шкіра», кольори — `palette.ts`):
//   .  порожньо
//   h  світло   s  основний   S  тінь   D  глибока тінь
// Обвідку не малюють — її додає `compose.ts` довкола кожної частини.
//
// Сітку з `half` пишуть лише ліву половину: права — її дзеркало (так
// фронтальний ракурс симетричний за побудовою).
// ============================================================

/** Частина тіла: сітка й точка кріплення (`pivot`) у пікселях сітки. */
export interface Part {
  readonly rows: readonly string[];
  readonly pivot: { readonly x: number; readonly y: number };
}

/** Ліва половина → повна сітка (права половина — дзеркало). */
function half(rows: readonly string[]): string[] {
  return rows.map((r) => r + [...r].reverse().join(''));
}

/** Дзеркальна копія частини: сітка й точка кріплення. */
export function mirrorPart(p: Part): Part {
  const w = p.rows[0]!.length;
  return { rows: p.rows.map((r) => [...r].reverse().join('')), pivot: { x: w - 1 - p.pivot.x, y: p.pivot.y } };
}

// ---------- Обличчям до нас ----------

/** Голова спереду: 16×12 з вухами (чверть зросту), точка кріплення — під серединою підборіддя. */
export const HEAD_FRONT: Part = {
  rows: half([
    '....ssss',
    '..ssssss',
    '.sssssss',
    '.ssssshh',
    '.sssssss',
    'Ssssssss',
    'SSssssss',
    'SSssssss',
    '.Sssssss',
    '.SSsssss',
    '..SSssss',
    '....SSss',
  ]),
  pivot: { x: 8, y: 12 },
};

/** Носик спереду — дві тіньові крапки (частина голови, а не обличчя: він у всіх однаковий). */
export const NOSE_FRONT: Part = { rows: ['SS'], pivot: { x: 1, y: 0 } };

/** Тулуб спереду з шиєю: 18×20, точка кріплення — верх шиї. */
export const TORSO_FRONT: Part = {
  rows: half([
    '......SSS',
    '......sss',
    '......sss',
    '....sssss',
    '.ssssssss',
    'hssssssss',
    'hssssssss',
    'sssssssss',
    '.Ssssssss',
    '.Ssssssss',
    '..Sssssss',
    '..Sssssss',
    '..Sssssss',
    '..Sssssss',
    '.SSssssss',
    '.SSssssss',
    '.SSssssss',
    '.SSssssss',
    '..SSsssss',
    '...SSSSSS',
  ]),
  pivot: { x: 9, y: 0 },
};

/** Тулуб зі спини: той самий силует, хребет і лопатки. */
export const TORSO_BACK: Part = {
  rows: half([
    '......SSS',
    '......sss',
    '......sss',
    '....sssss',
    '.ssssssss',
    'hssssssss',
    'hsssssssS',
    'ssssssssS',
    '.SssssssS',
    '.SssssssS',
    '..SsssssS',
    '..SsssssS',
    '..SsssssS',
    '..SsssssS',
    '.SSsssssS',
    '.SSsssssS',
    '.SSsssssS',
    '.SSsssssS',
    '..SSsssss',
    '...SSSSSS',
  ]),
  pivot: { x: 9, y: 0 },
};

/** Ліва рука (з нашого погляду) спереду: 3×19, кріплення — плече. */
export const ARM: Part = {
  rows: [
    '.hs',
    'hss',
    'hsS',
    'hsS',
    'ssS',
    'ssS',
    'ssS',
    'ssS',
    'ssS',
    'ssS',
    'ssS',
    'ssS',
    'ssS',
    'ssS',
    'sss',
    'hss',
    'sss',
    'sss',
    '.s.',
  ],
  pivot: { x: 1, y: 1 },
};

/** Ліва нога спереду: 7×20 зі стопою, кріплення — кульшовий суглоб. */
export const LEG_FRONT: Part = {
  rows: [
    '.ssssss',
    '.ssssss',
    '.sssssS',
    '.sssssS',
    '.sssssS',
    '.sssssS',
    '.sssssS',
    '.sssssS',
    '..ssssS',
    '..ssssS',
    '..sssS.',
    '..sssS.',
    '..sssS.',
    '..sssS.',
    '..sssS.',
    '..sssS.',
    '..sssS.',
    '.ssssS.',
    'ssssss.',
    'SSSSSS.',
  ],
  pivot: { x: 3, y: 0 },
};

// ---------- Профіль (обличчям праворуч; ліворуч — дзеркало) ----------

/** Голова в профіль: 14×12, обличчя праворуч, вухо трохи позаду середини. */
export const HEAD_SIDE: Part = {
  rows: [
    '...ssssss.....',
    '.ssssssssss...',
    '.sssssssshhs..',
    'sssssssssshhs.',
    'sssssssssssss.',
    'ssssSDsssssss.',
    'sssssDsssssss.',
    'ssssSDssssssss',
    '.ssssssssssssS',
    '.Sssssssssss..',
    '..SSsssssss...',
    '....SSSSss....',
  ],
  pivot: { x: 6, y: 12 },
};

/** Тулуб у профіль: 12×20, груди праворуч. */
export const TORSO_SIDE: Part = {
  rows: [
    '....SSSS....',
    '....ssss....',
    '....ssss....',
    '...ssssss...',
    '..ssssssss..',
    '.ssssssssss.',
    '.sssssssssss',
    '.sssssssssss',
    '.ssssssssssS',
    '.sssssssssS.',
    '..ssssssssS.',
    '..ssssssssS.',
    '..ssssssssS.',
    '..sssssssss.',
    '.ssssssssss.',
    '.sssssssssS.',
    '.sssssssssS.',
    '.sssssssssS.',
    '.SsssssssSS.',
    '..SSSSSSSS..',
  ],
  pivot: { x: 6, y: 0 },
};

/** Нога в профіль: 7×20, стопа вперед (праворуч). */
export const LEG_SIDE: Part = {
  rows: [
    'ssssss.',
    'ssssss.',
    'ssssss.',
    'ssssss.',
    'ssssss.',
    'ssssss.',
    'ssssss.',
    'ssssss.',
    '.sssss.',
    '.sssss.',
    '.ssss..',
    '.ssss..',
    '.ssss..',
    '.ssss..',
    '.ssss..',
    '.ssss..',
    '.ssss..',
    '.ssssss',
    '.ssssss',
    '.SSSSSS',
  ],
  pivot: { x: 2, y: 0 },
};
