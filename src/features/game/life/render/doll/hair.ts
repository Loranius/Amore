// ============================================================
// Зачіски (ADR-0239, поправка 2026-11-01 «модульні люди, зачіски»): два
// шари в координатах голови, з тією самою точкою кріплення (шия):
//   • `back` — за тілом (довге волосся, видне обабіч плечей спереду);
//   • `front` — поверх голови (маківка, чубчик, пасма; ззаду й у профіль
//     довге волосся лягає поверх спини, тож теж тут).
// Нова зачіска — новий запис у `HAIR`: скелет і решта шарів не міняються.
//
// Ключі: a світло, A основний, q тінь, Q глибока тінь (колір — волосся з
// `Look`), c/C заколка. Обвідка — своя, темна за кольором волосся (`O`).
// ============================================================
import type { Part } from './parts';

export type HairName = 'long' | 'short';

/** Частини зачіски для «до нас» (0), «праворуч» (2), «від нас» (3); «ліворуч» — дзеркало. */
export interface Hair {
  readonly front: Readonly<Record<0 | 2 | 3, Part>>;
  readonly back?: Readonly<Partial<Record<0 | 2 | 3, Part>>>;
}

export const HAIR: Readonly<Record<HairName, Hair>> = {
  // Лєна: довге пряме волосся до пояса, чубчик набік, жовта заколка зліва.
  long: {
    front: {
      0: {
        rows: [
          '.....AAAAAAAAAq.....',
          '...AAAaaaaAAAAAAq...',
          '..AAaaaAAAAqAAAAAq..',
          '.AAaccAAAAqAAAqAAAq.',
          '.AAAcCAAAqAAAAqAAAq.',
          '.AAAAAAAqAAAqqqAAAq.',
          '.AAAAAqqAqqq...qAAq.',
          'AAAAqqqqq.......AAAq',
          'AAAq............qAAq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'AqA..............Aqq',
          'qqA..............Aqq',
          '.qA..............Aq.',
          '.qq..............qq.',
          '.q................q.',
        ],
        pivot: { x: 10, y: 18 },
      },
      2: {
        rows: [
          '....AAaaaAAAAAA...',
          '..AAaaaAAAAAAAAAA.',
          '.qAaAAAAAAAAqAAAAA',
          '.qAAAAAAAccqAAAAAA',
          '.qAAAAAAAcCqAAAqAA',
          '.qAAAAAAAAqqqqAqAA',
          '.qAAAAAAAqq...qqqq',
          '.qAAAAAAq.........',
          'qAAqAAAA..........',
          'qAAqAAAA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqA..........',
          'qAAqAAqq..........',
          '.qAqAqq...........',
          '..qqq.............',
        ],
        pivot: { x: 11, y: 18 },
      },
      3: {
        rows: [
          '.....AAAAAAAAAq.....',
          '...AAAaaaAAAAAAAq...',
          '..AAaaAAAAAAAAAAAq..',
          '.AAaAAAAAAAAAAAAAAq.',
          '.AAAAAAAAqAAAAAAAAq.',
          '.AAAAAAAAqAAAAAAAAq.',
          '.AAAAAAAAqAAAAAAAAq.',
          'AAAAAAAAAqAAAAqAAAAq',
          'AAAaaaAAAqAAAAqAAAAq',
          'AAaaAAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'AAAAqAAAAqAAAAqAAAAq',
          'qAAAqAAAAqAAAAqAAAAq',
          '.qAAqqqAAqAAAqqAAAq.',
          '..qqq..qqqqqq..qqq..',
        ],
        pivot: { x: 10, y: 18 },
      },
    },
    back: {
      0: {
        rows: [
          'AAAAAAAAAAAAAAAAAAAAAA',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAAAAAAAAAAAAAAAAAQ',
          'qAAAAqAAAAAAAAAAqAAAAQ',
          '.qqqq.qqqqqqqqqq.qqqq.',
        ],
        pivot: { x: 11, y: 12 },
      },
    },
  },
  // Діма: коротка скуйовджена зачіска, зачесана набік.
  short: {
    front: {
      0: {
        rows: [
          '...AA..AAq......',
          '..AAaaaAAAAAAq..',
          'AAaaaAAAqAAAqAAq',
          'AaaAAAAqAAAqAAAq',
          'AAAAAAqAAAqAAAAq',
          'AAAAAqAAAAqAAAAq',
          'AAAAAqAAAAqAAAAq',
          'AAqAA.qAAq.qqAAq',
          'AA.qQ..qQ....qAq',
          'Aq............qq',
          'q..............q',
        ],
        pivot: { x: 8, y: 19 },
      },
      2: {
        rows: [
          '....AAA..AA.....',
          '..AAAaaAAAAAA...',
          '.AAaaaAAAAAAAAA.',
          'qAaAAAAAAqAAAAAA',
          'qAAAAAAAqAAAqAAA',
          'qAAAAAAqAAAqAAAA',
          'qAAAAAAqAqAqAAqq',
          'qAAAAAAqq.qAAq..',
          'qAAqAAq....qq...',
          'qAAqAA..........',
          'qAAqAA..........',
          'qAAqAA..........',
          'qAAqAA..........',
          'qAAAAA..........',
          '.qAAAq..........',
          '..qqq...........',
        ],
        pivot: { x: 9, y: 19 },
      },
      3: {
        rows: [
          '...AAAAAAAAq....',
          '..AAaaaAAAAAAq..',
          'AAaaAAAAAAAAAAAq',
          'AaAAAAAAAqAAAAAq',
          'AAAAAqAAAqAAAAAq',
          'AAAAqAAAqAAAqAAq',
          'AAAAqAAAqAAAqAAq',
          'AAAAqAAAqAAAqAAq',
          'AAAqAAAAqAAAAqAq',
          'AAAqAAAAqAAAAqAq',
          'AAAqAAAAqAAAAqAq',
          'AAAqAAAAqAAAAqAq',
          'qAAAAAAAqAAAAAAq',
          '.qAAAAAAAAAAAAq.',
          '..qAAqqAAqqAAq..',
          '...qq..qq..qq...',
        ],
        pivot: { x: 8, y: 19 },
      },
    },
  },
};
