import type {
  GodotInteractionKind,
  GodotLifecycleMessage,
  GodotStateMessage,
  GodotTelemetryMessage,
} from './godotBridgeProtocol';
import {
  isGodotHealthAcceptanceReady,
  type GodotRuntimeHealthSnapshot,
} from './godotRuntimeHealthPolicy';

export type GodotInteractionCounts = Record<GodotInteractionKind, number>;

export const INITIAL_GODOT_INTERACTIONS: GodotInteractionCounts = {
  orbit: 0,
  zoom: 0,
  tap: 0,
  keyboard: 0,
};

export interface GodotDeviceEnvironment {
  userAgent: string;
  platform: string;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  automated: boolean;
}

export interface GodotDeviceAcceptanceCriteria {
  runtimeAccepted: boolean;
  stableThirtySecondWindow: boolean;
  healthyRuntime: boolean;
  orbitCompleted: boolean;
  backgroundRestoreCompleted: boolean;
  deterministicSignaturePresent: boolean;
  motionProfileCaptured: boolean;
}

export interface GodotDeviceAcceptanceReport {
  version: 'godot-device-acceptance-v2';
  generatedAt: string;
  assessment: 'automation' | 'physical';
  environment: GodotDeviceEnvironment;
  runtime: {
    version: string;
    phase: number | null;
    signature: string;
    species: string;
    motion: 'full' | 'reduced' | 'unknown';
    quality: string;
    renderScale: number | null;
    lifeHz: number | null;
  };
  health: GodotRuntimeHealthSnapshot;
  latestTelemetry: GodotTelemetryMessage | null;
  lifecycle: GodotLifecycleMessage | null;
  interactions: GodotInteractionCounts;
  criteria: GodotDeviceAcceptanceCriteria;
  workflowPassed: boolean;
  passed: boolean;
  privacy: 'No Artifact DNA, Evolution Events, Supabase data or relationship content included.';
}

export function incrementGodotInteraction(
  current: GodotInteractionCounts,
  kind: GodotInteractionKind,
): GodotInteractionCounts {
  return { ...current, [kind]: current[kind] + 1 };
}

export function isGodotDiagnosticsEnabled(search: string): boolean {
  const params = new URLSearchParams(search);
  return ['1', 'true', 'on'].includes((params.get('godotDiagnostics') ?? '').toLowerCase());
}

export function readGodotDeviceEnvironment(): GodotDeviceEnvironment {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: 'server',
      platform: 'server',
      viewportWidth: 0,
      viewportHeight: 0,
      screenWidth: 0,
      screenHeight: 0,
      devicePixelRatio: 1,
      automated: true,
    };
  }
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    automated: navigator.webdriver === true,
  };
}

export function createGodotDeviceAcceptanceReport(input: {
  generatedAt?: string;
  environment: GodotDeviceEnvironment;
  state: GodotStateMessage | null;
  health: GodotRuntimeHealthSnapshot;
  telemetry: GodotTelemetryMessage | null;
  lifecycle: GodotLifecycleMessage | null;
  interactions: GodotInteractionCounts;
}): GodotDeviceAcceptanceReport {
  const criteria: GodotDeviceAcceptanceCriteria = {
    runtimeAccepted: Boolean(input.state && input.state.source === 'portal'),
    stableThirtySecondWindow: input.health.sampleCount >= 30,
    healthyRuntime: isGodotHealthAcceptanceReady(input.health),
    orbitCompleted: input.interactions.orbit > 0,
    backgroundRestoreCompleted: input.health.restores > 0,
    deterministicSignaturePresent: Boolean(input.state?.signature),
    motionProfileCaptured: input.state?.motion === 'full' || input.state?.motion === 'reduced',
  };
  const workflowPassed = criteria.runtimeAccepted
    && criteria.stableThirtySecondWindow
    && criteria.orbitCompleted
    && criteria.backgroundRestoreCompleted
    && criteria.deterministicSignaturePresent
    && criteria.motionProfileCaptured;

  return {
    version: 'godot-device-acceptance-v2',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    assessment: input.environment.automated ? 'automation' : 'physical',
    environment: input.environment,
    runtime: {
      version: input.state?.version ?? input.telemetry?.version ?? 'unknown',
      phase: input.state?.phase ?? null,
      signature: input.state?.signature ?? '',
      species: input.state?.species ?? 'unknown',
      motion: input.state?.motion ?? 'unknown',
      quality: input.telemetry?.quality ?? input.state?.quality ?? 'unknown',
      renderScale: input.telemetry?.render_scale ?? input.state?.render_scale ?? null,
      lifeHz: input.telemetry?.life_hz ?? input.state?.life_hz ?? null,
    },
    health: input.health,
    latestTelemetry: input.telemetry,
    lifecycle: input.lifecycle,
    interactions: input.interactions,
    criteria,
    workflowPassed,
    passed: workflowPassed && criteria.healthyRuntime && !input.environment.automated,
    privacy: 'No Artifact DNA, Evolution Events, Supabase data or relationship content included.',
  };
}
