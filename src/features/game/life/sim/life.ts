// ============================================================
// «Дєвочка в городі» — правила (ADR-0239).
// ------------------------------------------------------------
// Стан — звичайний об'єкт, що серіалізується в JSON; кожна дія — чиста
// функція `(стан, …) → { state, events }`. Жодного годинника, жодного
// `Math.random()`: однакові дії над однаковим сейвом дають однаковий
// результат, і тести тримають саме це.
//
// Сенс гри — прожити життя: рости, вчитися, обрати роботу, побачити
// міста, зібрати альбом і дійти до Жовтого каменя на Отраді. Програшу
// немає: прогул чи безсонна ніч коштують настрою й оцінок, а не гри.
// ============================================================
import {
  ADULT_FIRST_WEEK,
  DAY_END_MIN,
  DAY_START_MIN,
  MEET_DOW,
  MEET_WEEK,
  PROPOSAL_WEEK,
  UNI_FIRST_WEEK,
  dayInfo,
  firstDayOfWeek,
  type DayInfo,
} from './calendar';
import {
  CITIES,
  CITY_SHOPS,
  JOB_BY_ID,
  MAX_HEARTS,
  ROUTES,
  SIGHTS,
  itemById,
  shopStock,
  type CityId,
  type DecorSlot,
  type Education,
  type Job,
  type PersonId,
  type Route,
  type ShopId,
  type SkillId,
} from './content';
import { economyNight, economyWeek, type OwnedBusiness } from './economy';

/**
 * Версія сейву. 2 — додано Діму-супутника (`dima`); сейв версії 1
 * читається й доповнюється типовими значеннями (`save.ts`).
 */
export const SAVE_VERSION = 2;

export interface JobState {
  id: string;
  rank: number;
  shifts: number;
}

export interface LifeFlags {
  metDima: boolean;
  livingWithDima: boolean;
  proposed: boolean;
  lyceumVisit: boolean;
}

/**
 * Де Діма (власник, 2026-10-04: «Діма не має постійно бігати за Лєною —
 * лише коли вона попросить; скаже піти — чекає вдома; подзвонить — прийде»).
 * `home` — чекає вдома; `follow` — з Лєною. `eta` — хвилина дня, коли він
 * дійде після дзвінка (`null` — уже поруч).
 */
export interface DimaState {
  mode: 'home' | 'follow';
  eta: number | null;
}

export interface LifeState {
  version: typeof SAVE_VERSION;
  seed: number;
  day: number;
  /** Хвилини від півночі поточного дня; день починається о 7:00. */
  minute: number;
  city: CityId;
  home: CityId;
  homeName: string;
  /** Оренда за тиждень, гривень. */
  rent: number;
  money: number;
  energy: number;
  mood: number;
  skills: Record<SkillId, number>;
  hearts: Record<PersonId, number>;
  /** Вдягнене (id речі) або `null` — одяг за віком. */
  outfit: string | null;
  /** Куплене назавжди: одяг, книжки, техніка, сувеніри, затишок. Відсортовано. */
  owned: string[];
  /** Що стоїть у кімнаті. */
  decor: Partial<Record<DecorSlot, string>>;
  /** Подарунки в сумці (повторюються). */
  gifts: string[];
  /** Пам'ятки, сфотографовані для альбому. */
  photos: string[];
  /** Віхи в порядку досягнення. */
  milestones: string[];
  job: JobState | null;
  /** Оцінки днів поточного навчального року (0..1). */
  yearScores: number[];
  /** Річні оцінки за 12-бальною: тиждень → бал. */
  marks: { week: number; mark: number }[];
  flags: LifeFlags;
  /** Що вже зроблено сьогодні: 'duty', 'date', 'friends', 'sight:<id>', 'gift:<person>'. */
  doneToday: string[];
  dima: DimaState;
  /** Свої справи (ADR-0239, поправка 2026-10-04). */
  businesses: OwnedBusiness[];
  /** Куплене житло (id з `PROPERTIES`). */
  properties: string[];
  /** Де стоять меблі в кімнаті (клітинки); немає — типове місце. */
  layout: Partial<Record<DecorSlot, [number, number]>>;
  /** Знайомства: дружба з мешканцями (id → 0..10). */
  people: Record<string, number>;
}

export type LifeEventKind = 'toast' | 'card' | 'milestone' | 'story';
export interface LifeEvent {
  kind: LifeEventKind;
  text: string;
  id?: string;
}

export interface Outcome {
  state: LifeState;
  events: LifeEvent[];
}

export class LifeRuleError extends Error {}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);

// ------------------------------------------------------------
// Віхи альбому.
// ------------------------------------------------------------
export interface Milestone {
  id: string;
  title: string;
  text: string;
}

export const MILESTONES: readonly Milestone[] = [
  { id: 'sadok', title: 'Садочок', text: 'Перший день у садочку в Жилинцях.' },
  { id: 'firstBell', title: 'Перший дзвоник', text: 'Букет, бант і перший клас.' },
  { id: 'firstPurchase', title: 'Перша покупка', text: 'Сама, за власні кишенькові.' },
  { id: 'firstTrip', title: 'Перша подорож', text: 'Дорога кудись далі за село.' },
  { id: 'firstMoney', title: 'Перші заробітки', text: 'Гроші, зароблені своїми руками.' },
  { id: 'lyceum', title: 'Ліцей', text: 'Хмельницький ліцей — і рішення повернутись додому.' },
  { id: 'graduation', title: 'Випускний', text: 'Одинадцять класів позаду.' },
  { id: 'student', title: 'Студентка', text: 'ВДПУ, гуртожиток, Вінниця.' },
  { id: 'met', title: 'Дайвінчик', text: '«Класна ава, Лєна!» — 26 грудня 2022.' },
  { id: 'diploma', title: 'Диплом', text: 'Чотири курси ВДПУ.' },
  { id: 'together', title: 'Своя квартира', text: 'Вишенька: разом на роботу, разом додому.' },
  { id: 'promotion', title: 'Підвищення', text: 'Нова посада — заслужено.' },
  { id: 'sea', title: 'Море', text: 'Одеса: сонце, чайки й Отрада.' },
  { id: 'allCities', title: 'Мандрівниця', text: 'Побувала в усіх містах гри.' },
  { id: 'proposal', title: '«Так!»', text: '13 липня 2026, Жовтий камінь, Отрада.' },
];

