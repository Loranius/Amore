// ============================================================
// Позиції вершин із GLB — рівно стільки glTF, скільки треба мірці.
// ------------------------------------------------------------
// ЧОМУ НЕ `GLTFLoader`. Він тягне за собою THREE, а мірка живе в тестах
// без браузера й без WebGL. Плюс він робить УСЕ — матеріали, текстури,
// анімації, — а тут потрібен один атрибут з одного файла.
//
// Читається саме те й нічого більше: заголовок GLB, JSON-шматок, буфер, і
// з нього акцесори `POSITION` усіх примітивів. Ні розширень, ні
// зовнішніх буферів (`uri`), ні Draco: еталон експортується тим самим
// скриптом, який тут поруч, і якщо він колись почне писати щось із цього,
// читач мусить упасти вголос, а не показати мірку з половини дерева.
// ============================================================

const MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** `componentType` → скільки байтів займає одне число. */
const COMPONENT_BYTES: Record<number, number> = {
  5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4,
};

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface GltfNode {
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

interface GltfJson {
  nodes?: GltfNode[];
  meshes?: { primitives: { attributes: Record<string, number> }[] }[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: { uri?: string; byteLength: number }[];
  extensionsRequired?: string[];
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const same = (value: number[] | undefined, expected: number[]): boolean => (
  value === undefined || (value.length === expected.length
    && value.every((item, index) => Math.abs(item - expected[index]!) < 1e-6))
);

/**
 * Вузли сцени мусять бути без трансформацій.
 *
 * Мірка читає позиції з буфера НАПРЯМУ, не проходячи графом сцени. Поки
 * еталон — один об'єкт у нулі, це те саме; щойно в файлі з'явиться вузол
 * зі зсувом чи масштабом, мірка мовчки показала б інше дерево. Краще
 * впасти вголос.
 */
function assertPlainScene(json: GltfJson): void {
  for (const node of json.nodes ?? []) {
    const plain = same(node.matrix, IDENTITY)
      && same(node.translation, [0, 0, 0])
      && same(node.rotation, [0, 0, 0, 1])
      && same(node.scale, [1, 1, 1]);
    if (!plain) {
      throw new Error('Вузол GLB має трансформацію — мірка читає буфер напряму й дала б не те дерево.');
    }
  }
}

/**
 * Усі позиції вершин файла одним масивом `[x, y, z, …]`.
 *
 * Вузли сцени НЕ застосовуються: еталон експортується одним об'єктом без
 * трансформацій, і мовчазне ігнорування матриці там, де вона є, дало б
 * мірку не того дерева. Тому файл із трансформованим вузлом краще ламати,
 * ніж міряти — це перевіряє `assertPlainScene`.
 */
export function readGlbPositions(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('Це не GLB.');
  const total = view.getUint32(8, true);

  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;
  let cursor = 12;
  while (cursor + 8 <= total) {
    const length = view.getUint32(cursor, true);
    const kind = view.getUint32(cursor + 4, true);
    const body = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (kind === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(body)) as GltfJson;
    else if (kind === CHUNK_BIN) bin = body;
    cursor += 8 + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error('У GLB немає JSON-шматка.');
  if (!bin) throw new Error('У GLB немає буфера — зовнішні буфери не читаються.');
  const required = json.extensionsRequired ?? [];
  if (required.length > 0) {
    throw new Error(`GLB вимагає розширень, яких мірка не знає: ${required.join(', ')}.`);
  }
  assertPlainScene(json);

  const positions: number[] = [];
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const index = primitive.attributes.POSITION;
      if (index === undefined) continue;
      const accessor = json.accessors?.[index];
      if (!accessor) throw new Error(`Немає акцесора ${index}.`);
      if (accessor.type !== 'VEC3' || accessor.componentType !== 5126) {
        throw new Error('POSITION мусить бути VEC3 float32.');
      }
      if (accessor.bufferView === undefined) continue;
      const bufferView = json.bufferViews?.[accessor.bufferView];
      if (!bufferView) throw new Error(`Немає bufferView ${accessor.bufferView}.`);

      const componentSize = COMPONENT_BYTES[accessor.componentType] ?? 4;
      const stride = bufferView.byteStride ?? componentSize * 3;
      const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
      for (let element = 0; element < accessor.count; element += 1) {
        const at = start + element * stride;
        positions.push(
          data.getFloat32(at, true),
          data.getFloat32(at + 4, true),
          data.getFloat32(at + 8, true),
        );
      }
    }
  }
  if (positions.length === 0) throw new Error('У GLB немає жодної позиції.');
  return positions;
}
