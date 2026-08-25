// ============================================================
// Три дрібні форми: пучок, кулька, камінець.
// ------------------------------------------------------------
// Кожна будується РАЗ і малюється інстансами: сто п'ятдесят одиниць
// дрібноти коштують три виклики малювання. Тому й форм рівно три —
// четверта коштувала б четвертий виклик, а на екрані телефона різниці
// між нею й наявними не було б.
//
// Усі три стоять у ВЛАСНІЙ системі: основа в нулі, ріст у +Y, розмір 1.
// Сцена ставить їх на поверхню, повертає по нормалі й масштабує. Ця
// вісь — контракт, як і в риби.
// ============================================================
import { round6 } from './math';
import type { ReefMeshData } from './headMesh';

/** Скільки стрічок у пучку й наскільки вони розходяться. */
/*
 * Стрічка ВУЗЬКА, і це виправлення зі знімка.
 *
 * Перша редакція мала ширину 0.13 при висоті 1 — на екрані такі
 * стрічки читались клаптями паперу, а не травою. Трава вузька: 0.05
 * при висоті понад одиницю дає силует, у якому видно окремі стрічки, а
 * не суцільну пляму.
 */
const BLADE_COUNT = 7;
const BLADE_LEAN = 0.46;
const BLADE_WIDTH = 0.05;

/** Кулька: скільки голок і як глибоко западини між ними. */
/*
 * Кулька мусить мати ОБ'ЄМ. Три кільця по сім сторін давали форму, яка
 * на знімку читалась зім'ятим папірцем: занизька, щоб мати бік, і
 * заширока, щоб мати силует. Чотири кільця й глибші голки роблять з неї
 * актинію, яку видно з будь-якого боку.
 */
const TUFT_RINGS = 4;
const TUFT_SIDES = 7;
const TUFT_SPIKE = 0.34;

function emptyMesh(): { positions: number[]; normals: number[]; indices: number[] } {
  return { positions: [], normals: [], indices: [] };
}

function finish(
  parts: { positions: number[]; normals: number[]; indices: number[] },
): ReefMeshData {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let at = 0; at < parts.positions.length; at += 3) {
    minX = Math.min(minX, parts.positions[at]!); maxX = Math.max(maxX, parts.positions[at]!);
    minY = Math.min(minY, parts.positions[at + 1]!); maxY = Math.max(maxY, parts.positions[at + 1]!);
    minZ = Math.min(minZ, parts.positions[at + 2]!); maxZ = Math.max(maxZ, parts.positions[at + 2]!);
  }
  return {
    positions: parts.positions,
    normals: parts.normals,
    indices: parts.indices,
    baseCapTriangleCount: 0,
    bounds: {
      min: { x: round6(minX), y: round6(minY), z: round6(minZ) },
      max: { x: round6(maxX), y: round6(maxY), z: round6(maxZ) },
    },
  };
}

/**
 * Пучок стрічок — трава й м'які корали референсів.
 *
 * Стрічка двобічна: у площини немає товщини, і половина пучка
 * показувала б виворіт із будь-якого одного боку. Та сама причина, що
 * й у хвоста риби.
 */
export function buildReefBladeMesh(): ReefMeshData {
  const parts = emptyMesh();
  for (let blade = 0; blade < BLADE_COUNT; blade += 1) {
    const angle = (blade / BLADE_COUNT) * Math.PI * 2;
    const lean = BLADE_LEAN * (0.45 + 0.55 * ((blade * 7) % 5) / 4);
    const height = 0.95 + 0.45 * ((blade * 3) % 4) / 3;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    // Стрічка стоїть упоперек власного напряму — так її видно збоку.
    const acrossX = -dirZ * BLADE_WIDTH;
    const acrossZ = dirX * BLADE_WIDTH;
    const base = parts.positions.length / 3;

    const push = (x: number, y: number, z: number): void => {
      parts.positions.push(round6(x), round6(y), round6(z));
      parts.normals.push(round6(-dirZ), 0, round6(dirX));
    };
    push(-acrossX, 0, -acrossZ);
    push(acrossX, 0, acrossZ);
    // Верх звужений і відхилений — стрічка не палиця.
    push(dirX * lean - acrossX * 0.25, height, dirZ * lean - acrossZ * 0.25);
    push(dirX * lean + acrossX * 0.25, height, dirZ * lean + acrossZ * 0.25);

    parts.indices.push(base, base + 1, base + 2);
    parts.indices.push(base + 1, base + 3, base + 2);
    parts.indices.push(base + 2, base + 1, base);
    parts.indices.push(base + 2, base + 3, base + 1);
  }
  return finish(parts);
}

/**
 * Кулька з голок — актинія, губка, їжак.
 *
 * Півсфера з кільцями, у яких радіус стрибає через одну вершину: саме
 * цей стрибок і читається голками, без жодної додаткової геометрії.
 */