export const MILESTONE_BY_ID: ReadonlyMap<string, Milestone> = new Map(MILESTONES.map((m) => [m.id, m]));

function withMilestone(state: LifeState, id: string, events: LifeEvent[]): LifeState {
  if (state.milestones.includes(id)) return state;
  const m = MILESTONE_BY_ID.get(id);
  if (!m) throw new LifeRuleError(`Невідома віха: ${id}`);
  events.push({ kind: 'milestone', id, text: m.title });
  return { ...state, milestones: [...state.milestones, id] };
}

// ------------------------------------------------------------
// Початок.
// ------------------------------------------------------------
export type Chapter = 'sadok' | 'school' | 'uni' | 'adult';

export const CHAPTER_WEEK: Record<Chapter, number> = { sadok: 0, school: 1, uni: UNI_FIRST_WEEK, adult: ADULT_FIRST_WEEK };

function baseState(seed: number): LifeState {
  return {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    day: 0,
    minute: DAY_START_MIN,
    city: 'zhylyntsi',
    home: 'zhylyntsi',
    homeName: 'Хата в Жилинцях',
    rent: 0,
    money: 20,
    energy: 100,
    mood: 70,
    skills: { knowledge: 0, creativity: 0, sport: 0, charm: 0 },
    hearts: { mom: 8, dima: 0, friend: 3 },
    outfit: null,
    owned: [],
    decor: {},
    gifts: [],
    photos: [],
    milestones: [],
    job: null,
    yearScores: [],
    marks: [],
    flags: { metDima: false, livingWithDima: false, proposed: false, lyceumVisit: false },
    doneToday: [],
    dima: { mode: 'home', eta: null },
    businesses: [],
    properties: [],
    layout: {},
    people: {},
  };
}

/** Нове життя з обраного розділу. Пізніші розділи стартують із прожитим минулим. */
export function newLife(seed: number, chapter: Chapter = 'sadok'): LifeState {
  const s = baseState(seed);
  const day = firstDayOfWeek(CHAPTER_WEEK[chapter]);
  if (chapter === 'sadok') return { ...s, milestones: [] };
  if (chapter === 'school') return { ...s, day, money: 40, skills: { knowledge: 4, creativity: 4, sport: 4, charm: 3 }, milestones: ['sadok'] };
  if (chapter === 'uni') {
    return {
      ...s,
      day,
      city: 'vinnytsia',
      home: 'vinnytsia',
      homeName: 'Гуртожиток ВДПУ',
      money: 700,
      skills: { knowledge: 32, creativity: 18, sport: 15, charm: 16 },
      hearts: { mom: 8, dima: 0, friend: 6 },
      marks: Array.from({ length: 11 }, (_, i) => ({ week: i + 1, mark: 9 })),
      milestones: ['sadok', 'firstBell', 'firstPurchase', 'firstTrip', 'lyceum', 'graduation', 'student'],
      flags: { ...s.flags, lyceumVisit: true },
    };
  }
  return {
    ...s,
    day,
    city: 'vinnytsia',
    home: 'vinnytsia',
    homeName: 'Квартира на Вишеньці',
    rent: 700,
    money: 2500,
    skills: { knowledge: 50, creativity: 26, sport: 18, charm: 30 },
    hearts: { mom: 8, dima: 6, friend: 6 },
    marks: Array.from({ length: 15 }, (_, i) => ({ week: i + 1, mark: 9 })),
    milestones: ['sadok', 'firstBell', 'firstPurchase', 'firstTrip', 'lyceum', 'graduation', 'student', 'met', 'diploma', 'together'],
    flags: { metDima: true, livingWithDima: true, proposed: false, lyceumVisit: true },
  };
}

export function today(state: LifeState): DayInfo {
  return dayInfo(state.day);
}

export function education(state: LifeState): Education {
  const week = today(state).week;
  if (week >= ADULT_FIRST_WEEK) return 'diploma';
  if (week >= UNI_FIRST_WEEK) return 'school';
  return 'none';
}

/** Чи Лєна ще вчиться (садочок, школа, ВДПУ). */
export function studying(state: LifeState): boolean {
  return today(state).stage !== 'adult';
}

// ------------------------------------------------------------
// Обов'язок дня: садочок, школа, пари, робота.
// ------------------------------------------------------------
export type DutyKind = 'sadok' | 'school' | 'uni' | 'work';

export interface Duty {
  kind: DutyKind;
  city: CityId;
  /** Будівля на мапі міста. */
  building: string;
  title: string;
  /** До котрої треба прийти; пізніше — запізнення. */
  startBy: number;
  /** Скільки хвилин займає. */
  minutes: number;
}

export const LATE_GRACE_MIN = 150;

