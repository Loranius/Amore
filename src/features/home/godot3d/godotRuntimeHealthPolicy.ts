import type { GodotRuntimeQuality, GodotTelemetryMessage } from './godotBridgeProtocol';

export type GodotRuntimeHealthStatus = 'warming' | 'healthy' | 'degraded' | 'critical';
export type GodotRuntimeHealthReason =
  | 'warming-up'
  | 'stable'
  | 'low-fps'
  | 'slow-frame'
  | 'memory-pressure';

export interface GodotRuntimeHealthSample {
  fps: number;
  frameMs: number;
  staticMemoryMb: number;
  drawCalls: number;
  quality: GodotRuntimeQuality;
  restores: number;
}

export interface GodotRuntimeHealthSnapshot {
  version: 'godot-runtime-health-v1';
  status: GodotRuntimeHealthStatus;
  reason: GodotRuntimeHealthReason;
  sampleCount: number;
  criticalStreak: number;
  degradedStreak: number;
  averageFps: number;
  minimumFps: number;
  p95FrameMs: number;
  maxStaticMemoryMb: number;
  maxDrawCalls: number;
  restores: number;
  quality: GodotRuntimeQuality | 'unknown';
  shouldFallback: boolean;
}

export interface GodotRuntimeHealthState {
  samples: GodotRuntimeHealthSample[];
  criticalStreak: number;
  degradedStreak: number;
  snapshot: GodotRuntimeHealthSnapshot;
}

export const GODOT_HEALTH_WARMUP_SAMPLES = 8;
export const GODOT_HEALTH_ACCEPTANCE_SAMPLES = 30;
export const GODOT_HEALTH_FALLBACK_STREAK = 8;
export const GODOT_HEALTH_MAX_SAMPLES = 120;

const CRITICAL_FPS = 18;
const DEGRADED_FPS = 28;
const CRITICAL_FRAME_MS = 70;
const DEGRADED_FRAME_MS = 40;
const CRITICAL_MEMORY_MB = 512;
const DEGRADED_MEMORY_MB = 384;

export const INITIAL_GODOT_RUNTIME_HEALTH: GodotRuntimeHealthState = {
  samples: [],
  criticalStreak: 0,
  degradedStreak: 0,
  snapshot: {
    version: 'godot-runtime-health-v1',
    status: 'warming',
    reason: 'warming-up',
    sampleCount: 0,
    criticalStreak: 0,
    degradedStreak: 0,
    averageFps: 0,
    minimumFps: 0,
    p95FrameMs: 0,
    maxStaticMemoryMb: 0,
    maxDrawCalls: 0,
    restores: 0,
    quality: 'unknown',
    shouldFallback: false,
  },
};

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

function sampleSeverity(sample: GodotRuntimeHealthSample): 'healthy' | 'degraded' | 'critical' {
  if (
    sample.fps < CRITICAL_FPS
    || sample.frameMs > CRITICAL_FRAME_MS
    || sample.staticMemoryMb > CRITICAL_MEMORY_MB
  ) {
    return 'critical';
  }
  if (
    sample.fps < DEGRADED_FPS
    || sample.frameMs > DEGRADED_FRAME_MS
    || sample.staticMemoryMb > DEGRADED_MEMORY_MB
  ) {
    return 'degraded';
  }
  return 'healthy';
}

function healthReason(sample: GodotRuntimeHealthSample): GodotRuntimeHealthReason {
  if (sample.staticMemoryMb > DEGRADED_MEMORY_MB) return 'memory-pressure';
  if (sample.fps < DEGRADED_FPS) return 'low-fps';
  if (sample.frameMs > DEGRADED_FRAME_MS) return 'slow-frame';
  return 'stable';
}

export function reduceGodotRuntimeHealth(
  current: GodotRuntimeHealthState,
  telemetry: GodotTelemetryMessage,
): GodotRuntimeHealthState {
  if (telemetry.suspended) return current;

  const sample: GodotRuntimeHealthSample = {
    fps: telemetry.fps,
    frameMs: telemetry.frame_ms,
    staticMemoryMb: telemetry.static_memory_mb,
    drawCalls: telemetry.draw_calls,
    quality: telemetry.quality,
    restores: telemetry.restores,
  };
  const severity = sampleSeverity(sample);
  const criticalStreak = severity === 'critical' ? current.criticalStreak + 1 : 0;
  const degradedStreak = severity === 'degraded'
    ? current.degradedStreak + 1
    : severity === 'critical'
      ? current.degradedStreak + 1
      : 0;
  const samples = [...current.samples, sample].slice(-GODOT_HEALTH_MAX_SAMPLES);
  const averageFps = samples.reduce((sum, item) => sum + item.fps, 0) / samples.length;
  const shouldFallback = criticalStreak >= GODOT_HEALTH_FALLBACK_STREAK;

  let status: GodotRuntimeHealthStatus = 'healthy';
  let reason: GodotRuntimeHealthReason = healthReason(sample);
  if (samples.length < GODOT_HEALTH_WARMUP_SAMPLES) {
    status = 'warming';
    reason = 'warming-up';
  } else if (shouldFallback || criticalStreak >= 4) {
    status = 'critical';
  } else if (degradedStreak >= 3) {
    status = 'degraded';
  }

  return {
    samples,
    criticalStreak,
    degradedStreak,
    snapshot: {
      version: 'godot-runtime-health-v1',
      status,
      reason,
      sampleCount: samples.length,
      criticalStreak,
      degradedStreak,
      averageFps,
      minimumFps: Math.min(...samples.map(item => item.fps)),
      p95FrameMs: percentile95(samples.map(item => item.frameMs)),
      maxStaticMemoryMb: Math.max(...samples.map(item => item.staticMemoryMb)),
      maxDrawCalls: Math.max(...samples.map(item => item.drawCalls)),
      restores: sample.restores,
      quality: sample.quality,
      shouldFallback,
    },
  };
}

export function isGodotHealthAcceptanceReady(snapshot: GodotRuntimeHealthSnapshot): boolean {
  return snapshot.sampleCount >= GODOT_HEALTH_ACCEPTANCE_SAMPLES
    && snapshot.status === 'healthy'
    && !snapshot.shouldFallback;
}
