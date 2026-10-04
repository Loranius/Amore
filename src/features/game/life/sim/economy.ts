// ============================================================
// Гроші поза роботою: інтернет, власна справа, нерухомість, облаштування.
// ------------------------------------------------------------
// Власник, 2026-10-04: «додай можливість заробляти гроші вдома через
// інтернет, відкривати свою справу (3 справи буде достатньо), облаштовувати
// будинок, купляти нерухомість у різних місцях… симуляція життя на рівні
// Сімс, але все крутиться навколо Лєни».
//
// Логіка світу, а не лічильники:
//   * інтернет — це ноутбук удома, і робота за навичками Лєни;
//   * справа — у своєму місті: її відкривають на місці, розвивають і
//     навідуються; без хазяйки вона приносить удвічі менше;
//   * своє житло — без оренди; порожнє можна здавати;
//   * меблі в кімнаті переставляються, і кімната — Лєнина.
// Лише чисті функції; кості — `rngFor` із причиною.
// ============================================================
import { DAY_END_MIN, type DayInfo } from './calendar';
import { CITIES, type CityId, type DecorSlot, type SkillId } from './content';
import { LifeRuleError, today, type LifeEvent, type LifeState, type Outcome } from './life';
import { rngFor } from './rng';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const toTen = (v: number) => Math.round(v / 10) * 10;

/** Із цього тижня життя Лєна — доросла (після диплома). */
const ADULT_WEEK = 16;

function adult(state: LifeState): boolean {
  return today(state).week >= ADULT_WEEK;
}

// ------------------------------------------------------------
// Інтернет-заробіток.
// ------------------------------------------------------------
export type GigId = 'texts' | 'design' | 'smm' | 'tutor';

export interface Gig {
  id: GigId;
  title: string;
  skill: SkillId;
  need: number;
  base: number;
  minutes: number;
  energy: number;
  /** Лише з дипломом. */
  diploma?: boolean;
  blurb: string;
}

export const GIGS: readonly Gig[] = [
  { id: 'texts', title: 'Тексти для сайтів', skill: 'knowledge', need: 15, base: 260, minutes: 120, energy: 12, blurb: 'Описи товарів і новини для місцевих сайтів' },
  { id: 'design', title: 'Дизайн постів', skill: 'creativity', need: 15, base: 300, minutes: 120, energy: 12, blurb: 'Листівки, сторіз і банери на замовлення' },
  { id: 'smm', title: 'Соцмережі для кав\'ярні', skill: 'charm', need: 20, base: 340, minutes: 150, energy: 14, blurb: 'Фото, підписи й відповіді клієнтам' },
  { id: 'tutor', title: 'Онлайн-репетиторка', skill: 'knowledge', need: 40, base: 450, minutes: 120, energy: 16, diploma: true, blurb: 'Уроки по відеозв\'язку для школярів' },
];

export const GIGS_PER_DAY = 2;

export type Check = { ok: true } | { ok: false; reason: string };

/** Скільки принесе замовлення сьогодні: навичка підіймає ціну. */
export function gigPay(state: LifeState, gig: Gig): number {
  const r = rngFor(state.seed, 'gig', gig.id, state.day)();
  return toTen(gig.base * (0.75 + state.skills[gig.skill] / 100) * (0.9 + 0.2 * r));
}

export function gigCheck(state: LifeState, gig: Gig): Check {
  if (!state.owned.includes('laptop')) return { ok: false, reason: 'Потрібен ноутбук — у «Техніці»' };
  if (state.city !== state.home) return { ok: false, reason: 'Працювати онлайн — удома' };
  if (gig.diploma && !adult(state)) return { ok: false, reason: 'Після диплома' };
  if (state.skills[gig.skill] < gig.need) return { ok: false, reason: `Треба ${gig.need}+ навички` };
  if (state.doneToday.filter((d) => d === 'gig').length >= GIGS_PER_DAY) return { ok: false, reason: 'На сьогодні досить екрана' };
  if (state.energy < gig.energy + 4) return { ok: false, reason: 'Сил замало — поїж або відпочинь' };
  if (state.minute + gig.minutes > DAY_END_MIN - 60) return { ok: false, reason: 'Пізно — завтра' };
  return { ok: true };
}

