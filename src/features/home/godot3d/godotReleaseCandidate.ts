import type { GodotReleaseControlSnapshot } from './godotReleaseControl';

export const GODOT_RELEASE_CANDIDATE_VERSION = 'godot-release-candidate-v1' as const;
export const GODOT_RELEASE_CANDIDATE_PHASE = 15 as const;
export const GODOT_RELEASE_REQUIRED_ASSETS = [
  'index.html',
  'index.js',
  'index.wasm',
  'index.pck',
] as const;

export type GodotReleaseRequiredAsset = typeof GODOT_RELEASE_REQUIRED_ASSETS[number];
export type GodotReleasePreflightStatus = 'bypassed' | 'checking' | 'ready' | 'failed';

export interface GodotReleaseCandidateAsset {
  file: GodotReleaseRequiredAsset;
  bytes: number;
  sha256: string;
}

export interface GodotReleaseCandidateManifest {
  version: typeof GODOT_RELEASE_CANDIDATE_VERSION;
  phase: typeof GODOT_RELEASE_CANDIDATE_PHASE;
  runtimeVersion: '4.7.1';
  releaseId: string;
  acceptanceDigest: string;
  buildSha: string;
  generatedAt: string;
  assets: GodotReleaseCandidateAsset[];
  totalBytes: number;
}

export interface GodotReleaseCandidateValidation {
  valid: boolean;
  errors: string[];
  manifest: GodotReleaseCandidateManifest | null;
}

export interface GodotReleasePreflightSnapshot {
  status: GodotReleasePreflightStatus;
  reason: string;
  manifest: GodotReleaseCandidateManifest | null;
}

type FetchResponse = Pick<Response, 'ok' | 'status' | 'json'>;
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<FetchResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

function isBuildSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{7,64}$/i.test(value);
}

function isRequiredAsset(value: unknown): value is GodotReleaseRequiredAsset {
  return typeof value === 'string'
    && GODOT_RELEASE_REQUIRED_ASSETS.includes(value as GodotReleaseRequiredAsset);
}

export function resolveGodotReleaseManifestUrl(runtimeUrl: string): string {
  const withoutQuery = runtimeUrl.split(/[?#]/, 1)[0] ?? runtimeUrl;
  const slashIndex = withoutQuery.lastIndexOf('/');
  const directory = slashIndex >= 0 ? withoutQuery.slice(0, slashIndex + 1) : '';
  return `${directory}release-manifest.json`;
}

export function isGodotReleaseOperationsEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get('godotReleaseOps') ?? '';
  return ['1', 'true', 'on'].includes(value.toLowerCase());
}

export function isGodotRollbackDrillEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get('godotRollbackDrill') ?? '';
  return ['1', 'true', 'on'].includes(value.toLowerCase());
}

export function validateGodotReleaseCandidateManifest(
  value: unknown,
  expected: Pick<GodotReleaseControlSnapshot, 'releaseId' | 'acceptanceDigest'>,
): GodotReleaseCandidateValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ['Release manifest must be an object.'], manifest: null };
  }

  if (value.version !== GODOT_RELEASE_CANDIDATE_VERSION) {
    errors.push(`Manifest version must be ${GODOT_RELEASE_CANDIDATE_VERSION}.`);
  }
  if (value.phase !== GODOT_RELEASE_CANDIDATE_PHASE) {
    errors.push(`Manifest phase must be ${GODOT_RELEASE_CANDIDATE_PHASE}.`);
  }
  if (value.runtimeVersion !== '4.7.1') {
    errors.push('Runtime version must be 4.7.1.');
  }
  if (value.releaseId !== expected.releaseId) {
    errors.push('Manifest release ID does not match the approved release.');
  }
  if (value.acceptanceDigest !== expected.acceptanceDigest) {
    errors.push('Manifest acceptance digest does not match the physical report.');
  }
  if (!isBuildSha(value.buildSha)) {
    errors.push('Manifest build SHA is invalid.');
  }
  if (typeof value.generatedAt !== 'string' || Number.isNaN(Date.parse(value.generatedAt))) {
    errors.push('Manifest generation timestamp is invalid.');
  }

  const assets = Array.isArray(value.assets) ? value.assets : [];
  if (!Array.isArray(value.assets)) errors.push('Manifest assets must be an array.');
  const assetMap = new Map<GodotReleaseRequiredAsset, GodotReleaseCandidateAsset>();
  for (const candidate of assets) {
    if (!isRecord(candidate) || !isRequiredAsset(candidate.file)) {
      errors.push('Manifest contains an unknown asset entry.');
      continue;
    }
    if (assetMap.has(candidate.file)) {
      errors.push(`Manifest asset ${candidate.file} is duplicated.`);
      continue;
    }
    if (typeof candidate.bytes !== 'number' || !Number.isInteger(candidate.bytes) || candidate.bytes <= 0) {
      errors.push(`Manifest asset ${candidate.file} has invalid byte size.`);
      continue;
    }
    if (!isSha256(candidate.sha256)) {
      errors.push(`Manifest asset ${candidate.file} has invalid SHA-256.`);
      continue;
    }
    assetMap.set(candidate.file, {
      file: candidate.file,
      bytes: candidate.bytes,
      sha256: candidate.sha256.toLowerCase(),
    });
  }

  for (const file of GODOT_RELEASE_REQUIRED_ASSETS) {
    if (!assetMap.has(file)) errors.push(`Manifest is missing ${file}.`);
  }
  const normalizedAssets = GODOT_RELEASE_REQUIRED_ASSETS
    .map(file => assetMap.get(file))
    .filter((asset): asset is GodotReleaseCandidateAsset => Boolean(asset));
  const totalBytes = normalizedAssets.reduce((sum, asset) => sum + asset.bytes, 0);
  if (typeof value.totalBytes !== 'number' || value.totalBytes !== totalBytes) {
    errors.push('Manifest total byte count does not match its assets.');
  }

  if (errors.length > 0) return { valid: false, errors, manifest: null };

  return {
    valid: true,
    errors: [],
    manifest: {
      version: GODOT_RELEASE_CANDIDATE_VERSION,
      phase: GODOT_RELEASE_CANDIDATE_PHASE,
      runtimeVersion: '4.7.1',
      releaseId: expected.releaseId,
      acceptanceDigest: expected.acceptanceDigest,
      buildSha: String(value.buildSha).toLowerCase(),
      generatedAt: String(value.generatedAt),
      assets: normalizedAssets,
      totalBytes,
    },
  };
}

export async function loadGodotReleaseCandidateManifest(input: {
  url: string;
  expected: Pick<GodotReleaseControlSnapshot, 'releaseId' | 'acceptanceDigest'>;
  fetcher?: FetchLike;
}): Promise<GodotReleaseCandidateManifest> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(input.url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Release manifest request failed with HTTP ${response.status}.`);
  }
  const validation = validateGodotReleaseCandidateManifest(
    await response.json(),
    input.expected,
  );
  if (!validation.valid || !validation.manifest) {
    throw new Error(validation.errors.join(' '));
  }
  return validation.manifest;
}
