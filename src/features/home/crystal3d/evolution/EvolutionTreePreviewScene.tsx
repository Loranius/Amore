// ============================================================
// EvolutionTreePreviewScene — дерево у власному світі.
// ------------------------------------------------------------
// Production-дерево й далі приходить з того самого Evolution/tree pipeline:
// ті самі персоналізовані гілки, корені, листя, матеріали, сезонність і вітер.
// Змінюється лише renderer environment. Храм кристала сюди більше не
// монтується: дерево має власний пагорб, денне небо та сонячне освітлення.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalRenderScale } from '@/engine/renderer';
import { fitThreeTree, measureThreeTreeReach } from '@/engine/renderer/three';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { TreeTexturedStage } from '../treeScene/TreeTexturedStage';
import { TreeLifeDetailsPolished } from '../treeScene/TreeLifeDetailsPolished';
import { TreeSkyPolish } from '../treeScene/TreeSkyPolish';
import { useWorldPose } from '@/features/world/useWorldPose';
import { useWorldMotionMode } from '@/features/world/useWorldMotionMode';
import { EvolutionRuntimeProbe, type EvolutionRuntimeMetrics } from './EvolutionRuntimeProbe';
import { TreeLabObject } from '../treeLab/TreeLabObject';
import { resolveTreeLabLod } from '../treeLab/featureFlag';
import { useTreeLabPortalPreview } from '../treeLab/useTreeLabPortalPreview';
import type { TreeLabPreviewBuild } from '../treeLab/buildTreeLabPreview';

function TreeInWorld({ build, theme }: { build: TreeLabPreviewBuild; theme: 'light' | 'dark' }) {
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
          <TreeSkyPolish theme={theme} />
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

export default function EvolutionTreePreviewScene({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  const lod = useMemo(
    () => resolveTreeLabLod(typeof window === 'undefined' ? '' : window.location.search),
    [],
  );
  const { preview, isPending, error } = useTreeLabPortalPreview(lod);

  if (isPending) return <CrystalPlaceholder />;
  if (error || !preview) return <CrystalPlaceholder />;
  return <TreeInWorld build={preview.build} theme={theme} />;
}
