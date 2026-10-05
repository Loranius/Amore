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

/** Шестигранне вістря кристала від `base` уздовж `dir`. */
function shard(p: Painter, base: V3, dir: V3, size: number, turn: number, tone: (face: number) => number) {
  const up: V3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u0: V3 = [dir[1] * up[2] - dir[2] * up[1], dir[2] * up[0] - dir[0] * up[2], dir[0] * up[1] - dir[1] * up[0]];
  const ul = Math.hypot(...u0);
  const u: V3 = [u0[0] / ul, u0[1] / ul, u0[2] / ul];
  const v: V3 = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
  const at = (k: number, along: number, r: number): V3 => {
    const a = turn + (k / 6) * Math.PI * 2;
    const c = Math.cos(a) * r;
    const s = Math.sin(a) * r;
    return [base[0] + dir[0] * along + u[0] * c + v[0] * s, base[1] + dir[1] * along + u[1] * c + v[1] * s, base[2] + dir[2] * along + u[2] * c + v[2] * s];
  };
  // Корінь утоплено в скелю (−0.4 розміру): основа кристала не видна.
  const tipPt: V3 = [base[0] + dir[0] * size * 3.2, base[1] + dir[1] * size * 3.2, base[2] + dir[2] * size * 3.2];
  for (let k = 0; k < 6; k += 1) {
    const a0 = at(k, -size * 0.4, size * 0.5);
    const a1 = at(k + 1, -size * 0.4, size * 0.5);
    const b0 = at(k, size * 2.2, size * 0.5);
    const b1 = at(k + 1, size * 2.2, size * 0.5);
    p.tri(a0, b0, b1, TREE_PAINT.far, tone(k));
    p.tri(a0, b1, a1, TREE_PAINT.far, tone(k));
    p.tri(b0, tipPt, b1, TREE_PAINT.far, tone(k) * 1.12);
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
  // Гранчастий low-poly за референсом (ADR-0226): звис трави й ґрунт ідуть
  // за краєм (24 вершини), а скеля під ними — дванадцять сегментів із
  // сильним розкидом, небагато широких граней, без горбиків-кавалків.
  const top = [
    { r: 1.0, y: 0, paint: TREE_PAINT.grass },
    { r: 1.02, y: -0.05, paint: TREE_PAINT.grass },
    { r: 0.99, y: -0.1, paint: TREE_PAINT.soil },
  ] as const;
  const topRing = (li: number) => Array.from({ length: SEG }, (_, j): V3 => {
    // Верхнє кільце підошви — ТІ САМІ вершини, що й край трави: інакше
    // між ними щілина, крізь яку видно нутро (регресія острова кристала).
    if (li === 0) return rim[j]!;
    const L = top[li]!;
    const jitter = 0.98 + 0.04 * unit(seed, `tree-isle:cliff${li}:${j}:r`);
    return polar(rimR(j) * L.r * jitter, (j / SEG) * Math.PI * 2, R * L.y);
  });
  // Підошва гранчаста й кам'яна, «у стилі кристалів» (власник,
  // 2026-10-05): чотири кільця, а не три, — більше великих граней, що
  // по-різному ловлять світло. Вершин у кільці й далі 12 (ADR-0226: великі
  // грані, не горбики), тож гранчастість іде з глибини, а не з густоти.
  // Розкид по висоті малий (±4%), по радіусу — великий: кільця не
  // змішуються, а грані різні за нахилом.
  const UNDER = 12;
  const under = [
    { r: 0.9, y: -0.3 },
    { r: 0.7, y: -0.58 },
    { r: 0.46, y: -0.86 },
    { r: 0.24, y: -1.12 },
  ];
  const deep = under.map((L, li) => Array.from({ length: UNDER }, (_, j): V3 => {
    const a = ((j + (li % 2) * 0.5) / UNDER) * Math.PI * 2 + (unit(seed, `tree-isle:u${li}:${j}:a`) - 0.5) * 0.18;
    return polar(R * L.r * (0.82 + 0.36 * unit(seed, `tree-isle:u${li}:${j}:r`)), a, R * L.y * (0.96 + 0.08 * unit(seed, `tree-isle:u${li}:${j}:y`)));
  }));
  const shells: V3[][] = [...top.map((_, li) => topRing(li)), ...deep];
  for (let li = 0; li + 1 < top.length; li += 1) {
    p.band(shells[li + 1]!, shells[li]!, top[li + 1]!.paint, (i) => 0.92 * (0.85 + 0.3 * unit(seed, `tree-isle:cliff${li}:${i}:t`)));
  }
  const cliffTone = (key: string, depth: number) => (1 - 0.1 * depth) * (0.82 + 0.34 * unit(seed, `tree-isle:ct:${key}`));
  // Перехід від ґрунту (24 вершини) до скелі (12) — віялом, без щілини.
  const soil = shells[top.length - 1]!;
  const first = deep[0]!;
  // Кожна вершина ґрунту йде до вершини скелі під своїм кутом; між сусідніми
  // — смуга з двох трикутників, де одна зі сторін вироджена, коли обидві
  // вершини ґрунту лягають на ту саму вершину скелі.
  const below = (j: number) => Math.round((j / SEG) * UNDER) % UNDER;
  for (let j = 0; j < SEG; j += 1) {
    const k = (j + 1) % SEG;
    const b0 = below(j);
    const b1 = below(k);
    p.tri(first[b0]!, soil[k]!, soil[j]!, TREE_PAINT.cliff, cliffTone(`t${j}a`, 0));
    if (b0 !== b1) p.tri(first[b0]!, first[b1]!, soil[k]!, TREE_PAINT.cliff, cliffTone(`t${j}b`, 0));
  }
  for (let li = 0; li + 1 < deep.length; li += 1) {
    p.band(deep[li + 1]!, deep[li]!, TREE_PAINT.cliff, (i) => cliffTone(`${li}:${i}`, li + 1));
  }
  const tip: V3 = [R * 0.04, -R * 1.26, -R * 0.05];
  const last = deep[deep.length - 1]!;
  for (let j = 0; j < UNDER; j += 1) p.tri(last[(j + 1) % UNDER]!, last[j]!, tip, TREE_PAINT.cliff, 0.55 + 0.12 * unit(seed, `tree-isle:tip${j}`));

  const surfaceAt = (a: number, y: number) => {
    const profile = shells.map((ring) => {
      let best = ring[0]!;
      let gap = Infinity;
      for (const v of ring) {
        const d = Math.abs(Math.atan2(Math.sin(Math.atan2(v[2], v[0]) - a), Math.cos(Math.atan2(v[2], v[0]) - a)));
        if (d < gap) { gap = d; best = v; }
      }
      return { r: Math.hypot(best[0], best[2]), y: best[1] };
    });
    for (let li = 0; li + 1 < profile.length; li += 1) {
      const top = profile[li]!;
      const low = profile[li + 1]!;
      if (y <= top.y && y >= low.y) return top.r + ((low.r - top.r) * (top.y - y)) / Math.max(1e-6, top.y - low.y);
    }
    return profile[profile.length - 1]!.r;
  };
  // Кристали, що проросли крізь скелю: шестигранні вістря під кутом униз і
  // назовні, купками по 2–3, лілово-рожеві (фарба далеких острівців).
  for (let k = 0; k < 6; k += 1) {
    const key = `tree-isle:shard${k}`;
    const a = (k / 6) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.7;
    const y = -R * (0.45 + 0.4 * unit(seed, `${key}:y`));
    const base = polar(surfaceAt(a, y) * 0.96, a, y);
    const n = 2 + Math.floor(unit(seed, `${key}:n`) * 2);
    for (let q = 0; q < n; q += 1) {
      const lean = 0.5 + 0.5 * unit(seed, `${key}:${q}:lean`);
      const da = a + (unit(seed, `${key}:${q}:da`) - 0.5) * 0.5;
      const axis: V3 = [Math.cos(da) * lean, -(1 - lean * 0.5), Math.sin(da) * lean];
      const len = Math.hypot(...axis);
      const dir: V3 = [axis[0] / len, axis[1] / len, axis[2] / len];
      const size = R * (0.05 + 0.05 * unit(seed, `${key}:${q}:s`)) * (q === 0 ? 1.3 : 0.8);
      shard(p, base, dir, size, unit(seed, `${key}:${q}:turn`) * Math.PI, (f) => 0.85 + 0.35 * unit(seed, `${key}:${q}:f${f}`));
    }
  }

  // ── Валуни по краю, наполовину в траві ────────────────────
  for (let k = 0; k < 15; k += 1) {
    const key = `tree-isle:boulder${k}`;
    const a = (k / 15) * Math.PI * 2 + (unit(seed, `${key}:a`) - 0.5) * 0.35;
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
  for (let k = 0; k < 7; k += 1) {
    const key = `tree-isle:stone${k}`;
    const a = front + Math.PI * 0.35 + k * 0.62 + unit(seed, `${key}:a`) * 0.4;
    const r = R * (0.5 + 0.2 * unit(seed, `${key}:r`));
    const size = R * (0.04 + 0.03 * unit(seed, `${key}:s`));
    chunk(p, seed, key, polar(r, a, treeIslandGround(R, r) + size * 0.15), size, TREE_PAINT.boulder, 0, 0.75);
  }

  // ── Горбики луки: легка зміна висоти (власник, 2026-10-05) ──
  // Пласкі трав'яні кавалки, наполовину в куполі, осторонь дерева й не
  // спереду — лука дихає, а стовбур і коріння лишаються відкриті.
  for (let k = 0; k < 5; k += 1) {
    const key = `tree-isle:mound${k}`;
    const a = front + Math.PI * 0.6 + k * 1.05 + (unit(seed, `${key}:a`) - 0.5) * 0.4;
    const r = R * (0.55 + 0.25 * unit(seed, `${key}:r`));
    const size = R * (0.13 + 0.07 * unit(seed, `${key}:s`));
    chunk(p, seed, key, polar(r, a, treeIslandGround(R, r) - size * 0.22), size, TREE_PAINT.grass, 0, 0.28);
  }

  // ── Рожеві квіти купками по траві ─────────────────────────
  for (let k = 0; k < 13; k += 1) {
    const key = `tree-isle:bed${k}`;
    const a = (k / 13) * Math.PI * 2 + unit(seed, `${key}:a`) * 0.6;
    const r0 = R * (0.4 + 0.45 * unit(seed, `${key}:r`));
    const n = 3 + Math.floor(unit(seed, `${key}:n`) * 4);
    for (let f = 0; f < n; f += 1) {
      const fa = a + (unit(seed, `${key}:${f}:a`) - 0.5) * 0.25;
      const fr = Math.min(R * 0.9, r0 + (unit(seed, `${key}:${f}:r`) - 0.5) * R * 0.12);
      flower(p, seed, `${key}:${f}`, polar(fr, fa, treeIslandGround(R, fr) + R * 0.012), R * (0.034 + 0.014 * unit(seed, `${key}:${f}:s`)));
    }
  }

  // ── Плющ: латки на краю й пасма, що звисають по скелі ─────
  // Пасмо лягає на СПРАВЖНЮ поверхню скелі: радіус на кожній висоті береться
  // з кілець підошви в цьому напрямку. Перша версія вгадувала його лінійним
  // звуженням, а кільця мають власний розкид ±20% — і пасма висіли в повітрі
  // збоку від скелі або ховались у ній (власник: «не прилягають»).
  for (let k = 0; k < 26; k += 1) {
    const key = `tree-isle:strand${k}`;
    const j = Math.floor(unit(seed, `${key}:j`) * SEG);
    const a = ((j + 0.5) / SEG) * Math.PI * 2;
    const length = 2 + Math.floor(unit(seed, `${key}:len`) * 8);
    ivy(p, seed, `${key}:top`, polar(surfaceAt(a, -R * 0.02) + R * 0.02, a, -R * 0.02), R * 0.08);
    for (let d = 1; d <= length; d += 1) {
      const y = -R * 0.04 - d * R * 0.065;
      const ad = a + (unit(seed, `${key}:${d}:a`) - 0.5) * 0.08;
      ivy(p, seed, `${key}:${d}`, polar(surfaceAt(ad, y) + R * 0.015, ad, y), R * (0.065 - d * 0.005));
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
    chunk(debris, seed, key, polar(r, a, y), size, TREE_PAINT.boulder);
    // Деякі уламки — з клаптем трави зверху, як відколоті від острова.
    // Клапоть лежить НА камені, врізаний у його верх: з відступом 0.7 він
    // висів над уламком окремою пластинкою.
    if (unit(seed, `${key}:grass`) < 0.5) chunk(debris, seed, `${key}:top`, polar(r, a, y + size * 0.62), size * 0.72, TREE_PAINT.grass, 0, 0.3);
  }

  return { island: p.build(), debris: debris.build() };
}
