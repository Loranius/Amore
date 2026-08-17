import { describe, expect, it } from 'vitest';
import {
  cameraLocked,
  INITIAL_JOURNEY_STATE,
  journeyReducer,
  showsFocus,
  splitLayout,
  type JourneyEvent,
  type JourneyMode,
  type JourneyState,
} from './journeyMode';

/** Проганяє послідовність подій від початкового стану. */
function run(...events: JourneyEvent[]): JourneyState {
  return events.reduce(journeyReducer, INITIAL_JOURNEY_STATE);
}

const READY: JourneyEvent[] = [{ type: 'skyReady' }, { type: 'introDone' }];

const ALL_MODES: JourneyMode[] = [
  'loading', 'intro', 'constellation', 'focusing', 'eventFocus', 'returning', 'addingEvent',
];

describe('щасливий шлях', () => {
  it('починається із завантаження', () => {
    expect(INITIAL_JOURNEY_STATE.mode).toBe('loading');
    expect(INITIAL_JOURNEY_STATE.focusId).toBeNull();
  });

  it('небо → інтро → спокій', () => {
    expect(run({ type: 'skyReady' }).mode).toBe('intro');
    expect(run(...READY).mode).toBe('constellation');
  });

  it('зірка → політ → подія → повернення → спокій', () => {
    const focusing = run(...READY, { type: 'selectStar', id: 7 });
    expect(focusing.mode).toBe('focusing');
    expect(focusing.focusId).toBe(7);

    const focused = journeyReducer(focusing, { type: 'focusArrived' });
    expect(focused.mode).toBe('eventFocus');
    expect(focused.focusId).toBe(7);

    const returning = journeyReducer(focused, { type: 'dismiss' });
    expect(returning.mode).toBe('returning');
    expect(returning.focusId).toBeNull();

    expect(journeyReducer(returning, { type: 'returnArrived' }).mode).toBe('constellation');
  });
});

describe('пара робить не за сценарієм', () => {
  it('дотик під час інтро обриває політ і веде до події', () => {
    const state = run({ type: 'skyReady' }, { type: 'selectStar', id: 3 });
    expect(state.mode).toBe('focusing');
    expect(state.focusId).toBe(3);
  });

  it('друга зірка на півдорозі до першої перецілює політ', () => {
    const state = run(
      ...READY,
      { type: 'selectStar', id: 3 },
      { type: 'selectStar', id: 9 },
    );
    expect(state.mode).toBe('focusing');
    expect(state.focusId).toBe(9);
  });

  it('закрити можна й на півдорозі', () => {
    const state = run(...READY, { type: 'selectStar', id: 3 }, { type: 'dismiss' });
    expect(state.mode).toBe('returning');
  });

  it('нова зірка під час повернення розвертає камеру знову', () => {
    const state = run(
      ...READY,
      { type: 'selectStar', id: 3 },
      { type: 'dismiss' },
      { type: 'selectStar', id: 5 },
    );
    expect(state.mode).toBe('focusing');
    expect(state.focusId).toBe(5);
  });

  it('повторний дотик по вже відкритій зірці нічого не перезапускає', () => {
    const focused = run(...READY, { type: 'selectStar', id: 4 }, { type: 'focusArrived' });
    expect(journeyReducer(focused, { type: 'selectStar', id: 4 })).toBe(focused);
  });

  it('сусідня зірка з відкритої події — це новий політ', () => {
    const focused = run(...READY, { type: 'selectStar', id: 4 }, { type: 'focusArrived' });
    const next = journeyReducer(focused, { type: 'selectStar', id: 6 });
    expect(next.mode).toBe('focusing');
    expect(next.focusId).toBe(6);
  });

  it('поки небо не доїхало, дотик не робить нічого', () => {
    expect(run({ type: 'selectStar', id: 1 })).toBe(INITIAL_JOURNEY_STATE);
  });
});

describe('точка повернення', () => {
  it('запам’ятовується при виході зі спокою', () => {
    expect(run(...READY, { type: 'selectStar', id: 2 }).saveView).toBe(true);
  });

  it('запам’ятовується й коли пара обірвала інтро', () => {
    expect(run({ type: 'skyReady' }, { type: 'selectStar', id: 2 }).saveView).toBe(true);
  });

  it('НЕ перезаписується при стрибку з події на подію', () => {
    /*
     * Інакше друга подія затерла б точку повернення першою, і «назад» вивело б
     * пару не туди, звідки вона прийшла, а до попередньої зірки.
     */
    const jumped = run(
      ...READY,
      { type: 'selectStar', id: 2 },
      { type: 'focusArrived' },
      { type: 'selectStar', id: 8 },
    );
    expect(jumped.saveView).toBe(false);
  });

  it('не перезаписується й на півдорозі', () => {
    const retargeted = run(
      ...READY,
      { type: 'selectStar', id: 2 },
      { type: 'selectStar', id: 8 },
    );
    expect(retargeted.saveView).toBe(false);
  });

  it('скидається, щойно камера прилетіла', () => {
    const focused = run(...READY, { type: 'selectStar', id: 2 }, { type: 'focusArrived' });
    expect(focused.saveView).toBe(false);
  });
});

