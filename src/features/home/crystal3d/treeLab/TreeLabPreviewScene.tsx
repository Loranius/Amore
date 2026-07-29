import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from '../evolution/EvolutionRuntimeProbe';
import { evaluateTreeLabAcceptance } from './acceptance';
import { buildTreeLabPreview } from './buildTreeLabPreview';
import { resolveTreeLabLod } from './featureFlag';
import { TreeLabObject } from './TreeLabObject';
import './treeLabPreview.css';

function formatCount(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

export default function TreeLabPreviewScene() {
  const [lod] = useState(() => resolveTreeLabLod(
    typeof window === 'undefined' ? '' : window.location.search,
  ));
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const build = useMemo(() => buildTreeLabPreview(lod), [lod]);
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => {
    setRuntime(next);
  }, []);
  const acceptance = evaluateTreeLabAcceptance({
    vertices: build.mesh.diagnostics.vertexCount,
    triangles: build.mesh.diagnostics.triangleCount,
    buildMs: build.buildMs,
    drawCalls: runtime?.drawCalls ?? null,
  });
  const statusLabel = acceptance.status === 'pass'
    ? 'mobile budget OK'
    : acceptance.status === 'fail'
      ? `budget fail: ${acceptance.violations.join(', ')}`
      : 'runtime warming…';
  const badge = [
    'Tree Lab',
    lod,
    `${build.mesh.diagnostics.branchCount} гілок`,
    `${build.mesh.diagnostics.junctionCount} стиків`,
    `${formatCount(build.mesh.diagnostics.vertexCount)} vtx`,
    `${formatCount(build.mesh.diagnostics.triangleCount)} △`,
    runtime ? `${runtime.drawCalls} DC` : 'DC…',
    `${build.buildMs.toFixed(1)} ms`,
  ].join(' · ');

  return (
    <div
      className="crystal-wrap tree-lab-preview-wrap"
      data-tree-lab-preview="ready"
      data-tree-lab-lod={lod}
      data-tree-lab-acceptance={acceptance.status}
      data-tree-lab-violations={acceptance.violations.join(',')}
      data-tree-lab-branches={build.mesh.diagnostics.branchCount}
      data-tree-lab-junctions={build.mesh.diagnostics.junctionCount}
      data-tree-lab-vertices={build.mesh.diagnostics.vertexCount}
      data-tree-lab-triangles={build.mesh.diagnostics.triangleCount}
      data-tree-lab-build-ms={build.buildMs.toFixed(3)}
      data-tree-lab-draw-calls={runtime?.drawCalls ?? ''}
    >
      <Canvas
        dpr={lod === 'high' ? [1, 1.75] : lod === 'medium' ? [1, 1.5] : [1, 1.25]}
        camera={{ position: [6.2, 3.7, 8.4], fov: 40 }}
        gl={{ alpha: true, antialias: lod !== 'low' }}
      >
        <ambientLight intensity={0.72} />
        <directionalLight position={[4, 7, 5]} intensity={1.25} />
        <directionalLight position={[-4, 3, -2]} intensity={0.45} />
        <TreeLabObject mesh={build.mesh} />
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} warmupFrames={18} />
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={6.4}
          maxDistance={13}
          enableDamping={!reduceMotion}
          dampingFactor={0.08}
          target={[0, 2.55, 0]}
        />
      </Canvas>
      <span className="tree-lab-preview-badge" aria-label="Метрики Tree Lab preview">
        {badge}
      </span>
      <span
        className={`tree-lab-preview-status tree-lab-preview-status--${acceptance.status}`}
        aria-label="Перевірка мобільного бюджету Tree Lab"
      >
        {statusLabel}
      </span>
    </div>
  );
}
