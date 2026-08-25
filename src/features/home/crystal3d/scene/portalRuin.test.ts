import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  RUIN_PEDESTAL_BROAD_RADIUS,
  RUIN_PEDESTAL_TOP_RADIUS,
  RUIN_PEDESTAL_TOP_Y,
  portalRuinOffsetY,
  portalRuinScale,
} from './PortalRuin';
import { PORTAL_GROUND_Y } from './portalScene';

// ============================================================
// Числа руїни беруться з РУЇНИ, а не з пам'яті.
// ------------------------------------------------------------
// Привід: `RUIN_PEDESTAL_TOP_Y = 1.224` і `RUIN_PEDESTAL_TOP_RADIUS = 0.376`
// були записані як «виміряно на самому асеті (не „на око“ — розібраний
// GLB)». Вони справді з асета — але з ЛОКАЛЬНИХ координат меша `Stand`,
// узятих до того, як батьківський вузол застосує до них масштаб
// [0.2511, 0.0875, 0.2511] і зсув y +0.2895, а корінь — два повороти.
//
// У світі верх підставки стоїть на 0.3967 з радіусом 0.0962. Тобто код
// опускав руїну на 1.224 замість 0.3967 — на **0.827 нижче, ніж треба**,
// — і кристали висіли в повітрі над порожнечею з відкритими базовими
// кришками. Це та сама вада, яку видно на живому екрані як «кристал
// ширяє», і жоден тест її не бачив, бо тестів на ці числа не було.
//
// Тому тест не звіряє константи з іншими константами. Він РОЗБИРАЄ GLB і
// рахує ті самі величини з вершин, застосувавши всі перетворення вузлів.
// Перепакують асет — числа розійдуться, і це впаде.
// ============================================================

const RUIN_PATH = fileURLToPath(
  new URL('../../../../../public/models/amore_ruin.glb', import.meta.url),
);

type Matrix = readonly number[];
const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

interface Gltf {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: {
    name?: string;
    mesh?: number;
    children?: number[];
    matrix?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
}

/** JSON- і BIN-шматки GLB. Формат: 12 байтів заголовка, далі шматки. */
function readGlb(path: string): { gltf: Gltf; bin: Buffer } {
  const buffer = readFileSync(path);
  let offset = 12;
  let gltf: Gltf | null = null;
  let bin: Buffer | null = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) gltf = JSON.parse(new TextDecoder().decode(data)) as Gltf;
    else if (type === 0x004e4942) bin = data;
    offset += 8 + length;
  }
  if (gltf === null || bin === null) throw new Error('GLB без JSON- або BIN-шматка');
  return { gltf, bin };
}

/** Матриця вузла зі складників TRS — стовпцями, як у glTF. */
function nodeMatrix(node: Gltf['nodes'][number]): Matrix {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y! * y! + z! * z!)) * sx!, 2 * (x! * y! + z! * w!) * sx!, 2 * (x! * z! - y! * w!) * sx!, 0,
    2 * (x! * y! - z! * w!) * sy!, (1 - 2 * (x! * x! + z! * z!)) * sy!, 2 * (y! * z! + x! * w!) * sy!, 0,
    2 * (x! * z! + y! * w!) * sz!, 2 * (y! * z! - x! * w!) * sz!, (1 - 2 * (x! * x! + y! * y!)) * sz!, 0,
    tx!, ty!, tz!, 1,
  ];
}

