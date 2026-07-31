import type { BufferAttribute, Color, MeshPhysicalMaterial } from 'three';
import type {
  ReefRenderableBatch,
  ReefRenderableMesh,
  ReefThreeSceneState,
} from './reefThreeAdapter';

export const REEF_MATERIAL_COLOR_SPACE_VERSION = 'reef-linear-srgb-v1';

function srgbToLinear(channel: number): number {
  const value = Math.max(0, Math.min(1, channel));
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function convertColor(color: Color): void {
  color.setRGB(
    srgbToLinear(color.r),
    srgbToLinear(color.g),
    srgbToLinear(color.b),
  );
}

function convertArray(array: Float32Array): void {
  for (let index = 0; index < array.length; index += 1) {
    array[index] = srgbToLinear(array[index] ?? 0);
  }
}

function colorAttribute(mesh: ReefRenderableMesh): BufferAttribute {
  return mesh.geometry.getAttribute('color') as BufferAttribute;
}

function convertMaterial(material: MeshPhysicalMaterial): void {
  convertColor(material.sheenColor);
  convertColor(material.emissive);
  material.needsUpdate = true;
}

function convertFoundation(mesh: ReefRenderableMesh): void {
  const attribute = colorAttribute(mesh);
  convertArray(attribute.array as Float32Array);
  attribute.needsUpdate = true;
  convertMaterial(mesh.material);
  mesh.geometry.userData.reefMaterialColorSpace = REEF_MATERIAL_COLOR_SPACE_VERSION;
}

function convertBatch(batch: ReefRenderableBatch): void {
  convertArray(batch.baseColors);
  const attribute = colorAttribute(batch);
  (attribute.array as Float32Array).set(batch.baseColors);
  attribute.needsUpdate = true;
  convertMaterial(batch.material);
  batch.geometry.userData.reefMaterialColorSpace = REEF_MATERIAL_COLOR_SPACE_VERSION;
}

/**
 * Phase 11 palette constants are authored as familiar sRGB values, while
 * Three.js vertex colors and material colors are consumed in linear space.
 * This final renderer-only conversion keeps the intended saturation and depth.
 */
export function applyReefMaterialColorSpace(
  scene: ReefThreeSceneState,
): ReefThreeSceneState {
  if (
    scene.foundation.geometry.userData.reefMaterialColorSpace
    === REEF_MATERIAL_COLOR_SPACE_VERSION
  ) {
    return scene;
  }

  convertFoundation(scene.foundation);
  for (const batch of scene.batches) convertBatch(batch);
  return scene;
}