export function dutyToday(state: LifeState): Duty | null {
  const info = today(state);
  if (info.stage === 'sadok' && !info.weekend) return { kind: 'sadok', city: 'zhylyntsi', building: 'sadok', title: 'Садочок', startBy: 9 * 60, minutes: 6 * 60 };
  if (info.stage === 'school' && !info.weekend) {
    const city: CityId = info.level <= 9 ? 'zhylyntsi' : 'pravdivka';
    return { kind: 'school', city, building: 'school', title: `${info.level} клас`, startBy: 8 * 60 + 30, minutes: 5 * 60 + 30 };
  }
  if (info.stage === 'uni' && !info.weekend) return { kind: 'uni', city: 'vinnytsia', building: 'vtei', title: `${info.level} курс ВДПУ`, startBy: 9 * 60, minutes: 5 * 60 };
  if (state.job) {
    const job = JOB_BY_ID.get(state.job.id)!;
    const shiftDay = job.partTime && studying(state) ? info.weekend : !info.weekend;
    if (shiftDay) return { kind: 'work', city: job.city, building: `job:${job.id}`, title: job.title, startBy: 10 * 60, minutes: job.minutes };
  }
  return null;
}

export type DutyCheck = { ok: true; late: boolean } | { ok: false; reason: string };

export function canDoDuty(state: LifeState): DutyCheck {
  const duty = dutyToday(state);
  if (!duty) return { ok: false, reason: 'Сьогодні вільний день' };
  if (state.doneToday.includes('duty')) return { ok: false, reason: 'На сьогодні вже все' };
  if (state.city !== duty.city) return { ok: false, reason: `Це в місті ${CITIES[duty.city].name}` };
  if (state.minute > duty.startBy + LATE_GRACE_MIN) return { ok: false, reason: 'Сьогодні вже запізно — завтра зранку' };
  if (state.energy < 10) return { ok: false, reason: 'Немає сил — поїж або поспи' };
  return { ok: true, late: state.minute > duty.startBy };
}

function requireDuty(state: LifeState, kind: DutyKind): Duty {
  const check = canDoDuty(state);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const duty = dutyToday(state)!;
  if (duty.kind !== kind) throw new LifeRuleError(`Сьогодні не ${kind}, а ${duty.kind}`);
  return duty;
}

const meanOf = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * День навчання: садочок, уроки або пари. `scores` — результат кожної
 * міні-гри дня (0..1). Запізнення забирає частину оцінки.
 */
export function attendStudy(state: LifeState, scores: readonly number[]): Outcome {
  const info = today(state);
  const kind: DutyKind = info.stage === 'sadok' ? 'sadok' : info.stage === 'school' ? 'school' : 'uni';
  const duty = requireDuty(state, kind);
  if (scores.length === 0 || scores.some((s) => !Number.isFinite(s) || s < 0 || s > 1)) {
    throw new LifeRuleError('Оцінки уроків мають бути числами 0..1');
  }
  const late = state.minute > duty.startBy;
  const score = clamp(meanOf(scores) * (late ? 0.85 : 1), 0, 1);
  const events: LifeEvent[] = [];
  const gain = kind === 'sadok' ? 1 : kind === 'school' ? 2 + info.level * 0.25 : 5;
  let next: LifeState = {
    ...state,
    minute: Math.max(state.minute, duty.startBy) + duty.minutes,
    energy: clamp(state.energy - (kind === 'sadok' ? 5 : 22), 0, 100),
    mood: clamp(state.mood + (score >= 0.7 ? 5 : score >= 0.4 ? 1 : -3), 0, 100),
    skills: {
      ...state.skills,
      knowledge: clamp(state.skills.knowledge + round(gain * (0.4 + score)), 0, 100),
      creativity: clamp(state.skills.creativity + (kind === 'sadok' ? 1 : 0), 0, 100),
      sport: clamp(state.skills.sport + (kind === 'uni' ? 0 : 1), 0, 100),
    },
    hearts: { ...state.hearts, friend: clamp(state.hearts.friend + (kind === 'sadok' ? 0.5 : 0.25), 0, MAX_HEARTS) },
    yearScores: [...state.yearScores, score],
    doneToday: [...state.doneToday, 'duty'],
  };
  if (late) events.push({ kind: 'toast', text: 'Запізнилась — частину уроку пропущено' });
  if (kind === 'sadok') next = withMilestone(next, 'sadok', events);
  if (kind === 'school' && info.level === 1) next = withMilestone(next, 'firstBell', events);
  if (kind !== 'sadok') events.push({ kind: 'card', text: `Оцінка дня: ${markOf(score)} з 12` });
  return { state: next, events };
}

/** Частка 0..1 → бал 1..12. */
export function markOf(score: number): number {
  return clamp(Math.round(1 + score * 11), 1, 12);
}

// ------------------------------------------------------------
// Робота.
// ------------------------------------------------------------
export type JobCheck = { ok: true } | { ok: false; reason: string };

const EDU_RANK: Record<Education, number> = { none: 0, school: 1, diploma: 2 };
/** З якого тижня (класу) можна підробляти. */
export const PART_TIME_WEEK = 8;

export function jobCheck(state: LifeState, job: Job): JobCheck {
  const week = today(state).week;
  if (studying(state) && !job.partTime) return { ok: false, reason: 'Повна зміна — після навчання' };
  if (studying(state) && week < PART_TIME_WEEK) return { ok: false, reason: `Підробіток — з ${PART_TIME_WEEK} класу` };
  if (EDU_RANK[education(state)] < EDU_RANK[job.education]) return { ok: false, reason: `Потрібен ${job.education === 'diploma' ? 'диплом' : 'атестат'}` };
  for (const [skill, need] of Object.entries(job.skills ?? {}) as [SkillId, number][]) {
    if (state.skills[skill] < need) return { ok: false, reason: `Потрібно ${need}+ навички «${skillLabel(skill)}»` };
  }
  return { ok: true };
}

function skillLabel(skill: SkillId): string {
  return { knowledge: 'Знання', creativity: 'Творчість', sport: 'Спорт', charm: 'Чарівність' }[skill];
}

