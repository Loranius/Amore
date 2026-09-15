import {
  EVOLUTION_CHANNELS,
  stableHash32,
  type EvolutionChannel,
  type EvolutionPressureVector,
} from '../../evolution';
import { parseEvolutionInstant } from '../../evolution/calendar';

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function saturate(value: number, halfSaturation: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return round6(value / (value + halfSaturation));
}

export function vectorTotal(vector: EvolutionPressureVector): number {
  return EVOLUTION_CHANNELS.reduce((total, channel) => total + vector[channel], 0);
}

export function normalizedShares(vector: EvolutionPressureVector): EvolutionPressureVector {
  const total = vectorTotal(vector);
  if (total <= 0) {
    return {
      achievement: 0,
      remembrance: 0,
      exploration: 0,
      culture: 0,
      stability: 0,
      significance: 0,
    };
  }
  return {
    achievement: round6(vector.achievement / total),
    remembrance: round6(vector.remembrance / total),
    exploration: round6(vector.exploration / total),
    culture: round6(vector.culture / total),
    stability: round6(vector.stability / total),
    significance: round6(vector.significance / total),
  };
}

export function dominantChannel(
  vector: EvolutionPressureVector,
): { channel: EvolutionChannel | null; share: number } {
  const shares = normalizedShares(vector);
  let channel: EvolutionChannel | null = null;
  let share = 0;
  for (const candidate of EVOLUTION_CHANNELS) {
    if (shares[candidate] > share) {
      channel = candidate;
      share = shares[candidate];
    }
  }
  return { channel, share: round6(share) };
}

/** 0 = one channel dominates, 1 = all channels are balanced. */
export function channelEvenness(vector: EvolutionPressureVector): number {
  const shares = normalizedShares(vector);
  const entropy = EVOLUTION_CHANNELS.reduce((sum, channel) => {
    const value = shares[channel];
    return value > 0 ? sum - value * Math.log(value) : sum;
  }, 0);
  return round6(clamp01(entropy / Math.log(EVOLUTION_CHANNELS.length)));
}

export function seededUnit(seed: number, salt: string): number {
  let state = stableHash32(`${seed}\u001f${salt}`) >>> 0;
  state = (state + 0x6d2b79f5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}

export function stableSeed(seed: number, salt: string): number {
  return stableHash32(`${seed}\u001f${salt}`);
}

export function daysBetweenExplicit(earlier: string, later: string): number | null {
  const start = parseEvolutionInstant(earlier);
  const end = parseEvolutionInstant(later);
  if (start === null || end === null) return null;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function maturityAt(occurredAt: string, asOf: string, halfLifeDays: number): number {
  const ageDays = daysBetweenExplicit(occurredAt, asOf);
  if (ageDays === null || ageDays <= 0) return 0;
  return round6(clamp01(ageDays / (ageDays + halfLifeDays)));
}

/**
 * Затемнення в місці ДОТИКУ — те, чим виросле відрізняється від наклеєного.
 *
 * НАВІЩО. Кожне тіло рифа сидить на поверхні з твердим зрізом: немає ні
 * затемнення там, де воно торкається, ні переходу. Це остання й
 * найголовніша риса аплікації — **наклеєне видно по краю** (ADR-0195 §1.6).
 *
 * У природі так не буває з однієї фізичної причини: у щілину між тілом і
 * поверхнею світло майже не заходить. Тому основа будь-чого, що стоїть на
 * чомусь, темніша за середину — і око читає цю тінь як «воно тут росте».
 *
 * ЧОМУ ЗАПЕЧЕНЕ, А НЕ РАХОВАНЕ. Справжнє перекриття (SSAO) — це окремий
 * прохід пост-обробки на всю сцену; тут потрібне рівно те, що й так відоме
 * в мить побудови: наскільки далеко ця точка від підошви ВЛАСНОГО тіла.
 * Один множник у тон вершини коштує нуль трикутників, нуль викликів
 * малювання й нуль кадрового часу.
 *
 * ЧОМУ ТІНЬ ТАКА ДОВГА. У природі щілинна тінь коротка — частка висоти
 * тіла. Але тінь, яку не можуть передати вершини, стає не тінню, а
 * СХОДИНКОЮ: у коралового тіла всього чотири пояси профілю, тож перший із
 * них уже накриває чверть висоти. Тінь завдовжки 0.28 лягала б цілком
 * усередину одного пояса — і замість м'якого притемнення давала б стрибок
 * тону 36% між двома сусідніми кільцями, тобто рівно той твердий край,
 * проти якого вся ця робота й робиться.
 *
 * Тому досяжність задана НЕ фізикою, а кроком сітки: 0.55 кладе на схил
 * щонайменше два кільця в кожного тіла рифа. Той самий урок, що в ребра
 * кульки: **візерунок, дрібніший за вибірку, — це не візерунок, а шум.**
 *
 * @param along Частка висоти тіла, 0 при підошві.
 * @param depth Наскільки темна сама підошва: 0.25 означає −25%.
 * @param reach На якій частці висоти тінь сходить нанівець.
 */
export function reefContactShade(along: number, depth = 0.25, reach = 0.55): number {
  if (!Number.isFinite(along)) return 1;
  const safeReach = Math.max(1e-6, reach);
  /*
   * Квадратичне згасання, а не лінійне: тінь у щілині спадає швидко, і
   * лінійна дала б широку сіру смугу на пів тіла замість тіні при підошві.
   */
  const away = clamp01(along / safeReach);
  return 1 - depth * (1 - away) * (1 - away);
}
