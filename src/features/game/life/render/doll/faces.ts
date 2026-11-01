// ============================================================
// Очі й обличчя — накладки на голову, у тих самих координатах, що й її
// сітка (`HEAD_FRONT` 16×12, `HEAD_SIDE` 14×12), з тією самою точкою
// кріплення. Форма очей однакова для всіх (власник 2026-11-01: «форми …
// очей і вух мають бути однаковими»), змінюється лише колір.
//
// Ключі: p повіка, e райдужка, E її тінь, w відблиск (шар «очі»);
//        b брова, l вія, m губи, M лінія рота, r рум'янець (шар «обличчя»).
// ============================================================
import { HEAD_FRONT, HEAD_SIDE, type Part } from './parts';

const EMPTY_HALF = '........';

/** Ліва половина 8×12 → повна 16×12 (дзеркало). */
function half(rows: Readonly<Record<number, string>>): string[] {
  return Array.from({ length: 12 }, (_, y) => {
    const r = rows[y] ?? EMPTY_HALF;
    return r + [...r].reverse().join('');
  });
}

/** Сітка 14×12 профілю: ряди, яких не названо, — порожні. */
function side(rows: Readonly<Record<number, string>>): string[] {
  return Array.from({ length: 12 }, (_, y) => rows[y] ?? '..............');
}

export const EYES_FRONT: Part = {
  rows: half({ 4: '....pp..', 5: '....we..', 6: '....EE..' }),
  pivot: HEAD_FRONT.pivot,
};

export const EYES_SIDE: Part = {
  rows: side({ 4: '..........pp..', 5: '..........e...', 6: '..........E...' }),
  pivot: HEAD_SIDE.pivot,
};

/** Обличчя: брови, вії, рот, рум'янець. */
export type FaceKind = 'girl' | 'boy';

export const FACE_FRONT: Readonly<Record<FaceKind, Part>> = {
  girl: { rows: half({ 3: '....bb..', 4: '...l....', 7: '..rr....', 9: '.......m' }), pivot: HEAD_FRONT.pivot },
  boy: { rows: half({ 3: '...bbb..', 9: '.......M' }), pivot: HEAD_FRONT.pivot },
};

export const FACE_SIDE: Readonly<Record<FaceKind, Part>> = {
  girl: { rows: side({ 3: '.........bb...', 4: '............l.', 7: '........rr....', 9: '..........m...' }), pivot: HEAD_SIDE.pivot },
  boy: { rows: side({ 3: '.........bbb..', 9: '..........M...' }), pivot: HEAD_SIDE.pivot },
};
