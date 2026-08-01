import type { GodotDeviceAcceptanceReport } from './godotDeviceAcceptance';

export interface GodotPhysicalAcceptanceValidation {
  valid: boolean;
  errors: string[];
  report: GodotDeviceAcceptanceReport | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateGodotPhysicalAcceptanceReport(
  value: unknown,
): GodotPhysicalAcceptanceValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ['Report must be a JSON object.'], report: null };
  }

  const environment = isRecord(value.environment) ? value.environment : null;
  const runtime = isRecord(value.runtime) ? value.runtime : null;
  const health = isRecord(value.health) ? value.health : null;
  const criteria = isRecord(value.criteria) ? value.criteria : null;

  if (value.version !== 'godot-device-acceptance-v2') errors.push('Unsupported report version.');
  if (value.assessment !== 'physical') errors.push('Report assessment must be physical.');
  if (environment?.automated !== false) errors.push('Automated devices cannot approve a release.');
  if (value.workflowPassed !== true) errors.push('Acceptance workflow is incomplete.');
  if (value.passed !== true) errors.push('Report does not contain PHYSICAL PASS.');
  if (runtime?.phase !== 13) errors.push('Report must target Crystal Phase 13 runtime.');
  if (runtime?.species !== 'crystal') errors.push('Report species must be crystal.');
  if (typeof runtime?.signature !== 'string' || !/^[0-9a-f]{16}$/i.test(runtime.signature)) {
    errors.push('Deterministic signature is missing or malformed.');
  }
  if (runtime?.motion !== 'full' && runtime?.motion !== 'reduced') {
    errors.push('Motion profile was not captured.');
  }
  if (health?.status !== 'healthy') errors.push('Runtime health must be healthy.');
  if (typeof health?.sampleCount !== 'number' || health.sampleCount < 30) {
    errors.push('At least 30 telemetry samples are required.');
  }
  if (health?.shouldFallback !== false) errors.push('Fallback must not be requested.');
  if (typeof health?.restores !== 'number' || health.restores < 1) {
    errors.push('A successful background restore is required.');
  }

  const requiredCriteria = [
    'runtimeAccepted',
    'stableThirtySecondWindow',
    'healthyRuntime',
    'orbitCompleted',
    'backgroundRestoreCompleted',
    'deterministicSignaturePresent',
    'motionProfileCaptured',
  ];
  for (const key of requiredCriteria) {
    if (criteria?.[key] !== true) errors.push(`Acceptance criterion failed: ${key}.`);
  }

  if (value.privacy !== 'No Artifact DNA, Evolution Events, Supabase data or relationship content included.') {
    errors.push('Privacy declaration is missing.');
  }

  return {
    valid: errors.length === 0,
    errors,
    report: errors.length === 0 ? value as unknown as GodotDeviceAcceptanceReport : null,
  };
}

export async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createGodotReleaseEnvSnippet(input: {
  releaseId: string;
  acceptanceDigest: string;
  stage?: 'canary-5' | 'ramp-25' | 'ramp-50' | 'released-100';
}): string {
  const stage = input.stage ?? 'canary-5';
  const rollout = stage === 'canary-5'
    ? 5
    : stage === 'ramp-25'
      ? 25
      : stage === 'ramp-50'
        ? 50
        : 100;
  return [
    'VITE_EVOLUTION_GODOT=production',
    `VITE_EVOLUTION_GODOT_RELEASE_STAGE=${stage}`,
    `VITE_EVOLUTION_GODOT_RELEASE_ID=${input.releaseId}`,
    `VITE_EVOLUTION_GODOT_ACCEPTANCE_SHA256=${input.acceptanceDigest}`,
    'VITE_EVOLUTION_GODOT_KILL_SWITCH=off',
    `VITE_EVOLUTION_GODOT_ROLLOUT=${rollout}`,
  ].join('\n');
}
