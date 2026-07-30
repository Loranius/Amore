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
    + build.leaves.diagnostics.sharedVertexCount
    + build.groundDetails.diagnostics.sharedVertexCount;
  const totalTriangles = build.mesh.diagnostics.triangleCount
    + build.rootGeometry.diagnostics.triangleCount
    + build.leaves.diagnostics.renderedTriangleCount
    + build.groundDetails.diagnostics.renderedTriangleCount;
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
  const totalMaterials = build.materials.diagnostics.uniqueMaterialCount
    + build.groundDetails.diagnostics.estimatedAdditionalMaterials;
  const badge = [
    sourceLabel,
    build.lod,
    build.composition.silhouette,
    `${Math.round(build.composition.score.total * 100)}% comp`,
    `${build.roots.diagnostics.emittedRootCount} roots`,
    `${Math.round(build.groundContact.diagnostics.visiblePathFraction * 100)}% visible`,
    `${formatCount(build.terrain.diagnostics.triangleCount)} terrain △`,
    `${build.soilSurface.diagnostics.uniqueTintCount} soil tints`,
    `${build.barkSurface.diagnostics.uniqueTintCount} bark tints`,
    `${build.groundDetails.instances.length} ground details`,
    `${formatCount(build.rootGeometry.diagnostics.triangleCount)} static △`,
    `${build.foliage.diagnostics.emittedClusterCount} clusters`,
    `${build.leaves.instances.length} cards`,
    `${build.canopyDepth.diagnostics.innerLeafCount}/${build.canopyDepth.diagnostics.middleLeafCount}/${build.canopyDepth.diagnostics.outerLeafCount} depth`,
    `${build.canopyLight.diagnostics.shadeLeafCount}/${build.canopyLight.diagnostics.transitionLeafCount}/${build.canopyLight.diagnostics.sunlitLeafCount} light`,
    `${build.life.leaves.length} live`,
    `${totalMaterials} mat`,
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
      data-tree-lab-soil-surface="true"
      data-tree-lab-soil-id={build.soilSurface.descriptor.id}
      data-tree-lab-soil-palette-id={build.soilSurface.descriptor.paletteId}
      data-tree-lab-soil-tint-attribute={build.soilSurface.descriptor.tintAttributeId}
      data-tree-lab-soil-terrain-surface-id={build.soilSurface.descriptor.terrainSurfaceId}
      data-tree-lab-soil-material-role={build.soilSurface.descriptor.materialRole}
      data-tree-lab-soil-signature={build.soilSurface.signature}
      data-tree-lab-soil-root-geometry-vertices={build.soilSurface.diagnostics.rootGeometryVertexCount}
      data-tree-lab-soil-prefix-vertices={build.soilSurface.diagnostics.preservedBarkVertexCount}
      data-tree-lab-soil-terrain-offset={build.soilSurface.diagnostics.terrainVertexOffset}
      data-tree-lab-soil-terrain-vertices={build.soilSurface.diagnostics.terrainVertexCount}
      data-tree-lab-soil-tinted-vertices={build.soilSurface.diagnostics.tintedTerrainVertexCount}
      data-tree-lab-soil-unique-tints={build.soilSurface.diagnostics.uniqueTintCount}
      data-tree-lab-soil-tint-budget={build.soilSurface.diagnostics.tintBudget}
      data-tree-lab-soil-tint-budget-exceeded={String(build.soilSurface.diagnostics.tintBudgetExceeded)}
      data-tree-lab-soil-quantization={build.soilSurface.diagnostics.quantizationSteps}
      data-tree-lab-soil-radial-bands={build.soilSurface.diagnostics.radialTintBands}
      data-tree-lab-soil-variation-bands={build.soilSurface.diagnostics.variationTintBands}
      data-tree-lab-soil-prefix-preserved={String(build.soilSurface.diagnostics.prefixWhitePreserved)}
      data-tree-lab-soil-terrain-range-preserved={String(build.soilSurface.diagnostics.terrainRangePreserved)}
      data-tree-lab-soil-material-count={build.soilSurface.diagnostics.materialCount}
      data-tree-lab-soil-extra-draw-calls={build.soilSurface.diagnostics.estimatedAdditionalDrawCalls}
      data-tree-lab-soil-extra-materials={build.soilSurface.diagnostics.estimatedAdditionalMaterials}
      data-tree-lab-bark-surface="true"
      data-tree-lab-bark-surface-id={build.barkSurface.descriptor.id}
      data-tree-lab-bark-tint-attribute={build.barkSurface.descriptor.tintAttributeId}
      data-tree-lab-bark-roughness-attribute={build.barkSurface.descriptor.roughnessAttributeId}
      data-tree-lab-bark-signature={build.barkSurface.signature}
      data-tree-lab-bark-branch-vertices={build.barkSurface.diagnostics.branchVertexCount}
      data-tree-lab-bark-static-vertices={build.barkSurface.diagnostics.staticVertexCount}
      data-tree-lab-bark-static-bark-vertices={build.barkSurface.diagnostics.staticBarkVertexCount}
      data-tree-lab-bark-terrain-vertices={build.barkSurface.diagnostics.preservedTerrainVertexCount}
      data-tree-lab-bark-tinted-branch-vertices={build.barkSurface.diagnostics.tintedBranchVertexCount}
      data-tree-lab-bark-tinted-static-vertices={build.barkSurface.diagnostics.tintedStaticBarkVertexCount}
      data-tree-lab-bark-ranges={build.barkSurface.diagnostics.branchRangeCount}
      data-tree-lab-bark-trunk-vertices={build.barkSurface.diagnostics.trunkVertexCount}
      data-tree-lab-bark-generated-vertices={build.barkSurface.diagnostics.generatedBranchVertexCount}
      data-tree-lab-bark-max-generation={build.barkSurface.diagnostics.maximumGeneration}
      data-tree-lab-bark-unique-tints={build.barkSurface.diagnostics.uniqueTintCount}
      data-tree-lab-bark-tint-budget={build.barkSurface.diagnostics.tintBudget}
      data-tree-lab-bark-tint-budget-exceeded={String(build.barkSurface.diagnostics.tintBudgetExceeded)}
      data-tree-lab-bark-quantization={build.barkSurface.diagnostics.quantizationSteps}
      data-tree-lab-bark-tone-bands={build.barkSurface.diagnostics.toneBands}
      data-tree-lab-bark-roughness-bands={build.barkSurface.diagnostics.roughnessBands}
      data-tree-lab-bark-roughness-min={build.barkSurface.diagnostics.minimumRoughnessCharacter}
      data-tree-lab-bark-roughness-max={build.barkSurface.diagnostics.maximumRoughnessCharacter}
      data-tree-lab-bark-geometry-preserved={String(build.barkSurface.diagnostics.geometryPreserved)}
      data-tree-lab-bark-ranges-preserved={String(build.barkSurface.diagnostics.branchRangesPreserved)}
      data-tree-lab-bark-soil-preserved={String(build.barkSurface.diagnostics.soilTerrainTintPreserved)}
      data-tree-lab-bark-extra-draw-calls={build.barkSurface.diagnostics.estimatedAdditionalDrawCalls}
      data-tree-lab-bark-extra-materials={build.barkSurface.diagnostics.estimatedAdditionalMaterials}
      data-tree-lab-ground-detail="true"
      data-tree-lab-ground-detail-id={build.groundDetails.descriptor.id}
      data-tree-lab-ground-detail-template-id={build.groundDetails.descriptor.templateId}
      data-tree-lab-ground-detail-material-id={build.groundDetails.descriptor.materialId}
      data-tree-lab-ground-detail-signature={build.groundDetails.signature}
      data-tree-lab-ground-detail-candidates={build.groundDetails.diagnostics.candidateInstanceCount}
      data-tree-lab-ground-detail-instances={build.groundDetails.diagnostics.emittedInstanceCount}
      data-tree-lab-ground-detail-stones={build.groundDetails.diagnostics.stoneCount}
      data-tree-lab-ground-detail-fallen-leaves={build.groundDetails.diagnostics.fallenLeafCount}
      data-tree-lab-ground-detail-moss={build.groundDetails.diagnostics.mossCount}
      data-tree-lab-ground-detail-budget={build.groundDetails.diagnostics.instanceBudget}
      data-tree-lab-ground-detail-stone-budget={build.groundDetails.diagnostics.stoneBudget}
      data-tree-lab-ground-detail-leaf-budget={build.groundDetails.diagnostics.fallenLeafBudget}
      data-tree-lab-ground-detail-moss-budget={build.groundDetails.diagnostics.mossBudget}
      data-tree-lab-ground-detail-budget-exceeded={String(build.groundDetails.diagnostics.instanceBudgetExceeded)}
      data-tree-lab-ground-detail-truncated={build.groundDetails.diagnostics.truncatedInstanceIds.length}
      data-tree-lab-ground-detail-shared-vertices={build.groundDetails.diagnostics.sharedVertexCount}
      data-tree-lab-ground-detail-shared-triangles={build.groundDetails.diagnostics.sharedTriangleCount}
      data-tree-lab-ground-detail-rendered-triangles={build.groundDetails.diagnostics.renderedTriangleCount}
      data-tree-lab-ground-detail-draw-calls={build.groundDetails.diagnostics.estimatedDrawCalls}
      data-tree-lab-ground-detail-extra-materials={build.groundDetails.diagnostics.estimatedAdditionalMaterials}
      data-tree-lab-ground-detail-total-materials={build.groundDetails.diagnostics.totalMaterialCount}
      data-tree-lab-ground-detail-anchored={String(build.groundDetails.diagnostics.anchoredToTerrain)}
      data-tree-lab-ground-detail-prefix={String(build.groundDetails.diagnostics.stablePrefixPreserved)}
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
      data-tree-lab-canopy-depth="true"
      data-tree-lab-canopy-depth-id={build.canopyDepth.descriptor.id}
      data-tree-lab-canopy-profile-id={build.canopyDepth.descriptor.profileId}
      data-tree-lab-canopy-tint-attribute={build.canopyDepth.descriptor.tintAttributeId}
      data-tree-lab-canopy-signature={build.canopyDepth.signature}
      data-tree-lab-canopy-profiles={build.canopyDepth.diagnostics.emittedProfileCount}
      data-tree-lab-canopy-inner={build.canopyDepth.diagnostics.innerLeafCount}
      data-tree-lab-canopy-middle={build.canopyDepth.diagnostics.middleLeafCount}
      data-tree-lab-canopy-outer={build.canopyDepth.diagnostics.outerLeafCount}
      data-tree-lab-canopy-cells={build.canopyDepth.diagnostics.occupiedCellCount}
      data-tree-lab-canopy-cells-preserved={String(build.canopyDepth.diagnostics.preservedOccupiedCellIds)}
      data-tree-lab-canopy-empty-cells-filled={String(build.canopyDepth.diagnostics.filledPreviouslyEmptyCells)}
      data-tree-lab-canopy-order-preserved={String(build.canopyDepth.diagnostics.stableLeafOrderPreserved)}
      data-tree-lab-canopy-instances-preserved={String(build.canopyDepth.diagnostics.instanceCountPreserved)}
      data-tree-lab-canopy-scale-min={build.canopyDepth.diagnostics.minimumScaleMultiplier}
      data-tree-lab-canopy-scale-max={build.canopyDepth.diagnostics.maximumScaleMultiplier}
      data-tree-lab-canopy-max-offset={build.canopyDepth.diagnostics.maximumPositionOffset}
      data-tree-lab-canopy-max-offset-ratio={build.canopyDepth.diagnostics.maximumPositionOffsetRatio}
      data-tree-lab-canopy-unique-tints={build.canopyDepth.diagnostics.uniqueTintCount}
      data-tree-lab-canopy-tint-budget={build.canopyDepth.diagnostics.tintBudget}
      data-tree-lab-canopy-tint-budget-exceeded={String(build.canopyDepth.diagnostics.tintBudgetExceeded)}
      data-tree-lab-canopy-quantization={build.canopyDepth.diagnostics.quantizationSteps}
      data-tree-lab-canopy-extra-draw-calls={build.canopyDepth.diagnostics.estimatedAdditionalDrawCalls}
      data-tree-lab-canopy-extra-materials={build.canopyDepth.diagnostics.estimatedAdditionalMaterials}
      data-tree-lab-canopy-extra-matrix-updates={build.canopyDepth.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame}
      data-tree-lab-canopy-light="true"
      data-tree-lab-canopy-light-id={build.canopyLight.descriptor.id}
      data-tree-lab-canopy-light-profile-id={build.canopyLight.descriptor.profileId}
      data-tree-lab-canopy-light-tint-attribute={build.canopyLight.descriptor.tintAttributeId}
      data-tree-lab-canopy-light-signature={build.canopyLight.signature}
      data-tree-lab-canopy-light-direction-x={build.canopyLight.lightDirection.x}
      data-tree-lab-canopy-light-direction-y={build.canopyLight.lightDirection.y}
      data-tree-lab-canopy-light-direction-z={build.canopyLight.lightDirection.z}
      data-tree-lab-canopy-light-profiles={build.canopyLight.diagnostics.emittedProfileCount}
      data-tree-lab-canopy-light-shade={build.canopyLight.diagnostics.shadeLeafCount}
      data-tree-lab-canopy-light-transition={build.canopyLight.diagnostics.transitionLeafCount}
      data-tree-lab-canopy-light-sunlit={build.canopyLight.diagnostics.sunlitLeafCount}
      data-tree-lab-canopy-light-exposure-min={build.canopyLight.diagnostics.minimumExposure}
      data-tree-lab-canopy-light-exposure-max={build.canopyLight.diagnostics.maximumExposure}
      data-tree-lab-canopy-light-exposure-average={build.canopyLight.diagnostics.averageExposure}
      data-tree-lab-canopy-light-exposure-bands={build.canopyLight.diagnostics.exposureBands}
      data-tree-lab-canopy-light-unique-tints={build.canopyLight.diagnostics.uniqueCombinedTintCount}
      data-tree-lab-canopy-light-tint-budget={build.canopyLight.diagnostics.combinedTintBudget}
      data-tree-lab-canopy-light-tint-budget-exceeded={String(build.canopyLight.diagnostics.combinedTintBudgetExceeded)}
      data-tree-lab-canopy-light-quantization={build.canopyLight.diagnostics.quantizationSteps}
      data-tree-lab-canopy-light-direction-normalized={String(build.canopyLight.diagnostics.lightDirectionNormalized)}
      data-tree-lab-canopy-light-order-preserved={String(build.canopyLight.diagnostics.canopyProfileOrderPreserved)}
      data-tree-lab-canopy-light-instances-preserved={String(build.canopyLight.diagnostics.instanceCountPreserved)}
      data-tree-lab-canopy-light-cells-preserved={String(build.canopyLight.diagnostics.crownCellProvenancePreserved)}
      data-tree-lab-canopy-light-extra-draw-calls={build.canopyLight.diagnostics.estimatedAdditionalDrawCalls}
      data-tree-lab-canopy-light-extra-materials={build.canopyLight.diagnostics.estimatedAdditionalMaterials}
      data-tree-lab-canopy-light-extra-matrix-updates={build.canopyLight.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame}
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
        <directionalLight
          position={[
            build.canopyLight.lightDirection.x * 8,
            build.canopyLight.lightDirection.y * 8,
            build.canopyLight.lightDirection.z * 8,
          ]}
          intensity={1.25}
        />
        <directionalLight position={[-4, 3, -2]} intensity={0.45} />
        <TreeLabObject
          mesh={build.mesh}
          rootGeometry={build.rootGeometry}
          soilSurface={build.soilSurface}
          barkSurface={build.barkSurface}
          canopyDepth={build.canopyDepth}
          canopyLight={build.canopyLight}
          groundDetails={build.groundDetails}
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
