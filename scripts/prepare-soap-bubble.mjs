import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const sourceDirectory = resolve(repositoryRoot, 'scripts/assets/soap-bubble');
const outputPath = resolve(repositoryRoot, 'public/assets/soap-bubble.glb');

function extractBase64(source, expression, filename) {
  const match = source.match(expression);
  if (!match?.[1]) throw new Error(`Cannot extract base64 payload from ${filename}`);
  return match[1];
}

function align4(value) {
  return (value + 3) & ~3;
}

function padded(buffer, fill = 0) {
  const result = Buffer.alloc(align4(buffer.length), fill);
  buffer.copy(result);
  return result;
}

function minMax(values, itemSize) {
  const minimum = Array(itemSize).fill(Number.POSITIVE_INFINITY);
  const maximum = Array(itemSize).fill(Number.NEGATIVE_INFINITY);
  for (let index = 0; index < values.length; index += itemSize) {
    for (let component = 0; component < itemSize; component += 1) {
      const value = values[index + component];
      minimum[component] = Math.min(minimum[component], value);
      maximum[component] = Math.max(maximum[component], value);
    }
  }
  return { minimum, maximum };
}

function floatBuffer(values) {
  const buffer = Buffer.alloc(values.length * Float32Array.BYTES_PER_ELEMENT);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

const geometryFilename = resolve(sourceDirectory, 'model-geometry.ts');
const textureOneFilename = resolve(sourceDirectory, 'texture-part-01.ts');
const textureTwoFilename = resolve(sourceDirectory, 'texture-part-02.ts');

const [geometrySource, textureOneSource, textureTwoSource] = await Promise.all([
  readFile(geometryFilename, 'utf8'),
  readFile(textureOneFilename, 'utf8'),
  readFile(textureTwoFilename, 'utf8'),
]);

const modelBase64 = extractBase64(geometrySource, /const MODEL_DATA = '([^']+)'/, geometryFilename);
const textureBase64 = [
  extractBase64(textureOneSource, /= '([^']+)'/, textureOneFilename),
  extractBase64(textureTwoSource, /= '([^']+)'/, textureTwoFilename),
].join('');

const packedGeometry = Buffer.from(modelBase64, 'base64');
const vertexCount = packedGeometry.readUInt32LE(0);
const indexCount = packedGeometry.readUInt32LE(4);
const scale = packedGeometry.readFloatLE(8);
const positionOffset = 12;
const indexOffset = positionOffset + vertexCount * 3 * Int16Array.BYTES_PER_ELEMENT;

if (vertexCount < 32 || indexCount < 96 || indexOffset + indexCount * 2 > packedGeometry.length) {
  throw new Error('The packed Wishlist bubble geometry is invalid.');
}

const positions = [];
const normals = [];
const uvs = [];
for (let vertex = 0; vertex < vertexCount; vertex += 1) {
  const x = (packedGeometry.readInt16LE(positionOffset + (vertex * 3) * 2) / 32767) * scale;
  const y = (packedGeometry.readInt16LE(positionOffset + (vertex * 3 + 1) * 2) / 32767) * scale;
  const z = (packedGeometry.readInt16LE(positionOffset + (vertex * 3 + 2) * 2) / 32767) * scale;
  positions.push(x, y, z);

  const length = Math.hypot(x, y, z) || 1;
  const nx = x / length;
  const ny = y / length;
  const nz = z / length;
  normals.push(nx, ny, nz);
  uvs.push(
    0.5 + Math.atan2(nz, nx) / (2 * Math.PI),
    0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI,
  );
}

const indices = Buffer.alloc(indexCount * Uint16Array.BYTES_PER_ELEMENT);
for (let index = 0; index < indexCount; index += 1) {
  indices.writeUInt16LE(packedGeometry.readUInt16LE(indexOffset + index * 2), index * 2);
}

const jpeg = Buffer.from(textureBase64, 'base64');
if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg.at(-2) !== 0xff || jpeg.at(-1) !== 0xd9) {
  throw new Error('The embedded soap-film texture is not a valid JPEG.');
}

const binarySections = [
  padded(floatBuffer(positions)),
  padded(floatBuffer(normals)),
  padded(floatBuffer(uvs)),
  padded(indices),
  padded(jpeg),
];
const offsets = [];
let byteOffset = 0;
for (const section of binarySections) {
  offsets.push(byteOffset);
  byteOffset += section.length;
}
const binaryChunk = Buffer.concat(binarySections);
const positionBounds = minMax(positions, 3);

const gltf = {
  asset: { version: '2.0', generator: 'Amore soap-bubble asset builder' },
  extensionsUsed: ['KHR_materials_unlit'],
  buffers: [{ byteLength: binaryChunk.length }],
  bufferViews: [
    { buffer: 0, byteOffset: offsets[0], byteLength: binarySections[0].length, target: 34962 },
    { buffer: 0, byteOffset: offsets[1], byteLength: binarySections[1].length, target: 34962 },
    { buffer: 0, byteOffset: offsets[2], byteLength: binarySections[2].length, target: 34962 },
    { buffer: 0, byteOffset: offsets[3], byteLength: indices.length, target: 34963 },
    { buffer: 0, byteOffset: offsets[4], byteLength: jpeg.length },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC3',
      min: positionBounds.minimum,
      max: positionBounds.maximum,
    },
    { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: vertexCount, type: 'VEC2' },
    { bufferView: 3, componentType: 5123, count: indexCount, type: 'SCALAR' },
  ],
  images: [{ bufferView: 4, mimeType: 'image/jpeg', name: 'soap-film' }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  textures: [{ sampler: 0, source: 0 }],
  materials: [
    {
      name: 'Soap Bubble',
      pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 0.16],
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.16,
      },
      alphaMode: 'BLEND',
      doubleSided: false,
      extensions: { KHR_materials_unlit: {} },
    },
  ],
  meshes: [
    {
      name: 'Soap Bubble',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
          material: 0,
          mode: 4,
        },
      ],
    },
  ],
  nodes: [{ name: 'Soap Bubble', mesh: 0 }],
  scenes: [{ nodes: [0] }],
  scene: 0,
};

const jsonChunk = padded(Buffer.from(JSON.stringify(gltf)), 0x20);
const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
const glb = Buffer.alloc(totalLength);
let cursor = 0;
glb.writeUInt32LE(0x46546c67, cursor); cursor += 4;
glb.writeUInt32LE(2, cursor); cursor += 4;
glb.writeUInt32LE(totalLength, cursor); cursor += 4;
glb.writeUInt32LE(jsonChunk.length, cursor); cursor += 4;
glb.writeUInt32LE(0x4e4f534a, cursor); cursor += 4;
jsonChunk.copy(glb, cursor); cursor += jsonChunk.length;
glb.writeUInt32LE(binaryChunk.length, cursor); cursor += 4;
glb.writeUInt32LE(0x004e4942, cursor); cursor += 4;
binaryChunk.copy(glb, cursor);

if (glb.subarray(0, 4).toString('ascii') !== 'glTF' || glb.readUInt32LE(8) !== glb.length) {
  throw new Error('Generated soap-bubble GLB failed structural validation.');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, glb);
const digest = createHash('sha256').update(glb).digest('hex');
console.log(`Prepared ${outputPath} (${glb.length} bytes, sha256 ${digest}).`);