export function buildReefTuftMesh(): ReefMeshData {
  const parts = emptyMesh();
  const push = (x: number, y: number, z: number): void => {
    const length = Math.max(1e-9, Math.hypot(x, y, z));
    parts.positions.push(round6(x), round6(y), round6(z));
    parts.normals.push(round6(x / length), round6(y / length), round6(z / length));
  };

  for (let ring = 0; ring < TUFT_RINGS; ring += 1) {
    const band = (ring + 0.35) / TUFT_RINGS;
    const phi = band * (Math.PI / 2);
    for (let side = 0; side < TUFT_SIDES; side += 1) {
      const angle = (side / TUFT_SIDES) * Math.PI * 2;
      const spike = (side + ring) % 2 === 0 ? 1 + TUFT_SPIKE : 1 - TUFT_SPIKE * 0.5;
      const across = Math.cos(phi) * spike * 0.5;
      push(Math.cos(angle) * across, Math.sin(phi) * spike * 0.9, Math.sin(angle) * across);
    }
  }
  const apex = parts.positions.length / 3;
  push(0, 1.02, 0);

  for (let ring = 0; ring < TUFT_RINGS - 1; ring += 1) {
    const low = ring * TUFT_SIDES;
    const high = low + TUFT_SIDES;
    for (let side = 0; side < TUFT_SIDES; side += 1) {
      const next = (side + 1) % TUFT_SIDES;
      parts.indices.push(low + side, low + next, high + side);
      parts.indices.push(low + next, high + next, high + side);
    }
  }
  const top = (TUFT_RINGS - 1) * TUFT_SIDES;
  for (let side = 0; side < TUFT_SIDES; side += 1) {
    parts.indices.push(top + side, top + ((side + 1) % TUFT_SIDES), apex);
  }
  // Денце: кулька сидить на поверхні, але камера рифа опускається, і
  // відкритий низ показав би порожнечу.
  const floor = parts.positions.length / 3;
  push(0, 0, 0);
  for (let side = 0; side < TUFT_SIDES; side += 1) {
    parts.indices.push(floor, (side + 1) % TUFT_SIDES, side);
  }
  return finish(parts);
}

/**
 * Камінець — приплюснута галька, а не пласка пірамідка.
 *
 * Перша редакція давала шестикутник із однією вершиною зверху: під
 * пласким затіненням це читалось клаптем паперу на піску. Два кільця
 * дають гальці бік, а бік — це те, чим камінь відрізняється від тіні.
 */
export function buildReefPebbleMesh(): ReefMeshData {
  const parts = emptyMesh();
  const SIDES = 6;
  const push = (x: number, y: number, z: number): void => {
    const length = Math.max(1e-9, Math.hypot(x, y, z));
    parts.positions.push(round6(x), round6(y), round6(z));
    parts.normals.push(round6(x / length), round6(y / length), round6(z / length));
  };

  const RINGS: ReadonlyArray<readonly [number, number]> = [[0.02, 0.5], [0.2, 0.44]];
  for (const [height, across] of RINGS) {
    for (let side = 0; side < SIDES; side += 1) {
      const angle = (side / SIDES) * Math.PI * 2;
      const wobble = 0.82 + 0.18 * ((side * 5) % 3) / 2;
      push(Math.cos(angle) * across * wobble, height, Math.sin(angle) * across * wobble);
    }
  }
  const crown = parts.positions.length / 3;
  push(0, 0.34, 0);
  const floor = crown + 1;
  push(0, 0, 0);

  for (let side = 0; side < SIDES; side += 1) {
    const next = (side + 1) % SIDES;
    parts.indices.push(side, next, SIDES + side);
    parts.indices.push(next, SIDES + next, SIDES + side);
    parts.indices.push(SIDES + side, SIDES + next, crown);
    parts.indices.push(floor, next, side);
  }
  return finish(parts);
}

/** Кущ водорості: скільки стрічок, скільки в них колін, як вигинаються. */
const WEED_STRANDS = 5;
const WEED_JOINTS = 5;
const WEED_WIDTH = 0.09;
const WEED_CURVE = 0.5;

/** Наскільки корінь утоплений у пісок. */
const WEED_ROOT = 0.06;

/**
 * Висока водорість — КУЩ, а не одна стрічка.
 *
 * Перша редакція давала єдину стрічку, і на знімку вона читалась
 * пласкою зеленою смугою, що висить у воді: у одної стрічки немає ані
 * об'єму, ані місця, де вона починається. Кущ із п'яти, кожна зі своєю
 * висотою й вигином, читається рослиною з першого погляду.
 *
 * Корінь іде НИЖЧЕ нуля: інакше на дюні стеблина зависає над піском, і
 * рослина знову втрачає землю під собою.
 *
 * Коліна потрібні не для краси: сцена гойдає кущ, обертаючи його
 * цілком, і прямі палиці під таким рухом читались би стрілками
 * годинника. Вигнуті стрічки під тим самим поворотом читаються течією.
 */
export function buildReefWeedMesh(): ReefMeshData {
  const parts = emptyMesh();
  for (let strand = 0; strand < WEED_STRANDS; strand += 1) {
    const azimuth = (strand / WEED_STRANDS) * Math.PI * 2 + 0.3;
    const dirX = Math.cos(azimuth);
    const dirZ = Math.sin(azimuth);
    const height = 0.62 + 0.38 * ((strand * 3) % 5) / 4;
    const curve = WEED_CURVE * (0.5 + 0.5 * ((strand * 7) % 4) / 3);
    // Стрічка стоїть упоперек власного напряму — так її видно збоку.
    const acrossX = -dirZ;
    const acrossZ = dirX;
    const base = parts.positions.length / 3;

    for (let joint = 0; joint <= WEED_JOINTS; joint += 1) {
      const along = joint / WEED_JOINTS;
      const bend = curve * along * along;
      const width = WEED_WIDTH * (1 - 0.6 * along);
      for (const side of [-1, 1]) {
        parts.positions.push(
          round6(dirX * bend + acrossX * side * width),
          round6(along * height - WEED_ROOT),
          round6(dirZ * bend + acrossZ * side * width),
        );
        parts.normals.push(round6(-dirZ), 0, round6(dirX));
      }
    }

    for (let joint = 0; joint < WEED_JOINTS; joint += 1) {
      const low = base + joint * 2;
      parts.indices.push(low, low + 1, low + 2);
      parts.indices.push(low + 1, low + 3, low + 2);
      parts.indices.push(low + 2, low + 1, low);
      parts.indices.push(low + 2, low + 3, low + 1);
    }
  }
  return finish(parts);
}
