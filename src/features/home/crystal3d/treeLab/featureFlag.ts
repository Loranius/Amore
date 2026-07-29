import type { OrganicMeshLod } from '@/engine/labs/organic';

export const TREE_LAB_RENDERER_QUERY_KEY = 'engine';
export const TREE_LAB_RENDERER_QUERY_VALUE = 'tree-lab';
export const TREE_LAB_LOD_QUERY_KEY = 'treeLod';

const TREE_LAB_LODS = new Set<OrganicMeshLod>(['high', 'medium', 'low']);

/** Explicit opt-in only. Production Home keeps the existing renderer by default. */
export function isTreeLabPreviewEnabled(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get(TREE_LAB_RENDERER_QUERY_KEY) === TREE_LAB_RENDERER_QUERY_VALUE;
}

export function resolveTreeLabLod(
  search: string,
  fallback: OrganicMeshLod = 'medium',
): OrganicMeshLod {
  const value = new URLSearchParams(search).get(TREE_LAB_LOD_QUERY_KEY);
  return value && TREE_LAB_LODS.has(value as OrganicMeshLod)
    ? value as OrganicMeshLod
    : fallback;
}
