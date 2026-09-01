// ============================================================
// Дерево в сцені порталу — окремим модулем.
// ------------------------------------------------------------
// Винесено з `EvolutionTreePreviewScene.tsx` не заради охайності: той
// файл імпортує `useTreeLabPortalPreview`, а той — клієнт Supabase.
// Лабораторії дерева потрібна САМЕ ця розкладка й нічого більше; поки
// вона жила поруч із мережевим гаком, сторінка падала на «Немає
// VITE_SUPABASE_URL» ще до першого кадру.
//
// Третій такий випадок у проєкті після `coupleEngine.ts` і
// `crystalPipeline.ts`: чисте показове не має тягнути за собою мережу.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalRenderScale } from '@/engine/renderer';
import { fitThreeTree, measureThreeTreeReach } from '@/engine/renderer/three';
import { useWorldPose } from '@/features/world/useWorldPose';
import { useWorldMotionMode } from '@/features/world/useWorldMotionMode';
import { useWorldFrameloop } from '@/features/world/useImmersiveRoute';
import { TreeTexturedStage } from '../treeScene/TreeTexturedStage';
import { TreeLifeDetailsPolished } from '../treeScene/TreeLifeDetailsPolished';
import { TreeLabObject } from '../treeLab/TreeLabObject';
import type { TreeLabPreviewBuild } from '../treeLab/buildTreeLabPreview';
import { EvolutionRuntimeProbe, type EvolutionRuntimeMetrics } from './EvolutionRuntimeProbe';
// Розкладка полотна їхала з `EvolutionTreePreviewScene`; тепер вона тут,
// бо саме тут стоїть `.evolution-preview-wrap`.
import './evolutionPreview.css';

/** Експортовано заради лабораторії: вимір має йти по ТОМУ САМОМУ дереву. */
export function TreeInWorld({ build, theme }: { build: TreeLabPreviewBuild; theme: 'light' | 'dark' }) {
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setRuntime(next), []);
  const { pose } = useWorldPose();
  const motionMode = useWorldMotionMode();
  const fit = useMemo(
    () => fitThreeTree(measureThreeTreeReach({
      mesh: build.mesh,
      rootGeometry: build.rootGeometry,
      leaves: build.leaves,
      canopyDepth: build.canopyDepth,
      crownSilhouette: build.crownSilhouette,
      groundDetails: build.groundDetails,
    })),
    [build],
  );
  const hillRadius = useMemo(
    () => Math.max(8, fit.soilRadius * 4.2, fit.crownRadius * 3.8),
    [fit.soilRadius, fit.crownRadius],
  );

  /*
   * Кадри — лише коли сцену видно.
   *
   * Це полотно живе на КОЖНОМУ маршруті модуля й малює кадри без упину,
   * навіть коли поверх нього непрозорий повний екран — карта спогадів або
   * «Наш шлях». Дві сцени одночасно на телефоні — подвійний рахунок за
   * батарею за одну картинку.
   *
   * Сусідні полотна (`CrystalScene`, `ReefPreviewScene`) цей гак уже
   * поважають; ці два — ні, і це був недогляд. Пауза не звільняє контекст
   * WebGL: повернення на звичайний екран вмикає кадри тим самим станом,
   * без перезбирання (ADR-0020).
   */
  const frameloop = useWorldFrameloop();

  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-evolution-preview="ready"
      data-evolution-renderer="three"
      data-evolution-species="tree"
      data-tree-scene="outdoor-textured"
      data-evolution-draw-calls={runtime?.drawCalls ?? ''}
      data-evolution-rendered-triangles={runtime?.triangles ?? ''}
    >
      <Canvas
        frameloop={frameloop}
        dpr={[1, crystalRenderScale('balanced', typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
        camera={{ position: [0, 0.9, 7.1], fov: 42 }}
        gl={{ alpha: false, antialias: true }}
      >
        <TreeTexturedStage
          theme={theme}
          reduceMotion={reduceMotion}
          soilRadius={fit.soilRadius}
          crownRadius={fit.crownRadius}
          treeHeight={fit.height}
          groundY={fit.groundY}
          pose={pose}
          motionMode={motionMode}
        >
          <TreeLifeDetailsPolished
            theme={theme}
            hillRadius={hillRadius}
            soilRadius={fit.soilRadius}
            groundY={fit.groundY}
            reducedMotion={reduceMotion}
          />
          <group position={[0, fit.groundY, 0]} scale={fit.scale}>
            <TreeLabObject
              mesh={build.mesh}
              rootGeometry={build.rootGeometry}
              soilSurface={build.soilSurface}
              barkSurface={build.barkSurface}
              canopyDepth={build.canopyDepth}
              canopyLight={build.canopyLight}
              phenology={build.phenology}
              leafOrientation={build.leafOrientation}
              crownSilhouette={build.crownSilhouette}
              groundDetails={build.groundDetails}
              leaves={build.leaves}
              materials={build.materials}
              life={build.life}
              reducedMotion={reduceMotion}
              showGroundDetails={false}
            />
          </group>
        </TreeTexturedStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
      </Canvas>
    </div>
  );
}
