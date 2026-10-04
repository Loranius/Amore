// ============================================================
// Сейв «Дєвочка в городі» (ADR-0239): JSON у сховищі браузера.
// ------------------------------------------------------------
// Прогрес гри — особистий для пристрою, як збереження в будь-якій грі;
// у базу він не пишеться. Читання сейву перевіряє кожне поле: пошкоджений
// сейв не підмішується мовчки до нового життя, а повертається помилкою, і
// гра питає, що з ним робити.
// ============================================================
import { CITY_IDS, ITEM_BY_ID, JOB_BY_ID, SIGHTS, type CityId, type DecorSlot } from './content';
import { RESIDENT_BY_ID } from './people';
import { BUSINESS_BY_ID, DEFAULT_SPOT, PROPERTY_BY_ID, type BusinessId } from './economy';
import { MILESTONE_BY_ID, SAVE_VERSION, type LifeState } from './life';

export const SAVE_KEY = 'amore:game:life:v1';

export class SaveError extends Error {}

export function serialize(state: LifeState): string {
  return JSON.stringify(state);
}

function fail(field: string): never {
  throw new SaveError(`Сейв пошкоджено: поле «${field}»`);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, field: string, lo = -Infinity, hi = Infinity): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) fail(field);
  return v;
};
const strList = (v: unknown, field: string, valid: (s: string) => boolean): string[] => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !valid(x))) fail(field);
  return [...(v as string[])];
};
const city = (v: unknown, field: string): CityId => {
  if (typeof v !== 'string' || !(CITY_IDS as string[]).includes(v)) fail(field);
  return v as CityId;
};

function parseBusinesses(v: unknown): LifeState['businesses'] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail('businesses');
  return v.map((b, i) => {
    if (!isObj(b) || typeof b.id !== 'string' || !BUSINESS_BY_ID.has(b.id as BusinessId)) fail(`businesses.${i}`);
    const level = num(b.level, `businesses.${i}.level`, 1, 3);
    if (!Number.isInteger(level)) fail(`businesses.${i}.level`);
    return { id: b.id as BusinessId, level: level as 1 | 2 | 3, visited: num(b.visited, `businesses.${i}.visited`, 0, 100000) };
  });
}

function parseLayout(v: unknown): LifeState['layout'] {
  if (v === undefined) return {};
  if (!isObj(v)) fail('layout');
  const out: LifeState['layout'] = {};
  for (const [slot, at] of Object.entries(v)) {
    if (!(slot in DEFAULT_SPOT) || !Array.isArray(at) || at.length !== 2) fail(`layout.${slot}`);
    out[slot as DecorSlot] = [num(at[0], `layout.${slot}`, 0, 16), num(at[1], `layout.${slot}`, 0, 12)];
  }
  return out;
}

function parsePeople(v: unknown): LifeState['people'] {
  if (v === undefined) return {};
  if (!isObj(v)) fail('people');
  const out: LifeState['people'] = {};
  for (const [id, level] of Object.entries(v)) {
    if (!RESIDENT_BY_ID.has(id)) fail(`people.${id}`);
    out[id] = num(level, `people.${id}`, 0, 10);
  }
  return out;
}

function parseDima(v: unknown): LifeState['dima'] {
  if (v === undefined) return { mode: 'home', eta: null };
  if (!isObj(v) || (v.mode !== 'home' && v.mode !== 'follow')) fail('dima');
  const eta = v.eta === null ? null : num(v.eta, 'dima.eta', 0, 30 * 60);
  return { mode: v.mode, eta };
}

