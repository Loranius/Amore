import { BufferAttribute, BufferGeometry } from 'three';
import { WISHLIST_BUBBLE_MESH_PART_1 } from './wishlistBubbleMeshPart1';
import { WISHLIST_BUBBLE_MESH_PART_2 } from './wishlistBubbleMeshPart2';
import { WISHLIST_BUBBLE_MESH_PART_3 } from './wishlistBubbleMeshPart3';
import { WISHLIST_BUBBLE_MESH_PART_4 } from './wishlistBubbleMeshPart4';
import { WISHLIST_BUBBLE_MESH_PART_5 } from './wishlistBubbleMeshPart5';
import { WISHLIST_BUBBLE_MESH_PART_6 } from './wishlistBubbleMeshPart6';
import { WISHLIST_BUBBLE_TEXTURE_PART_1 } from './wishlistBubbleTexturePart1';
import { WISHLIST_BUBBLE_TEXTURE_PART_2 } from './wishlistBubbleTexturePart2';

/**
 * Uploaded model: "soap-bubble" by honoreo.
 * Source: https://sketchfab.com/3d-models/soap-bubble-893be3cf512848ba842912b7c61566b1
 * License: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
 *
 * The mesh, UV map and soap-film texture come from the uploaded GLB. Positions
 * and UVs are quantized to 16-bit and the 4096px JPEG is resized to 256px for
 * the Wishlist's maximum 174px rendering size.
 */
const MODEL_DATA = [
  WISHLIST_BUBBLE_MESH_PART_1,
  WISHLIST_BUBBLE_MESH_PART_2,
  WISHLIST_BUBBLE_MESH_PART_3,
  WISHLIST_BUBBLE_MESH_PART_4,
  WISHLIST_BUBBLE_MESH_PART_5,
  WISHLIST_BUBBLE_MESH_PART_6,
].join('');

export const WISHLIST_BUBBLE_TEXTURE_URL = `data:image/jpeg;base64,${[
  WISHLIST_BUBBLE_TEXTURE_PART_1,
  WISHLIST_BUBBLE_TEXTURE_PART_2,
].join('')}`;

function decodedBytes(): Uint8Array {
  const binary = globalThis.atob(MODEL_DATA);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function createWishlistBubbleGeometry(): BufferGeometry {
  const bytes = decodedBytes();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vertexCount = view.getUint32(0, true);
  const indexCount = view.getUint32(4, true);
  const positionScale = view.getFloat32(8, true);
  const positionOffset = 12;
  const uvOffset = positionOffset + vertexCount * 3 * Int16Array.BYTES_PER_ELEMENT;
  const indexOffset = uvOffset + vertexCount * 2 * Uint16Array.BYTES_PER_ELEMENT;

  const quantizedPositions = new Int16Array(
    bytes.buffer,
    bytes.byteOffset + positionOffset,
    vertexCount * 3,
  );
  const positions = new Float32Array(vertexCount * 3);
  for (let index = 0; index < quantizedPositions.length; index += 1) {
    positions[index] = (quantizedPositions[index]! / 32767) * positionScale;
  }

  const quantizedUvs = new Uint16Array(
    bytes.buffer,
    bytes.byteOffset + uvOffset,
    vertexCount * 2,
  );
  const uvs = new Float32Array(vertexCount * 2);
  for (let index = 0; index < quantizedUvs.length; index += 1) {
    uvs[index] = quantizedUvs[index]! / 65535;
  }

  const indices = new Uint16Array(
    bytes.buffer,
    bytes.byteOffset + indexOffset,
    indexCount,
  );

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices.slice(), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
