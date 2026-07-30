export type HomeArtifact = 'crystal' | 'tree' | 'reef';

export const HOME_ARTIFACT_QUERY_KEY = 'artifact';
export const HOME_ARTIFACT_STORAGE_KEY = 'amore:home-artifact';

const HOME_ARTIFACTS = new Set<HomeArtifact>(['crystal', 'tree', 'reef']);

export const HOME_ARTIFACT_LABELS: Readonly<Record<HomeArtifact, string>> = {
  crystal: 'Кристал',
  tree: 'Дерево',
  reef: 'Риф',
};

export function parseHomeArtifact(value: string | null | undefined): HomeArtifact | null {
  return value && HOME_ARTIFACTS.has(value as HomeArtifact)
    ? value as HomeArtifact
    : null;
}

/**
 * Explicit laboratory query flags retain compatibility with existing preview
 * links. Otherwise the shareable artifact query wins over the local preference.
 */
export function resolveHomeArtifact(
  search: string,
  storedValue?: string | null,
): HomeArtifact {
  const params = new URLSearchParams(search);
  const engine = params.get('engine');
  if (engine === 'tree-lab') return 'tree';
  if (engine === 'evolution') return 'crystal';

  return parseHomeArtifact(params.get(HOME_ARTIFACT_QUERY_KEY))
    ?? parseHomeArtifact(storedValue)
    ?? 'crystal';
}

/** Removes old renderer-preview flags and publishes one stable Home selection. */
export function withHomeArtifactSearch(search: string, artifact: HomeArtifact): string {
  const params = new URLSearchParams(search);
  params.delete('engine');
  params.delete('treeSource');
  params.delete('treeLod');
  params.set(HOME_ARTIFACT_QUERY_KEY, artifact);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