export function parseSave(text: string): LifeState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('Сейв пошкоджено: не JSON');
  }
  if (!isObj(raw)) fail('корінь');
  // Версія 1 — до Діми-супутника: читається, нові поля беруть типові
  // значення. Нові поля й далі додаються так само, без втрати життя.
  if (raw.version !== SAVE_VERSION && raw.version !== 1) throw new SaveError(`Сейв іншої версії: ${String(raw.version)}`);
  const skills = isObj(raw.skills) ? raw.skills : fail('skills');
  const hearts = isObj(raw.hearts) ? raw.hearts : fail('hearts');
  const flags = isObj(raw.flags) ? raw.flags : fail('flags');
  const decor = isObj(raw.decor) ? raw.decor : fail('decor');
  const bool = (v: unknown, f: string) => (typeof v === 'boolean' ? v : fail(f));
  const job = raw.job === null ? null : isObj(raw.job) && typeof raw.job.id === 'string' && JOB_BY_ID.has(raw.job.id)
    ? { id: raw.job.id, rank: num(raw.job.rank, 'job.rank', 0, 5), shifts: num(raw.job.shifts, 'job.shifts', 0) }
    : fail('job');
  if (raw.outfit !== null && (typeof raw.outfit !== 'string' || !ITEM_BY_ID.has(raw.outfit))) fail('outfit');
  if (typeof raw.homeName !== 'string') fail('homeName');
  if (!Array.isArray(raw.yearScores)) fail('yearScores');
  if (!Array.isArray(raw.marks) || raw.marks.some((m) => !isObj(m) || typeof m.week !== 'number' || typeof m.mark !== 'number')) fail('marks');
  const decorOut: LifeState['decor'] = {};
  for (const [slot, id] of Object.entries(decor)) {
    if (typeof id !== 'string' || ITEM_BY_ID.get(id)?.decor !== slot) fail(`decor.${slot}`);
    decorOut[slot as keyof LifeState['decor']] = id;
  }
  return {
    version: SAVE_VERSION,
    seed: num(raw.seed, 'seed', 0, 2 ** 32),
    day: num(raw.day, 'day', 0, 100000),
    minute: num(raw.minute, 'minute', 0, 26 * 60),
    city: city(raw.city, 'city'),
    home: city(raw.home, 'home'),
    homeName: raw.homeName,
    rent: num(raw.rent, 'rent', 0),
    money: num(raw.money, 'money', 0),
    energy: num(raw.energy, 'energy', 0, 100),
    mood: num(raw.mood, 'mood', 0, 100),
    skills: {
      knowledge: num(skills.knowledge, 'skills.knowledge', 0, 100),
      creativity: num(skills.creativity, 'skills.creativity', 0, 100),
      sport: num(skills.sport, 'skills.sport', 0, 100),
      charm: num(skills.charm, 'skills.charm', 0, 100),
    },
    hearts: {
      mom: num(hearts.mom, 'hearts.mom', 0, 10),
      dima: num(hearts.dima, 'hearts.dima', 0, 10),
      friend: num(hearts.friend, 'hearts.friend', 0, 10),
    },
    outfit: raw.outfit as string | null,
    owned: strList(raw.owned, 'owned', (id) => ITEM_BY_ID.has(id)),
    decor: decorOut,
    gifts: strList(raw.gifts, 'gifts', (id) => ITEM_BY_ID.get(id)?.kind === 'gift'),
    photos: strList(raw.photos, 'photos', (id) => SIGHTS.some((s) => s.id === id)),
    milestones: strList(raw.milestones, 'milestones', (id) => MILESTONE_BY_ID.has(id)),
    job,
    yearScores: (raw.yearScores as unknown[]).map((s, i) => num(s, `yearScores.${i}`, 0, 1)),
    marks: (raw.marks as { week: number; mark: number }[]).map((m) => ({ week: m.week, mark: m.mark })),
    flags: {
      metDima: bool(flags.metDima, 'flags.metDima'),
      livingWithDima: bool(flags.livingWithDima, 'flags.livingWithDima'),
      proposed: bool(flags.proposed, 'flags.proposed'),
      lyceumVisit: bool(flags.lyceumVisit, 'flags.lyceumVisit'),
    },
    doneToday: strList(raw.doneToday, 'doneToday', () => true),
    dima: parseDima(raw.dima),
    // Нові поля (2026-10-04): сейв без них — до справ, житла й облаштування.
    businesses: parseBusinesses(raw.businesses),
    properties: raw.properties === undefined ? [] : strList(raw.properties, 'properties', (id) => PROPERTY_BY_ID.has(id)),
    layout: parseLayout(raw.layout),
    people: parsePeople(raw.people),
  };
}
