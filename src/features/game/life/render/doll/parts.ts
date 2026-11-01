// ============================================================
// Модульні люди (ADR-0239, поправка 2026-11-01): частини тіла — піксельні
// сітки, однакові для всіх. Зріст, голова, руки, ноги, вуха й форма очей у
// Лєни, Діми й будь-кого в грі одні й ті самі: відрізняються лише кольори
// (шкіра, очі, брови) й обличчя (`faces.ts`), а згодом — зачіска й одяг.
//
// Розміри — за спрайтом власника (2026-11-01, «піджени скелет під розміри
// цього спрайту»): зріст 44 пікселі малюнка, голова 16 з обвідкою (з
// волоссям — 18), шия 1, тулуб 12, ноги 14 зі стопами; руки 2, долоні 3,
// ноги по 4. Пікселі спрайта не копійовано — лише розміри.
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
    '....ssssssss....',
    '..shhsssssssss..',
    '.shssssssssssss.',
    '.ssssssssssssss.',
    '.ssssssssssssss.',
    '.ssssssssssssss.',
    '.ssssssssssssss.',
    '.ssssssssssssss.',
    'ssssssssssssssss',
    'SssssssssssssssS',
    'ssssssssssssssss',
    '.ssssssssssssss.',
    '.ssssssssssssss.',
    '..ssssssssssss..',
    '...ssssssssss...',
    '....sSSSSSSs....',
  ],
  pivot: { x: 8, y: 16 },
};

/** Тулуб спереду з шиєю й тазом, кріплення — верх шиї. */
export const TORSO_FRONT: Part = {
  rows: [
    '...SSSSSS...',
    '...ssssss...',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
    'ssssssssssss',
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
    '...ssssss...',
    'ssssssssssss',
    'shhsssssssss',
    'sssssSSsssss',
    'sssssSSsssss',
    'sssssSSsssss',
    'sssssSSsssss',
    'SssssSSssssS',
    'SssssSSssssS',
    'SssssSSssssS',
    'SssssSSssssS',
    'SssssssssssS',
    '..ssSSSSss..',
    '....ssss....',
  ],
  pivot: { x: 6, y: 0 },
};

/** Ліва рука (з нашого погляду): плече, передпліччя, долоня; кріплення — плече. */
export const ARM: Part = {
  rows: [
    '..s',
    '.hS',
    '.hS',
    '.sS',
    '.sS',
    '.sS',
    '.sS',
    '.sS',
    '.sS',
    'sss',
    'sss',
    '.SS',
  ],
  pivot: { x: 2, y: 1 },
};

/** Ліва нога спереду зі стопою, кріплення — кульшовий суглоб. */
export const LEG_FRONT: Part = {
  rows: [
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.sssS',
    '.ssss',
    'sssss',
    'SSSSS',
  ],
  pivot: { x: 2, y: 1 },
};

// ---------- Профіль (обличчям праворуч; ліворуч — дзеркало) ----------

/** Голова в профіль: обличчя праворуч, вухо посередині. */
export const HEAD_SIDE: Part = {
  rows: [
    '...ssssssss.....',
    '.shhhssssssss...',
    'shssssssssssss..',
    'ssssssssssssss..',
    'ssssssssssssss..',
    'sssssssssssssss.',
    'sssssssssssssss.',
    'sssssssssssssss.',
    'sssssDDssssssss.',
    'ssssssDssssssss.',
    'sssssDDsssssssss',
    'sssssssssssssss.',
    'sssssssssssssss.',
    '.ssssssssssssss.',
    '.sssssssssssss..',
    '..sSSSSSSSSSs...',
  ],
  pivot: { x: 8, y: 16 },
};

/** Тулуб у профіль: груди праворуч. */
export const TORSO_SIDE: Part = {
  rows: [
    '...SSSS...',
    '...ssss...',
    '..ssssss..',
    '.ssssssss.',
    '.ssssssss.',
    '.ssssssss.',
    '.ssssssss.',
    '.sssssssS.',
    '.sssssssS.',
    '.sssssssS.',
    'ssssssssS.',
    'ssssssssS.',
    'ssssssssS.',
    '.ssssssS..',
    '..ssssS...',
  ],
  pivot: { x: 5, y: 0 },
};

/** Нога в профіль, стопа вперед (праворуч). */
export const LEG_SIDE: Part = {
  rows: [
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'Ssss..',
    'ssss..',
    'ssssss',
    'SSSSSS',
  ],
  pivot: { x: 2, y: 1 },
};
