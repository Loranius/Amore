// ============================================================
// Модульні люди (ADR-0239, поправка 2026-11-01): частини тіла — піксельні
// сітки, однакові для всіх. Зріст, голова, руки, ноги, вуха й форма очей у
// Лєни, Діми й будь-кого в грі одні й ті самі: відрізняються лише кольори
// (шкіра, очі, брови) й обличчя (`faces.ts`), а згодом — зачіска й одяг.
//
// Пропорції — за референсами власника (2026-11-01, «спробуй щось схоже на
// це»): велика кругла голова (~45% зросту) з очима в нижній половині,
// коротке м'яке тіло, тонкі руки, коротенькі ноги. Пікселі референсів не
// копійовано — лише пропорції й прийоми.
//
// Ключі сітки (матеріал «шкіра», кольори — `dolls.ts`):
//   .  порожньо
//   h  світло   s  основний   S  тінь   D  глибока тінь
// Обвідку не малюють — її додає `rig.ts` довкола кожної частини.
// ============================================================

/** Частина тіла: сітка й точка кріплення (`pivot`) у пікселях сітки. */
export interface Part {
  readonly rows: readonly string[];
  readonly pivot: { readonly x: number; readonly y: number };
}

/** Дзеркальна копія частини: сітка й точка кріплення. */
export function mirrorPart(p: Part): Part {
  const w = p.rows[0]!.length;
  return { rows: p.rows.map((r) => [...r].reverse().join('')), pivot: { x: w - 1 - p.pivot.x, y: p.pivot.y } };
}

// ---------- Обличчям до нас ----------

/** Голова спереду з вухами, точка кріплення — під серединою підборіддя. Зі спини та сама (обличчя — окремі шари). */
export const HEAD_FRONT: Part = {
  rows: [
    '.........ssssssssss.........',
    '......ssssssssssssssss......',
    '.....ssshhhssssssssssss.....',
    '....ssshhsssssssssssssss....',
    '...ssshssssssssssssssssss...',
    '...ssssssssssssssssssssss...',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    '..ssssssssssssssssssssssss..',
    'ssssssssssssssssssssssssssss',
    'sSssssssssssssssssssssssssSs',
    'sSssssssssssssssssssssssssSs',
    'sSssssssssssssssssssssssssSs',
    'ssssssssssssssssssssssssssss',
    '...ssssssssssssssssssssss...',
    '...ssssssssssssssssssssss...',
    '....ssssssssssssssssssss....',
    '......sSssssssssssssSs......',
    '........SsSSSSSSSSsS........',
  ],
  pivot: { x: 14, y: 27 },
};

/** Тулуб спереду з шиєю й тазом, кріплення — верх шиї. */
export const TORSO_FRONT: Part = {
  rows: [
    '...SSSSSS...',
    '...SSSSSS...',
    '...ssssss...',
    '..ssssssss..',
    '.shhsssssss.',
    'shssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'SssssSsssssS',
    'SssssssssssS',
    'SssssssssssS',
    'SssssssssssS',
    'SssssssssssS',
    'SssssssssssS',
    '..ssssssss..',
    '....ssss....',
  ],
  pivot: { x: 6, y: 0 },
};

/** Тулуб зі спини: той самий силует, хребет. */
export const TORSO_BACK: Part = {
  rows: [
    '...SSSSSS...',
    '...SSSSSS...',
    '...ssssss...',
    '..ssssssss..',
    '.shhsssssss.',
    'shssssssssss',
    'sssssSSsssss',
    'sssssSSsssss',
    'sssssSSsssss',
    'sssssSSsssss',
    'sssssSSsssss',
    'SssssSSssssS',
    'SssssSSssssS',
    'SssssSSssssS',
    'SssssSSssssS',
    'SssssssssssS',
    'SssssSSssssS',
    '..ssSSSSss..',
    '....ssss....',
  ],
  pivot: { x: 6, y: 0 },
};

/** Ліва рука (з нашого погляду): плече, передпліччя, долоня; кріплення — плече. */
export const ARM: Part = {
  rows: [
    '..ss',
    '.hss',
    '.hsS',
    '.ssS',
    '.ssS',
    '.ssS',
    '.ssS',
    '.ssS',
    '.ssS',
    '.ssS',
    'ssss',
    'ssss',
    'sssS',
    '.SS.',
  ],
  pivot: { x: 2, y: 1 },
};

/** Ліва нога спереду зі стопою, кріплення — кульшовий суглоб. */
export const LEG_FRONT: Part = {
  rows: [
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.ssssS',
    '.sssss',
    'ssssss',
    'SSSSSS',
  ],
  pivot: { x: 3, y: 1 },
};

// ---------- Профіль (обличчям праворуч; ліворуч — дзеркало) ----------

/** Голова в профіль: обличчя праворуч, вухо посередині. */
export const HEAD_SIDE: Part = {
  rows: [
    '.......ssssssssss........',
    '....sssssssssssssss......',
    '...ssshhhhssssssssss.....',
    '..ssshhssssssssssssss....',
    '.sssssssssssssssssssss...',
    '.sssssssssssssssssssss...',
    'sssssssssssssssssssssss..',
    'sssssssssssssssssssssss..',
    'sssssssssssssssssssssss..',
    'sssssssssssssssssssssss..',
    'ssssssssssssssssssssssss.',
    'ssssssssssssssssssssssss.',
    'ssssssssssssssssssssssss.',
    'ssssssssssssssssssssssss.',
    'ssssssssssssssssssssssss.',
    'ssssssssssssssssssssssss.',
    '.sssssssssssssssssssssss.',
    '.ssssssssDDsssssssssssss.',
    '.sssssssSDssssssssssssss.',
    '.sssssssSDssssssssssssss.',
    '.sssssssSDssssssssssssss.',
    '.ssssssssDDssssssssssssss',
    '..ssssssssssssssssssssssS',
    '..ssssssssssssssssssssss.',
    '...ssssssssssssssssssss..',
    '....ssssssssssssssssss...',
    '......sSSSSSSSSSSSss.....',
  ],
  pivot: { x: 13, y: 27 },
};

/** Тулуб у профіль: груди праворуч. */
export const TORSO_SIDE: Part = {
  rows: [
    '...SSSS...',
    '...SSSS...',
    '...ssss...',
    '..ssssss..',
    '.shhsssss.',
    '.sssssssss',
    '.sssssssss',
    '.sssssssss',
    '.ssssssss.',
    '.ssssssss.',
    '.ssssssssS',
    '.ssssssssS',
    '.ssssssssS',
    'sssssssssS',
    'sssssssssS',
    'sssssssssS',
    'ssssssssS.',
    '.ssssssS..',
    '..ssssS...',
  ],
  pivot: { x: 5, y: 0 },
};

/** Нога в профіль, стопа вперед (праворуч). */
export const LEG_SIDE: Part = {
  rows: [
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'Sssss..',
    'sssss..',
    'sssssss',
    'SSSSSSS',
  ],
  pivot: { x: 2, y: 1 },
};