export function takeJob(state: LifeState, jobId: string): Outcome {
  const job = JOB_BY_ID.get(jobId);
  if (!job) throw new LifeRuleError(`Невідома робота: ${jobId}`);
  if (state.city !== job.city) throw new LifeRuleError(`Співбесіда — у місті ${CITIES[job.city].name}`);
  const check = jobCheck(state, job);
  if (!check.ok) throw new LifeRuleError(check.reason);
  if (state.job?.id === jobId) throw new LifeRuleError('Ти вже тут працюєш');
  const events: LifeEvent[] = [{ kind: 'card', text: `Нова робота: ${job.title}` }];
  return { state: { ...state, job: { id: job.id, rank: 0, shifts: 0 }, minute: state.minute + 45 }, events };
}

export function quitJob(state: LifeState): Outcome {
  if (!state.job) throw new LifeRuleError('Роботи немає');
  return { state: { ...state, job: null }, events: [{ kind: 'toast', text: 'Звільнилась. Час шукати нове' }] };
}

/** Скільки змін до наступного рівня (ранги 0 → 1 → 2). */
export const SHIFTS_PER_RANK = [5, 12, 24] as const;

export function shiftPay(job: Job, rank: number, score: number, mood: number): number {
  const base = job.pay * (1 + 0.25 * rank);
  const effort = 0.6 + 0.6 * clamp(score, 0, 1);
  const spirit = mood < 25 ? 0.85 : 1;
  return round(base * effort * spirit);
}

export function workShift(state: LifeState, score: number): Outcome {
  const duty = requireDuty(state, 'work');
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new LifeRuleError('Результат зміни — число 0..1');
  const job = JOB_BY_ID.get(state.job!.id)!;
  const pay = shiftPay(job, state.job!.rank, score, state.mood);
  const shifts = state.job!.shifts + 1;
  const events: LifeEvent[] = [{ kind: 'card', text: `Зміна завершена: +${pay} ₴` }];
  let rank = state.job!.rank;
  if (rank < job.ranks.length - 1 && shifts >= SHIFTS_PER_RANK[rank]!) {
    rank += 1;
    events.push({ kind: 'card', text: `Підвищення! Тепер ти — ${job.ranks[rank]}` });
  }
  let next: LifeState = {
    ...state,
    money: state.money + pay,
    minute: Math.max(state.minute, duty.startBy) + duty.minutes,
    energy: clamp(state.energy - 28, 0, 100),
    mood: clamp(state.mood + (score >= 0.7 ? 3 : -2), 0, 100),
    skills: { ...state.skills, [job.grows]: clamp(state.skills[job.grows] + 2, 0, 100) },
    job: { id: job.id, rank, shifts },
    doneToday: [...state.doneToday, 'duty'],
  };
  next = withMilestone(next, 'firstMoney', events);
  if (rank > state.job!.rank) next = withMilestone(next, 'promotion', events);
  return { state: next, events };
}

// ------------------------------------------------------------
// Крамниці.
// ------------------------------------------------------------
export function canBuy(state: LifeState, shop: ShopId, itemId: string): JobCheck {
  const item = itemById(itemId);
  if (!CITY_SHOPS[state.city].includes(shop)) return { ok: false, reason: 'Такої крамниці тут немає' };
  if (!shopStock(shop, state.city, today(state).week).some((i) => i.id === itemId)) return { ok: false, reason: 'Цього тут не продають' };
  if (['outfit', 'decor', 'book', 'gadget', 'souvenir'].includes(item.kind) && state.owned.includes(itemId)) return { ok: false, reason: 'Вже є' };
  if (state.money < item.price) return { ok: false, reason: `Не вистачає ${item.price - state.money} ₴` };
  return { ok: true };
}

export function buy(state: LifeState, shop: ShopId, itemId: string): Outcome {
  const check = canBuy(state, shop, itemId);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const item = itemById(itemId);
  const events: LifeEvent[] = [];
  let next: LifeState = { ...state, money: state.money - item.price, minute: state.minute + 10 };
  if (item.energy && item.kind === 'food') next.energy = clamp(next.energy + item.energy, 0, 100);
  if (item.mood) next.mood = clamp(next.mood + item.mood, 0, 100);
  if (item.skills) {
    const skills = { ...next.skills };
    for (const [k, v] of Object.entries(item.skills) as [SkillId, number][]) skills[k] = clamp(skills[k] + v, 0, 100);
    next.skills = skills;
  }
  if (item.kind === 'gift') next.gifts = [...next.gifts, item.id].sort();
  if (item.kind !== 'food' && item.kind !== 'gift') next.owned = [...next.owned, item.id].sort();
  if (item.kind === 'outfit') next.outfit = item.id;
  if (item.decor) next.decor = { ...next.decor, [item.decor]: item.id };
  events.push({ kind: 'toast', text: item.kind === 'food' ? `Смачно! ${item.blurb}` : `Куплено: ${item.name}` });
  if (item.price > 0) next = withMilestone(next, 'firstPurchase', events);
  return { state: next, events };
}

export function wear(state: LifeState, itemId: string | null): LifeState {
  if (itemId !== null) {
    const item = itemById(itemId);
    if (item.kind !== 'outfit' || !state.owned.includes(itemId)) throw new LifeRuleError('Цього одягу немає');
  }
  return { ...state, outfit: itemId };
}

// ------------------------------------------------------------
// Дорога.
// ------------------------------------------------------------
export interface TravelPlan {
  legs: Route[];
  price: number;
  minutes: number;
}

