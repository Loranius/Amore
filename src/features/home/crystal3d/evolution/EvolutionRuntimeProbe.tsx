import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export interface EvolutionRuntimeMetrics {
  frames: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
}

export function EvolutionRuntimeProbe({
  onMetrics,
  warmupFrames = 24,
}: {
  onMetrics: (metrics: EvolutionRuntimeMetrics) => void;
  warmupFrames?: number;
}) {
  const gl = useThree((state) => state.gl);
  const frameRef = useRef(0);
  const lastRef = useRef('');

  useEffect(() => {
    frameRef.current = 0;
    lastRef.current = '';
  }, [gl, warmupFrames]);

  useFrame(() => {
    frameRef.current += 1;
    if (frameRef.current < warmupFrames) return;

    // R3F renders after useFrame callbacks, so renderer.info describes the
    // previous completed frame. That is exactly what the acceptance test needs.
    const metrics: EvolutionRuntimeMetrics = {
      frames: frameRef.current,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines,
    };
    const signature = [
      metrics.drawCalls,
      metrics.triangles,
      metrics.points,
      metrics.lines,
    ].join(':');
    if (signature === lastRef.current) return;
    lastRef.current = signature;
    onMetrics(metrics);
  });

  return null;
}