describe('додавання події', () => {
  it('відкривається лише зі спокою', () => {
    expect(run(...READY, { type: 'requestAdd' }).mode).toBe('addingEvent');
  });

  it('не відкривається під час польоту', () => {
    const focusing = run(...READY, { type: 'selectStar', id: 1 });
    expect(journeyReducer(focusing, { type: 'requestAdd' }).mode).toBe('focusing');
  });

  it('не відкривається з відкритої події', () => {
    const focused = run(...READY, { type: 'selectStar', id: 1 }, { type: 'focusArrived' });
    expect(journeyReducer(focused, { type: 'requestAdd' }).mode).toBe('eventFocus');
  });

  it('дотик по небу з відкритої модалки нічого не обирає', () => {
    const adding = run(...READY, { type: 'requestAdd' });
    expect(journeyReducer(adding, { type: 'selectStar', id: 5 })).toBe(adding);
  });

  it('закриття повертає у спокій', () => {
    expect(run(...READY, { type: 'requestAdd' }, { type: 'addClosed' }).mode).toBe('constellation');
  });
});

describe('керування камерою', () => {
  it('заблоковане лише там, де камера веде себе сама', () => {
    expect(cameraLocked('focusing')).toBe(true);
    expect(cameraLocked('returning')).toBe(true);
  });

  it('інтро лишається перервним — це рішення, а не недогляд', () => {
    // Політ здалеку триває секунди зо три; рука, яка за цей час торкнулась
    // екрана, просить показати зірку зараз, а не чекати.
    expect(cameraLocked('intro')).toBe(false);
  });

  it('у спокої та в події пара крутить небо вільно', () => {
    expect(cameraLocked('constellation')).toBe(false);
    expect(cameraLocked('eventFocus')).toBe(false);
  });
});

describe('що показує кожен режим', () => {
  it('сонце живе весь час, поки подія в кадрі', () => {
    expect(showsFocus('focusing')).toBe(true);
    expect(showsFocus('eventFocus')).toBe(true);
    // На поверненні воно ще гасне — зникнути миттю означало б стрибок.
    expect(showsFocus('returning')).toBe(true);
    expect(showsFocus('constellation')).toBe(false);
  });

  it('розкладка ділиться, лише поки подія справді відкривається', () => {
    expect(splitLayout('focusing')).toBe(true);
    expect(splitLayout('eventFocus')).toBe(true);
    // На поверненні кадр уже віддано сузір'ю.
    expect(splitLayout('returning')).toBe(false);
  });
});

describe('машина не ламається', () => {
  it('невчасна подія лишає стан тим самим ОБ’ЄКТОМ, а не копією', () => {
    // Копія на кожен ігнорований дотик змушувала б React перемальовувати
    // сцену дарма — а дотиків повз зірку буде більше, ніж влучних.
    for (const event of [
      { type: 'introDone' }, { type: 'focusArrived' }, { type: 'dismiss' },
      { type: 'returnArrived' }, { type: 'addClosed' }, { type: 'requestAdd' },
    ] as JourneyEvent[]) {
      expect(journeyReducer(INITIAL_JOURNEY_STATE, event)).toBe(INITIAL_JOURNEY_STATE);
    }
  });

  it('жодна пара «режим + подія» не дає невідомого режиму', () => {
    const events: JourneyEvent[] = [
      { type: 'skyReady' }, { type: 'introDone' }, { type: 'selectStar', id: 1 },
      { type: 'focusArrived' }, { type: 'dismiss' }, { type: 'returnArrived' },
      { type: 'requestAdd' }, { type: 'addClosed' },
    ];
    for (const mode of ALL_MODES) {
      for (const event of events) {
        const next = journeyReducer({ mode, focusId: 1, saveView: false }, event);
        expect(ALL_MODES).toContain(next.mode);
      }
    }
  });

  it('де немає події, там немає й focusId', () => {
    const events: JourneyEvent[] = [
      { type: 'skyReady' }, { type: 'introDone' }, { type: 'selectStar', id: 1 },
      { type: 'focusArrived' }, { type: 'dismiss' }, { type: 'returnArrived' },
      { type: 'requestAdd' }, { type: 'addClosed' },
    ];
    for (const mode of ALL_MODES) {
      for (const event of events) {
        const next = journeyReducer({ mode, focusId: 1, saveView: false }, event);
        if (!showsFocus(next.mode)) continue;
        if (next.mode === 'returning') continue; // повернення вже без цілі
        expect(next.focusId).not.toBeNull();
      }
    }
  });
});
