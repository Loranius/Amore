import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalVeinBearings } from '@/engine/geometry';
import { crystalRenderScale } from '@/engine/renderer';
import {
  crystalSceneHeight,
  crystalSceneRadius,
  crystalSubstrateSceneRadius,
} from '@/engine/renderer/three';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorldPose } from '@/features/world/useWorldPose';
import { useWorldMotionMode } from '@/features/world/useWorldMotionMode';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import { wishCrystalCost, type WishSubject } from '../scene/wishCrystals';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { PortalStage } from '../scene/PortalStage';
import {
  PORTAL_ENVIRONMENT_DRAW_CALLS,
  PORTAL_ENVIRONMENT_TRIANGLES,
} from '../scene/portalScene';
import { EvolutionCrystalObject } from './EvolutionCrystalObject';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from './EvolutionRuntimeProbe';
import { isEvolutionDiagnosticsEnabled } from './featureFlag';
import { useEvolutionCrystalPipeline } from './useEvolutionCrystalPipeline';
import './evolutionPreview.css';

// Аварійний шлях, і вантажиться він теж аварійно. Статичний імпорт зшивав
// увесь старий рендерер — власний конвеєр кластерів, батчинг, публікацію,
// bloom — у той самий чанк, що й головна: приблизно сотня кілобайт, яку
// платить кожен, хто просто відкрив портал, заради гілки, у яку майже ніхто
// ніколи не заходить.
const LegacyCrystalScene = lazy(() => import('../CrystalScene'));

