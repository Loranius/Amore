// ============================================================
// Острів дерева за референсом власника (ADR-0222).
// ------------------------------------------------------------
// Референс: летючий острів із соковитою яскраво-зеленою травою куполом,
// по краю й на траві — рожево-сірі гранчасті валуни, дрібні рожеві квіти,
// з краю звисає плющ, підошва — тепла коричнево-лілова скеля великими
// гранями, довкола висять уламки того ж каменю, у небі — хмари й далекі
// острівці (вони — в оточенні на 360°, `diorama/surround.ts`, ADR-0224).
// Дерево росте з центру.
//
// Ті самі «пензлі», що й острів кристала (ADR-0221): `Painter`, кавалки,
// плющ. Фарби — ті самі індекси, прочитані по-своєму (`TREE_PAINT`).
// Усе — оздоблення з хешу дати початку: правил росту (ADR-0218) не чіпає.
//
// Модуль чистий: лише масиви, без three. Одиниці — сцени, земля на y = 0.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { Painter, chunk, ivy, polar, type IslandMesh, type V3 } from '../v2/crystalIsland';

/** Індекси палітри острова дерева (ті самі слоти, що й `PAINT` кристала). */
export const TREE_PAINT = { grass: 0, cliff: 1, boulder: 2, ivy: 3, flower: 4, soil: 5, cloud: 6, far: 7 } as const;

/** Купол трави: наскільки центр вищий за край, у частках радіуса. */
export const TREE_ISLAND_DOME = 0.07;

/** Плаский верх купола в частках радіуса: на ньому стоїть дерево з корінням. */
export const TREE_ISLAND_PLATEAU = 0.4;

/**
 * Висота трави над точкою на відстані `r` від осі. Купол гладкий, тож
 * трава й квіти, що стоять на ньому, беруть висоту звідси, а не вгадують.
 *
 * Центр — ПЛАСКИЙ, і дерево стоїть на ньому (`treeIslandBase`). Перший
 * купол був опуклим від самої осі, дерево — на нулі, і коріння, яке
 * лежить майже на землі, ховалось під травою: ефект «місць» пари
 * (ADR-0218) зникав з кадру. Регресійний тест тримає коріння над травою.
 */
export function treeIslandGround(radius: number, r: number): number {
  const t = Math.min(1, r / Math.max(1e-6, radius));
  const s = Math.max(0, (t - TREE_ISLAND_PLATEAU) / (1 - TREE_ISLAND_PLATEAU));
  return radius * TREE_ISLAND_DOME * (1 - s * s) + RIM_Y;
}

/** Висота, на яку піднято дерево: верх пласкої середини купола. */
export function treeIslandBase(radius: number): number {
  return treeIslandGround(radius, 0);
}

const RIM_Y = 0.004;
const SEG = 24;

export interface TreeIsland {
  island: IslandMesh;
  /** Уламки довкола: окремо, бо повільно гойдаються. */
  debris: IslandMesh;
}

/** Дрібна рожева квітка: п'ять пелюсток зіркою й серединка. */
function flower(p: Painter, seed: string, key: string, c: V3, size: number) {
  const turn = unit(seed, `${key}:turn`) * Math.PI * 2;
  const mid: V3 = [c[0], c[1] + size * 0.25, c[2]];
  for (let k = 0; k < 5; k += 1) {
    const a0 = turn + (k / 5) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / 10;
    const a2 = a0 + (Math.PI * 2) / 5;
    const tip: V3 = [c[0] + Math.cos(a1) * size, c[1] + size * 0.1, c[2] + Math.sin(a1) * size];
    const l: V3 = [c[0] + Math.cos(a0) * size * 0.4, c[1] + size * 0.2, c[2] + Math.sin(a0) * size * 0.4];
    const r: V3 = [c[0] + Math.cos(a2) * size * 0.4, c[1] + size * 0.2, c[2] + Math.sin(a2) * size * 0.4];
    p.tri(l, tip, r, TREE_PAINT.flower, 0.95 + 0.15 * unit(seed, `${key}:p${k}`));
    p.tri(l, r, mid, TREE_PAINT.flower, 1.1);
  }
}