export function doGig(state: LifeState, id: GigId): Outcome {
  const gig = GIGS.find((g) => g.id === id);
  if (!gig) throw new LifeRuleError(`Невідоме замовлення: ${id}`);
  const check = gigCheck(state, gig);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const pay = gigPay(state, gig);
  const events: LifeEvent[] = [{ kind: 'toast', text: `${gig.title}: +${pay} ₴` }];
  let next: LifeState = {
    ...state,
    money: state.money + pay,
    minute: state.minute + gig.minutes,
    energy: clamp(state.energy - gig.energy, 0, 100),
    skills: { ...state.skills, [gig.skill]: clamp(state.skills[gig.skill] + 1, 0, 100) },
    doneToday: [...state.doneToday, 'gig'],
  };
  if (!next.milestones.includes('firstMoney')) {
    next = { ...next, milestones: [...next.milestones, 'firstMoney'] };
    events.push({ kind: 'milestone', id: 'firstMoney', text: 'Перші заробітки' });
  }
  return { state: next, events };
}

// ------------------------------------------------------------
// Своя справа.
// ------------------------------------------------------------
export type BusinessId = 'cafe' | 'flowers' | 'shop';

export interface Business {
  id: BusinessId;
  name: string;
  /** Де відкривається; `null` — онлайн, з ноутбука вдома. */
  city: CityId | null;
  open: number;
  /** Ціна переходу на рівень 2 і 3. */
  upgrade: readonly [number, number];
  /** Дохід за ніч на рівнях 1–3. */
  income: readonly [number, number, number];
  /** Що росте, коли навідуєшся. */
  grows: SkillId;
  blurb: string;
  levels: readonly [string, string, string];
}

export const BUSINESSES: readonly Business[] = [
  {
    id: 'cafe', name: 'Кав\'ярня «Бубоси»', city: 'vinnytsia', open: 24000, upgrade: [16000, 28000], income: [600, 1050, 1700], grows: 'charm',
    blurb: 'Маленька кав\'ярня біля Вишеньки: капучино з корицею й чізкейк',
    levels: ['Віконце з кавою', 'Кав\'ярня на шість столиків', 'Улюблене місце району'],
  },
  {
    id: 'flowers', name: 'Квіткова крамниця', city: 'khmelnytskyi', open: 14000, upgrade: [10000, 18000], income: [380, 700, 1150], grows: 'creativity',
    blurb: 'Букети, вазони й доставка на Проскурівській',
    levels: ['Кіоск із букетами', 'Крамниця з доставкою', 'Флористична студія'],
  },
  {
    id: 'shop', name: 'Інтернет-магазин хендмейду', city: null, open: 5000, upgrade: [7000, 14000], income: [220, 460, 820], grows: 'creativity',
    blurb: 'Прикраси й листівки ручної роботи — замовлення з усієї України',
    levels: ['Сторінка в соцмережі', 'Свій сайт', 'Бренд із постійними клієнтами'],
  },
];

export const BUSINESS_BY_ID: ReadonlyMap<BusinessId, Business> = new Map(BUSINESSES.map((b) => [b.id, b]));

export interface OwnedBusiness {
  id: BusinessId;
  level: 1 | 2 | 3;
  /** День, коли Лєна востаннє навідувалась. */
  visited: number;
}

/** Без нагляду довше за стільки днів — справа приносить половину. */
export const BUSINESS_NEGLECT_DAYS = 3;

function business(id: BusinessId): Business {
  const b = BUSINESS_BY_ID.get(id);
  if (!b) throw new LifeRuleError(`Невідома справа: ${id}`);
  return b;
}

