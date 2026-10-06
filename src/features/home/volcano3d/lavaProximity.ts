/**
 * Світло рік на схилі (ADR-0246): для кожної вершини каменю — близькість до
 * найближчої точки ріки (0…1, гаусом від відстані) і `flow` тієї точки.
 * Шейдер каменю засвічує схил лише там, де ріка вже дотекла, тож світло біжить
 * разом із фронтом лави. Точки чаші (`flow < 0`) — не ріки, вони не світять.
 * Рахується раз на геометрію: ~600 вершин × ~300 точок рік.
 */
export function lavaProximity(rock: Float32Array, lava: Float32Array, flow: Float32Array, reach: number): Float32Array {
  const river: number[] = [];
  for (let v = 0; v < flow.length; v += 1) if (flow[v]! >= 0) river.push(v);
  const out = new Float32Array((rock.length / 3) * 2);
  const r = Math.max(1e-6, reach);
  for (let v = 0; v < rock.length / 3; v += 1) {
    let best = Infinity;
    let at = 1;
    for (const p of river) {
      const d = Math.hypot(rock[v * 3]! - lava[p * 3]!, rock[v * 3 + 1]! - lava[p * 3 + 1]!, rock[v * 3 + 2]! - lava[p * 3 + 2]!);
      if (d < best) { best = d; at = flow[p]!; }
    }
    out[v * 2] = river.length ? Math.exp(-((best / r) ** 2)) : 0;
    out[v * 2 + 1] = at;
  }
  return out;
}
