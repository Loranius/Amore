// ============================================================
// Знайомства: мешканці міст «Дєвочка в городі».
// ------------------------------------------------------------
// Власник, 2026-10-04: «додай можливість знайомств… усе має крутитись
// навколо Лєни». Кожне місто має своїх людей зі своїм місцем, характером і
// розмовами, що змінюються з дружбою. Познайомитися, поговорити раз на день,
// подарувати, запросити на каву — і подруга чи друг відповідає своїм:
// хтось вчить, хтось підбадьорює. Лише дані й чисті правила.
// ============================================================
import { DAY_END_MIN } from './calendar';
import { CITIES, itemById, type CityId, type SkillId } from './content';
import { LifeRuleError, today, type LifeEvent, type LifeState, type Outcome } from './life';
import { rngFor } from './rng';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const MAX_FRIENDSHIP = 10;
/** З цього рівня — подруга/друг: кава вдвох і бонус дружби. */
export const FRIEND_LEVEL = 4;
export const CLOSE_LEVEL = 7;
export const COFFEE_PRICE = 90;

export interface Resident {
  id: string;
  name: string;
  /** Хто це для Лєни — підпис у розмові. */
  role: string;
  city: CityId;
  /** Де зазвичай стоїть (клітинка мапи міста). */
  tile: [number, number];
  /** З якого тижня життя людина поруч (одногрупниця — з університету). */
  minWeek: number;
  /** Чого вчить близька дружба. */
  teaches: SkillId;
  female: boolean;
  /** Репліки: незнайомі, знайомі, друзі. */
  lines: readonly [readonly string[], readonly string[], readonly string[]];
}

export const RESIDENTS: readonly Resident[] = [
  {
    id: 'hanna', name: 'Бабуся Ганна', role: 'сусідка з котом', city: 'zhylyntsi', tile: [32, 6], minWeek: 0, teaches: 'creativity', female: true,
    lines: [
      ['Ой, а чия ж ти будеш? Заходь, не соромся.'],
      ['Мій Мурчик знову спав на твоєму паркані.', 'Пиріжки з вишнями — то мій секрет. Колись навчу.'],
      ['Сідай, дитино, вишивку покажу — ось так стібок до стібка.', 'Ти в мене як онучка. Приходь частіше.'],
    ],
  },
  {
    id: 'petro', name: 'Дядько Петро', role: 'сусід-тракторист', city: 'zhylyntsi', tile: [17, 12], minWeek: 0, teaches: 'sport',
    female: false,
    lines: [
      ['Здорова була! Я Петро, з крайньої хати.'],
      ['Трактор знову чхає. Але восени все одно поле зоремо!', 'Кажуть, ти бігаєш швидше за всіх у школі?'],
      ['Ану, хто перший до ставка? Я тебе вже не дожену!', 'Буде тобі пора — допоможу з переїздом, трактор є.'],
    ],
  },
  {
    id: 'nina', name: 'Ніна Іванівна', role: 'вчителька', city: 'pravdivka', tile: [8, 10], minWeek: 1, teaches: 'knowledge', female: true,
    lines: [
      ['Добрий день! Ти з Жилинців? Я веду українську.'],
      ['Читаєш щось цікаве? Принеси — обговоримо.', 'У тебе гарний почерк. Не загуби його.'],
      ['Я в тебе вірю. Будь-який університет — твій.', 'Ось список книжок на літо. Ти їх проковтнеш.'],
    ],
  },
  {
    id: 'marko', name: 'Марко', role: 'музикант на Проскурівській', city: 'khmelnytskyi', tile: [27, 18], minWeek: 4, teaches: 'creativity', female: false,
    lines: [
      ['Привіт! Замовиш пісню? Перша — безкоштовно.'],
      ['Вчора грав до темряви — люди танцювали просто на бруківці.', 'Хочеш, навчу три акорди? З ними — пів пісень світу.'],
      ['Я написав пісню. Про дівчину з села, яка підкорила місто.', 'Як матиму концерт — ти в першому ряду.'],
    ],
  },
  {
    id: 'sofia', name: 'Софія', role: 'флористка', city: 'khmelnytskyi', tile: [36, 26], minWeek: 6, teaches: 'charm', female: true,
    lines: [
      ['Привіт! Ці півонії сьогодні зранку з Кам\'янця.'],
      ['Колір букета каже більше, ніж листівка.', 'Як ти? Виглядаєш, ніби закохана.'],
      ['Хочеш свою квіткову справу? Я поділюсь постачальниками.', 'Подружко, ти найкраща клієнтка й найкраща людина.'],
    ],
  },
  {
    id: 'iryna', name: 'Ірина', role: 'одногрупниця з ВДПУ', city: 'vinnytsia', tile: [12, 21], minWeek: 12, teaches: 'knowledge', female: true,
    lines: [
      ['О, ти теж з першого курсу? Я Іра, сиджу на третій парті.'],
      ['Конспект з педагогіки дам, тільки поверни до сесії!', 'Підемо після пар на набережну?'],
      ['Сесію закриємо разом — я в тебе вірю більше, ніж у себе.', 'Ти моя людина. На все життя.'],
    ],
  },
  {
    id: 'taras', name: 'Тарас', role: 'бариста', city: 'vinnytsia', tile: [30, 10], minWeek: 9, teaches: 'charm', female: false,
    lines: [
      ['Привіт! Тобі як завжди — чи щось нове?'],
      ['Сьогодні новий сорт з Ефіопії. Пахне чорницею.', 'Ти посміхаєшся — значить, день вдався.'],
      ['Колись відкриєш свою кав\'ярню — кличь мене, я першим прийду.', 'Тобі кава за рахунок закладу. Не сперечайся.'],
    ],
  },
  {
    id: 'anya', name: 'Аня', role: 'програмістка', city: 'kyiv', tile: [20, 14], minWeek: 12, teaches: 'knowledge', female: true,
    lines: [
      ['Привіт! Ти теж губишся в метро? Я тут третій рік — і досі.'],
      ['Хочеш, покажу, як зробити собі сайт за вечір?', 'Київ шалений, але свій.'],
      ['Твій інтернет-магазин? Давай я допоможу з кодом!', 'Приїжджай частіше — у мене завжди є диван для тебе.'],
    ],
  },
  {
    id: 'ostap', name: 'Остап', role: 'екскурсовод', city: 'lviv', tile: [18, 12], minWeek: 9, teaches: 'knowledge', female: false,
    lines: [
      ['Вітаю у Львові! Ратуша, кава, дощ — класика.'],
      ['Знаєш, чому левів у місті понад чотири тисячі?', 'Шоколад тут — не їжа, а стан душі.'],
      ['Для тебе — екскурсія дахами. Нікому не кажи!', 'Ти вже майже львів\'янка.'],
    ],
  },
  {
    id: 'katya', name: 'Катя', role: 'серферка з Отради', city: 'odesa', tile: [22, 20], minWeek: 9, teaches: 'sport', female: true,
    lines: [
      ['Ой, привіт! Море сьогодні тепле, як чай.'],
      ['Хочеш, навчу стояти на дошці? Головне — не боятись хвилі.', 'Привоз — це не ринок, це вистава.'],
      ['Ти стала на дошку з третьої спроби! Я пишаюсь!', 'Одеса тепер і твоя. Чекаю щоліта.'],
    ],
  },
];