/** Чи Лєна там, де справу можна вести: у її місті, а онлайн — удома з ноутбуком. */
function atBusiness(state: LifeState, b: Business): Check {
  if (b.city === null) {
    if (!state.owned.includes('laptop')) return { ok: false, reason: 'Потрібен ноутбук' };
    if (state.city !== state.home) return { ok: false, reason: 'Магазин ведеться з дому' };
    return { ok: true };
  }
  if (state.city !== b.city) return { ok: false, reason: `Справа — у місті ${CITIES[b.city].name}` };
  return { ok: true };
}

export function openBusinessCheck(state: LifeState, id: BusinessId): Check {
  const b = business(id);
  if (state.businesses.some((x) => x.id === id)) return { ok: false, reason: 'Уже твоя' };
  if (b.city !== null && !adult(state)) return { ok: false, reason: 'Своя справа — після диплома' };
  if (b.city === null && today(state).week < 12) return { ok: false, reason: 'Зі студентських років' };
  const at = atBusiness(state, b);
  if (!at.ok) return at;
  if (state.money < b.open) return { ok: false, reason: `Потрібно ${b.open} ₴` };
  return { ok: true };
}

export function openBusiness(state: LifeState, id: BusinessId): Outcome {
  const check = openBusinessCheck(state, id);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const b = business(id);
  return {
    state: {
      ...state,
      money: state.money - b.open,
      minute: state.minute + 90,
      mood: clamp(state.mood + 12, 0, 100),
      businesses: [...state.businesses, { id, level: 1, visited: state.day }],
    },
    events: [{ kind: 'card', text: `Відкрито: ${b.name}` }],
  };
}

export function manageCheck(state: LifeState, id: BusinessId): Check {
  const b = business(id);
  if (!state.businesses.some((x) => x.id === id)) return { ok: false, reason: 'Спершу відкрий' };
  const at = atBusiness(state, b);
  if (!at.ok) return at;
  if (state.doneToday.includes(`biz:${id}`)) return { ok: false, reason: 'Сьогодні вже навідувалась' };
  if (state.energy < 12) return { ok: false, reason: 'Сил замало' };
  if (state.minute + 90 > DAY_END_MIN - 60) return { ok: false, reason: 'Пізно — завтра' };
  return { ok: true };
}

/** Навідатись у справу: пів денного доходу одразу, навичка, і справа знову під наглядом. */
export function manageBusiness(state: LifeState, id: BusinessId): Outcome {
  const check = manageCheck(state, id);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const b = business(id);
  const owned = state.businesses.find((x) => x.id === id)!;
  const cash = toTen(b.income[owned.level - 1]! * 0.5);
  return {
    state: {
      ...state,
      money: state.money + cash,
      minute: state.minute + 90,
      energy: clamp(state.energy - 10, 0, 100),
      skills: { ...state.skills, [b.grows]: clamp(state.skills[b.grows] + 1, 0, 100) },
      businesses: state.businesses.map((x) => (x.id === id ? { ...x, visited: state.day } : x)),
      doneToday: [...state.doneToday, `biz:${id}`],
    },
    events: [{ kind: 'toast', text: `${b.name}: каса +${cash} ₴` }],
  };
}

export function upgradeCheck(state: LifeState, id: BusinessId): Check {
  const b = business(id);
  const owned = state.businesses.find((x) => x.id === id);
  if (!owned) return { ok: false, reason: 'Спершу відкрий' };
  if (owned.level >= 3) return { ok: false, reason: 'Найвищий рівень' };
  const at = atBusiness(state, b);
  if (!at.ok) return at;
  const price = b.upgrade[owned.level - 1]!;
  if (state.money < price) return { ok: false, reason: `Потрібно ${price} ₴` };
  return { ok: true };
}

