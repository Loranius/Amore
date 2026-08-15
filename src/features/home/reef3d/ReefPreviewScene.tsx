import { Canvas } from '@react-three/fiber';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import { ReefCoralColoniesObject } from './ReefCoralColoniesObject';
import { ReefCoreObject } from './ReefCoreObject';
import { ReefCoreStage } from './ReefCoreStage';
import { ReefYearStructuresObject } from './ReefYearStructuresObject';
import { useReefPortalPreview } from './useReefPortalPreview';
import './reefWorld.css';

/** Portal-facing Phase 5 scene: deterministic geology, coral surfaces and baseline colonies. */
export default function ReefPreviewScene() {
  const portal = useReefPortalPreview();

  if (portal.isPending) return <CrystalPlaceholder />;
  if (portal.error || !portal.preview) {
    return (
      <div
        className="home-artifact-preview-fallback reef-world-error"
        data-home-artifact-preview="reef"
        data-reef-preview="error"
        role="status"
      >
        <div>
          <h2>Риф не вдалося побудувати</h2>
          <p>{portal.error?.message ?? 'Reef coral colonization is unavailable.'}</p>
        </div>
      </div>
    );
  }

  const { core, yearStructures, composition, surfaces, colonies, asOf } = portal.preview;
  const coreExtent = Math.max(core.platform.radiusX, core.platform.radiusZ);
  const structureExtent = composition.structures.reduce(
    (maximum, structure) => Math.max(
      maximum,
      Math.hypot(structure.center.x, structure.center.z) + structure.footprintRadius,
    ),
    0,
  );
  const colonyExtent = colonies.colonies.reduce(
    (maximum, colony) => Math.max(
      maximum,
      Math.hypot(colony.position.x, colony.position.z) + colony.radius,
    ),
    0,
  );
  const sceneExtent = Math.max(coreExtent, structureExtent, colonyExtent);
  const cameraDistance = Math.max(6.6, sceneExtent * 1.72, core.dimensions.height * 1.4);
  const cameraHeight = Math.max(2.7, core.dimensions.height * 0.58, sceneExtent * 0.28);
  const counts = yearStructures.diagnostics.archetypeCounts;
  const score = composition.diagnostics.score;
  const surfaceDiagnostics = surfaces.diagnostics;
  const colonyDiagnostics = colonies.diagnostics;
  const coralCounts = colonyDiagnostics.morphotypeCounts;

  return (
    <div
      className="crystal-wrap evolution-preview-wrap reef-world-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-reef-source="portal"
      data-reef-scene="phase-5-coral-colonization"
      data-reef-phase="5"
      data-reef-core-version={core.version}
      data-reef-year-structures-version={yearStructures.version}
      data-reef-composition-version={composition.version}
      data-reef-surface-version={surfaces.version}
      data-reef-colony-version={colonies.version}
      data-reef-couple-id={core.identity.coupleId}
      data-reef-as-of={asOf}
      data-reef-seed={core.identity.reefSeed}
      data-reef-core-seed={core.identity.coreSeed}
      data-reef-platform-seed={core.identity.platformSeed}
      data-reef-identity-signature={core.identity.identitySignature}
      data-reef-core-signature={core.signature}
      data-reef-year-structures-signature={yearStructures.signature}
      data-reef-composition-signature={composition.signature}
      data-reef-surface-signature={surfaces.signature}
      data-reef-colony-signature={colonies.signature}
      data-reef-days-together={core.age.daysTogether}
      data-reef-completed-years={core.age.completedYears}
      data-reef-max-years={core.age.maxYears}
      data-reef-progress={core.age.progress}
      data-reef-growth={core.age.growth}
      data-reef-core-radius-x={core.dimensions.radiusX}
      data-reef-core-radius-z={core.dimensions.radiusZ}
      data-reef-core-height={core.dimensions.height}
      data-reef-foundation-radius={coreExtent}
      data-reef-platform-radius-x={core.platform.radiusX}
      data-reef-platform-radius-z={core.platform.radiusZ}
      data-reef-year-structures={composition.diagnostics.structureCount}
      data-reef-year-boulders={counts.BOULDER}
      data-reef-year-columns={counts.COLUMN}
      data-reef-year-ridges={counts.RIDGE}
      data-reef-year-arches={counts.ARCH}
      data-reef-year-collision-free={composition.diagnostics.collisionFree ? 'true' : 'false'}
      data-reef-water-windows={composition.diagnostics.waterWindowCount}
      data-reef-free-water={composition.diagnostics.freeWaterFraction}
      data-reef-core-visibility={composition.diagnostics.coreVisibility}
      data-reef-composition-adjusted={composition.diagnostics.adjustedStructureCount}
      data-reef-composition-score={score.total}
      data-reef-composition-core-visibility-score={score.coreVisibility}
      data-reef-composition-open-water-score={score.openWater}
      data-reef-composition-height-balance-score={score.heightBalance}
      data-reef-composition-radial-balance-score={score.radialBalance}
      data-reef-composition-silhouette-score={score.silhouette}
      data-reef-composition-collision-score={score.collision}
      data-reef-surface-patches={surfaceDiagnostics.patchCount}
      data-reef-surface-eligible={surfaceDiagnostics.eligiblePatchCount}
      data-reef-surface-rejected-underside={surfaceDiagnostics.rejectedUndersideCount}
      data-reef-surface-core-patches={surfaceDiagnostics.corePatchCount}
      data-reef-surface-platform-patches={surfaceDiagnostics.platformPatchCount}
      data-reef-surface-year-patches={surfaceDiagnostics.yearPatchCount}
      data-reef-surface-average-suitability={surfaceDiagnostics.averageSuitability}
      data-reef-surface-average-eligible-suitability={surfaceDiagnostics.averageEligibleSuitability}
      data-reef-surface-total-capacity={surfaceDiagnostics.totalCapacity}
      data-reef-surface-mobile-bounded={surfaceDiagnostics.boundedForMobile ? 'true' : 'false'}
      data-reef-colonies={colonyDiagnostics.colonyCount}
      data-reef-colony-platform={colonyDiagnostics.platformColonyCount}
      data-reef-colony-yearly={colonyDiagnostics.yearlyColonyCount}
      data-reef-colony-sources={colonyDiagnostics.sourceCount}
      data-reef-colony-skipped-spacing={colonyDiagnostics.skippedBySpacing}
      data-reef-colony-average-vitality={colonyDiagnostics.averageVitality}
      data-reef-colony-mobile-bounded={colonyDiagnostics.boundedForMobile ? 'true' : 'false'}
      data-reef-colony-branching={coralCounts.BRANCHING}
      data-reef-colony-massive={coralCounts.MASSIVE}
      data-reef-colony-plate={coralCounts.PLATE}
      data-reef-colony-encrusting={coralCounts.ENCRUSTING}
      data-reef-colony-draw-groups={4}
      data-reef-map-outcrops={0}
      data-reef-schedule-terraces={0}
      data-reef-plan-fish-logical={0}
      data-reef-plan-fish-visible={0}
      data-reef-wish-corals={0}
      data-reef-photo-corals={0}
      data-reef-media-corals={0}
      data-reef-calendar-landmarks={0}
      data-reef-normalized-events={0}
      data-reef-motion-bindings={0}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="demand"
        camera={{
          position: [cameraDistance * 0.42, cameraHeight, cameraDistance],
          fov: 42,
          near: 0.1,
          far: Math.max(90, cameraDistance * 8),
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ReefCoreStage core={core} sceneExtent={sceneExtent}>
          <ReefCoreObject core={core} />
          <ReefYearStructuresObject core={core} manifest={composition} />
          <ReefCoralColoniesObject manifest={colonies} />
        </ReefCoreStage>
      </Canvas>
    </div>
  );
}