export const RESIDENT_BY_ID: ReadonlyMap<string, Resident> = new Map(RESIDENTS.map((r) => [r.id, r]));

function resident(id: string): Resident {
  const r = RESIDENT_BY_ID.get(id);
  if (!r) throw new LifeRuleError(`Невідома людина: ${id}`);
  return r;
}

export function friendship(state: LifeState, id: string): number {
  return state.people[id] ?? 0;
}

export function acquainted(state: LifeState, id: string): boolean {
  return friendship(state, id) > 0;
}

/** Хто з мешканців зараз у місті Лєни. */
export function residentsIn(state: LifeState, city: CityId): Resident[] {
  const week = today(state).week;
  return RESIDENTS.filter((r) => r.city === city && week >= r.minWeek);
}

export type FriendTier = 0 | 1 | 2;

export function tierOf(level: number): FriendTier {
  return level >= FRIEND_LEVEL ? 2 : level > 0 ? 1 : 0;
}

export function relationName(state: LifeState, id: string): string {
  const r = resident(id);
  const level = friendship(state, id);
  if (level <= 0) return 'Незнайомі';
  if (level >= CLOSE_LEVEL) return r.female ? 'Близька подруга' : 'Близький друг';
  if (level >= FRIEND_LEVEL) return r.female ? 'Подруга' : 'Друг';
  return 'Знайомі';
}

/** Що людина скаже сьогодні (стабільно протягом дня). */
export function lineFor(state: LifeState, id: string): string {
  const r = resident(id);
  const pool = r.lines[tierOf(friendship(state, id))];
  return pool[Math.floor(rngFor(state.seed, 'talk', id, state.day)() * pool.length)]!;
}

function here(state: LifeState, r: Resident): void {
  if (state.city !== r.city) throw new LifeRuleError(`${r.name} — у місті ${CITIES[r.city].name}`);
  if (today(state).week < r.minWeek) throw new LifeRuleError('Ще не час для цієї зустрічі');
}