export function upgradeBusiness(state: LifeState, id: BusinessId): Outcome {
  const check = upgradeCheck(state, id);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const b = business(id);
  const owned = state.businesses.find((x) => x.id === id)!;
  const level = (owned.level + 1) as 2 | 3;
  return {
    state: {
      ...state,
      money: state.money - b.upgrade[owned.level - 1]!,
      mood: clamp(state.mood + 8, 0, 100),
      businesses: state.businesses.map((x) => (x.id === id ? { ...x, level, visited: state.day } : x)),
    },
    events: [{ kind: 'card', text: `${b.name}: ${b.levels[level - 1]}` }],
  };
}

/** Скільки справа принесе за ніч. */
export function businessNight(state: LifeState, owned: OwnedBusiness): number {
  const b = business(owned.id);
  const neglected = state.day - owned.visited > BUSINESS_NEGLECT_DAYS;
  const r = rngFor(state.seed, 'biz', owned.id, state.day)();
  return toTen(b.income[owned.level - 1]! * (neglected ? 0.5 : 1) * (0.85 + 0.3 * r));
}

// ------------------------------------------------------------
// Нерухомість.
// ------------------------------------------------------------
export interface Property {
  id: string;
  city: CityId;
  name: string;
  price: number;
  /** Скільки приносить за тиждень, якщо здавати. */
  rentOut: number;
  blurb: string;
}

export const PROPERTIES: readonly Property[] = [
  { id: 'houseZhyl', city: 'zhylyntsi', name: 'Свій будинок у Жилинцях', price: 16000, rentOut: 250, blurb: 'Біля ставка, з садом і верандою' },
  { id: 'flatKhm', city: 'khmelnytskyi', name: 'Квартира в Хмельницькому', price: 26000, rentOut: 550, blurb: 'Дві кімнати біля Проскурівської' },
  { id: 'flatVin', city: 'vinnytsia', name: 'Своя квартира на Вишеньці', price: 30000, rentOut: 650, blurb: 'Та сама Вишенька — але своя' },
  { id: 'flatLviv', city: 'lviv', name: 'Квартира у Львові', price: 42000, rentOut: 950, blurb: 'Старий будинок, високі стелі, бруківка під вікном' },
  { id: 'flatOdesa', city: 'odesa', name: 'Квартира біля моря', price: 48000, rentOut: 1150, blurb: 'Десять хвилин до Отради' },
  { id: 'flatKyiv', city: 'kyiv', name: 'Квартира в Києві', price: 58000, rentOut: 1350, blurb: 'Новобудова з видом на Дніпро' },
];

export const PROPERTY_BY_ID: ReadonlyMap<string, Property> = new Map(PROPERTIES.map((p) => [p.id, p]));

function property(id: string): Property {
  const p = PROPERTY_BY_ID.get(id);
  if (!p) throw new LifeRuleError(`Невідоме житло: ${id}`);
  return p;
}

/** Чи Лєна зараз живе в цьому своєму житлі. */
export function livesIn(state: LifeState, id: string): boolean {
  return state.homeName === property(id).name;
}

export function buyPropertyCheck(state: LifeState, id: string): Check {
  const p = property(id);
  if (state.properties.includes(id)) return { ok: false, reason: 'Уже твоє' };
  if (!adult(state)) return { ok: false, reason: 'Купівля — після диплома' };
  if (state.city !== p.city) return { ok: false, reason: `Житло дивляться на місці: ${CITIES[p.city].name}` };
  if (state.money < p.price) return { ok: false, reason: `Потрібно ${p.price} ₴` };
  return { ok: true };
}

export function buyProperty(state: LifeState, id: string): Outcome {
  const check = buyPropertyCheck(state, id);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const p = property(id);
  return {
    state: { ...state, money: state.money - p.price, minute: state.minute + 60, mood: clamp(state.mood + 15, 0, 100), properties: [...state.properties, id] },
    events: [{ kind: 'card', text: `Своє житло: ${p.name}` }],
  };
}

