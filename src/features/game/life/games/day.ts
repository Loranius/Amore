// ============================================================
// Розклад дня «Життя Лєни» (ADR-0239): що саме сьогодні в садочку,
// які уроки, яка перерва, яка зміна. Кості — від сейву, тижня й дня:
// той самий день у того самого сейву завжди однаковий, а два сусідні —
// різні. Фізкультура — щонайменше раз на тиждень.
// ============================================================
import { JOB_BY_ID } from '../sim/content';
import { dutyToday, today, type LifeState } from '../sim/life';
import { rngFor, shuffled } from '../sim/rng';
import type { Look } from '../render/people';
import type { GameContext, MiniGame } from './kit';
import { SUBJECT_NAME, lessonGame, subjectsFor, type Subject } from './lessons';
import { PLAYGROUND } from './playground';
import { shiftGame } from './work';

export interface PlannedGame {
  kind: 'playground' | 'lesson' | 'shift';
  id: string;
  title: string;
  level: number;
  /** Причина кидка костей для цієї гри. */
  key: string;
}

export const PLAYGROUND_NAME: Record<string, string> = {
  rope: 'Скакалка', classics: 'Класики', hide: 'Хованки', ball: 'М\'яч у кошик', memory: 'Пам\'ять',
  tower: 'Башта з кубиків', butterflies: 'Метелики', shapes: 'Фігури', simon: 'Хоровод',
};

const TEEN_RECESS = ['ball', 'memory', 'simon', 'tower', 'hide'];

function playgroundFor(state: LifeState, n: number, salt: string, pool: readonly string[]): string[] {
  const info = today(state);
  // Учорашні ігри — в кінець черги, щоб два дні поспіль не були однакові.
  const yesterday = info.day > 0 ? shuffled(rngFor(state.seed, salt, info.day - 1), pool).slice(0, n) : [];
  const order = shuffled(rngFor(state.seed, salt, info.day), pool);
  return [...order.filter((g) => !yesterday.includes(g)), ...order.filter((g) => yesterday.includes(g))].slice(0, n);
}

export function dayPlan(state: LifeState): PlannedGame[] {
  const duty = dutyToday(state);
  const info = today(state);
  if (!duty) return [];
  if (duty.kind === 'sadok') {
    return playgroundFor(state, 3, 'sadok', Object.keys(PLAYGROUND)).map((id, k) => ({ kind: 'playground', id, title: PLAYGROUND_NAME[id]!, level: 0, key: `sadok:${info.day}:${k}` }));
  }
  if (duty.kind === 'school') {
    const subjects = shuffled(rngFor(state.seed, 'timetable', info.week), subjectsFor(info.level));
    // Фізкультура — у середу, якщо в цьому класі вона є.
    const pick: Subject[] = [];
    for (let k = 0; pick.length < 3 && k < subjects.length * 2; k += 1) {
      const s = subjects[(info.dow * 3 + k) % subjects.length]!;
      if (!pick.includes(s)) pick.push(s);
    }
    if (info.dow === 2 && subjects.includes('pe') && !pick.includes('pe')) pick[2] = 'pe';
    const lessons: PlannedGame[] = pick.map((s, k) => ({ kind: 'lesson', id: s, title: SUBJECT_NAME[s], level: info.level, key: `school:${info.day}:${k}` }));
    const recessPool = info.level <= 4 ? Object.keys(PLAYGROUND) : TEEN_RECESS;
    const recess = playgroundFor(state, 1, 'recess', recessPool)[0]!;
    lessons.splice(2, 0, { kind: 'playground', id: recess, title: `Перерва: ${PLAYGROUND_NAME[recess]}`, level: info.level, key: `recess:${info.day}` });
    return lessons;
  }
  if (duty.kind === 'uni') {
    const level = 11 + info.level;
    const subjects = shuffled(rngFor(state.seed, 'uni', info.week), subjectsFor(level));
    const pairs: Subject[] = info.dow === 2 || info.dow === 4 ? ['exam', subjects[info.dow % subjects.length]!] : [subjects[info.dow % subjects.length]!, subjects[(info.dow + 1) % subjects.length]!];
    return pairs.map((s, k) => ({ kind: 'lesson', id: s, title: s === 'exam' ? (info.dow === 2 ? 'Зимова сесія' : 'Літня сесія') : SUBJECT_NAME[s], level, key: `uni:${info.day}:${k}` }));
  }
  const job = JOB_BY_ID.get(state.job!.id)!;
  return [{ kind: 'shift', id: job.game, title: job.title, level: state.job!.rank, key: `shift:${info.day}` }];
}

export function makeGame(state: LifeState, plan: PlannedGame, lena: Look): MiniGame {
  const ctx: GameContext = { rng: rngFor(state.seed, plan.key), level: plan.level, lena };
  if (plan.kind === 'playground') return PLAYGROUND[plan.id]!(ctx);
  if (plan.kind === 'lesson') return lessonGame(plan.id as Subject, ctx);
  return shiftGame(plan.id, ctx);
}

/** Вільна гра у дворі з друзями (не обов'язок): одна гра з садочкових. */
export function friendsGame(state: LifeState, lena: Look): { plan: PlannedGame; game: MiniGame } {
  const info = today(state);
  const id = playgroundFor(state, 1, 'friends', info.week <= 4 ? Object.keys(PLAYGROUND) : TEEN_RECESS)[0]!;
  const plan: PlannedGame = { kind: 'playground', id, title: PLAYGROUND_NAME[id]!, level: Math.max(0, info.level), key: `friends:${info.day}` };
  return { plan, game: makeGame(state, plan, lena) };
}
