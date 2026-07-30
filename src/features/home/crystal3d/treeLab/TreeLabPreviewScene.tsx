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
  const totalVertices = build.mesh.diagnostics.vertexCount
    + build.rootGeometry.diagnostics.vertexCount
    + build.leaves.diagnostics.sharedVertexCount;
  const totalTriangles = build.mesh.diagnostics.triangleCount
    + build.rootGeometry.diagnostics.triangleCount
    + build.leaves.diagnostics.renderedTriangleCount;
  const acceptance = evaluateTreeLabAcceptance({
    vertices: totalVertices,
    triangles: totalTriangles,
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
  const barkMaterial = build.materials.materials.find((material) => material.role === 'bark');
  const foliageMaterial = build.materials.materials.find((material) => material.role === 'foliage');
  const badge = [
    sourceLabel,
    build.lod,
    build.composition.silhouette,
    `${Math.round(build.composition.score.total * 100)}% comp`,
    `${build.roots.diagnostics.emittedRootCount} roots`,
    `${Math.round(build.groundContact.diagnostics.visiblePathFraction * 100)}% visible`,
    `${formatCount(build.terrain.diagnostics.triangleCount)} terrain △`,
    `${formatCount(build.rootGeometry.diagnostics.triangleCount)} static △`,
    `${build.foliage.diagnostics.emittedClusterCount} clusters`,
    `${build.leaves.instances.length} cards`,
    `${build.life.leaves.length} live`,
    `${build.materials.diagnostics.uniqueMaterialCount} mat`,
    `${build.mesh.diagnostics.branchCount} гілок`,
    `${formatCount(totalTriangles)} △`,
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
      data-tree-lab-root-candidates={build.roots.diagnostics.candidateRootCount}
      data-tree-lab-root-count={build.roots.diagnostics.emittedRootCount}
      data-tree-lab-root-surface={build.roots.diagnostics.surfaceRootCount}
      data-tree-lab-root-near-surface={build.roots.diagnostics.nearSurfaceRootCount}
      data-tree-lab-root-samples={build.roots.diagnostics.sampleCount}
      data-tree-lab-root-truncated={build.roots.diagnostics.truncatedRootIds.length}
      data-tree-lab-root-budget={build.roots.diagnostics.rootBudget}
      data-tree-lab-root-sample-budget={build.roots.diagnostics.sampleBudget}
      data-tree-lab-ground-contact="true"
      data-tree-lab-ground-level={build.groundContact.ground.levelY}
      data-tree-lab-ground-burial-depth={build.groundContact.burialDepth}
      data-tree-lab-ground-visible-path-fraction={build.groundContact.diagnostics.visiblePathFraction}
      data-tree-lab-ground-visible-roots={build.groundContact.diagnostics.visibleRootCount}
      data-tree-lab-ground-visible-samples={build.groundContact.diagnostics.visibleSampleCount}
      data-tree-lab-ground-buried-samples={build.groundContact.diagnostics.buriedSampleCount}
      data-tree-lab-ground-prefix-preserved={String(build.groundContact.diagnostics.appendOnlyPrefixPreserved)}
      data-tree-lab-ground-terrain-binding={build.groundContact.ground.terrainBindingId}
      data-tree-lab-ground-collar-bottom-y={build.groundContact.collar.bottomY}
      data-tree-lab-ground-collar-top-y={build.groundContact.collar.topY}
      data-tree-lab-ground-collar-bottom-radius={build.groundContact.collar.bottomRadius}
      data-tree-lab-ground-collar-top-radius={build.groundContact.collar.topRadius}
      data-tree-lab-ground-extra-draw-calls={build.groundContact.diagnostics.estimatedAdditionalDrawCalls}
      data-tree-lab-ground-extra-materials={build.groundContact.diagnostics.estimatedAdditionalMaterials}
      data-tree-lab-terrain-binding="true"
      data-tree-lab-terrain-binding-id={build.terrain.binding.id}
      data-tree-lab-terrain-source-binding={build.terrain.binding.sourceBindingId}
      data-tree-lab-terrain-surface-id={build.terrain.binding.surfaceId}
      data-tree-lab-terrain-heightfield-id={build.terrain.binding.heightfieldId}
      data-tree-lab-terrain-ground-plane-id={build.terrain.binding.groundPlaneId}
      data-tree-lab-terrain-ground-level={build.terrain.groundLevelY}
      data-tree-lab-terrain-surface-radius={build.terrain.surfaceRadius}
      data-tree-lab-terrain-plateau-radius={build.terrain.plateauRadius}
      data-tree-lab-terrain-root-coverage-radius={build.terrain.diagnostics.rootCoverageRadius}
      data-tree-lab-terrain-radial-segments={build.terrain.diagnostics.radialSegments}
      data-tree-lab-terrain-rings={build.terrain.diagnostics.ringCount}
      data-tree-lab-terrain-vertices={build.terrain.diagnostics.vertexCount}
      data-tree-lab-terrain-triangles={build.terrain.diagnostics.triangleCount}
      data-tree-lab-terrain-min-y={build.terrain.diagnostics.minimumY}
      data-tree-lab-terrain-max-y={build.terrain.diagnostics.maximumY}
      data-tree-lab-terrain-max-height-delta={build.terrain.diagnostics.maximumHeightDelta}
      data-tree-lab-terrain-vertex-budget={build.terrain.diagnostics.vertexBudget}
      data-tree-lab-terrain-triangle-budget={build.terrain.diagnostics.triangleBudget}
      data-tree-lab-terrain-vertex-budget-exceeded={String(build.terrain.diagnostics.vertexBudgetExceeded)}
      data-tree-lab-terrain-triangle-budget-exceeded={String(build.terrain.diagnostics.triangleBudgetExceeded)}
      data-tree-lab-terrain-ground-preserved={String(build.terrain.diagnostics.groundPlanePreserved)}
      data-tree-lab-terrain-root-coverage-preserved={String(build.terrain.diagnostics.rootCoveragePreserved)}
      data-tree-lab-terrain-merged={String(build.terrain.diagnostics.mergedIntoRootGeometry)}
      data-tree-lab-terrain-extra-draw-calls={build.terrain.diagnostics.estimatedAdditionalDrawCalls}
      data-tree-lab-terrain-extra-materials={build.terrain.diagnostics.estimatedAdditionalMaterials}
      data-tree-lab-root-geometry-roots={build.rootGeometry.diagnostics.renderedRootCount}
      data-tree-lab-root-geometry-vertices={build.rootGeometry.diagnostics.vertexCount}
      data-tree-lab-root-geometry-triangles={build.rootGeometry.diagnostics.triangleCount}
      data-tree-lab-root-geometry-draw-calls={build.rootGeometry.diagnostics.estimatedDrawCalls}
      data-tree-lab-root-geometry-anchored={String(build.rootGeometry.diagnostics.anchoredToGround)}
      data-tree-lab-root-geometry-contact-applied={String(build.rootGeometry.diagnostics.contactApplied)}
      data-tree-lab-root-geometry-collar-vertices={build.rootGeometry.diagnostics.collarVertexCount}
      data-tree-lab-root-geometry-collar-triangles={build.rootGeometry.diagnostics.collarTriangleCount}
      data-tree-lab-root-geometry-terrain-applied={String(build.rootGeometry.diagnostics.terrainApplied)}
      data-tree-lab-root-geometry-terrain-vertices={build.rootGeometry.diagnostics.terrainVertexCount}
      data-tree-lab-root-geometry-terrain-triangles={build.rootGeometry.diagnostics.terrainTriangleCount}
      data-tree-lab-root-geometry-terrain-merged={String(build.rootGeometry.diagnostics.terrainMergedIntoStaticMesh)}
      data-tree-lab-root-geometry-vertex-budget={build.rootGeometry.diagnostics.vertexBudget}
      data-tree-lab-root-geometry-triangle-budget={build.rootGeometry.diagnostics.triangleBudget}
      data-tree-lab-root-geometry-vertex-budget-exceeded={String(build.rootGeometry.diagnostics.vertexBudgetExceeded)}
      data-tree-lab-root-geometry-triangle-budget-exceeded={String(build.rootGeometry.diagnostics.triangleBudgetExceeded)}
      data-tree-lab-foliage-candidates={build.foliage.diagnostics.candidateClusterCount}
      data-tree-lab-foliage-clusters={build.foliage.diagnostics.emittedClusterCount}
      data-tree-lab-foliage-leaves={build.foliage.diagnostics.totalLeafCount}
      data-tree-lab-foliage-cells={build.foliage.diagnostics.occupiedCellIds.length}
      data-tree-lab-foliage-truncated={build.foliage.diagnostics.truncatedClusterIds.length}
      data-tree-lab-leaf-candidates={build.leaves.diagnostics.candidateInstanceCount}
      data-tree-lab-leaf-instances={build.leaves.diagnostics.renderedInstanceCount}
      data-tree-lab-leaf-shared-vertices={build.leaves.diagnostics.sharedVertexCount}
      data-tree-lab-leaf-shared-triangles={build.leaves.diagnostics.sharedTriangleCount}
      data-tree-lab-leaf-rendered-triangles={build.leaves.diagnostics.renderedTriangleCount}
      data-tree-lab-leaf-truncated={build.leaves.diagnostics.truncatedInstanceIds.length}
      data-tree-lab-leaf-draw-calls={build.leaves.diagnostics.estimatedDrawCalls}
      data-tree-lab-material-count={build.materials.diagnostics.uniqueMaterialCount}
      data-tree-lab-material-budget={build.materials.diagnostics.materialBudget}
      data-tree-lab-material-budget-exceeded={String(build.materials.diagnostics.materialBudgetExceeded)}
      data-tree-lab-material-quantization={build.materials.diagnostics.quantizationSteps}
      data-tree-lab-bark-material={barkMaterial?.signature ?? ''}
      data-tree-lab-foliage-material={foliageMaterial?.signature ?? ''}
      data-tree-lab-life-profiles={build.life.diagnostics.emittedLeafProfileCount}
      data-tree-lab-life-truncated={build.life.diagnostics.truncatedLeafInstanceIds.length}
      data-tree-lab-life-motion-scale={build.life.motionScale}
      data-tree-lab-life-sway-x={build.life.branch.swayXAmplitudeRad}
      data-tree-lab-life-sway-z={build.life.branch.swayZAmplitudeRad}
      data-tree-lab-life-matrix-updates={build.life.diagnostics.estimatedMatrixUpdatesPerFrame}
      data-tree-lab-life-extra-draw-calls={build.life.diagnostics.estimatedAdditionalDrawCalls}
      data-tree-lab-life-reduced-motion={String(reduceMotion)}
      data-tree-lab-branches={build.mesh.diagnostics.branchCount}
      data-tree-lab-junctions={build.mesh.diagnostics.junctionCount}
      data-tree-lab-branch-vertices={build.mesh.diagnostics.vertexCount}
      data-tree-lab-branch-triangles={build.mesh.diagnostics.triangleCount}
      data-tree-lab-vertices={totalVertices}
      data-tree-lab-triangles={totalTriangles}
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
        <TreeLabObject
          mesh={build.mesh}
          rootGeometry={build.rootGeometry}
          leaves={build.leaves}
          materials={build.materials}
          life={build.life}
          reducedMotion={reduceMotion}
        />
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
