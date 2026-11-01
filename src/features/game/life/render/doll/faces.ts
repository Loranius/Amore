// ============================================================
// Очі й обличчя — накладки на голову, у тих самих координатах, що й її
// сітка (`HEAD_FRONT` 18×15, `HEAD_SIDE` 15×15), з тією самою точкою
// кріплення. Форма очей однакова для всіх (власник 2026-11-01: «форми …
// очей і вух мають бути однаковими»), змінюється лише колір.
//
// Ключі: p повіка, e райдужка, E її тінь, w відблиск (шар «очі»);
//        b брова, l вія, m губи, M лінія рота, r рум'янець (шар «обличчя»).
// ============================================================
import { HEAD_FRONT, HEAD_SIDE, type Part } from './parts';

const EMPTY_HALF = '.........';

/** Ліва половина 9×15 → повна 18×15 (дзеркало). */
function half(rows: Readonly<Record<number, string>>): string[] {
  return Array.from({ length: 15 }, (_, y) => {
    const r = rows[y] ?? EMPTY_HALF;
    return r + [...r].reverse().join('');
  });
}

/** Сітка 15×15 профілю: ряди, яких не названо, — порожні. */
function side(rows: Readonly<Record<number, string>>): string[] {
  return Array.from({ length: 15 }, (_, y) => rows[y] ?? '...............');
}

export const EYES_FRONT: Part = {
  rows: half({ 6: '.....pp..', 7: '.....we..', 8: '.....ee..', 9: '.....EE..' }),
  pivot: HEAD_FRONT.pivot,
};

export const EYES_SIDE: Part = {
  rows: side({ 6: '...........pp..', 7: '...........e...', 8: '...........e...', 9: '...........E...' }),
  pivot: HEAD_SIDE.pivot,
};

/** Обличчя: брови, вії, рот, рум'янець. */
export type FaceKind = 'girl' | 'boy';

export const FACE_FRONT: Readonly<Record<FaceKind, Part>> = {
  girl: { rows: half({ 4: '.....bb..', 6: '....l....', 10: '...rr....', 12: '........m' }), pivot: HEAD_FRONT.pivot },
  boy: { rows: half({ 4: '....bbb..', 5: '....b....', 12: '........M' }), pivot: HEAD_FRONT.pivot },
};

export const FACE_SIDE: Readonly<Record<FaceKind, Part>> = {
  girl: { rows: side({ 4: '..........bb...', 6: '.............l.', 10: '.........rr....', 12: '...........m...' }), pivot: HEAD_SIDE.pivot },
  boy: { rows: side({ 4: '..........bbb..', 12: '...........M...' }), pivot: HEAD_SIDE.pivot },
};