/** Найдешевший шлях; при рівній ціні — найкоротший. Детерміновано. */
export function routePlan(from: CityId, to: CityId): TravelPlan | null {
  if (from === to) return { legs: [], price: 0, minutes: 0 };
  const best = new Map<CityId, { price: number; minutes: number; legs: Route[] }>([[from, { price: 0, minutes: 0, legs: [] }]]);
  const open: CityId[] = [from];
  while (open.length > 0) {
    open.sort((a, b) => best.get(a)!.price - best.get(b)!.price || best.get(a)!.minutes - best.get(b)!.minutes || (a < b ? -1 : a > b ? 1 : 0));
    const at = open.shift()!;
    const here = best.get(at)!;
    for (const r of ROUTES) {
      const other = r.a === at ? r.b : r.b === at ? r.a : null;
      if (!other) continue;
      const cand = { price: here.price + r.price, minutes: here.minutes + r.minutes, legs: [...here.legs, r] };
      const prev = best.get(other);
      if (!prev || cand.price < prev.price || (cand.price === prev.price && cand.minutes < prev.minutes)) {
        best.set(other, cand);
        if (!open.includes(other)) open.push(other);
      }
    }
  }
  const found = best.get(to);
  return found ? { legs: found.legs, price: found.price, minutes: found.minutes } : null;
}

/** До 9 класу далеко — лише з мамою, вихідними, і мама платить. */
export const ALONE_TRAVEL_WEEK = 9;

export type TravelCheck = { ok: true; plan: TravelPlan; withMom: boolean } | { ok: false; reason: string };

export function travelCheck(state: LifeState, to: CityId): TravelCheck {
  if (to === state.city) return { ok: false, reason: 'Ти вже тут' };
  const plan = routePlan(state.city, to);
  if (!plan) return { ok: false, reason: 'Туди не ходить транспорт' };
  const info = today(state);
  const walkOnly = plan.legs.every((l) => l.mode === 'walk');
  const withMom = info.week < ALONE_TRAVEL_WEEK && !walkOnly;
  if (withMom && !info.weekend) return { ok: false, reason: 'З мамою — лише на вихідних' };
  if (withMom && state.hearts.mom < 4) return { ok: false, reason: 'Мама сумує — побудь з нею вдома' };
  if (!withMom && state.money < plan.price) return { ok: false, reason: `Квиток коштує ${plan.price} ₴` };
  if (state.minute + plan.minutes > DAY_END_MIN - 60) return { ok: false, reason: 'Сьогодні вже не встигнеш — вирушай зранку' };
  return { ok: true, plan, withMom };
}

export function travel(state: LifeState, to: CityId): Outcome {
  const check = travelCheck(state, to);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const events: LifeEvent[] = [];
  let next: LifeState = {
    ...state,
    city: to,
    money: state.money - (check.withMom ? 0 : check.plan.price),
    minute: state.minute + check.plan.minutes,
    energy: clamp(state.energy - Math.round(check.plan.minutes / 30), 0, 100),
    mood: clamp(state.mood + 3, 0, 100),
  };
  if (CITIES[to].kind === 'city') next = withMilestone(next, 'firstTrip', events);
  if (to === 'odesa') next = withMilestone(next, 'sea', events);
  const visited = new Set([...next.photos.map((id) => SIGHTS.find((s) => s.id === id)!.city), to]);
  if (visited.size >= 7) next = withMilestone(next, 'allCities', events);
  return { state: next, events };
}

// ------------------------------------------------------------
// Вільний час: пам'ятки, друзі, побачення, подарунки.
// ------------------------------------------------------------
export function visitSight(state: LifeState, sightId: string): Outcome {
  const sight = SIGHTS.find((s) => s.id === sightId);
  if (!sight) throw new LifeRuleError(`Невідома пам'ятка: ${sightId}`);
  if (sight.city !== state.city) throw new LifeRuleError('Ця пам\'ятка в іншому місті');
  const key = `sight:${sightId}`;
  const events: LifeEvent[] = [];
  const fresh = !state.photos.includes(sightId);
  const already = state.doneToday.includes(key);
  let next: LifeState = {
    ...state,
    minute: state.minute + 30,
    energy: clamp(state.energy - 3, 0, 100),
    mood: clamp(state.mood + (already ? 0 : fresh ? sight.mood : Math.round(sight.mood / 3)), 0, 100),
    photos: fresh ? [...state.photos, sightId] : state.photos,
    doneToday: already ? state.doneToday : [...state.doneToday, key],
  };
  events.push({ kind: 'toast', text: fresh ? `Нове фото в альбомі: ${sight.name}` : `${sight.name} — гарно, як завжди` });
  const cities = new Set(next.photos.map((id) => SIGHTS.find((s) => s.id === id)!.city));
  if (cities.size >= 7) next = withMilestone(next, 'allCities', events);
  return { state: next, events };
}

export function playWithFriends(state: LifeState): Outcome {
  if (state.doneToday.includes('friends')) throw new LifeRuleError('З друзями вже гуляли сьогодні');
  if (state.energy < 8) throw new LifeRuleError('Немає сил на гру');
  return {
    state: {
      ...state,
      minute: state.minute + 90,
      energy: clamp(state.energy - 8, 0, 100),
      mood: clamp(state.mood + 10, 0, 100),
      skills: { ...state.skills, sport: clamp(state.skills.sport + 1, 0, 100), charm: clamp(state.skills.charm + 1, 0, 100) },
      hearts: { ...state.hearts, friend: clamp(state.hearts.friend + 1, 0, MAX_HEARTS) },
      doneToday: [...state.doneToday, 'friends'],
    },
    events: [{ kind: 'toast', text: 'Гарно погуляли з Олею' }],
  };
}

export type DateKind = 'walk' | 'cafe' | 'cinema';
export const DATE_PRICE: Record<DateKind, number> = { walk: 0, cafe: 160, cinema: 240 };
const DATE_MOOD: Record<DateKind, number> = { walk: 10, cafe: 14, cinema: 16 };

