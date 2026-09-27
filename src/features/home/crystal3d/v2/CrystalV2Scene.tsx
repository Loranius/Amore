import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalRenderScale } from '@/engine/renderer';
import { hash32 } from '@/engine/species/crystalV2/hash';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorldPose } from '@/features/world/useWorldPose';
import { useWorldMotionMode } from '@/features/world/useWorldMotionMode';
import { useWorldFrameloop } from '@/features/world/useImmersiveRoute';
import { MODULE_SPIN_RATE } from '@/features/world/sceneDirector';
import { useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import { useGrowthSinceLastVisit } from '@/features/home/useGrowthSinceLastVisit';
import { useWorldGrowthReporter } from '@/features/world/growthChannel';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { PortalStage } from '../scene/PortalStage';
import {
  PORTAL_ENVIRONMENT_DRAW_CALLS,
  PORTAL_ENVIRONMENT_TRIANGLES,
} from '../scene/portalScene';
import { EvolutionRuntimeProbe, type EvolutionRuntimeMetrics } from '../evolution/EvolutionRuntimeProbe';
import { readQuality } from '../evolution/useEvolutionCrystalPipeline';
import { CrystalV2Object } from './CrystalV2Object';
import { crystalV2Frame, crystalV2GrowthEvents } from './crystalV2Frame';
import { useCrystalV2 } from './useCrystalV2';
import '../evolution/evolutionPreview.css';

// Шлях відкату (ADR-0217): старий конвеєр Evolution лишився в коді цілим і
// вантажиться лише тоді, коли v2 не змогла зібратись. Лінивий, щоб його
// шість томів не лягали в чанк головної заради гілки, куди майже не ходять.
const EvolutionCrystalPreviewScene = lazy(() => import('../evolution/EvolutionCrystalPreviewScene'));

/**
 * Кристал v2 у порталі: той самий острів, небо, камера й жести
 * (`PortalStage`), а на ньому — колонія, яку рахує одна модель.
 */
export default function CrystalV2Scene() {
  const { theme } = useTheme();
  const { freeCameraActive } = useEvolutionSandbox();
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [quality] = useState(readQuality);
  const { state, isPending, error } = useCrystalV2();
  const { pose, region } = useWorldPose();
  const motionMode = useWorldMotionMode();
  // Гаки — до ранніх виходів нижче: інакше React ловить різну кількість
  // гаків між рендерами (див. той самий коментар у старій сцені).
  const frameloop = useWorldFrameloop();
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setRuntime(next), []);

  const snapshot = state?.snapshot;
  const growthEvents = useMemo(() => (snapshot ? crystalV2GrowthEvents(snapshot) : null), [snapshot]);
  const growth = useGrowthSinceLastVisit(growthEvents, 'crystal');
  const reportGrowth = useWorldGrowthReporter();
  useEffect(() => {
    reportGrowth(growth === null ? null : { species: 'crystal', summary: growth });
    return () => reportGrowth(null);
  }, [growth, reportGrowth]);

  const geometry = state?.geometry;
  const frame = useMemo(() => (geometry ? crystalV2Frame(geometry) : null), [geometry]);
  const noBearings = useMemo<readonly number[]>(() => [], []);

  if (error) {
    console.error('[Crystal v2] rollback to the Evolution pipeline:', error);
    return (
      <Suspense fallback={<CrystalPlaceholder />}>
        <EvolutionCrystalPreviewScene />
      </Suspense>
    );
  }
  if (isPending || !state || !frame) return <CrystalPlaceholder />;

  const { model } = state;
  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-evolution-preview="ready"
      data-evolution-renderer="crystal-v2"
      data-evolution-quality={quality}
      data-evolution-bodies={1 + model.children.length}
      data-evolution-meshes={state.geometry.sparks.length > 0 ? 3 : 2}
      data-evolution-triangles={state.geometry.crystals.triangles + state.geometry.rocks.triangles}
      data-evolution-runtime={runtime ? 'ready' : 'warming'}
      data-evolution-draw-calls={runtime?.drawCalls ?? ''}
      data-evolution-composition={runtime?.composition ?? ''}
      data-evolution-rendered-triangles={runtime?.triangles ?? ''}
      data-portal-environment-draw-calls={PORTAL_ENVIRONMENT_DRAW_CALLS}
      data-portal-environment-triangles={PORTAL_ENVIRONMENT_TRIANGLES}
      data-crystal-version={model.version}
      data-crystal-years={model.years}
      data-crystal-children={model.children.length}
      data-crystal-hue={model.colour.hue}
      data-crystal-channel={model.colour.channel ?? 'own'}
    >
      <Canvas
        frameloop={frameloop}
        dpr={[1, crystalRenderScale(quality, typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
        camera={{ position: [0, 0.685, 7.1], fov: 42 }}
        gl={{ alpha: true, antialias: quality !== 'fallback' }}
      >
        <PortalStage
          seed={hash32(model.startDate)}
          theme={theme}
          quality={quality}
          reduceMotion={reduceMotion}
          artifactSceneRadius={frame.reach}
          crystalsSceneRadius={frame.reach}
          artifactSceneHeight={frame.height}
          veinBearings={noBearings}
          veinReach={frame.geodeRadius}
          pose={pose}
          spin={region === 'centre' ? 0 : MODULE_SPIN_RATE}
          allowOrbit={region === 'centre'}
          freeCamera={freeCameraActive}
          motionMode={motionMode}
        >
          <CrystalV2Object
            model={model}
            geometry={state.geometry}
            scale={frame.scale}
            theme={theme}
            reduceMotion={reduceMotion}
          />
        </PortalStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
      </Canvas>
    </div>
  );
}
