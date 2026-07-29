import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from '../evolution/EvolutionRuntimeProbe';
import { evaluateTreeLabAcceptance } from './acceptance';
import {
  buildTreeLabPreview,
  type TreeLabPreviewBuild,
} from './buildTreeLabPreview';
import {
  resolveTreeLabLod,
  resolveTreeLabSource,
  type TreeLabSource,
} from './featureFlag';
import { TreeLabObject } from './TreeLabObject';
import { useTreeLabPortalPreview } from './useTreeLabPortalPreview';
import './treeLabPreview.css';

function formatCount(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

type RenderedTreeLabSource = TreeLabSource | 'fixture-fallback';

interface TreeLabRenderedSceneProps {
  build: TreeLabPreviewBuild;
  source: RenderedTreeLabSource;
  adapterDiagnosticCount: number;
  errorMessage?: string | undefined;
}

function TreeLabRenderedScene({
  build,
  source,
  adapterDiagnosticCount,
  errorMessage,
}: TreeLabRenderedSceneProps) {
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
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
  const budgetLabel = acceptance.status === 'pass'
    ? 'mobile budget OK'
    : acceptance.status === 'fail'
      ? `budget fail: ${acceptance.violations.join(', ')}`
      : 'runtime warming…';
  const statusLabel = errorMessage ? `portal fallback · ${budgetLabel}` : budgetLabel;
  const sourceLabel = source === 'portal'
    ? 'Portal history'
    : source === 'fixture-fallback'
      ? 'Fixture fallback'
      : 'Fixture baseline';
  const badge = [
    sourceLabel,
    build.lod,
    build.composition.silhouette,
    `${Math.round(build.composition.score.total * 100)}% comp`,
    `${build.foliage.diagnostics.emittedClusterCount} foliage`,
    `${build.foliage.diagnostics.totalLeafCount} leaves`,
    `${build.mesh.diagnostics.branchCount} гілок`,
    `${build.mesh.diagnostics.junctionCount} стиків`,
    `${formatCount(build.mesh.diagnostics.vertexCount)} vtx`,
    `${formatCount(build.mesh.diagnostics.triangleCount)} △`,
    runtime ? `${runtime.drawCalls} DC` : 'DC…',
    `${build.buildMs.toFixed(1)} ms`,
  ].join(' · ');
  const speciesBadge = [
    build.species.state.stage,
    `${build.species.diagnostics.annualInstructionCount} річн.`,
    `${build.species.diagnostics.eventInstructionCount} подій`,
    `${build.field.diagnostics.attractorCount} цілей`,
  ].join(' · ');

  return (
    <div
      className="crystal-wrap tree-lab-preview-wrap"
      data-tree-lab-preview="ready"
      data-tree-lab-source={source}
      data-tree-lab-couple-id={build.artifact.coupleId}
      data-tree-lab-normalized-events={build.artifact.events.length}
      data-tree-lab-adapter-diagnostics={adapterDiagnosticCount}
      data-tree-lab-error={errorMessage ?? ''}
      data-tree-lab-lod={build.lod}
      data-tree-lab-acceptance={acceptance.status}
      data-tree-lab-violations={acceptance.violations.join(',')}
      data-tree-lab-stage={build.species.state.stage}
      data-tree-lab-annual-instructions={build.species.diagnostics.annualInstructionCount}
      data-tree-lab-event-instructions={build.species.diagnostics.eventInstructionCount}
      data-tree-lab-attractors={build.field.diagnostics.attractorCount}
      data-tree-lab-truncated={build.field.diagnostics.truncatedInstructionIds.length}
      data-tree-lab-silhouette={build.composition.silhouette}
      data-tree-lab-composition-score={build.composition.score.total}
      data-tree-lab-negative-space={build.composition.score.negativeSpace}
      data-tree-lab-crown-density={build.composition.score.crownDensity}
      data-tree-lab-empty-cells={build.composition.diagnostics.emptyCellCount}
      data-tree-lab-foliage-candidates={build.foliage.diagnostics.candidateClusterCount}
      data-tree-lab-foliage-clusters={build.foliage.diagnostics.emittedClusterCount}
      data-tree-lab-foliage-leaves={build.foliage.diagnostics.totalLeafCount}
      data-tree-lab-foliage-cells={build.foliage.diagnostics.occupiedCellIds.length}
      data-tree-lab-foliage-truncated={build.foliage.diagnostics.truncatedClusterIds.length}
      data-tree-lab-branches={build.mesh.diagnostics.branchCount}
      data-tree-lab-junctions={build.mesh.diagnostics.junctionCount}
      data-tree-lab-vertices={build.mesh.diagnostics.vertexCount}
      data-tree-lab-triangles={build.mesh.diagnostics.triangleCount}
      data-tree-lab-build-ms={build.buildMs.toFixed(3)}
      data-tree-lab-draw-calls={runtime?.drawCalls ?? ''}
    >
      <Canvas
        dpr={build.lod === 'high' ? [1, 1.75] : build.lod === 'medium' ? [1, 1.5] : [1, 1.25]}
        camera={{ position: [6.2, 3.7, 8.4], fov: 40 }}
        gl={{ alpha: true, antialias: build.lod !== 'low' }}
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
      <span className="tree-lab-preview-species" aria-label="Дані Tree Species preview">
        {speciesBadge}
      </span>
      <span className="tree-lab-preview-badge" aria-label="Метрики Tree Lab preview">
        {badge}
      </span>
      <span
        className={`tree-lab-preview-status tree-lab-preview-status--${acceptance.status}`}
        aria-label="Перевірка мобільного бюджету Tree Lab"
        title={errorMessage}
      >
        {statusLabel}
      </span>
    </div>
  );
}

interface TreeLabFixtureSceneProps {
  lod: TreeLabPreviewBuild['lod'];
  source?: 'fixture' | 'fixture-fallback';
  errorMessage?: string | undefined;
}

function TreeLabFixtureScene({
  lod,
  source = 'fixture',
  errorMessage,
}: TreeLabFixtureSceneProps) {
  const build = useMemo(() => buildTreeLabPreview(lod), [lod]);
  return (
    <TreeLabRenderedScene
      build={build}
      source={source}
      adapterDiagnosticCount={0}
      errorMessage={errorMessage}
    />
  );
}

function TreeLabPortalScene({ lod }: { lod: TreeLabPreviewBuild['lod'] }) {
  const { preview, isPending, error } = useTreeLabPortalPreview(lod);

  if (isPending) return <CrystalPlaceholder />;
  if (error || !preview) {
    return (
      <TreeLabFixtureScene
        lod={lod}
        source="fixture-fallback"
        errorMessage={error?.message ?? 'Portal tree preview failed.'}
      />
    );
  }

  return (
    <TreeLabRenderedScene
      build={preview.build}
      source="portal"
      adapterDiagnosticCount={preview.diagnostics.length}
    />
  );
}

export default function TreeLabPreviewScene() {
  const [search] = useState(
    () => typeof window === 'undefined' ? '' : window.location.search,
  );
  const [lod] = useState(() => resolveTreeLabLod(search));
  const [source] = useState(() => resolveTreeLabSource(search));

  return source === 'portal'
    ? <TreeLabPortalScene lod={lod} />
    : <TreeLabFixtureScene lod={lod} />;
}