/** Дім Діми: спільна квартира, якщо живуть разом, інакше — Вінниця. */
export function dimaHome(state: LifeState): CityId {
  return state.flags.livingWithDima ? state.home : 'vinnytsia';
}

/** Чи Діма вже дійшов після дзвінка. */
export function dimaArrived(state: LifeState): boolean {
  return state.dima.eta === null || state.minute >= state.dima.eta;
}

/**
 * Де зараз Діма: поруч із Лєною, якщо вона покликала і він дійшов, інакше —
 * вдома. `null` — ще не знайомі або в дорозі.
 */
export function dimaCity(state: LifeState): CityId | null {
  if (!state.flags.metDima) return null;
  if (state.dima.mode === 'home') return dimaHome(state);
  return dimaArrived(state) ? state.city : null;
}

/** Діма йде поруч із Лєною. */
export function dimaWithLena(state: LifeState): boolean {
  return state.flags.metDima && state.dima.mode === 'follow' && dimaArrived(state);
}

/** «Ходімо зі мною» — коли Діма поруч (удома чи на вулиці його міста). */
export function askDimaAlong(state: LifeState): Outcome {
  if (!state.flags.metDima) throw new LifeRuleError('Ви ще не знайомі');
  if (state.dima.mode === 'follow') throw new LifeRuleError('Діма вже з тобою');
  if (dimaHome(state) !== state.city) throw new LifeRuleError('Діми тут немає — подзвони йому');
  return { state: { ...state, dima: { mode: 'follow', eta: null } }, events: [{ kind: 'toast', text: 'Діма: «Ходімо!»' }] };
}

/** «Йди додому, я пізніше» — Діма повертається додому й чекає. */
export function sendDimaHome(state: LifeState): Outcome {
  if (state.dima.mode !== 'follow') throw new LifeRuleError('Діма й так удома');
  return { state: { ...state, dima: { mode: 'home', eta: null } }, events: [{ kind: 'toast', text: 'Діма: «Чекаю вдома. Не барись!»' }] };
}

/** Обійняти Діму — раз на день, коли він поруч. */
export function hugDima(state: LifeState): Outcome {
  if (!dimaWithLena(state)) throw new LifeRuleError('Поклич Діму з собою — і обіймай скільки хочеш');
  if (state.doneToday.includes('hug')) throw new LifeRuleError('Сьогодні вже обіймались — але можна ще й завтра');
  return {
    state: {
      ...state,
      mood: clamp(state.mood + 4, 0, 100),
      hearts: { ...state.hearts, dima: clamp(state.hearts.dima + 0.25, 0, MAX_HEARTS) },
      doneToday: [...state.doneToday, 'hug'],
    },
    events: [{ kind: 'toast', text: 'Обійми — і на душі тепло' }],
  };
}

/** Скільки йти Дімі до Лєни: містом — пів години, з іншого міста — дорога. */
export function dimaTravelMinutes(state: LifeState): number {
  const from = dimaHome(state);
  if (from === state.city) return 30;
  return (routePlan(from, state.city)?.minutes ?? 240) + 20;
}

/** Подзвонити Дімі й попросити прийти: він вирушає до Лєни. */
export function callDima(state: LifeState): Outcome {
  if (!state.flags.metDima) throw new LifeRuleError('Номера Діми ще немає');
  if (state.dima.mode === 'follow') throw new LifeRuleError(dimaArrived(state) ? 'Діма вже поруч' : 'Діма вже в дорозі');
  const minutes = dimaTravelMinutes(state);
  if (state.minute + minutes > DAY_END_MIN - 30) throw new LifeRuleError('Діма: «Сьогодні вже не встигну, давай завтра?»');
  const far = dimaHome(state) !== state.city;
  const text = far
    ? `Діма: «Їду! Буду через ${Math.round(minutes / 6) / 10} год»`
    : 'Діма: «Уже йду, хвилин за тридцять буду»';
  return { state: { ...state, minute: state.minute + 5, dima: { mode: 'follow', eta: state.minute + 5 + minutes } }, events: [{ kind: 'toast', text }] };
}

export function goOnDate(state: LifeState, kind: DateKind): Outcome {
  if (!state.flags.metDima) throw new LifeRuleError('Ви ще не знайомі');
  if (!dimaWithLena(state)) throw new LifeRuleError('Діми поруч немає — поклич його або подзвони');
  if (state.doneToday.includes('date')) throw new LifeRuleError('Побачення вже було сьогодні');
  if (state.money < DATE_PRICE[kind]) throw new LifeRuleError(`Треба ${DATE_PRICE[kind]} ₴`);
  const events: LifeEvent[] = [{ kind: 'toast', text: kind === 'walk' ? 'Прогулянка вдвох' : kind === 'cafe' ? 'Кава вдвох' : 'Кіно вдвох' }];
  return {
    state: {
      ...state,
      money: state.money - DATE_PRICE[kind],
      minute: state.minute + 120,
      energy: clamp(state.energy - 6, 0, 100),
      mood: clamp(state.mood + DATE_MOOD[kind], 0, 100),
      hearts: { ...state.hearts, dima: clamp(state.hearts.dima + (kind === 'walk' ? 0.5 : 1), 0, MAX_HEARTS) },
      doneToday: [...state.doneToday, 'date'],
    },
    events,
  };
}

/** Хто поруч, щоб отримати подарунок. */
export function personNearby(state: LifeState, person: PersonId): boolean {
  if (person === 'mom') return state.city === 'zhylyntsi';
  if (person === 'dima') return dimaWithLena(state);
  return state.city === 'zhylyntsi' || state.city === state.home;
}

