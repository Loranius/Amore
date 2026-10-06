// ============================================================
// Лабораторія вулкана на головній — сцена порталу без входу.
// ------------------------------------------------------------
// Головна вимагає сесії Supabase, а пісочниця без ключів її не має; тоді
// сцену не оглянути Three.js DevTools. Тут — ТА САМА сцена: `PortalStage` із
// тими самими пропами камери, що в `VolcanoScene`, і `VolcanoWorld` (не
// `bare`). Відрізняються лише джерела: синтетична пара (`labSnapshot`).
//
//   /volcano-home-lab.html                  — 8 років, темна тема
//   /volcano-home-lab.html?years=2&theme=light
//   /volcano-home-lab.html?still            — без руху (A/B кадрів)
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { buildVolcanoGeometry } from '@/engine/species/volcano/geometry';
import { buildVolcanoModel } from '@/engine/species/volcano/model';
import { hash32 } from '@/engine/species/crystalV2/hash';
import { seasonOf } from '@/engine/species/grammar/season';
import { PortalStage } from '@/features/home/crystal3d/scene/PortalStage';
import { dioramaFrameHeight } from '@/features/home/diorama/dioramaStyle';
import { VolcanoWorld } from '@/features/home/volcano3d/VolcanoWorld';
import { volcanoFrame, volcanoIsland } from '@/features/home/volcano3d/volcanoFrame';
import { labSnapshot } from './labSnapshot';
import '@/index.css';

const NO_BEARINGS: readonly number[] = [];
const PARAMS = new URLSearchParams(window.location.search);
// Тема сторінки — раз, до рендера.
const THEME: 'light' | 'dark' = PARAMS.get('theme') === 'light' ? 'light' : 'dark';
document.documentElement.dataset.theme = THEME;

function Lab() {
  const years = Math.max(0, Number(PARAMS.get('years') ?? 8));
  const fill = Math.max(0, Number(PARAMS.get('fill') ?? 8));
  const still = PARAMS.has('still');
  const built = useMemo(() => {
    const model = buildVolcanoModel(labSnapshot(years, fill));
    const geometry = buildVolcanoGeometry(model);
    const frame = volcanoFrame(geometry);
    return { model, geometry, frame, island: volcanoIsland(frame) };
  }, [years, fill]);
  const { model, geometry, frame, island } = built;
  return (
    <div className="lab-stage" data-evolution-preview="ready" data-evolution-runtime="ready">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.685, 7.1], fov: 42, far: 400 }} gl={{ alpha: false, antialias: true }}>
        <PortalStage
          seed={hash32(model.startDate)}
          theme={THEME}
          quality="high"
          reduceMotion={still}
          artifactSceneRadius={Math.max(frame.reach, island * 0.95)}
          crystalsSceneRadius={Math.max(frame.reach, island * 0.95)}
          artifactSceneHeight={dioramaFrameHeight(frame.height)}
          veinBearings={NO_BEARINGS}
          veinReach={0}
          allowOrbit
          world="none"
        >
          <VolcanoWorld
            seed={model.startDate}
            creatures={model.creatures}
            geometry={geometry}
            scale={frame.scale}
            theme={THEME}
            reduceMotion={still}
            island={island}
            rockRadius={model.baseRadius * frame.scale}
            glow={model.glow}
            streamReach={model.streamReach}
            craterRadius={model.craterRadius}
            fishKinds={model.fishKinds}
            season={seasonOf(model.asOf)}
          />
        </PortalStage>
      </Canvas>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Lab />);
