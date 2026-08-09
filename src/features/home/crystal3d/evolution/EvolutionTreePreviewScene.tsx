// ============================================================
// EvolutionTreePreviewScene — дерево в порталі, а не в рамці.
// ------------------------------------------------------------
// Дерево досі жило в TreeLabPreviewScene — власному вікні з бейджами
// бюджету, окремою орбітою і власним фоном. Це була лабораторія, і як
// лабораторія вона чесна: там видно кількість трикутників, статус
// приймального тесту й джерело даних. Але власник дивиться не на
// лабораторію, а на портал, і дерево там мусить стояти в тій самій залі,
// що й кристал, — на тому ж камені, під тією ж колонадою, у тому ж
// освітленні.
//
// Тож сцена тут рівно та сама, що в кристала: `PortalStage` з усім, що в
// ньому, і артефакт усередині. Різниця лише в тому, який артефакт.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalRenderScale } from '@/engine/renderer';
import { fitThreeTree, measureThreeTreeReach } from '@/engine/renderer/three';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { PortalStage } from '../scene/PortalStage';
import { EvolutionRuntimeProbe, type EvolutionRuntimeMetrics } from './EvolutionRuntimeProbe';
import { TreeLabObject } from '../treeLab/TreeLabObject';
import { resolveTreeLabLod } from '../treeLab/featureFlag';
import { useTreeLabPortalPreview } from '../treeLab/useTreeLabPortalPreview';
import type { TreeLabPreviewBuild } from '../treeLab/buildTreeLabPreview';

function TreeInPortal({ build, theme }: { build: TreeLabPreviewBuild; theme: 'light' | 'dark' }) {
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setRuntime(next), []);
  // Дерево приходить у власних одиницях рушія — вищим за всю сцену й з
  // підошвою на нулі, а не на підлозі порталу. Кристал ту саму різницю
  // прибирає підгонкою в bundle.ts; тут та сама підгонка, у той самий кадр.
  const fit = useMemo(
    () => fitThreeTree(measureThreeTreeReach({
      mesh: build.mesh,
      rootGeometry: build.rootGeometry,
      leaves: build.leaves,
      // Крону міряємо тим самим, чим її малює InstancedMesh: силует і глибина
      // крони перевидають і позицію листка, і його масштаб.
      canopyDepth: build.canopyDepth,
      crownSilhouette: build.crownSilhouette,
      groundDetails: build.groundDetails,
    })),
    [build],
  );

  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-evolution-preview="ready"
      data-evolution-renderer="three"
      data-evolution-species="tree"
      data-evolution-draw-calls={runtime?.drawCalls ?? ''}
      data-evolution-rendered-triangles={runtime?.triangles ?? ''}
    >
      <Canvas
        dpr={[1, crystalRenderScale('balanced', typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
        camera={{ position: [0, 0.685, 7.1], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
      >
        <PortalStage
          seed={build.seed}
          theme={theme}
          quality="balanced"
          reduceMotion={reduceMotion}
          // Подіум накриває ґрунт, камера кадрує крону — два різні радіуси з
          // тієї ж причини, що й у кристала (камінь проти самих кристалів).
          artifactSceneRadius={fit.soilRadius}
          crystalsSceneRadius={fit.crownRadius}
          artifactSceneHeight={fit.height}
          // Кварцової жили в дерева немає — камінь платформи не вигинається
          // ні над чим, і це не заглушка: вигин публікує субстрат кристала, а
          // в дерева субстрат інший.
          veinBearings={[]}
          veinReach={0}
        >
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
            />
          </group>
        </PortalStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
      </Canvas>
    </div>
  );
}

export default function EvolutionTreePreviewScene({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  const lod = useMemo(
    () => resolveTreeLabLod(typeof window === 'undefined' ? '' : window.location.search),
    [],
  );
  const { preview, isPending, error } = useTreeLabPortalPreview(lod);

  if (isPending) return <CrystalPlaceholder />;
  if (error || !preview) return <CrystalPlaceholder />;
  return <TreeInPortal build={preview.build} theme={theme} />;
}