export function giveGift(state: LifeState, person: PersonId, itemId: string): Outcome {
  const at = state.gifts.indexOf(itemId);
  if (at < 0) throw new LifeRuleError('Такого подарунка немає в сумці');
  if (!personNearby(state, person)) throw new LifeRuleError('Цієї людини тут немає');
  const key = `gift:${person}`;
  if (state.doneToday.includes(key)) throw new LifeRuleError('Сьогодні вже дарувала');
  const item = itemById(itemId);
  const gifts = [...state.gifts];
  gifts.splice(at, 1);
  return {
    state: {
      ...state,
      gifts,
      mood: clamp(state.mood + 6, 0, 100),
      hearts: { ...state.hearts, [person]: clamp(state.hearts[person] + (item.hearts ?? 1), 0, MAX_HEARTS) },
      doneToday: [...state.doneToday, key],
    },
    events: [{ kind: 'toast', text: 'Подарунок вручено' }],
  };
}

// ------------------------------------------------------------
// Історія: ліцей, Діма, пропозиція.
// ------------------------------------------------------------
export function canVisitLyceum(state: LifeState): boolean {
  const info = today(state);
  return state.city === 'khmelnytskyi' && info.week === 9 && info.weekend && !state.flags.lyceumVisit;
}

export function visitLyceum(state: LifeState): Outcome {
  if (!canVisitLyceum(state)) throw new LifeRuleError('Ліцей зачинено');
  const events: LifeEvent[] = [];
  const next = withMilestone({ ...state, minute: state.minute + 60, flags: { ...state.flags, lyceumVisit: true } }, 'lyceum', events);
  events.push({ kind: 'story', text: 'Ліцей відвідано. Але серце тягне додому… 10 і 11 клас — у Правдівці.' });
  return { state: next, events };
}

/** Зустріч: середа 4-го курсу, Вінниця, і лише раз. */
export function meetingDue(state: LifeState): boolean {
  const info = today(state);
  return !state.flags.metDima && state.city === 'vinnytsia'
    && (info.week > MEET_WEEK || (info.week === MEET_WEEK && info.dow >= MEET_DOW));
}

export function meetDima(state: LifeState): Outcome {
  if (!meetingDue(state)) throw new LifeRuleError('Ще не час');
  const events: LifeEvent[] = [];
  const next = withMilestone({
    ...state,
    mood: 100,
    hearts: { ...state.hearts, dima: 4 },
    flags: { ...state.flags, metDima: true },
  }, 'met', events);
  return { state: next, events };
}

export const PROPOSAL_HEARTS = 7;

export type ProposalCheck = { ok: true } | { ok: false; reason: string };

export function proposalCheck(state: LifeState): ProposalCheck {
  const info = today(state);
  if (state.flags.proposed) return { ok: false, reason: 'Вона вже сказала «так»' };
  if (!state.flags.metDima) return { ok: false, reason: 'Просто гарний жовтий камінь' };
  if (info.week < PROPOSAL_WEEK) return { ok: false, reason: 'Гарний камінь. Колись ми сюди повернемось…' };
  if (info.season !== 'summer') return { ok: false, reason: 'Холодно — повернемось улітку' };
  if (state.city !== 'odesa') return { ok: false, reason: 'Жовтий камінь — в Одесі' };
  if (state.hearts.dima < PROPOSAL_HEARTS) return { ok: false, reason: 'Діма щось задумав… Побудьте ще трохи разом' };
  if (!dimaWithLena(state)) return { ok: false, reason: 'Без Діми тут не те — поклич його з собою' };
  return { ok: true };
}

export function propose(state: LifeState): Outcome {
  const check = proposalCheck(state);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const events: LifeEvent[] = [];
  const next = withMilestone({
    ...state,
    mood: 100,
    hearts: { ...state.hearts, dima: MAX_HEARTS },
    flags: { ...state.flags, proposed: true },
  }, 'proposal', events);
  return { state: next, events };
}

// ------------------------------------------------------------
// Час і сон.
// ------------------------------------------------------------
/** Час іде, поки Лєна ходить. Опівночі після 2:00 вона засинає де стоїть. */
export function passTime(state: LifeState, minutes: number): LifeState {
  if (!Number.isFinite(minutes) || minutes < 0) throw new LifeRuleError('Час іде лише вперед');
  return { ...state, minute: Math.min(DAY_END_MIN, state.minute + minutes) };
}

export function mustSleep(state: LifeState): boolean {
  return state.minute >= DAY_END_MIN;
}

/** Скільки енергії дає ніч. */
function sleepEnergy(state: LifeState, passedOut: boolean): number {
  if (passedOut) return 55;
  const bed = state.decor.bed ? 10 : 0;
  return state.minute <= 24 * 60 ? 100 : 80 + bed;
}

/**
 * Лягти спати (або заснути де стоїш). Новий день; у понеділок — новий рік:
 * річна оцінка, кишенькові чи стипендія, оренда, переїзди за історією.
 */
export function sleep(state: LifeState, passedOut = false): Outcome {
  if (!passedOut && state.city !== state.home) throw new LifeRuleError('Спати — вдома');
  const events: LifeEvent[] = [];
  const decorMood = Object.keys(state.decor).length;
  let next: LifeState = {
    ...state,
    day: state.day + 1,
    minute: DAY_START_MIN + (passedOut ? 60 : 0),
    city: state.home,
    energy: clamp(sleepEnergy(state, passedOut), 0, 100),
    mood: clamp(Math.round(state.mood + (62 - state.mood) * 0.15) + Math.min(6, decorMood) - (passedOut ? 8 : 0), 0, 100),
    doneToday: [],
    // На ніч Діма вдома; уранці Лєна кличе його знову, якщо хоче.
    dima: { mode: 'home', eta: null },
  };
  if (passedOut) events.push({ kind: 'toast', text: 'Заснула від утоми — прокинулась удома' });
  next = economyNight(next, events);

  const before = today(state);
  const after = today(next);
  if (after.week !== before.week) next = newYear(next, before, after, events);
  else if (!before.weekend && after.weekend && before.stage !== 'adult' && before.stage !== 'sadok') {
    events.push({ kind: 'card', text: 'Останній дзвоник! Попереду літо' });
  }
  if (after.week === PROPOSAL_WEEK && after.dow === 4 && next.flags.metDima && !next.flags.proposed) {
    events.push({ kind: 'story', text: 'Діма: «Лєно… а гайда до моря? В Одесу! Потяг із Вінниці — у суботу».' });
  }
  return { state: next, events };
}