/** Познайомитися: перший крок, чарівність допомагає. */
export function meetResident(state: LifeState, id: string): Outcome {
  const r = resident(id);
  here(state, r);
  if (acquainted(state, id)) throw new LifeRuleError('Ви вже знайомі');
  const start = state.skills.charm >= 20 ? 1.5 : 1;
  return {
    state: { ...state, people: { ...state.people, [id]: start }, mood: clamp(state.mood + 3, 0, 100), minute: state.minute + 10, doneToday: [...state.doneToday, `talk:${id}`] },
    events: [{ kind: 'toast', text: `Нове знайомство: ${r.name}` }],
  };
}

/** Поговорити раз на день: дружба росте, настрій теж; близька дружба вчить. */
export function chat(state: LifeState, id: string): Outcome {
  const r = resident(id);
  here(state, r);
  if (!acquainted(state, id)) throw new LifeRuleError('Спершу познайомтесь');
  if (state.doneToday.includes(`talk:${id}`)) throw new LifeRuleError('Сьогодні вже говорили');
  const level = friendship(state, id);
  const events: LifeEvent[] = [];
  const nextLevel = clamp(level + 0.5, 0, MAX_FRIENDSHIP);
  let skills = state.skills;
  if (level >= CLOSE_LEVEL) {
    skills = { ...skills, [r.teaches]: clamp(skills[r.teaches] + 1, 0, 100) };
    events.push({ kind: 'toast', text: `${r.name} ${r.female ? 'навчила' : 'навчив'} тебе чогось нового` });
  }
  if (tierOf(nextLevel) > tierOf(level)) events.push({ kind: 'toast', text: `${r.name} тепер ${r.female ? 'твоя подруга' : 'твій друг'}` });
  return {
    state: { ...state, people: { ...state.people, [id]: nextLevel }, skills, mood: clamp(state.mood + 3, 0, 100), minute: state.minute + 20, doneToday: [...state.doneToday, `talk:${id}`] },
    events,
  };
}

/** Подарунок із сумки — один на день. */
export function giftResident(state: LifeState, id: string, itemId: string): Outcome {
  const r = resident(id);
  here(state, r);
  if (!acquainted(state, id)) throw new LifeRuleError('Спершу познайомтесь');
  const at = state.gifts.indexOf(itemId);
  if (at < 0) throw new LifeRuleError('Такого подарунка немає в сумці');
  if (state.doneToday.includes(`gift:${id}`)) throw new LifeRuleError('Сьогодні вже дарувала');
  const gifts = [...state.gifts];
  gifts.splice(at, 1);
  const boost = 1 + (itemById(itemId).hearts ?? 0) * 0.5;
  return {
    state: { ...state, gifts, people: { ...state.people, [id]: clamp(friendship(state, id) + boost, 0, MAX_FRIENDSHIP) }, mood: clamp(state.mood + 5, 0, 100), doneToday: [...state.doneToday, `gift:${id}`] },
    events: [{ kind: 'toast', text: `${r.name}: «Ой, це мені? Дякую!»` }],
  };
}

export type Check = { ok: true } | { ok: false; reason: string };

export function coffeeCheck(state: LifeState, id: string): Check {
  if (friendship(state, id) < FRIEND_LEVEL) return { ok: false, reason: 'Спершу подружіться' };
  if (state.doneToday.includes(`coffee:${id}`)) return { ok: false, reason: 'Сьогодні вже бачились' };
  if (state.money < COFFEE_PRICE) return { ok: false, reason: `Треба ${COFFEE_PRICE} ₴` };
  if (state.minute + 90 > DAY_END_MIN - 60) return { ok: false, reason: 'Пізно — завтра' };
  return { ok: true };
}

/** Кава вдвох з подругою чи другом: сили, настрій і дружба. */
export function coffeeWith(state: LifeState, id: string): Outcome {
  const r = resident(id);
  here(state, r);
  const check = coffeeCheck(state, id);
  if (!check.ok) throw new LifeRuleError(check.reason);
  return {
    state: {
      ...state,
      money: state.money - COFFEE_PRICE,
      minute: state.minute + 90,
      energy: clamp(state.energy + 12, 0, 100),
      mood: clamp(state.mood + 10, 0, 100),
      people: { ...state.people, [id]: clamp(friendship(state, id) + 1, 0, MAX_FRIENDSHIP) },
      doneToday: [...state.doneToday, `coffee:${id}`],
    },
    events: [{ kind: 'toast', text: `Кава вдвох: ${r.name} — і день кращий` }],
  };
}
