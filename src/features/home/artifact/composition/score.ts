// ============================================================
// Composition Score — самооцінка зразка (Stage 10). Чисте вимірювання:
// нічого не мутує, працює лише з геометрією/ієрархією (жодних матеріалів).
// Кожна метрика — 0..1; total — зважена сума. Framework повторює
// оптимізацію один раз, якщо total нижчий за поріг конфіга.
// ============================================================
import type { ComposedBody } from './framework';

export interface CompositionScore {
  hierarchy: number;
  flow: number;
  silhouette: number;
  density: number;
  balance: number;
  rhythm: number;
  negativeSpace: number;
  realism: number;
  total: number;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const volumeOf = (b: ComposedBody): number => b.radius * b.radius * b.length;

/** Пік 1 у target, лінійний спад до 0 на ±width. */
const peak = (value: number, target: number, width: number): number =>
  clamp01(1 - Math.abs(value - target) / width);

export function scoreComposition(bodies: readonly ComposedBody[], sectorCount: number): CompositionScore {
  if (bodies.length === 0) {
    return { hierarchy: 0, flow: 0, silhouette: 0, density: 0, balance: 0, rhythm: 0, negativeSpace: 0, realism: 0, total: 0 };
  }

  // Ієрархія: король має ЧИТАТИСЬ — найвищий (стеля росту гарантує) І серед
  // наймасивніших. Порівнюємо з найбільшим НЕ-королем: висота — строго,
  // об'єм — досить 60% від найтовщого support'а (король виграє оптикою й
  // центральністю, не мусить бути найширшим).
  const king = bodies.find((b) => b.tier === 'king');
  const others = bodies.filter((b) => !b.primary);
  const maxOtherLen = Math.max(1e-6, ...others.map((b) => b.length));
  const maxOtherVol = Math.max(1e-6, ...others.map(volumeOf));
  const hierarchy = king
    ? clamp01(king.length / (maxOtherLen * 1.05)) * 0.6 + clamp01(volumeOf(king) / maxOtherVol / 0.6) * 0.4
    : 0;

  // Силует: направлена «маса» (довжина²·радіус по азимутних бінах вершин —
  // силует читають ВЕРШИНИ) має концентруватись у 1-3 лобах, не рівномірно
  // (зірка) і не в одному диску.
  const bins = 12;
  const hist = new Array<number>(bins).fill(0);
  for (const b of bodies) {
    const tip = { x: b.anchor.x + b.direction.x * b.length, z: b.anchor.z + b.direction.z * b.length };
    const az = Math.atan2(tip.z, tip.x) + Math.PI;
    hist[Math.min(bins - 1, Math.floor((az / (Math.PI * 2)) * bins))]! += b.length * b.length * b.radius;
  }
  const histTotal = hist.reduce((a, b) => a + b, 0) || 1;
  const histMax = Math.max(...hist) / histTotal;
  const silhouette = peak(histMax, 0.32, 0.28); // ~третина маси в головному лобі — виразно, але не монолітно

  // Щільність: контраст секторів (стандартне відхилення / середнє).
  const sectors = new Array<number>(sectorCount).fill(0);
  for (const b of bodies) {
    const az = Math.atan2(b.anchor.z, b.anchor.x) + Math.PI;
    sectors[Math.min(sectorCount - 1, Math.floor((az / (Math.PI * 2)) * sectorCount))]! += 1;
  }
  const mean = bodies.length / sectorCount;
  const std = Math.sqrt(sectors.reduce((acc, n) => acc + (n - mean) * (n - mean), 0) / sectorCount);
  const density = clamp01(std / Math.max(1e-6, mean) / 0.9);

  // Баланс: центр маси не повинен тікати далеко вбік від осі.
  let cx = 0;
  let cz = 0;
  let mass = 0;
  for (const b of bodies) {
    const v = volumeOf(b);
    cx += b.anchor.x * v;
    cz += b.anchor.z * v;
    mass += v;
  }
  const balance = clamp01(1 - Math.hypot(cx / (mass || 1), cz / (mass || 1)) / 0.45);

  // Ритм: коефіцієнт варіації довжин ОСНОВНИХ тіл (без мікропилу — той
  // навмисно крихітний і задер би варіацію) ~0.65 — «живе», не клони й не хаос.
  const lengths = bodies.filter((b) => b.role !== 'micro').map((b) => b.length);
  const lm = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const lstd = Math.sqrt(lengths.reduce((acc, l) => acc + (l - lm) * (l - lm), 0) / Math.max(1, lengths.length));
  const rhythm = peak(lstd / (lm || 1), 0.65, 0.5);

  // Повітря: 1-3 майже порожні сектори з 8 — композиція «дихає».
  const emptyish = sectors.filter((n) => n <= 1).length;
  const negativeSpace = peak(emptyish, 2, 2.5);

  // Потік: великий → середній → дрібний → мікро; квадранти мають накривати
  // маршрут (у кожному погляді є за чим «іти»).
  const quadrantTiers = new Map<number, Set<string>>();
  for (const b of bodies) {
    const q = (b.anchor.x >= 0 ? 1 : 0) + (b.anchor.z >= 0 ? 2 : 0);
    if (!quadrantTiers.has(q)) quadrantTiers.set(q, new Set());
    quadrantTiers.get(q)!.add(b.tier);
  }
  let flowAcc = 0;
  for (let q = 0; q < 4; q++) {
    const tiers = quadrantTiers.get(q) ?? new Set<string>();
    flowAcc += (tiers.has('king') || tiers.has('support') ? 0.5 : 0) + (tiers.has('family') ? 0.3 : 0) + (tiers.has('micro') ? 0.2 : 0);
  }
  const flow = clamp01(flowAcc / 4 / 0.75);

  // Геологічний реалізм: мало горизонтальних «шпаг», відчутна частка
  // немолодих тіл, наявний мікрошар.
  const horizontalShare = bodies.filter((b) => b.direction.y < 0.25).length / bodies.length;
  const microShare = bodies.filter((b) => b.role === 'micro').length / bodies.length;
  const realism = clamp01((1 - horizontalShare * 3) * 0.6 + clamp01(microShare / 0.12) * 0.4);

  const total =
    hierarchy * 0.18 +
    flow * 0.1 +
    silhouette * 0.16 +
    density * 0.12 +
    balance * 0.12 +
    rhythm * 0.1 +
    negativeSpace * 0.1 +
    realism * 0.12;

  return { hierarchy, flow, silhouette, density, balance, rhythm, negativeSpace, realism, total };
}
