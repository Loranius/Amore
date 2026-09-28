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
import { EvolutionRuntimeProbe, type EvolutionRuntimeMetrics } from '../evolution/EvolutionRuntimeProbe';
import { readQuality } from '../evolution/useEvolutionCrystalPipeline';
import { crystalV2GrowthEvents } from '../v2/crystalV2Frame';
import { dioramaFrameHeight, dioramaIslandRadius } from '@/features/home/diorama/dioramaStyle';
import { TreeV2World } from './TreeV2World';
import { treeV2Frame } from './treeV2Frame';
import { useTreeV2 } from './useTreeV2';
import '../evolution/evolutionPreview.css';

// Шлях відкату (ADR-0218): старе дерево лишилось у коді цілим і
// вантажиться лише тоді, коли v2 не змогло зібратись.
const EvolutionTreePreviewScene = lazy(() => import('../evolution/EvolutionTreePreviewScene'));

/**
 * Дерево v2 на власному острові в денному небі (ADR-0222, ADR-0224), на
 * тій самій камері й тих самих жестах порталу, що й кристал.
 */
export default function TreeV2Scene() {
  const { theme } = useTheme();
  const { freeCameraActive } = useEvolutionSandbox();
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [quality] = useState(readQuality);
  const { state, isPending, error } = useTreeV2();
  const { pose, region } = useWorldPose();
  const motionMode = useWorldMotionMode();
  // Гаки — до ранніх виходів (див. той самий коментар у сцені кристала).
  const frameloop = useWorldFrameloop();
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setRuntime(next), []);

  const snapshot = state?.snapshot;
  const growthEvents = useMemo(() => (snapshot ? crystalV2GrowthEvents(snapshot) : null), [snapshot]);
  const growth = useGrowthSinceLastVisit(growthEvents, 'tree');
  const reportGrowth = useWorldGrowthReporter();
  useEffect(() => {
    reportGrowth(growth === null ? null : { species: 'tree', summary: growth });
    return () => reportGrowth(null);
  }, [growth, reportGrowth]);

  const geometry = state?.geometry;
  const frame = useMemo(() => (geometry ? treeV2Frame(geometry) : null), [geometry]);
  const noBearings = useMemo<readonly number[]>(() => [], []);
  // Острів того самого розміру, що в кристала й рифу (ADR-0220).
  const island = frame ? dioramaIslandRadius(frame.reach * 0.9) : 0;

  if (error) {
    console.error('[Tree v2] rollback to the previous tree:', error);
    return (
      <Suspense fallback={<CrystalPlaceholder />}>
        <EvolutionTreePreviewScene theme={theme} />
      </Suspense>
    );
  }
  if (isPending || !state || !frame) return <CrystalPlaceholder />;

  const { model } = state;
  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-evolution-preview="ready"
      data-evolution-renderer="tree-v2"
      data-evolution-species="tree"
      data-evolution-quality={quality}
      data-evolution-runtime={runtime ? 'ready' : 'warming'}
      data-evolution-draw-calls={runtime?.drawCalls ?? ''}
      data-evolution-rendered-triangles={runtime?.triangles ?? ''}
      data-tree-version={model.version}
      data-tree-years={model.years}
      data-tree-height={model.height}
      data-tree-blossoms={model.blossoms.length}
    >
      <Canvas
        frameloop={frameloop}
        dpr={[1, crystalRenderScale(quality, typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
        camera={{ position: [0, 0.685, 7.1], fov: 42, far: 400 }}
        gl={{ alpha: false, antialias: quality !== 'fallback' }}
      >
        <PortalStage
          seed={hash32(model.startDate)}
          theme={theme}
          quality={quality}
          reduceMotion={reduceMotion}
          artifactSceneRadius={Math.max(frame.reach, island * 0.95)}
          crystalsSceneRadius={Math.max(frame.reach, island * 0.95)}
          artifactSceneHeight={dioramaFrameHeight(frame.height)}
          veinBearings={noBearings}
          veinReach={0}
          pose={pose}
          spin={region === 'centre' ? 0 : MODULE_SPIN_RATE}
          allowOrbit={region === 'centre'}
          freeCamera={freeCameraActive}
          motionMode={motionMode}
          world="none"
        >
          <TreeV2World
            seed={model.startDate}
            geometry={state.geometry}
            scale={frame.scale}
            theme={theme}
            reduceMotion={reduceMotion}
            island={island}
          />
        </PortalStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
      </Canvas>
    </div>
  );
}
