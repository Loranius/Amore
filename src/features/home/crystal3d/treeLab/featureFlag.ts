import type { OrganicMeshLod } from '@/engine/labs/organic';

export const TREE_LAB_RENDERER_QUERY_KEY = 'engine';
export const TREE_LAB_RENDERER_QUERY_VALUE = 'tree-lab';
export const TREE_LAB_LOD_QUERY_KEY = 'treeLod';
export const TREE_LAB_SOURCE_QUERY_KEY = 'treeSource';

export type TreeLabSource = 'fixture' | 'portal';

const TREE_LAB_LODS = new Set<OrganicMeshLod>(['high', 'medium', 'low']);
const TREE_LAB_SOURCES = new Set<TreeLabSource>(['fixture', 'portal']);

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

/** Fixture stays the default regression baseline; portal data needs explicit opt-in. */
export function resolveTreeLabSource(
  search: string,
  fallback: TreeLabSource = 'fixture',
): TreeLabSource {
  const value = new URLSearchParams(search).get(TREE_LAB_SOURCE_QUERY_KEY);
  return value && TREE_LAB_SOURCES.has(value as TreeLabSource)
    ? value as TreeLabSource
    : fallback;
}