function multiply(parent: Matrix, child: Matrix): Matrix {
  const out = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += parent[k * 4 + row]! * child[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function transform(m: Matrix, p: readonly number[]): [number, number, number] {
  return [
    m[0]! * p[0]! + m[4]! * p[1]! + m[8]! * p[2]! + m[12]!,
    m[1]! * p[0]! + m[5]! * p[1]! + m[9]! * p[2]! + m[13]!,
    m[2]! * p[0]! + m[6]! * p[1]! + m[10]! * p[2]! + m[14]!,
  ];
}

/** Світові вершини кожного названого вузла асета. */
function worldPointsByNode(path: string): Map<string, [number, number, number][]> {
  const { gltf, bin } = readGlb(path);
  const positions = (accessorIndex: number): number[][] => {
    const accessor = gltf.accessors[accessorIndex]!;
    const view = gltf.bufferViews[accessor.bufferView]!;
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? 12;
    const out: number[][] = [];
    for (let index = 0; index < accessor.count; index += 1) {
      out.push([
        bin.readFloatLE(start + index * stride),
        bin.readFloatLE(start + index * stride + 4),
        bin.readFloatLE(start + index * stride + 8),
      ]);
    }
    return out;
  };

  const found = new Map<string, [number, number, number][]>();
  const walk = (index: number, parent: Matrix, inherited: string): void => {
    const node = gltf.nodes[index]!;
    const world = multiply(parent, nodeMatrix(node));
    // Ім'я живе на батьківському вузлі; сам меш скрізь зветься
    // `defaultMaterial`, тож за іменем беремо найближчого названого предка.
    const label = node.name && node.name !== 'defaultMaterial' ? node.name : inherited;
    if (node.mesh !== undefined) {
      const points = found.get(label) ?? [];
      for (const primitive of gltf.meshes[node.mesh]!.primitives) {
        for (const point of positions(primitive.attributes.POSITION!)) {
          points.push(transform(world, point));
        }
      }
      found.set(label, points);
    }
    for (const child of node.children ?? []) walk(child, world, label);
  };
  for (const root of gltf.scenes[gltf.scene ?? 0]!.nodes) walk(root, IDENTITY, 'root');
  return found;
}

const NODES = worldPointsByNode(RUIN_PATH);
const STAND = NODES.get('Stand')!;

describe('константи руїни описують саму руїну', () => {
  it('асет узагалі має підставку', () => {
    expect(STAND, 'вузол Stand зник із асета').toBeDefined();
    expect(STAND.length).toBeGreaterThan(100);
  });

  it('верх підставки стоїть там, де каже константа', () => {
    /*
     * Тут була різниця в 0.827 — і саме вона тримала кристали в повітрі.
     * Допуск щільний навмисно: це вимір, а не оцінка, і будь-яке
     * розходження понад тисячну означає, що асет змінили.
     */
    const top = Math.max(...STAND.map((point) => point[1]));
    expect(RUIN_PEDESTAL_TOP_Y).toBeCloseTo(top, 3);
  });

  it('радіус верхньої площини — теж вимір, а не пам’ять', () => {
    const top = Math.max(...STAND.map((point) => point[1]));
    let radius = 0;
    for (const point of STAND) {
      if (Math.abs(point[1] - top) > 1e-4) continue;
      radius = Math.max(radius, Math.hypot(point[0], point[2]));
    }
    expect(RUIN_PEDESTAL_TOP_RADIUS).toBeCloseTo(radius, 3);
  });

  it('широка сходинка — те, на чому насправді лежить друза', () => {
    /*
     * Верхня площина — маленький виступ (радіус 0.096). Жеода на нього не
     * сяде, і не мусить: під нею є сходинка вчетверо ширша, і саме вона
     * читається як камінь під кристалом. Число публікується окремо, щоб
     * ніхто не сплутав «куди ставити» з «на чому лежить».
     */
    let radius = 0;
    for (const point of STAND) radius = Math.max(radius, Math.hypot(point[0], point[2]));
    expect(RUIN_PEDESTAL_BROAD_RADIUS).toBeCloseTo(radius, 3);
    expect(RUIN_PEDESTAL_BROAD_RADIUS).toBeGreaterThan(RUIN_PEDESTAL_TOP_RADIUS * 2);
  });

  it('зсув саджає верх підставки рівно на площину кристалів', () => {
    // Те, заради чого константи існують: після зсуву верх `Stand` мусить
    // збігтися з `PORTAL_GROUND_Y` — площиною, на якій стоять усі тіла.
    //
    // Точність — чотири знаки, бо стільки їх у самій константі. Просити
    // шести означало б перевіряти не посадку, а округлення: асет дає
    // 0.39671, константа каже 0.3967, різниця 1.1e-5 — і це та сама
    // тисячна долі міліметра сцени, якої ніхто не побачить.
    const scale = portalRuinScale();
    const top = Math.max(...STAND.map((point) => point[1]));
    expect(portalRuinOffsetY(scale) + top * scale).toBeCloseTo(PORTAL_GROUND_Y, 4);
  });

  it('колони не заходять у центр, де росте кристал', () => {
    // Обіцянка з коментаря до `PortalRuin`: у радіусі осі колон немає,
    // тож монарх не перетнеться з ними, хай як високо виросте.
    const pillar = NODES.get('Pillar')!;
    let closest = Number.POSITIVE_INFINITY;
    for (const point of pillar) {
      closest = Math.min(closest, Math.hypot(point[0], point[2]));
    }
    expect(closest).toBeGreaterThan(RUIN_PEDESTAL_BROAD_RADIUS);
  });
});
