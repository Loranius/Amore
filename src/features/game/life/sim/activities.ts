// ============================================================
// Заняття в містах: кожна локація має своє (власник, 2026-10-04: «додай
// трошки різноманіття в локації усі»).
// ------------------------------------------------------------
// Заняття — частина життя, а не міні-гра: воно коштує часу й сил, дає
// настрій, навичку, а часом гроші чи тепло з мамою. Що де робити —
// залежить від міста, пори року й часу доби, як у житті.
// ============================================================
import { DAY_END_MIN, type Season } from './calendar';
import type { CityId, SkillId } from './content';
import { LifeRuleError, today, type LifeState, type Outcome } from './life';
import { rngFor } from './rng';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface Activity {
  id: string;
  city: CityId;
  title: string;
  minutes: number;
  energy: number;
  mood: number;
  price?: number;
  skill?: SkillId;
  /** Скільки можна заробити (випадково від половини до повної суми). */
  earn?: number;
  /** Тепло з мамою (серця). */
  mom?: number;
  minWeek?: number;
  seasons?: readonly Season[];
  /** Лише з цієї години (вечірні заняття). */
  fromHour?: number;
  blurb: string;
}

export const ACTIVITIES: readonly Activity[] = [
  { id: 'garden', city: 'zhylyntsi', title: 'Город із мамою', minutes: 90, energy: 12, mood: 5, skill: 'sport', mom: 0.5, seasons: ['spring', 'summer', 'autumn'], blurb: 'Полоти, поливати, збирати — мама радіє' },
  // Садиба Лєни (власник, 2026-10-06): літня кухня, майстерня й сад.
  { id: 'summerKitchen', city: 'zhylyntsi', title: 'Літня кухня з мамою', minutes: 60, energy: 4, mood: 7, skill: 'creativity', mom: 0.4, seasons: ['spring', 'summer', 'autumn'], blurb: 'Вареники, компот і мамині історії' },
  { id: 'workshop', city: 'zhylyntsi', title: 'Майстерня', minutes: 90, energy: 8, mood: 5, skill: 'creativity', minWeek: 6, blurb: 'Полагодити стілець і змайструвати шпаківню' },
  { id: 'orchard', city: 'zhylyntsi', title: 'Збирати фрукти в саду', minutes: 60, energy: 8, mood: 8, earn: 80, seasons: ['summer', 'autumn'], blurb: 'Вишні, яблука, груші — частину на продаж' },
  { id: 'fishing', city: 'zhylyntsi', title: 'Рибалка на ставку', minutes: 60, energy: 4, mood: 9, minWeek: 3, blurb: 'Тиша, поплавок і качки поруч' },
  { id: 'mushrooms', city: 'pravdivka', title: 'По гриби в лісосмугу', minutes: 120, energy: 14, mood: 6, earn: 120, seasons: ['summer', 'autumn'], blurb: 'Повний кошик — частину можна продати' },
  { id: 'concert', city: 'khmelnytskyi', title: 'Вуличний концерт на Проскурівській', minutes: 60, energy: 3, mood: 12, skill: 'creativity', fromHour: 17, minWeek: 4, blurb: 'Марко грає до темряви' },
  { id: 'gym', city: 'vinnytsia', title: 'Спортзал', minutes: 90, energy: 18, mood: 6, price: 120, skill: 'sport', minWeek: 9, blurb: 'Тренування — і сили на весь тиждень' },
  { id: 'museum', city: 'kyiv', title: 'Музей історії України', minutes: 120, energy: 8, mood: 7, price: 100, skill: 'knowledge', blurb: 'Від трипільців до сьогодні' },
  { id: 'coffeeMine', city: 'lviv', title: 'Копальня кави', minutes: 60, energy: -10, mood: 10, price: 80, blurb: 'Кава в шахті, у касці — тільки у Львові' },
  { id: 'swim', city: 'odesa', title: 'Поплавати в морі', minutes: 90, energy: 10, mood: 14, skill: 'sport', seasons: ['summer'], blurb: 'Тепла хвиля й сіль на губах' },
];

export const ACTIVITY_BY_ID: ReadonlyMap<string, Activity> = new Map(ACTIVITIES.map((a) => [a.id, a]));

export type Check = { ok: true } | { ok: false; reason: string };

const SEASON_NAME: Record<Season, string> = { spring: 'навесні', summer: 'влітку', autumn: 'восени', winter: 'взимку' };

export function activityCheck(state: LifeState, id: string): Check {
  const a = ACTIVITY_BY_ID.get(id);
  if (!a) return { ok: false, reason: 'Невідоме заняття' };
  const info = today(state);
  if (state.city !== a.city) return { ok: false, reason: 'Це в іншому місті' };
  if (a.minWeek !== undefined && info.week < a.minWeek) return { ok: false, reason: 'Ще замала для цього' };
  if (a.seasons && !a.seasons.includes(info.season)) return { ok: false, reason: `Лише ${a.seasons.map((s) => SEASON_NAME[s]).join(' й ')}` };
  if (a.fromHour !== undefined && state.minute < a.fromHour * 60) return { ok: false, reason: `Починається о ${a.fromHour}:00` };
  if (state.doneToday.includes(`act:${id}`)) return { ok: false, reason: 'Сьогодні вже було' };
  if (a.price && state.money < a.price) return { ok: false, reason: `Треба ${a.price} ₴` };
  if (a.energy > 0 && state.energy < a.energy + 4) return { ok: false, reason: 'Сил замало' };
  if (state.minute + a.minutes > DAY_END_MIN - 30) return { ok: false, reason: 'Пізно — завтра' };
  return { ok: true };
}

export function doActivity(state: LifeState, id: string): Outcome {
  const check = activityCheck(state, id);
  if (!check.ok) throw new LifeRuleError(check.reason);
  const a = ACTIVITY_BY_ID.get(id)!;
  const earned = a.earn ? Math.round((a.earn * (0.5 + 0.5 * rngFor(state.seed, 'act', id, state.day)())) / 10) * 10 : 0;
  const skills = a.skill ? { ...state.skills, [a.skill]: clamp(state.skills[a.skill] + 1, 0, 100) } : state.skills;
  return {
    state: {
      ...state,
      money: state.money - (a.price ?? 0) + earned,
      minute: state.minute + a.minutes,
      energy: clamp(state.energy - a.energy, 0, 100),
      mood: clamp(state.mood + a.mood, 0, 100),
      skills,
      hearts: a.mom ? { ...state.hearts, mom: clamp(state.hearts.mom + a.mom, 0, 10) } : state.hearts,
      doneToday: [...state.doneToday, `act:${id}`],
    },
    events: [{ kind: 'toast', text: earned ? `${a.title}: +${earned} ₴` : a.title }],
  };
}