function formatTopology(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

/** Стала порожнеча: `?? []` створювала б новий масив щорендера, а на ньому
 *  висить перебудова матеріалів дошки бажань. */
const NO_WISHES: readonly WishSubject[] = [];

export default function EvolutionCrystalPreviewScene() {
  // Build metrics are a development instrument. They were rendering over the
  // artifact in production, which is both noise on the portal's one hero
  // surface and an internal detail (body counts, draw calls, build time) that
  // means nothing to a couple looking at their crystal.
  const [diagnosticsVisible] = useState(isEvolutionDiagnosticsEnabled);
  const { theme } = useTheme();
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const { pipeline, isPending, error } = useEvolutionCrystalPipeline(reduceMotion);
  // Обидва — ЗЗОВНІ полотна. Всередині <Canvas> живе окремий корінь React, і
  // зміна маршруту не перемальовує його сама; тут же зміна маршруту
  // перемальовує цей компонент, а з ним і дітей полотна. Див. коментар до
  // `PortalStageProps.pose`.
  const { pose } = useWorldPose();
  const motionMode = useWorldMotionMode();
  // Бажання приходять від самого модуля, а не з окремого запиту: він знає,
  // яка вкладка відкрита й що в ній видно, і повторювати цю логіку в сцені
  // означало б мати дві відповіді на одне питання.
  const { wishBoard } = useArtifactWorld();
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  // Напрямки гілок кварцової жили. Меми в сцені тримаються за цей масив, тож
  // він мусить бути стабільним посиланням — інакше камінь платформи
  // перебудовувався б щокадру.
  const meshes = pipeline?.geometry.meshes;
  const veinBearings = useMemo(() => crystalVeinBearings(meshes ?? []), [meshes]);

  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => {
    setRuntime(next);
  }, []);

  if (error) {
    console.error('[Evolution crystal preview] fallback to legacy renderer:', error);
    return (
      <div className="evolution-preview-fallback">
        <Suspense fallback={<CrystalPlaceholder />}>
          <LegacyCrystalScene />
        </Suspense>
        <span className="evolution-preview-badge evolution-preview-badge--error">
          Evolution fallback
        </span>
      </div>
    );
  }

  if (isPending || !pipeline) return <CrystalPlaceholder />;

  const metrics = pipeline.metrics;
  // Ціна хмари бажань публікується окремо — так само, як ціна оточення.
  // Бюджет артефакта має лишатись про артефакт: донька, позичена дванадцять
  // разів, у топології порахована один раз.
  const wishCost = wishCrystalCost(
    pipeline.geometry,
    wishBoard?.wishes ?? NO_WISHES,
    metrics.quality,
    pose.azimuth,
  );
  // The reliquary replaces the old quartz ground mesh visually. Size it from
  // the crystals that remain visible, otherwise the hidden vein still inflates
  // the bronze disc until its rim fills the phone viewport.
  const visibleCrystalRadius = crystalSceneRadius(
    pipeline.geometry,
    { includeSubstrate: false },
  );
  const badge = [
    'Evolution',
    metrics.quality,
    `${metrics.meshCount} тіл`,
    `${formatTopology(metrics.usedTriangles)} △`,
    runtime ? `${runtime.drawCalls} DC` : 'метрики…',
    `${metrics.buildMs.toFixed(1)} ms`,
  ].join(' · ');

  return (
    <>
      <div
        className="crystal-wrap evolution-preview-wrap"
        data-evolution-preview="ready"
        data-evolution-renderer="three"
        data-evolution-quality={metrics.quality}
        data-evolution-bodies={metrics.bodyCount}
        data-evolution-meshes={metrics.meshCount}
        data-evolution-materials={metrics.materialCount}
        data-evolution-vertices={metrics.usedVertices}
        data-evolution-triangles={metrics.usedTriangles}
        data-evolution-build-ms={metrics.buildMs}
        data-evolution-runtime={runtime ? 'ready' : 'warming'}
        data-evolution-draw-calls={runtime?.drawCalls ?? ''}
        data-evolution-rendered-triangles={runtime?.triangles ?? ''}
        data-evolution-wish-crystals={wishCost.instances}
        data-evolution-wish-triangles={wishCost.triangles}
        data-portal-environment-draw-calls={PORTAL_ENVIRONMENT_DRAW_CALLS}
        data-portal-environment-triangles={PORTAL_ENVIRONMENT_TRIANGLES}
      >
        <Canvas
          // Render scale, not optics, is how a dense screen is paid for — see
          // crystalRenderScale. Kept in the engine so the tier and the scale
          // cannot drift apart.
          dpr={[1, crystalRenderScale(metrics.quality, typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
          // Стартова позиція — приблизно кадр для вертикального телефона.
          // Точну дає PortalCameraRig із фактичного аспекту вже на першому
          // кадрі; тут вона потрібна лише щоб цей кадр не почався здалеку.
          camera={{ position: [0, 0.685, 7.1], fov: 42 }}
          gl={{ alpha: true, antialias: metrics.quality !== 'fallback' }}
        >
          <PortalStage
            seed={pipeline.geometry.artifactSeed}
            theme={theme}
            quality={metrics.quality}
            reduceMotion={reduceMotion}
            artifactSceneRadius={visibleCrystalRadius}
            crystalsSceneRadius={visibleCrystalRadius}
            artifactSceneHeight={crystalSceneHeight(pipeline.geometry)}
            veinBearings={veinBearings}
            veinReach={crystalSubstrateSceneRadius(pipeline.geometry)}
            pose={pose}
            motionMode={motionMode}
          >
            <EvolutionCrystalObject
              geometry={pipeline.geometry}
              material={pipeline.material}
              life={pipeline.life}
              substrateVisible={false}
              wishes={wishBoard?.wishes ?? NO_WISHES}
              quality={metrics.quality}
              wishFacing={pose.azimuth}
              reduceMotion={reduceMotion}
              {...(wishBoard ? { onWishSelect: wishBoard.onSelect } : {})}
            />
          </PortalStage>
          <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
        </Canvas>
        {diagnosticsVisible && (
          <span className="evolution-preview-badge" aria-label="Метрики Evolution preview">
            {badge}
          </span>
        )}
        {diagnosticsVisible && pipeline.diagnostics.length > 0 && (
          <span
            className="evolution-preview-diagnostics"
            title={pipeline.diagnostics.map((item) => item.message).join('\n')}
          >
            {pipeline.diagnostics.length} діагн.
          </span>
        )}
      </div>
    </>
  );
}
