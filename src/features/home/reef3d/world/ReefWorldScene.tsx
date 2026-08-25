// ============================================================
// Вхід у сцену рифа.
// ------------------------------------------------------------
// Три стани: чекаємо, не вийшло, готово. Нічого більше тут не
// вирішується — план дає гак, геометрію рушій, шари малюють.
//
// ЧОМУ ОЗНАКИ ТІ САМІ, ЩО В КРИСТАЛА. Живий стенд читає зі сцени
// `data-evolution-*` (`scripts/live/portal.mjs`, `readSceneMetrics`).
// Стара сцена рифа публікувала натомість двадцять власних ознак, яких
// стенд не знав, — і будь-яке твердження про риф доводилось робити з
// картинки, тобто на око. Спільний набір означає, що риф міряється тим
// самим приладом, що й кристал.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTheme } from '@/providers/ThemeProvider';
import { crystalRenderScale, resolveCrystalRendererQuality } from '@/engine/renderer';
import type { CrystalMaterialQuality } from '@/engine/material/types';
import { REEF_CAMERA_FOV_DEG } from '@/engine/species/reef/reefStaging';
import { useWorldFrameloop } from '@/features/world/useImmersiveRoute';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from '../../crystal3d/evolution/EvolutionRuntimeProbe';
import { ReefWorld } from './ReefWorld';
import { useReefMeshes } from './useReefMeshes';
import { useReefPlan } from './useReefPlan';

function readQuality(): CrystalMaterialQuality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'fallback';
  const extended = navigator as Navigator & { deviceMemory?: number };
  return resolveCrystalRendererQuality({
    webgl: true,
    webgl2: typeof WebGL2RenderingContext !== 'undefined',
    deviceMemoryGb: typeof extended.deviceMemory === 'number' ? extended.deviceMemory : null,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null,
    devicePixelRatio: window.devicePixelRatio,
  });
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = (): void => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function ReefWorldScene(): React.JSX.Element {
  const { theme } = useTheme();
  const reef = useReefPlan(theme);
  const reduceMotion = useReducedMotion();
  const frameloop = useWorldFrameloop();
  const [quality] = useState(readQuality);
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onMetrics = useCallback((next: EvolutionRuntimeMetrics) => setRuntime(next), []);

  if (reef.isPending) return <CrystalPlaceholder />;
  if (reef.error || !reef.plan) {
    return (
      <div
        className="home-artifact-preview-fallback"
        data-home-artifact-preview="reef"
        data-reef-preview="error"
        role="status"
      >
        <div>
          <h2>Риф не вдалося побудувати</h2>
          <p>{reef.error?.message ?? 'Історію порталу не отримано.'}</p>
        </div>
      </div>
    );
  }

  return <ReefWorldReady
    plan={reef.plan}
    asOf={reef.asOf}
    eventCount={reef.eventCount}
    theme={theme}
    quality={quality}
    frameloop={frameloop}
    reduceMotion={reduceMotion}
    runtime={runtime}
    onMetrics={onMetrics}
  />;
}

/**
 * Готовий риф — окремим компонентом, а не гілкою вище.
 *
 * `useReefMeshes` не можна кликати після раннього повернення: гак,
 * викликаний не на кожному рендері, — це рівно та помилка, яку правило
 * гаків і забороняє. Тому будування мешів живе там, де план уже точно є.
 */
function ReefWorldReady({
  plan, asOf, eventCount, theme, quality, frameloop, reduceMotion, runtime, onMetrics,
}: {
  plan: NonNullable<ReturnType<typeof useReefPlan>['plan']>;
  asOf: string;
  eventCount: number;
  theme: 'light' | 'dark';
  quality: CrystalMaterialQuality;
  frameloop: 'always' | 'never';
  reduceMotion: boolean;
  runtime: EvolutionRuntimeMetrics | null;
  onMetrics: (metrics: EvolutionRuntimeMetrics) => void;
}): React.JSX.Element {
  const meshes = useReefMeshes(plan);

  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-evolution-preview="ready"
      data-evolution-renderer="three"
      data-evolution-quality={quality}
      data-evolution-bodies={meshes.bodyCount}
      data-evolution-meshes={meshes.meshCount}
      data-evolution-materials={meshes.meshCount + 2}
      data-evolution-vertices={meshes.vertices}
      data-evolution-triangles={meshes.triangles}
      data-evolution-runtime={runtime ? 'ready' : 'warming'}
      data-evolution-draw-calls={runtime?.drawCalls ?? ''}
      data-evolution-rendered-triangles={runtime?.triangles ?? ''}
      data-reef-as-of={asOf}
      data-reef-years={plan.colonies.length}
      data-reef-breadth={plan.breadth}
      data-reef-days-together={plan.daysTogether}
      data-reef-events={eventCount}
    >
      <Canvas
        frameloop={frameloop}
        dpr={[1, crystalRenderScale(quality, typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
        // Кут береться з постановки, а не пишеться тут удруге: кадр
        // рахується саме під нього, і два різні числа означали б, що
        // риф уміщається в розрахунку й не вміщається на екрані.
        camera={{ position: [0, 1.2, 4.2], fov: REEF_CAMERA_FOV_DEG }}
        gl={{ alpha: false, antialias: quality !== 'fallback' }}
      >
        <ReefWorld plan={plan} meshes={meshes} theme={theme} reduceMotion={reduceMotion} />
        <EvolutionRuntimeProbe onMetrics={onMetrics} />
      </Canvas>
    </div>
  );
}
