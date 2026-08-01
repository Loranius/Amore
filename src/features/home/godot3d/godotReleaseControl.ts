import type { GodotEvolutionMode } from './godotFeatureFlag';

export type GodotReleaseStage =
  | 'blocked'
  | 'canary-5'
  | 'ramp-25'
  | 'ramp-50'
  | 'released-100';

export type GodotReleaseGateReason =
  | 'disabled-mode'
  | 'preview-mode'
  | 'kill-switch'
  | 'blocked-stage'
  | 'invalid-release-id'
  | 'missing-physical-digest'
  | 'ready';

export interface GodotReleaseControlSnapshot {
  version: 'godot-release-control-v1';
  stage: GodotReleaseStage;
  releaseId: string;
  acceptanceDigest: string;
  killSwitch: boolean;
  requestedRolloutPercent: number;
  stageLimitPercent: number;
  effectiveRolloutPercent: number;
  gateOpen: boolean;
  reason: GodotReleaseGateReason;
}

const STAGE_LIMITS: Record<GodotReleaseStage, number> = {
  blocked: 0,
  'canary-5': 5,
  'ramp-25': 25,
  'ramp-50': 50,
  'released-100': 100,
};

export function parseGodotReleaseStage(value: unknown): GodotReleaseStage {
  if (typeof value !== 'string') return 'blocked';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'canary-5' || normalized === '5') return 'canary-5';
  if (normalized === 'ramp-25' || normalized === '25') return 'ramp-25';
  if (normalized === 'ramp-50' || normalized === '50') return 'ramp-50';
  if (normalized === 'released-100' || normalized === '100' || normalized === 'released') {
    return 'released-100';
  }
  return 'blocked';
}

export function parseGodotKillSwitch(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'on', 'enabled', 'kill'].includes(value.trim().toLowerCase());
}

export function isValidGodotReleaseId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(value);
}

export function isValidSha256Digest(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

export function resolveGodotReleaseControl(input: {
  mode: GodotEvolutionMode;
  requestedRolloutPercent: number;
  stage: GodotReleaseStage;
  releaseId: string;
  acceptanceDigest: string;
  killSwitch: boolean;
}): GodotReleaseControlSnapshot {
  const releaseId = input.releaseId.trim();
  const acceptanceDigest = input.acceptanceDigest.trim().toLowerCase();
  const stageLimitPercent = STAGE_LIMITS[input.stage];
  const requestedRolloutPercent = Math.min(100, Math.max(0, Math.round(input.requestedRolloutPercent)));

  const base = {
    version: 'godot-release-control-v1' as const,
    stage: input.stage,
    releaseId,
    acceptanceDigest,
    killSwitch: input.killSwitch,
    requestedRolloutPercent,
    stageLimitPercent,
  };

  if (input.mode === 'disabled') {
    return { ...base, effectiveRolloutPercent: 0, gateOpen: false, reason: 'disabled-mode' };
  }
  if (input.mode === 'preview') {
    return {
      ...base,
      effectiveRolloutPercent: requestedRolloutPercent,
      gateOpen: true,
      reason: 'preview-mode',
    };
  }
  if (input.killSwitch) {
    return { ...base, effectiveRolloutPercent: 0, gateOpen: false, reason: 'kill-switch' };
  }
  if (input.stage === 'blocked') {
    return { ...base, effectiveRolloutPercent: 0, gateOpen: false, reason: 'blocked-stage' };
  }
  if (!isValidGodotReleaseId(releaseId)) {
    return { ...base, effectiveRolloutPercent: 0, gateOpen: false, reason: 'invalid-release-id' };
  }
  if (!isValidSha256Digest(acceptanceDigest)) {
    return {
      ...base,
      effectiveRolloutPercent: 0,
      gateOpen: false,
      reason: 'missing-physical-digest',
    };
  }

  return {
    ...base,
    effectiveRolloutPercent: Math.min(requestedRolloutPercent, stageLimitPercent),
    gateOpen: true,
    reason: 'ready',
  };
}