/** Переїхати у своє: оренди немає, меблі розставляються заново. */
export function moveToOwned(state: LifeState, id: string): Outcome {
  const p = property(id);
  if (!state.properties.includes(id)) throw new LifeRuleError('Це житло ще не твоє');
  if (livesIn(state, id)) throw new LifeRuleError('Ти вже тут живеш');
  if (state.city !== p.city) throw new LifeRuleError(`Переїзд — на місці: ${CITIES[p.city].name}`);
  return {
    state: { ...state, home: p.city, homeName: p.name, rent: 0, layout: {}, minute: state.minute + 60 },
    events: [{ kind: 'card', text: `Новий дім: ${p.name}` }],
  };
}

/** Дохід за тиждень від здаваного житла (усе своє, крім того, де живеш). */
export function rentIncome(state: LifeState): number {
  return state.properties.filter((id) => !livesIn(state, id)).reduce((sum, id) => sum + property(id).rentOut, 0);
}

// ------------------------------------------------------------
// Облаштування дому: меблі переставляються.
// ------------------------------------------------------------
/** Межі підлоги кімнати (клітинки), де можна ставити меблі. */
export const ROOM_FLOOR = { x0: 1, x1: 14, y0: 3, y1: 9 } as const;

/** Типове місце кожної речі — як було до облаштування. */
export const DEFAULT_SPOT: Record<DecorSlot, [number, number]> = {
  bed: [2, 3], rug: [6, 7], plant: [1, 8], lamp: [14, 8], poster: [7, 0.6], shelf: [11, 3.6], tv: [12, 7], pet: [9, 8.6], table: [2, 8], desk: [8, 3.6], sofa: [9, 3.6],
};

/** Стінні речі (постер) рухаються лише вздовж стіни. */
const WALL: readonly DecorSlot[] = ['poster'];

export function spotOf(state: LifeState, slot: DecorSlot): [number, number] {
  return state.layout[slot] ?? DEFAULT_SPOT[slot];
}

export function moveFurniture(state: LifeState, slot: DecorSlot, dx: number, dy: number): LifeState {
  if (!state.decor[slot] && slot !== 'bed') throw new LifeRuleError('Цієї речі в кімнаті немає');
  const [x, y] = spotOf(state, slot);
  const nx = clamp(x + dx, ROOM_FLOOR.x0, ROOM_FLOOR.x1);
  const ny = WALL.includes(slot) ? y : clamp(y + dy, ROOM_FLOOR.y0, ROOM_FLOOR.y1);
  return { ...state, layout: { ...state.layout, [slot]: [nx, ny] } };
}

// ------------------------------------------------------------
// Ніч і тиждень: що приносять справи й житло.
// ------------------------------------------------------------
/** Щоночі: дохід справ. Викликається зі `sleep`. */
export function economyNight(state: LifeState, events: LifeEvent[]): LifeState {
  if (state.businesses.length === 0) return state;
  const total = state.businesses.reduce((sum, b) => sum + businessNight(state, b), 0);
  const neglected = state.businesses.filter((b) => state.day - b.visited > BUSINESS_NEGLECT_DAYS).map((b) => business(b.id).name);
  events.push({ kind: 'toast', text: `Справи за день: +${total} ₴` });
  if (neglected.length) events.push({ kind: 'toast', text: `Без хазяйки — пів доходу: ${neglected.join(', ')}` });
  return { ...state, money: state.money + total };
}

/** Щотижня: оренда від здаваного житла. Викликається на зміні тижня. */
export function economyWeek(state: LifeState, _after: DayInfo, events: LifeEvent[]): LifeState {
  const income = rentIncome(state);
  if (income <= 0) return state;
  events.push({ kind: 'toast', text: `Квартиранти заплатили: +${income} ₴` });
  return { ...state, money: state.money + income };
}