export function buildTreeIsland(seed: string, radius: number): TreeIsland {
  const R = radius;
  const p = new Painter();
  // Перед острова — до камери (+z): туди не кладемо великих валунів, щоб
  // вони не затуляли стовбур.
  const front = Math.PI / 2;
  const nearFront = (a: number, gap: number) => Math.abs(Math.atan2(Math.sin(a - front), Math.cos(a - front))) < gap;

  // ── Трава: купол із трьох кілець і центру ─────────────────
  const rimR = (j: number) => R * (0.97 + 0.07 * unit(seed, `tree-isle:rim${j % SEG}`));
  const rim = Array.from({ length: SEG }, (_, j) => polar(rimR(j), (j / SEG) * Math.PI * 2, RIM_Y));
  const ring = (t: number, key: string) => Array.from({ length: SEG }, (_, j): V3 => {
    const a = ((j + (key === 'mid' ? 0.5 : 0)) / SEG) * Math.PI * 2;
    const r = rimR(j) * t * (0.94 + 0.12 * unit(seed, `tree-isle:${key}${j}`));
    return polar(r, a, treeIslandGround(R, r));
  });
  const outerRing = ring(0.7, 'out');
  const midRing = ring(0.38, 'mid');
  const centre: V3 = [0, treeIslandGround(R, 0), 0];
  const grassTone = (key: string) => 0.9 + 0.2 * unit(seed, `tree-isle:grass:${key}`);
  for (let j = 0; j < SEG; j += 1) {
    const k = (j + 1) % SEG;
    p.tri(centre, midRing[k]!, midRing[j]!, TREE_PAINT.grass, grassTone(`c${j}`));
    p.tri(midRing[j]!, midRing[k]!, outerRing[k]!, TREE_PAINT.grass, grassTone(`m${j}a`));
    p.tri(midRing[j]!, outerRing[k]!, outerRing[j]!, TREE_PAINT.grass, grassTone(`m${j}b`));
    p.tri(outerRing[j]!, outerRing[k]!, rim[k]!, TREE_PAINT.grass, grassTone(`o${j}a`));
    p.tri(outerRing[j]!, rim[k]!, rim[j]!, TREE_PAINT.grass, grassTone(`o${j}b`));
  }

  // ── Підошва: трав'яний звис, смуга ґрунту, скеля великими гранями ──
  const layers = [
    { r: 1.0, y: 0, paint: TREE_PAINT.grass },
    { r: 1.02, y: -0.06, paint: TREE_PAINT.grass },
    { r: 0.99, y: -0.12, paint: TREE_PAINT.soil },
    { r: 0.93, y: -0.3, paint: TREE_PAINT.cliff },
    { r: 0.76, y: -0.54, paint: TREE_PAINT.cliff },
    { r: 0.5, y: -0.8, paint: TREE_PAINT.cliff },
    { r: 0.2, y: -1.0, paint: TREE_PAINT.cliff },
  ] as const;
  const layerRing = (li: number) => Array.from({ length: SEG }, (_, j): V3 => {
    // Верхнє кільце підошви — ТІ САМІ вершини, що й край трави: інакше
    // між ними щілина, крізь яку видно нутро (регресія острова кристала).
    if (li === 0) return rim[j]!;
    const L = layers[li]!;
    const soft = li <= 2 ? 0.04 : 0.4;
    const jitter = 1 - soft / 2 + soft * unit(seed, `tree-isle:cliff${li}:${j}:r`);
    const a = ((j + (li >= 3 ? (li % 2) * 0.5 : 0)) / SEG) * Math.PI * 2;
    return polar(rimR(j) * L.r * jitter, a, R * L.y * (li <= 2 ? 1 : 0.85 + 0.3 * unit(seed, `tree-isle:cliff${li}:${j}:y`)));
  });
  const shells = layers.map((_, li) => layerRing(li));
  for (let li = 0; li + 1 < shells.length; li += 1) {
    const paint = layers[li + 1]!.paint;
    p.band(shells[li + 1]!, shells[li]!, paint, (i) => (paint === TREE_PAINT.cliff ? 1 - 0.1 * (li - 2) : 0.92) * (0.85 + 0.3 * unit(seed, `tree-isle:cliff${li}:${i}:t`)));
  }
  const tip: V3 = [R * 0.04, -R * 1.2, -R * 0.05];
  const last = shells[shells.length - 1]!;
  for (let j = 0; j < SEG; j += 1) p.tri(last[(j + 1) % SEG]!, last[j]!, tip, TREE_PAINT.cliff, 0.5 + 0.1 * unit(seed, `tree-isle:tip${j}`));

  // Великі грані референсу: кавалки, втоплені в скелю, ламають її рівні кільця.
  for (let k = 0; k < 16; k += 1) {
    const key = `tree-isle:face${k}`;
    const li = 3 + Math.floor(unit(seed, `${key}:l`) * 3);
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const at = shells[li]![j]!;
    chunk(p, seed, key, [at[0] * 0.96, at[1], at[2] * 0.96], R * (0.12 + 0.08 * unit(seed, `${key}:s`)) * (1.2 - 0.2 * (li - 3)), TREE_PAINT.cliff);
  }

  // ── Валуни по краю, наполовину в траві ────────────────────
  for (let k = 0; k < 11; k += 1) {
    const key = `tree-isle:boulder${k}`;
    const a = (k / 11) * Math.PI * 2 + (unit(seed, `${key}:a`) - 0.5) * 0.35;
    const big = !nearFront(a, 0.5);
    const size = R * (big ? 0.08 + 0.07 * unit(seed, `${key}:s`) : 0.04 + 0.02 * unit(seed, `${key}:s`));
    chunk(p, seed, key, polar(R * (0.93 + 0.05 * unit(seed, `${key}:r`)), a, size * 0.2), size, TREE_PAINT.boulder, 0, 0.8);
    // Дрібний камінчик поруч — купки, а не намистини в ряд.
    if (unit(seed, `${key}:pair`) < 0.6) {
      const b = a + (unit(seed, `${key}:pa`) < 0.5 ? -1 : 1) * 0.12;
      chunk(p, seed, `${key}:small`, polar(R * 0.9, b, size * 0.1), size * 0.5, TREE_PAINT.boulder, 0, 0.8);
    }
  }
  // Кілька каменів на самій траві, осторонь дерева.
  for (let k = 0; k < 4; k += 1) {
    const key = `tree-isle:stone${k}`;
    const a = front + Math.PI * 0.5 + k * 0.9 + unit(seed, `${key}:a`) * 0.5;
    const r = R * (0.5 + 0.2 * unit(seed, `${key}:r`));
    const size = R * (0.04 + 0.03 * unit(seed, `${key}:s`));
    chunk(p, seed, key, polar(r, a, treeIslandGround(R, r) + size * 0.15), size, TREE_PAINT.boulder, 0, 0.75);
  }

  // ── Рожеві квіти купками по траві ─────────────────────────
  for (let k = 0; k < 9; k += 1) {
    const key = `tree-isle:bed${k}`;
    const a = (k / 9) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.6;
    const r0 = R * (0.4 + 0.45 * unit(seed, `${key}:r`));
    const n = 3 + Math.floor(unit(seed, `${key}:n`) * 4);
    for (let f = 0; f < n; f += 1) {
      const fa = a + (unit(seed, `${key}:${f}:a`) - 0.5) * 0.25;
      const fr = Math.min(R * 0.9, r0 + (unit(seed, `${key}:${f}:r`) - 0.5) * R * 0.12);
      flower(p, seed, `${key}:${f}`, polar(fr, fa, treeIslandGround(R, fr) + R * 0.012), R * (0.034 + 0.014 * unit(seed, `${key}:${f}:s`)));
    }
  }

  // ── Плющ: латки на краю й пасма, що звисають по скелі ─────
  for (let k = 0; k < 18; k += 1) {
    const key = `tree-isle:strand${k}`;
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const a = ((j + 0.5) / SEG) * Math.PI * 2;
    const r = rimR(j) * 1.02;
    const length = 2 + Math.floor(unit(seed, `${key}:len`) * 6);
    ivy(p, seed, `${key}:top`, polar(r, a, -R * 0.02), R * 0.08);
    for (let d = 1; d <= length; d += 1) {
      const y = -R * 0.04 - d * R * 0.065;
      const rr = r * (1 - 0.045 * d) + R * 0.03;
      ivy(p, seed, `${key}:${d}`, polar(rr, a + (unit(seed, `${key}:${d}:a`) - 0.5) * 0.08, y), R * (0.065 - d * 0.005));
    }
  }

  // ── Уламки довкола ────────────────────────────────────────
  const debris = new Painter();
  for (let k = 0; k < 6; k += 1) {
    const key = `tree-isle:debris${k}`;
    const a = (k / 6) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.6;
    const r = R * (1.35 + 0.55 * unit(seed, `${key}:r`));
    // Нижче краю острова: над травою уламок пропливав перед деревом.
    const y = R * (-0.9 + 0.7 * unit(seed, `${key}:y`));
    const size = R * (0.06 + 0.08 * unit(seed, `${key}:s`));
    chunk(debris, seed, key, polar(r, a, y), size, TREE_PAINT.cliff);
    // Деякі уламки — з клаптем трави зверху, як відколоті від острова.
    if (unit(seed, `${key}:grass`) < 0.5) chunk(debris, seed, `${key}:top`, polar(r, a, y + size * 0.7), size * 0.7, TREE_PAINT.grass, 0, 0.35);
  }

  return { island: p.build(), debris: debris.build() };
}
