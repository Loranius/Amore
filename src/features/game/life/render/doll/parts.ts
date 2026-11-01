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

/** Голова спереду: 18×15 з вухами, точка кріплення — під серединою підборіддя. */
export const HEAD_FRONT: Part = {
  rows: half([
    '.....ssss',
    '...ssssss',
    '..sssssss',
    '.sssssshh',
    '.ssssssss',
    '.ssssssss',
    'Sssssssss',
    'SSsssssss',
    'SSsssssss',
    'Sssssssss',
    '.ssssssss',
    '.Ssssssss',
    '..Sssssss',
    '...SSssss',
    '.....SSss',
  ]),
  pivot: { x: 9, y: 15 },
};

/** Носик спереду — дві тіньові крапки (частина голови, а не обличчя: він у всіх однаковий). */
export const NOSE_FRONT: Part = { rows: ['SS'], pivot: { x: 1, y: 0 } };

/** Тулуб спереду з шиєю: 16×18, точка кріплення — верх шиї. */
export const TORSO_FRONT: Part = {
  rows: half([
    '.....SSS',
    '.....sss',
    '.....sss',
    '...sssss',
    '.hssssss',
    '.hssssss',
    '.sssssss',
    '.Sssssss',
    '.Sssssss',
    '..Ssssss',
    '..Ssssss',
    '..Ssssss',
    '.SSsssss',
    '.SSsssss',
    '.SSsssss',
    '.SSsssss',
    '..SSssss',
    '...SSSSS',
  ]),
  pivot: { x: 8, y: 0 },
};

/** Тулуб зі спини: той самий силует, хребет і лопатки. */
export const TORSO_BACK: Part = {
  rows: half([
    '.....SSS',
    '.....sss',
    '.....sss',
    '...sssss',
    '.hssssss',
    '.hssssss',
    '.ssssssS',
    '.SsssssS',
    '.SsssssS',
    '..SssssS',
    '..SssssS',
    '..SssssS',
    '.SSssssS',
    '.SSssssS',
    '.SSssssS',
    '.SSssssS',
    '..SSsssS',
    '...SSSSS',
  ]),
  pivot: { x: 8, y: 0 },
};

/** Ліва рука (з нашого погляду) спереду: 3×17, кріплення — плече. */
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
    'sss',
    'hss',
    'sss',
    '.s.',
  ],
  pivot: { x: 1, y: 1 },
};

/** Ліва нога спереду: 5×21 зі стопою, кріплення — кульшовий суглоб. */
export const LEG_FRONT: Part = {
  rows: [
    '.ssss',
    '.ssss',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '..ssS',
    '..ssS',
    '..ssS',
    '..ssS',
    '..ssS',
    '..ssS',
    '..ssS',
    '..ssS',
    '.ssss',
    'sssss',
    'SSSSS',
  ],
  pivot: { x: 2, y: 0 },
};

// ---------- Профіль (обличчям праворуч; ліворуч — дзеркало) ----------

/** Голова в профіль: 15×15, обличчя праворуч, вухо трохи позаду середини. */
export const HEAD_SIDE: Part = {
  rows: [
    '....ssssss.....',
    '..ssssssssss...',
    '.sssssssshhss..',
    '.ssssssssshhss.',
    'ssssssssssssss.',
    'ssssssssssssss.',
    'sssssSDsssssss.',
    'ssssssDsssssss.',
    'ssssssDsssssss.',
    'sssssSDssssssss',
    '.sssssssssssssS',
    '.sssssssssssss.',
    '..Sssssssssss..',
    '...SSsssssss...',
    '.....SSSSss....',
  ],
  pivot: { x: 7, y: 15 },
};

/** Тулуб у профіль: 10×18, груди праворуч. */
export const TORSO_SIDE: Part = {
  rows: [
    '...SSSS...',
    '...ssss...',
    '...ssss...',
    '..ssssss..',
    '.sssssss..',
    'sssssssss.',
    'ssssssssss',
    'ssssssssss',
    'sssssssssS',
    '.sssssssS.',
    '.sssssssS.',
    '.ssssssss.',
    'sssssssss.',
    'ssssssssS.',
    'ssssssssS.',
    'ssssssssS.',
    'SsssssssS.',
    '.SSSSSSS..',
  ],
  pivot: { x: 5, y: 0 },
};

/** Нога в профіль: 6×21, стопа вперед (праворуч). */
export const LEG_SIDE: Part = {
  rows: [
    'ssss..',
    'ssss..',
    'ssss..',
    'ssss..',
    'ssss..',
    'ssss..',
    'ssss..',
    'ssss..',
    'ssss..',
    'ssss..',
    '.sss..',
    '.sss..',
    '.sss..',
    '.sss..',
    '.sss..',
    '.sss..',
    '.sss..',
    '.sss..',
    '.ssss.',
    '.sssss',
    '.SSSSS',
  ],
  pivot: { x: 1, y: 0 },
};
