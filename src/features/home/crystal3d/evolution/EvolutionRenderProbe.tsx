import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export interface EvolutionRenderMetrics {
  drawCalls: number;
  triangles: number;
  frame: number;
}

export function EvolutionRenderProbe({
  onReady,
  warmupFrames = 24,
}: {
  onReady: (metrics: EvolutionRenderMetrics) => void;
  warmupFrames?: number;
}) {
  const frame = useRef(0);
  const published = useRef(false);
  const maxCalls = useRef(0);
  const maxTriangles = useRef(0);

  useFrame(({ gl }) => {
    if (published.current) return;
    frame.current += 1;
    maxCalls.current = Math.max(maxCalls.current, gl.info.render.calls);
    maxTriangles.current = Math.max(maxTriangles.current, gl.info.render.triangles);
    if (frame.current < warmupFrames) return;

    published.current = true;
    onReady({
      drawCalls: maxCalls.current,
      triangles: maxTriangles.current,
      frame: frame.current,
    });
  });

  return null;
}
