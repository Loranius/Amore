import { Canvas } from '@react-three/fiber';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import { ReefCoreObject } from './ReefCoreObject';
import { ReefCoreStage } from './ReefCoreStage';
import { useReefPortalPreview } from './useReefPortalPreview';
import './reefWorld.css';

/** Portal-facing Phase 1 scene: deterministic chronological core only. */
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
          <p>{portal.error?.message ?? 'Reef Core is unavailable.'}</p>
        </div>
      </div>
    );
  }

  const { core, asOf } = portal.preview;
  const horizontalExtent = Math.max(core.platform.radiusX, core.platform.radiusZ);
  const cameraDistance = Math.max(6.6, horizontalExtent * 2.15, core.dimensions.height * 1.4);
  const cameraHeight = Math.max(2.7, core.dimensions.height * 0.58);

  return (
    <div
      className="crystal-wrap evolution-preview-wrap reef-world-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-reef-source="portal"
      data-reef-scene="phase-1-core"
      data-reef-phase="1"
      data-reef-core-version={core.version}
      data-reef-couple-id={core.identity.coupleId}
      data-reef-as-of={asOf}
      data-reef-seed={core.identity.reefSeed}
      data-reef-core-seed={core.identity.coreSeed}
      data-reef-platform-seed={core.identity.platformSeed}
      data-reef-identity-signature={core.identity.identitySignature}
      data-reef-core-signature={core.signature}
      data-reef-days-together={core.age.daysTogether}
      data-reef-completed-years={core.age.completedYears}
      data-reef-max-years={core.age.maxYears}
      data-reef-progress={core.age.progress}
      data-reef-growth={core.age.growth}
      data-reef-core-radius-x={core.dimensions.radiusX}
      data-reef-core-radius-z={core.dimensions.radiusZ}
      data-reef-core-height={core.dimensions.height}
      data-reef-foundation-radius={Math.max(core.platform.radiusX, core.platform.radiusZ)}
      data-reef-platform-radius-x={core.platform.radiusX}
      data-reef-platform-radius-z={core.platform.radiusZ}
      data-reef-year-arches={0}
      data-reef-map-outcrops={0}
      data-reef-schedule-terraces={0}
      data-reef-plan-fish-logical={0}
      data-reef-plan-fish-visible={0}
      data-reef-wish-corals={0}
      data-reef-photo-corals={0}
      data-reef-media-corals={0}
      data-reef-calendar-landmarks={0}
      data-reef-normalized-events={0}
      data-reef-colonies={0}
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
          far: Math.max(80, cameraDistance * 8),
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ReefCoreStage core={core}>
          <ReefCoreObject core={core} />
        </ReefCoreStage>
      </Canvas>
    </div>
  );
}
