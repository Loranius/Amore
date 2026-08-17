// ============================================================
// Машина станів сцени «Наш шлях».
// ------------------------------------------------------------
// Сцена вміє сім станів, і між ними ходять не прапорці, а перехід. Це не
// формальність: без машини «камера летить» і «відкрита подія» жили б двома
// незалежними булевими, а їхні чотири комбінації включали б дві неможливі —
// і саме вони згодом виявились би на екрані.
//
// Чиста таблиця без React і без three, тож усі переходи видно тестом. Найдорожче
// тут не щасливий шлях, а те, що пара робить не за сценарієм: тапає другу зірку
// на півдорозі до першої, закриває деталі, поки камера ще летить, тягне небо
// пальцем під час інтро. Кожен такий випадок — рядок нижче.
// ============================================================

export type JourneyMode =
  /** Небо ще їде. */
  | 'loading'
  /** Камера летить здалеку, зірки народжуються за хронологією. */
  | 'intro'
  /** Пара крутить сузір'я. Це стан спокою. */
  | 'constellation'
  /** Камера летить до обраної події. */
  | 'focusing'
  /** Подія розкрита: сонце й деталі. */
  | 'eventFocus'
  /** Камера повертається в ракурс, який пара лишила. */
  | 'returning'
  /** Відкрита модалка додавання. */
  | 'addingEvent';

export type JourneyEvent =
  | { type: 'skyReady' }
  | { type: 'introDone' }
  /** Пара обрала зірку. `id` потрібен, щоб знати, куди летіти. */
  | { type: 'selectStar'; id: number }
  | { type: 'focusArrived' }
  | { type: 'dismiss' }
  | { type: 'returnArrived' }
  | { type: 'requestAdd' }
  | { type: 'addClosed' };

export interface JourneyState {
  mode: JourneyMode;
  /** Подія, до якої летимо або яку показуємо. */
  focusId: number | null;
  /**
   * Чи слід зберегти поточний ракурс перед польотом.
   *
   * Прапорець живе тут, а не в компоненті, бо відповідь на нього дає САМЕ
   * перехід: ракурс запам'ятовується, коли пара йде з `constellation`, і не
   * запам'ятовується, коли вона перестрибує з однієї події на іншу. Інакше
   * друга подія затерла б точку повернення, і кнопка «назад» вивела б пару не
   * туди, звідки вона прийшла.
   */
  saveView: boolean;
}

export const INITIAL_JOURNEY_STATE: JourneyState = {
  mode: 'loading',
  focusId: null,
  saveView: false,
};

/** Режими, у яких сцена веде камеру сама й пара її не чіпає. */
const CAMERA_LOCKED: ReadonlySet<JourneyMode> = new Set<JourneyMode>(['focusing', 'returning']);

/**
 * Чи можна зараз крутити небо.
 *
 * Інтро свідомо НЕ заблоковане, хоч воно теж перехідне. Політ здалеку триває
 * секунди зо три, і рука, яка за цей час торкнулась екрана, просить показати
 * зірку зараз, а не «зачекайте, ми ще летимо». Дотик обриває політ — це
 * перевірено на живому екрані ще на першому етапі й лишається.
 *
 * Політ до події й повернення — інша річ: там камера має дійти до кінця,
 * інакше пара опиниться в проміжному ракурсі, з якого не видно ні сузір'я, ні
 * події.
 */
export function cameraLocked(mode: JourneyMode): boolean {
  return CAMERA_LOCKED.has(mode);
}

/** Чи показувати сонце й деталі події. */
export function showsFocus(mode: JourneyMode): boolean {
  return mode === 'focusing' || mode === 'eventFocus' || mode === 'returning';
}

/** Чи розкладка вже поступилась місцем деталям. */
export function splitLayout(mode: JourneyMode): boolean {
  return mode === 'focusing' || mode === 'eventFocus';
}

export function journeyReducer(state: JourneyState, event: JourneyEvent): JourneyState {
  switch (event.type) {
    case 'skyReady':
      return state.mode === 'loading' ? { ...state, mode: 'intro' } : state;

    case 'introDone':
      return state.mode === 'intro' ? { ...state, mode: 'constellation' } : state;

    case 'selectStar': {
      // Обрати зірку можна звідусіль, крім завантаження й відкритої модалки:
      // під час інтро це обриває політ, а з відкритої події — перекидає на
      // сусідню, і обидва випадки природні.
      if (state.mode === 'loading' || state.mode === 'addingEvent') return state;
      // Той самий вибір удруге — не подія: повторний тап по відкритій зірці не
      // мусить перезапускати політ.
      if (state.mode === 'eventFocus' && state.focusId === event.id) return state;
      return {
        mode: 'focusing',
        focusId: event.id,
        // Ракурс запам'ятовується лише при виході зі спокою. Стрибок з однієї
        // події на іншу зберігає ту точку повернення, яка вже є.
        saveView: state.mode === 'intro' || state.mode === 'constellation',
      };
    }

    case 'focusArrived':
      return state.mode === 'focusing' ? { ...state, mode: 'eventFocus', saveView: false } : state;

    case 'dismiss':
      // Закрити можна й на півдорозі: пара передумала, поки камера летіла.
      if (state.mode !== 'focusing' && state.mode !== 'eventFocus') return state;
      return { mode: 'returning', focusId: null, saveView: false };

    case 'returnArrived':
      return state.mode === 'returning' ? { ...state, mode: 'constellation' } : state;

    case 'requestAdd':
      // Додавати можна лише зі спокою: під час польоту модалка накрила б
      // сцену, яка сама себе веде.
      return state.mode === 'constellation' ? { ...state, mode: 'addingEvent' } : state;

    case 'addClosed':
      return state.mode === 'addingEvent' ? { ...state, mode: 'constellation' } : state;

    default:
      return state;
  }
}