function newYear(state: LifeState, before: DayInfo, after: DayInfo, events: LifeEvent[]): LifeState {
  let next = state;
  // Річна оцінка: пропущені дні рахуються слабкими.
  if (before.stage === 'school' || before.stage === 'uni') {
    const days = [...state.yearScores, ...Array(Math.max(0, 5 - state.yearScores.length)).fill(0.25)];
    const mark = markOf(meanOf(days));
    next = { ...next, marks: [...next.marks, { week: before.week, mark }] };
    events.push({ kind: 'card', text: before.stage === 'school' ? `${before.level} клас закінчено · середній бал ${mark}` : `${before.level} курс складено · ${mark} балів` });
  }
  next = { ...next, yearScores: [] };

  if (before.stage === 'school' && after.stage === 'uni') {
    next = withMilestone(next, 'graduation', events);
    next = withMilestone({ ...next, home: 'vinnytsia', homeName: 'Гуртожиток ВДПУ', city: 'vinnytsia', rent: 0 }, 'student', events);
    events.push({ kind: 'story', text: 'Випускний позаду. Вінниця, ВДПУ і гуртожиток — нове життя починається!' });
  }
  if (before.stage === 'uni' && after.stage === 'adult') {
    next = withMilestone(next, 'diploma', events);
    if (next.flags.metDima) {
      next = withMilestone({ ...next, homeName: 'Квартира на Вишеньці', rent: 700, flags: { ...next.flags, livingWithDima: true } }, 'together', events);
      events.push({ kind: 'story', text: 'Переїзд на Вишеньку: разом на роботу, разом додому.' });
    } else {
      next = { ...next, homeName: 'Орендована квартира', rent: 1100 };
      events.push({ kind: 'story', text: 'Диплом є — гуртожиток позаду. Тепер своя орендована квартира.' });
    }
    if (next.job && JOB_BY_ID.get(next.job.id)!.partTime) events.push({ kind: 'toast', text: 'Тепер можна шукати повну роботу — дошка вакансій у місті' });
  }

  // Гроші тижня.
  if (after.stage === 'sadok' || after.stage === 'school') {
    const pocket = 20 + after.week * 10;
    next = { ...next, money: next.money + pocket };
    events.push({ kind: 'toast', text: `Мама дала кишенькові: +${pocket} ₴` });
  } else if (after.stage === 'uni') {
    const lastMark = next.marks.at(-1)?.mark ?? 0;
    const grant = lastMark >= 10 ? 900 : 300;
    next = { ...next, money: next.money + grant };
    events.push({ kind: 'toast', text: lastMark >= 10 ? `Стипендія й мамина допомога: +${grant} ₴` : `Мама передала: +${grant} ₴` });
  }
  if (next.rent > 0) {
    const paid = Math.min(next.money, next.rent);
    next = { ...next, money: next.money - paid, mood: clamp(next.mood - (paid < next.rent ? 12 : 0), 0, 100) };
    events.push({ kind: 'toast', text: paid < next.rent ? `Оренда: не вистачило ${next.rent - paid} ₴ — тривожно` : `Оренда за тиждень: −${paid} ₴` });
  }
  next = economyWeek(next, after, events);
  return next;
}

// ------------------------------------------------------------
// Переїзд (доросле життя): оренда в будь-якому місті.
// ------------------------------------------------------------
export const RENT: Record<CityId, number> = {
  zhylyntsi: 0,
  pravdivka: 300,
  khmelnytskyi: 700,
  vinnytsia: 800,
  kyiv: 1600,
  lviv: 1200,
  odesa: 1300,
};

export function moveHome(state: LifeState, city: CityId): Outcome {
  if (studying(state)) throw new LifeRuleError('Переїзд — після диплома');
  if (state.city !== city) throw new LifeRuleError('Квартиру дивляться на місці');
  if (state.home === city) throw new LifeRuleError('Ти вже тут живеш');
  const rent = state.flags.livingWithDima ? Math.round(RENT[city] * 0.6) : RENT[city];
  if (state.money < rent) throw new LifeRuleError(`Потрібна застава ${rent} ₴`);
  const name = city === 'zhylyntsi' ? 'Хата в Жилинцях' : `Квартира: ${CITIES[city].name}`;
  return {
    state: { ...state, home: city, homeName: name, rent, money: state.money - rent, minute: state.minute + 60, layout: {} },
    events: [{ kind: 'card', text: `Новий дім: ${name}` }],
  };
}

// ------------------------------------------------------------
// Альбом: наскільки прожите життя повне.
// ------------------------------------------------------------
export function albumProgress(state: LifeState): { done: number; total: number } {
  const outfits = state.owned.filter((id) => itemById(id).kind === 'outfit').length;
  const souvenirs = state.owned.filter((id) => itemById(id).kind === 'souvenir').length;
  const done = state.milestones.length + state.photos.length + Math.min(outfits, 6) + Math.min(souvenirs, 4);
  return { done, total: MILESTONES.length + SIGHTS.length + 6 + 4 };
}
